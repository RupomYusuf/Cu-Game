/* ============ Networking (PeerJS) ============
 * Host creates a peer with a fixed id derived from a 4-letter room code.
 * Guest generates a random peer id and dials the host.
 * Only 2 players per room; extra connections are refused.
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
    const code = makeCode();
    peer = new Peer(PREFIX + code);
    peer.on('open', () => onReady(code));
    peer.on('connection', c => {
      if (conn && conn.open) { try { c.close(); } catch (e) {} return; }
      bind(c);
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        // code collision: try a fresh one
        const fresh = makeCode();
        peer = new Peer(PREFIX + fresh);
        peer.on('open', () => onReady(fresh));
        peer.on('connection', c => {
          if (conn && conn.open) { try { c.close(); } catch (e) {} return; }
          bind(c);
        });
      } else if (err.type !== 'peer-unavailable') {
        onError(err.type);
      }
    });
  }

  /* Join a room by code. */
  function join(code, onReady, onError) {
    isHost = false;
    destroy();
    peer = new Peer();
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      bind(c, onReady);
      const failTimer = setTimeout(() => {
        if (!conn) onError('peer-unavailable');
      }, 10000);
      peer.on('error', err => {
        clearTimeout(failTimer);
        if (err.type === 'peer-unavailable') onError('Room not found. Check the code!');
        else onError(err.type);
      });
    });
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
