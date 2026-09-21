/* ============ App shell: lobby, menu, game lifecycle ============ */
const APP_VERSION = '20'; // bump together with the ?v= in index.html

const App = (() => {
  const $ = sel => document.querySelector(sel);

  let myName = '';
  let partnerName = '';
  let roomCode = '';
  let helloSent = false;
  let currentGame = null; // { id, instance }

  /* ---------- screens ---------- */
  function show(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`#screen-${screen}`).classList.add('active');
    // global chat only makes sense once connected to a partner
    const inRoom = screen === 'menu' || screen === 'game';
    $('#chat-fab').style.display = inRoom ? 'block' : 'none';
    if (!inRoom) closeChat();
  }

  /* ---------- global chat (works inside any game) ---------- */
  const chat = { open: false, unread: 0, msgs: [] };

  function renderChat() {
    const log = $('#gchat-log');
    log.innerHTML = chat.msgs.map(m =>
      m.sys ? `<div class="sys">${esc(m.text)}</div>`
            : `<div><span class="who">${esc(m.name)}:</span> ${esc(m.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
    const badge = $('#chat-badge');
    badge.style.display = chat.unread > 0 ? 'block' : 'none';
    badge.textContent = chat.unread;
  }

  function openChat() {
    chat.open = true;
    chat.unread = 0;
    $('#chat-panel').classList.add('show');
    renderChat();
    $('#gchat-in').focus();
  }

  function closeChat() {
    chat.open = false;
    $('#chat-panel').classList.remove('show');
    renderChat();
  }

  function sendChatMsg() {
    const inp = $('#gchat-in');
    const text = inp.value.trim();
    if (!text || !Net.connected) return;
    inp.value = '';
    chat.msgs.push({ name: myName, text });
    if (chat.msgs.length > 200) chat.msgs.shift();
    renderChat();
    Net.send({ t: 'chat', name: myName, text });
  }

  $('#chat-fab').onclick = openChat;
  $('#chat-close').onclick = closeChat;
  $('#gchat-send').onclick = sendChatMsg;
  $('#gchat-in').addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMsg(); });

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- floating hearts background ---------- */
  (function hearts() {
    const bg = $('#hearts-bg');
    const glyphs = ['💗', '💖', '💕', '❤️', '💘'];
    for (let i = 0; i < 14; i++) {
      const h = document.createElement('span');
      h.className = 'fh';
      h.textContent = glyphs[i % glyphs.length];
      h.style.left = Math.random() * 100 + 'vw';
      h.style.fontSize = (14 + Math.random() * 22) + 'px';
      h.style.animationDuration = (10 + Math.random() * 14) + 's';
      h.style.animationDelay = (-Math.random() * 20) + 's';
      bg.appendChild(h);
    }
  })();

  /* ---------- connection flow ---------- */
  function connectedFlow() {
    if (!helloSent) {
      helloSent = true;
      Net.send({ t: 'hello', name: myName, v: APP_VERSION });
    }
    enterMenu();
  }

  function lobbyError(msg) { $('#lobby-error').textContent = msg; }

  // random default nickname — names are optional, zero typing required
  const NICKS = ['Honey', 'Sweetie', 'Cutie', 'Babe', 'Darling', 'Sunshine', 'Boo', 'Love', 'Angel', 'Cherry'];
  $('#name-input').value = NICKS[Math.floor(Math.random() * NICKS.length)];

  // invited via link? hide the manual-code path and get them in with one tap
  let linkCode = '';
  if (location.hash.length >= 5) {
    linkCode = location.hash.slice(1).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }
  if (linkCode.length === 4) {
    $('#code-input').value = linkCode;
    $('#btn-host').style.display = 'none';
    $('#join-hint').textContent = `You're invited to room ${linkCode} 💞 — just tap Join!`;
  }

  function inviteUrl() {
    return location.origin + location.pathname + '#' + roomCode;
  }

  $('#btn-host').onclick = () => {
    myName = $('#name-input').value.trim() || 'Player 1';
    lobbyError('Creating room…');
    Net.host(
      code => {
        roomCode = code;
        lobbyError('');
        $('#room-code').textContent = code;
        show('waiting');
      },
      errType => lobbyError('Connection error: ' + errType)
    );
  };

  $('#btn-join').onclick = () => {
    // accept a pasted invite link as well as a plain code
    let code = $('#code-input').value.trim().toUpperCase();
    const fromLink = code.match(/#([A-Z0-9]{4})/);
    if (fromLink) code = fromLink[1];
    if (linkCode.length === 4 && code.length !== 4) code = linkCode;
    if (code.length !== 4) { lobbyError('Enter the 4-letter room code.'); return; }
    myName = $('#name-input').value.trim() || 'Player 2';
    lobbyError('Connecting…');
    Net.join(code,
      () => { lobbyError(''); roomCode = code; connectedFlow(); },
      err => lobbyError('Could not connect: ' + err)
    );
  };

  $('#code-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-join').click(); });
  $('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-host').click(); });

  $('#btn-copy-code').onclick = async () => {
    try {
      await navigator.clipboard.writeText(`Play Games Night with me! 💕 ${inviteUrl()}`);
      toast('Invite copied — send it to your partner 💌');
    } catch (e) {
      toast(inviteUrl());
    }
  };

  $('#btn-share').onclick = async () => {
    const url = inviteUrl();
    if (navigator.share) {
      try { await navigator.share({ title: 'Games Night 💕', text: 'Play Games Night with me! 💕', url }); return; } catch (e) { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(`Play Games Night with me! 💕 ${url}`);
      toast('Invite copied — send it to your partner 💌');
    } catch (e) { toast(url); }
  };

  /* ---------- menu ---------- */
  function makeGameCard(id, g) {
    const b = document.createElement('button');
    b.className = 'game-card';
    b.innerHTML = `<span class="gc-icon">${g.icon}</span><span class="gc-name">${g.name}</span><span class="gc-desc">${g.desc}</span>`;
    b.onclick = () => {
      App.send({ t: 'game', g: id });
      startGame(id);
    };
    return b;
  }

  function enterMenu() {
    $('#menu-me').textContent = myName;
    $('#menu-partner').textContent = partnerName;
    const grid = $('#game-grid');
    grid.innerHTML = '';
    Object.entries(Games).filter(([id]) => id !== 'intimate')
      .forEach(([id, g]) => grid.appendChild(makeGameCard(id, g)));

    // separate consent-gated 18+ zone below the regular games
    const zone = $('#intimate-zone');
    zone.style.display = 'block';
    const igrid = $('#intimate-grid');
    igrid.innerHTML = '';
    igrid.appendChild(makeGameCard('intimate', Games.intimate));
    show('menu');
  }

  /* ---------- game lifecycle ---------- */
  function startGame(id) {
    const g = Games[id];
    if (!g || (currentGame && currentGame.id === id)) return;
    destroyGame();
    const container = $('#game-container');
    container.innerHTML = '';
    $('#game-title').textContent = `${g.icon} ${g.name}`;
    $('#game-score').textContent = '';
    const instance = g.init(container, {
      get isHost() { return Net.isHost; },
      myName,
      partnerName,
      send: obj => Net.send({ t: 'state', g: id, ...obj }),
      setScore: html => { $('#game-score').textContent = html; },
      toast,
    });
    currentGame = { id, instance };
    show('game');
  }

  function destroyGame() {
    if (currentGame) {
      try { currentGame.instance.destroy(); } catch (e) {}
      currentGame = null;
    }
  }

  $('#btn-back').onclick = () => {
    App.send({ t: 'menu' });
    destroyGame();
    enterMenu();
  };

  $('#btn-reload').onclick = () => location.reload();

  /* ---------- incoming messages ---------- */
  Net.onMessage(d => {
    if (!d || typeof d !== 'object') return;
    switch (d.t) {
      case 'hello':
        partnerName = d.name || 'Partner';
        connectedFlow();
        if (d.v !== APP_VERSION) {
          toast('⚠️ You two have different versions — refresh both browsers!');
        }
        break;
      case 'menu':
        destroyGame();
        enterMenu();
        break;
      case 'game':
        if (!Games[d.g]) {
          toast('⚠️ New game missing — refresh both browsers to update!');
          return;
        }
        startGame(d.g);
        toast(`Playing ${Games[d.g].name}!`);
        break;
      case 'chat':
        chat.msgs.push({ name: d.name || partnerName, text: d.text });
        if (chat.msgs.length > 200) chat.msgs.shift();
        if (!chat.open) chat.unread++;
        renderChat();
        break;
      case 'state':
        if (currentGame && currentGame.id === d.g) {
          currentGame.instance.onMsg(d);
        }
        break;
    }
  });

  Net.onStatus(s => {
    if (s !== 'disconnected') return;
    // ignore while still in the lobby (never connected yet)
    if ($('#screen-lobby').classList.contains('active')) return;
    $('#disconnect-reason').textContent = partnerName
      ? `${partnerName} left the room.`
      : 'Your partner left the room.';
    $('#overlay-disconnect').classList.add('show');
  });

  return { send: obj => Net.send(obj), toast };
})();
