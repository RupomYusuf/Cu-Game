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
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          // free public TURN relays — needed when both players are behind
          // strict mobile/carrier networks that can't peer directly
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
      },
    };
  }

  // keep the signaling connection alive across phone locks / network switches
  function watchBroker(p) {
    p.on('disconnected', () => {
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

  /* Join a room by code. Retries up to 3 attempts (the host may still be
   * registering, or may be reconnecting after a phone lock). */
  function join(code, onReady, onError) {
    isHost = false;
    destroy();
    const attempt = (n) => {
      peer = new Peer(peerOptions());
      watchBroker(peer);
      peer.on('open', () => {
        const c = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
        bind(c, onReady);
        // give up (for this attempt) if the host id can't be reached
        peer.on('error', err => {
          if (err.type === 'peer-unavailable') {
            if (n < 2) {
              setTimeout(() => {
                try { peer.destroy(); } catch (e) {}
                attempt(n + 1);
              }, 2000);
            } else {
              onError('Room not found — make sure the host\'s page is still open (screen unlocked), then try again.');
            }
          } else if (err.type !== 'peer-unavailable') {
            onError('Connection problem: ' + err.type);
          }
        });
        // safety net: no answer at all
        setTimeout(() => {
          if (!conn && n >= 2) {
            onError('Could not reach the room. Check the code and ask the host to refresh.');
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
