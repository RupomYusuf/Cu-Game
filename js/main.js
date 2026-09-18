/* ============ App shell: lobby, menu, game lifecycle ============ */
const APP_VERSION = '2'; // bump together with the ?v= in index.html

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
  }

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
    const code = $('#code-input').value.trim().toUpperCase();
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
    const url = location.origin + location.pathname + '#' + roomCode;
    try {
      await navigator.clipboard.writeText(`Play Couples Game Night with me! 💕 Room code: ${roomCode}\n${url}`);
      toast('Copied! Send it to your partner 💌');
    } catch (e) {
      toast('Room code: ' + roomCode);
    }
  };

  // auto-fill code from URL hash (#ABCD)
  if (location.hash.length === 5) {
    $('#code-input').value = location.hash.slice(1).toUpperCase();
  }

  /* ---------- menu ---------- */
  function enterMenu() {
    $('#menu-me').textContent = myName;
    $('#menu-partner').textContent = partnerName;
    const grid = $('#game-grid');
    grid.innerHTML = '';
    Object.entries(Games).forEach(([id, g]) => {
      const b = document.createElement('button');
      b.className = 'game-card';
      b.innerHTML = `<span class="gc-icon">${g.icon}</span><span class="gc-name">${g.name}</span><span class="gc-desc">${g.desc}</span>`;
      b.onclick = () => {
        App.send({ t: 'game', g: id });
        startGame(id);
      };
      grid.appendChild(b);
    });
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
