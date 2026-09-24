/* ============ Networking (Trystero — serverless WebRTC) ============
 * Why Trystero instead of PeerJS:
 *  - No single signaling broker: peer discovery runs over several public
 *    Nostr relays, so there is no demo-grade server to fall over.
 *  - Presence-based rooms: the guest joins the room and waits for the host
 *    to appear - no more dialing a dead ID ("peer unavailable" is gone).
 *  - Auto re-announce/reconnect is built in.
 *
 * External API (unchanged for the rest of the app):
 *   host(code?), join(code), send(obj), onMessage, onStatus,
 *   connected, isHost
 */
const Net = (() => {
  const APP_ID = 'games-night-couples-v1';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L, O (easy to confuse)

  let lib = null;          // trystero module
  let libPromise = null;
  let room = null;
  let sendRaw = null;
  let connPeerId = null;
  let isHost = false;
  let leaveTimer = null;

  const msgHandlers = [];    // (data) => void
  const statusHandlers = []; // (status) => void

  function makeCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }

  function emitStatus(s) { statusHandlers.forEach(h => h(s)); }
  function emitMsg(d) { msgHandlers.forEach(h => h(d)); }

  /* load trystero with CDN fallbacks */
  async function ensureLib() {
    if (lib) return lib;
    if (libPromise) return libPromise;
    const sources = [
      'https://esm.sh/trystero@0.21.1/nostr',
      'https://cdn.jsdelivr.net/npm/trystero@0.21.1/nostr/+esm',
      'https://esm.sh/trystero/nostr',
      'https://cdn.jsdelivr.net/npm/trystero/nostr/+esm'
    ];
    libPromise = (async () => {
      let lastErr = null;
      for (const src of sources) {
        try {
          lib = await import(src);
          if (lib && lib.joinRoom) return lib;
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('no cdn');
    })();
    return libPromise;
  }

  function closeRoom() {
    try { if (room) room.leave(); } catch (e) {}
    room = null;
    sendRaw = null;
    connPeerId = null;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  }

  async function setupRoom(code, onReady, onError) {
    try {
      const t = await ensureLib();
      closeRoom();
      room = t.joinRoom({ appId: APP_ID }, 'room-' + code);

      const [send, onMsg] = room.makeAction('g');
      sendRaw = o => { try { send(o); } catch (e) {} };
      onMsg((data, peerId) => {
        if (peerId !== connPeerId) return; // ignore extra peers
        emitMsg(data);
      });

      room.onPeerJoin(pid => {
        // accept only the first peer (2-player rooms); ignore everyone else
        if (connPeerId && connPeerId !== pid) return;
        if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
        const isNew = connPeerId !== pid;
        connPeerId = pid;
        if (isNew) {
          emitStatus('connected');
          if (onReady) onReady(code);
        }
      });

      room.onPeerLeave(pid => {
        if (pid !== connPeerId) return;
        // grace period: quick rejoin (network blip) doesn't kill the room
        if (leaveTimer) clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => {
          if (connPeerId === pid) {
            connPeerId = null;
            emitStatus('disconnected');
          }
        }, 3000);
      });

      return true;
    } catch (e) {
      if (onError) onError("Couldn't load the connection library - check your internet and refresh.");
      return false;
    }
  }

  /* Host a room. onReady fires when a partner actually joins. */
  function host(onReady, onError) {
    isHost = true;
    const code = makeCode();
    setupRoom(code, onReady, onError);
    return code;
  }

  /* Join a room. Presence-based: keeps looking until the host appears.
   * After 15s we surface a helpful error but KEEP searching - if the host
   * shows up later the connection still completes. */
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
          onError('Room not found yet - double-check the code and make sure the host\'s screen is on. Still searching...');
        }
      }, 15000);
    });
  }

  function send(obj) {
    if (connPeerId && sendRaw) sendRaw(obj);
  }

  function onMessage(h) { msgHandlers.push(h); }
  function onStatus(h) { statusHandlers.push(h); }

  return {
    host, join, send, onMessage, onStatus,
    get connected() { return !!connPeerId; },
    get isHost() { return isHost; }
  };
})();
