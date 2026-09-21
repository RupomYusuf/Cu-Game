/* ============ Networking (PeerJS) ============
 * Host creates a peer with a fixed id derived from a 4-letter room code.
 * Guest generates a random peer id and dials the host.
 * Only 2 players per room; extra connections are refused.
 *
 * Cross-device notes:
 *  - TURN relays are configured (Open Relay free TURN) because STUN-only
 *    often fails between two mobile networks.
 *  - The signaling connection auto-reconnects (phone lock / network switch),
 *    and the guest retries the join a few times.
 */
const Net = (() => {
  const PREFIX = 'couplesgn-';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L, O (easy to confuse)

  let peer = null;
  let conn = null;
  let isHost = false;

  const msgHandlers = [];    // (data) => void
  const statusHandlers = []; // (status: 'connected'|'disconnected') => void

  function makeCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }

  function peerOptions() {
    return {
      debug: 2,
      // force ONE endpoint for everyone: a host on http://localhost and a
      // guest on https:// must land on the same registry or rooms never meet
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // two free TURN relay providers — strict mobile/carrier networks
          // usually can't connect directly and need one of these
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:standard.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:standard.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:standard.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
        iceCandidatePoolSize: 10,
      },
    };
  }

  // keep the signaling connection alive across phone locks / network switches
  function watchBroker(p) {
    p.on('disconnected', () => {
      emitStatus('broker-lost');
      try { p.reconnect(); } catch (e) {}
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && p.disconnected) {
        try { p.reconnect(); } catch (e) {}
      }
    });
  }

  function emitStatus(s) { statusHandlers.forEach(h => h(s)); }
  function emitMsg(d) { msgHandlers.forEach(h => h(d)); }

  function bind(c, onOpen) {
    c.on('open', () => {
      conn = c;
      if (onOpen) onOpen();
      emitStatus('connected');
    });
    c.on('data', d => emitMsg(d));
    c.on('close', () => {
      conn = null;
      emitStatus('disconnected');
    });
    c.on('error', () => {
      conn = null;
      emitStatus('disconnected');
    });
  }

  function destroy() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    conn = null;
    peer = null;
  }

  /* Host a room. Retries with a new code if the id is taken. */
  function host(onReady, onError) {
    isHost = true;
    destroy();
    const start = (code, attempt) => {
      peer = new Peer(PREFIX + code, peerOptions());
      watchBroker(peer);
      peer.on('open', () => onReady(code));
      peer.on('connection', c => {
        if (conn && conn.open) { try { c.close(); } catch (e) {} return; }
        bind(c);
      });
      peer.on('error', err => {
        if (err.type === 'unavailable-id' && attempt < 5) start(makeCode(), attempt + 1);
        else if (err.type !== 'peer-unavailable') onError(err.type);
      });
    };
    start(makeCode(), 0);
  }

  /* Join a room by code. Retries up to 3 attempts, surfaces broker/network
   * failures immediately (they used to be swallowed, leaving 'Connecting…' forever). */
  function join(code, onReady, onError) {
    isHost = false;
    destroy();
    const attempt = (n) => {
      let settled = false;
      const settle = (msg) => {
        if (settled) return;
        settled = true;
        onError(msg);
      };
      const progress = (msg) => { if (!settled) onError(msg); };
      peer = new Peer(peerOptions());
      watchBroker(peer);
      // registered BEFORE open: broker/network failures must not be swallowed
      peer.on('error', err => {
        if (settled) return;
        if (err.type === 'peer-unavailable') {
          if (n < 2) {
            progress('Connecting… retry ' + (n + 2) + '/3');
            setTimeout(() => {
              if (settled) return;
              try { peer.destroy(); } catch (e) {}
              attempt(n + 1);
            }, 2000);
          } else {
            settle("Room not found — make sure the host's page is still open (screen unlocked), then try again.");
          }
        } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          settle("Can't reach the connection server — check your internet, or try switching between Wi-Fi and mobile data.");
        } else {
          settle('Connection problem: ' + err.type);
        }
      });
      peer.on('open', () => {
        progress('Connecting… final attempt');
        const c = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
        bind(c, onReady);
        // detect the link stage: if the relay also fails, say so clearly
        c.on('iceStateChanged', () => {
          const st = c.peerConnection && c.peerConnection.iceConnectionState;
          if (st === 'failed' && !settled) {
            settle('Found the room, but your two networks refuse the link (even the relay failed). Try: put one device on mobile data, then reconnect.');
          }
        });
        // safety net: nothing at all within 12s of the final attempt
        setTimeout(() => {
          if (!settled && !conn) {
            settle('Could not reach the room. Check the code, ask the host to stay on their page, and try again.');
          }
        }, 12000);
      });
    };
    attempt(0);
  }

  function send(obj) {
    if (conn && conn.open) {
      try { conn.send(obj); } catch (e) {}
    }
  }

  function onMessage(h) { msgHandlers.push(h); }
  function onStatus(h) { statusHandlers.push(h); }

  return {
    host, join, send, onMessage, onStatus,
    get connected() { return !!(conn && conn.open); },
    get isHost() { return isHost; }
  };
})();
