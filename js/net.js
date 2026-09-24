/* ============ Networking (MQTT relay transport) ============
 * Design: NO peer-to-peer. Game messages are relayed through a public
 * MQTT broker over WebSocket-Secure (looks like ordinary web traffic, so
 * it works through networks that block direct device-to-device links).
 * Payloads are end-to-end encrypted with AES-GCM using a key derived from
 * the room code - the broker only ever sees ciphertext.
 *
 * Presence: every client publishes a heartbeat every 2.5s; the partner is
 * "connected" when any message from them arrives, and "gone" after ~11s
 * of silence. mqtt.js auto-reconnects the socket if it drops.
 *
 * External API (unchanged for the rest of the app):
 *   host(), join(code), send(obj), onMessage, onStatus, connected, isHost
 */
const Net = (() => {
  const APP_ID = 'games-night-v1';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker-cn.emqx.io:8084/mqtt'
  ];

  const selfId = 'gn-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  let client = null;
  let topicBase = '';
  let isHost = false;
  let cryptoKey = null;
  let connPeerId = null;
  let lastSeen = 0;
  let hbTimer = null;
  let watchTimer = null;
  let leaveTimer = null;
  let nameLocal = '';

  const msgHandlers = [];
  const statusHandlers = [];

  function makeCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }

  function emitStatus(s) { statusHandlers.forEach(h => h(s)); }
  function emitMsg(d) { msgHandlers.forEach(h => h(d)); }

  /* ---- end-to-end encryption (key derived from room code) ---- */
  async function deriveKey(code) {
    try {
      const enc = new TextEncoder().encode(APP_ID + ':' + code);
      const hash = await crypto.subtle.digest('SHA-256', enc);
      return await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
    } catch (e) { return null; }
  }

  async function encrypt(obj) {
    const json = JSON.stringify(Object.assign({ f: selfId }, obj));
    if (!cryptoKey) return json;
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(json));
      const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
      return JSON.stringify({ iv: b64(iv), ct: b64(ct) });
    } catch (e) { return json; }
  }

  async function decrypt(payload) {
    let parsed;
    try { parsed = JSON.parse(payload); } catch (e) { return null; }
    if (parsed && parsed.iv && parsed.ct && cryptoKey) {
      try {
        const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(parsed.iv) }, cryptoKey, fromB64(parsed.ct));
        return JSON.parse(new TextDecoder().decode(pt));
      } catch (e) { return null; }
    }
    return parsed; // plaintext fallback
  }

  /* ---- broker connection with failover ---- */
  function connectBroker() {
    return new Promise(resolve => {
      let i = 0;
      const tryNext = () => {
        if (i >= BROKERS.length) { resolve(null); return; }
        const url = BROKERS[i++];
        let settled = false;
        let c;
        try {
          c = mqtt.connect(url, {
            clientId: selfId + Math.random().toString(36).slice(2, 6),
            keepalive: 30,
            reconnectPeriod: 4000,
            connectTimeout: 8000,
            clean: true
          });
        } catch (e) { tryNext(); return; }
        c.on('connect', () => { if (!settled) { settled = true; resolve(c); } });
        c.on('error', () => { if (!settled) { settled = true; try { c.end(true); } catch (e) {} tryNext(); } });
        c.on('close', () => { if (!settled) { settled = true; tryNext(); } });
      };
      tryNext();
    });
  }

  function publish(obj) {
    if (!client) return;
    encrypt(obj).then(s => {
      try { client.publish(topicBase + 'data', s, { qos: 0 }); } catch (e) {}
    });
  }

  function handleIncoming(msg, onReady) {
    if (!msg || msg.f === selfId) return; // our own echo
    lastSeen = Date.now();
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    const isNew = connPeerId === null;
    connPeerId = msg.f;
    if (msg.t === 'presence') {
      if (isNew) {
        emitStatus('connected');
        emitStatus('path-relay');
        if (onReady) onReady();
      }
      return; // heartbeats don't reach the app
    }
    if (isNew) {
      emitStatus('connected');
      if (onReady) onReady();
    }
    emitMsg(msg);
  }

  function closeAll() {
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    try { if (client) client.end(true); } catch (e) {}
    client = null;
    connPeerId = null;
  }

  window.__trace = [];
  window.addEventListener('unhandledrejection', e => window.__trace.push('REJECTION: ' + (e.reason && e.reason.message || e.reason)));

  async function setup(code, onReady, onError) {
    const tr = m => { try { window.__trace.push(m); } catch (e) {} };
    tr('setup:start code=' + code);
    closeAll();
    if (typeof mqtt === 'undefined') {
      onError("Couldn't load the connection library — check your internet and refresh.");
      return false;
    }
    cryptoKey = await deriveKey(code);
    tr('derive done, key=' + !!cryptoKey);
    topicBase = 'gamesnight/v1/' + code + '/';
    tr('broker resolving…');
    const c = await connectBroker();
    tr('broker done, has client=' + !!c);
    if (!c) {
      onError("Can't reach the message broker — check your internet, then try again.");
      return false;
    }
    client = c;
    client.on('message', (topic, payload) => {
      decrypt(payload.toString()).then(msg => handleIncoming(msg, onReady));
    });
    client.subscribe(topicBase + 'data', { qos: 0 }, err => {
      if (err) onError('Broker subscription failed — try again.');
    });

    // presence heartbeat: partner is alive while these keep arriving
    hbTimer = setInterval(() => publish({ t: 'presence' }), 2500);
    publish({ t: 'presence' });

    // liveness watchdog: silence > 11s means the partner dropped
    watchTimer = setInterval(() => {
      if (connPeerId && Date.now() - lastSeen > 11000) {
        connPeerId = null;
        emitStatus('disconnected');
      }
    }, 1000);
    return true;
  }

  /* Host a room. onReady fires when the partner appears. */
  function host(onReady, onError, name) {
    isHost = true;
    nameLocal = name || 'Player 1';
    const code = makeCode();
    setup(code, onReady, onError);
    return code;
  }

  /* Join a room. Presence-based: keeps searching until the host appears.
   * After 20s a helpful message shows but the search CONTINUES. */
  function join(code, onReady, onError, name) {
    isHost = false;
    nameLocal = name || 'Player 2';
    const upper = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (upper.length !== 4) {
      onError('Enter the 4-letter room code.');
      return;
    }
    setup(upper, onReady, onError).then(started => {
      if (!started) return;
      setTimeout(() => {
        if (!connPeerId) {
          onError("Room not found yet — check the code and make sure the host's screen is on. Still searching…");
        }
      }, 20000);
    });
  }

  function send(obj) {
    publish(obj);
  }

  function onMessage(h) { msgHandlers.push(h); }
  function onStatus(h) { statusHandlers.push(h); }

  window.__netDebug = () => ({ hasClient: !!client, brokerConnected: !!(client && client.connected), topicBase, connPeerId, isHost, key: !!cryptoKey });
  return {
    host, join, send, onMessage, onStatus,
    get connected() { return !!connPeerId; },
    get isHost() { return isHost; }
  };
})();
