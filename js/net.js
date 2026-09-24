/* ============ Networking (Trystero — dual-strategy WebRTC) ============
 * Reliability model:
 *  - The room is joined on TWO independent discovery networks at once
 *    (Nostr relays + MQTT brokers). Different protocols, different
 *    infrastructure, different blocking profiles. If a network blocks one,
 *    the other still connects the two players.
 *  - Presence-based: the guest waits in the room until the host appears.
 *    "Peer unavailable" is structurally impossible.
 *  - First path to discover a peer wins; data flows only through that path.
 *
 * External API (unchanged for the rest of the app):
 *   host(), join(code), send(obj), onMessage, onStatus, connected, isHost
 */
const Net = (() => {
  const APP_ID = 'games-night-couples-v1';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

  let mods = {};           // strategy key -> trystero module
  let rooms = {};          // strategy key -> room
  let peerRoom = {};       // peerId -> strategy key (first path wins)
  let sendRaw = {};        // strategy key -> send fn
  let connPeerId = null;
  let isHost = false;
  let leaveTimer = null;

  const msgHandlers = [];
  const statusHandlers = [];

  function makeCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }

  function emitStatus(s) { statusHandlers.forEach(h => h(s)); }
  function emitMsg(d) { msgHandlers.forEach(h => h(d)); }

  async function loadModule(strategy) {
    const sources = [
      'https://esm.sh/trystero@0.21.1/' + strategy,
      'https://cdn.jsdelivr.net/npm/trystero@0.21.1/' + strategy + '/+esm',
      'https://esm.sh/trystero/' + strategy,
      'https://cdn.jsdelivr.net/npm/trystero/' + strategy + '/+esm'
    ];
    for (const src of sources) {
      try {
        const m = await import(src);
        if (m && m.joinRoom) return m;
      } catch (e) { /* try next CDN */ }
    }
    return null;
  }

  function closeAll() {
    for (const k in rooms) { try { rooms[k].leave(); } catch (e) {} }
    rooms = {};
    sendRaw = {};
    peerRoom = {};
    connPeerId = null;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  }

  function onPeerJoinFor(key, pid, onReady, code) {
    if (peerRoom[pid] && peerRoom[pid] !== key) return; // already connected via other path
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    const isNew = connPeerId !== pid;
    peerRoom[pid] = key;
    connPeerId = pid;
    if (isNew) {
      emitStatus('connected');
      emitStatus('path-' + key);
      if (onReady) onReady(code);
    }
  }

  function onPeerLeaveFor(key, pid) {
    if (peerRoom[pid] !== key) return;
    delete peerRoom[pid];
    if (connPeerId !== pid) return;
    // grace period: quick rejoin on either path cancels the disconnect
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (connPeerId === pid && !peerRoom[pid]) {
        connPeerId = null;
        emitStatus('disconnected');
      }
    }, 3000);
  }

  async function setupRoom(code, onReady, onError) {
    closeAll();
    // load both discovery networks; each continues even if the other fails
    const [nostr, mqtt] = await Promise.all([loadModule('nostr'), loadModule('mqtt')]);
    if (!nostr && !mqtt) {
      onError("Couldn't load the connection library — check your internet and refresh.");
      return false;
    }
    if (nostr) mods.nostr = nostr;
    if (mqtt) mods.mqtt = mqtt;

    for (const key of Object.keys(mods)) {
      try {
        const rtcConfig = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // TURN relays: without these, two phones on different carriers'
            // networks usually CANNOT link directly. Two providers for backup.
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:standard.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:standard.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:standard.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turns:standard.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
          ],
          iceCandidatePoolSize: 10
        };
        const r = mods[key].joinRoom({ appId: APP_ID, rtcConfig }, 'room-' + code);
        // diagnostics: if we see the partner via signaling but their link
        // stays in 'failed' state, the relay/NAT stage is what's broken
        setTimeout(() => {
          try {
            if (typeof r.getPeers !== 'function') return;
            const peers = r.getPeers();
            for (const pid in peers) {
              if (pid !== connPeerId) continue;
              const pc = peers[pid];
              const st = pc.iceConnectionState || pc.connectionState;
              if (st === 'failed' || st === 'disconnected' || st === 'closed') {
                onError('You two FOUND each other, but the networks refuse the final link (relay failed). Try: put ONE phone on mobile data, then reconnect.');
              }
            }
          } catch (e) {}
        }, 22000);
        rooms[key] = r;
        const [send, onMsg] = r.makeAction('g');
        sendRaw[key] = o => { try { send(o); } catch (e) {} };
        onMsg((data, pid) => {
          if (pid !== connPeerId || peerRoom[pid] !== key) return;
          emitMsg(data);
        });
        r.onPeerJoin(pid => onPeerJoinFor(key, pid, onReady, code));
        r.onPeerLeave(pid => onPeerLeaveFor(key, pid));
      } catch (e) { /* this strategy failed; the other may still work */ }
    }
    return Object.keys(rooms).length > 0;
  }

  /* Host a room. onReady fires when the partner appears. */
  function host(onReady, onError) {
    isHost = true;
    const code = makeCode();
    setupRoom(code, onReady, onError);
    return code;
  }

  /* Join a room. Presence-based: keeps searching until the host appears.
   * After 20s a helpful message shows, but the search CONTINUES — the
   * connection completes on its own whenever the host's room is detected. */
  function join(code, onReady, onError) {
    isHost = false;
    const upper = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (upper.length !== 4) {
      onError('Enter the 4-letter room code.');
      return;
    }
    setupRoom(upper, onReady, onError).then(started => {
      if (!started) return;
      setTimeout(() => {
        if (!connPeerId) {
          onError("Room not found yet — check the code, make sure the host's screen is on, and keep this page open. Still searching…");
        }
      }, 20000);
    });
  }

  function send(obj) {
    if (!connPeerId) return;
    const via = peerRoom[connPeerId];
    if (via && sendRaw[via]) sendRaw[via](obj);
  }

  function onMessage(h) { msgHandlers.push(h); }
  function onStatus(h) { statusHandlers.push(h); }

  return {
    host, join, send, onMessage, onStatus,
    get connected() { return !!connPeerId; },
    get isHost() { return isHost; }
  };
})();
