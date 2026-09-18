/* ============ Games ============
 * Each game: { name, icon, desc, init(root, api) -> { onMsg(data), destroy() } }
 * api: { isHost, myName, partnerName, send(obj) (auto-tagged with game id),
 *        setScore(html), toast(msg) }
 * All messages arriving here look like { g: <gameId>, kind: '...', ... }.
 */
const Games = {};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* =====================================================
 * 1. Tic-Tac-Toe
 * ===================================================== */
Games.tictactoe = {
  name: 'Tic-Tac-Toe', icon: '⭕', desc: 'Classic three in a row',
  init(root, api) {
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const S = {
      board: Array(9).fill(''),
      mySym: api.isHost ? 'X' : 'O',
      turn: 'X',
      over: false,
      wins: { X: 0, O: 0 },
    };
    root.innerHTML = `
      <div class="game-panel">
        <div class="turn-indicator" id="ttt-turn"></div>
        <div class="ttt-board" id="ttt-board"></div>
        <div id="ttt-result"></div>
        <div style="margin-top:16px"><button class="btn btn-primary" id="ttt-again" style="display:none">Play again 🔁</button></div>
      </div>`;
    const boardEl = root.querySelector('#ttt-board');
    const turnEl = root.querySelector('#ttt-turn');
    const resultEl = root.querySelector('#ttt-result');
    const againBtn = root.querySelector('#ttt-again');

    function render() {
      boardEl.innerHTML = '';
      S.board.forEach((v, i) => {
        const b = document.createElement('button');
        b.className = 'ttt-cell' + (v === 'X' ? ' x' : v === 'O' ? ' o' : '');
        b.textContent = v;
        b.disabled = !!v || S.over || S.turn !== S.mySym;
        b.onclick = () => move(i);
        boardEl.appendChild(b);
      });
      turnEl.textContent = S.over ? '' :
        S.turn === S.mySym ? `Your turn (${S.mySym})` : `Waiting for ${api.partnerName}…`;
      api.setScore(`You ${S.wins[S.mySym]} — ${S.wins[S.mySym === 'X' ? 'O' : 'X']} ${api.partnerName}`);
    }

    function winner(bd) {
      for (const [a, b, c] of LINES) {
        if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return { sym: bd[a], line: [a, b, c] };
      }
      return bd.every(v => v) ? { sym: 'draw', line: [] } : null;
    }

    function finish(res) {
      S.over = true;
      if (res.sym !== 'draw') {
        S.wins[res.sym]++;
        res.line.forEach(i => boardEl.children[i].classList.add('win'));
        const iWin = res.sym === S.mySym;
        resultEl.innerHTML = `<div class="result-banner ${iWin ? 'win' : 'lose'}">${iWin ? 'You win! 🎉' : `${esc(api.partnerName)} wins!`}</div>`;
      } else {
        resultEl.innerHTML = `<div class="result-banner draw">It's a draw! 🤝</div>`;
      }
      againBtn.style.display = 'inline-block';
      render();
    }

    function move(i) {
      if (S.over || S.board[i] || S.turn !== S.mySym) return;
      apply(i, S.mySym);
      api.send({ kind: 'move', i });
      const res = winner(S.board);
      if (res) finish(res);
    }

    function apply(i, sym) {
      S.board[i] = sym;
      S.turn = sym === 'X' ? 'O' : 'X';
      render();
    }

    againBtn.onclick = () => {
      S.board = Array(9).fill('');
      S.over = false;
      S.turn = 'X';
      resultEl.innerHTML = '';
      againBtn.style.display = 'none';
      render();
      api.send({ kind: 'again' });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'move') {
          apply(d.i, S.mySym === 'X' ? 'O' : 'X');
          const res = winner(S.board);
          if (res) finish(res);
        } else if (d.kind === 'again') {
          S.board = Array(9).fill('');
          S.over = false;
          S.turn = 'X';
          resultEl.innerHTML = '';
          againBtn.style.display = 'none';
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 2. Connect Four
 * ===================================================== */
Games.connect4 = {
  name: 'Connect Four', icon: '🔴', desc: 'Four in a row wins',
  init(root, api) {
    const COLS = 7, ROWS = 6;
    const S = {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), // 0 empty, 1 host, 2 guest
      me: api.isHost ? 1 : 2,
      turn: 1,
      over: false,
      wins: { 1: 0, 2: 0 },
    };
    root.innerHTML = `
      <div class="game-panel">
        <div class="turn-indicator" id="c4-turn"></div>
        <div class="c4-board" id="c4-board"></div>
        <div id="c4-result"></div>
        <div style="margin-top:16px"><button class="btn btn-primary" id="c4-again" style="display:none">Play again 🔁</button></div>
      </div>`;
    const boardEl = root.querySelector('#c4-board');
    const turnEl = root.querySelector('#c4-turn');
    const resultEl = root.querySelector('#c4-result');
    const againBtn = root.querySelector('#c4-again');

    function render() {
      boardEl.innerHTML = '';
      // clickable drop buttons
      for (let c = 0; c < COLS; c++) {
        const b = document.createElement('button');
        b.className = 'c4-col-btn';
        b.textContent = '▼';
        b.disabled = S.over || S.turn !== S.me || S.board[0][c] !== 0;
        b.onclick = () => drop(c);
        boardEl.appendChild(b);
      }
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = document.createElement('div');
          const v = S.board[r][c];
          cell.className = 'c4-cell' + (v ? (v === 1 ? ' p1' : ' p2') : '');
          if (v && winCells.some(([wr, wc]) => wr === r && wc === c)) cell.classList.add('win');
          boardEl.appendChild(cell);
        }
      }
      turnEl.textContent = S.over ? '' :
        S.turn === S.me ? 'Your turn — pick a column ▼' : `Waiting for ${api.partnerName}…`;
      api.setScore(`You ${S.wins[S.me]} — ${S.wins[S.me === 1 ? 2 : 1]} ${api.partnerName}`);
    }

    let winCells = [];
    function checkWin(bd, p) {
      const dirs = [[0,1],[1,0],[1,1],[1,-1]];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (bd[r][c] !== p) continue;
        for (const [dr, dc] of dirs) {
          const cells = [[r, c]];
          for (let k = 1; k < 4; k++) {
            const rr = r + dr * k, cc = c + dc * k;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || bd[rr][cc] !== p) break;
            cells.push([rr, cc]);
          }
          if (cells.length === 4) return cells;
        }
      }
      return null;
    }

    function drop(col) {
      if (S.over || S.turn !== S.me) return;
      let row = -1;
      for (let r = ROWS - 1; r >= 0; r--) if (S.board[r][col] === 0) { row = r; break; }
      if (row < 0) return;
      apply(col, row);
      api.send({ kind: 'move', col });
    }

    function apply(col, row) {
      S.board[row][col] = S.turn;
      const w = checkWin(S.board, S.turn);
      if (w) {
        S.over = true;
        winCells = w;
        S.wins[S.turn]++;
        const iWin = S.turn === S.me;
        resultEl.innerHTML = `<div class="result-banner ${iWin ? 'win' : 'lose'}">${iWin ? 'You win! 🎉' : `${esc(api.partnerName)} wins!`}</div>`;
        againBtn.style.display = 'inline-block';
      } else if (S.board.every(row2 => row2.every(v => v !== 0))) {
        S.over = true;
        resultEl.innerHTML = `<div class="result-banner draw">Board full — it's a draw! 🤝</div>`;
        againBtn.style.display = 'inline-block';
      } else {
        S.turn = S.turn === 1 ? 2 : 1;
      }
      render();
    }

    againBtn.onclick = () => {
      S.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      S.over = false;
      winCells = [];
      S.turn = 1;
      resultEl.innerHTML = '';
      againBtn.style.display = 'none';
      render();
      api.send({ kind: 'again' });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'move') {
          const col = d.col;
          for (let r = ROWS - 1; r >= 0; r--) if (S.board[r][col] === 0) { apply(col, r); break; }
        } else if (d.kind === 'again') {
          S.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
          S.over = false;
          winCells = [];
          S.turn = 1;
          resultEl.innerHTML = '';
          againBtn.style.display = 'none';
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 3. Conversation cards
 * ===================================================== */
Games.cards = {
  name: 'Question Cards', icon: '💌', desc: 'Talk, laugh, connect',
  init(root, api) {
    const S = { deck: 'warm', idx: 0 };
    root.innerHTML = `
      <div class="game-panel">
        <select id="cards-deck" class="btn btn-secondary" style="margin-bottom:18px"></select>
        <div id="cards-asker" class="card-tag"></div>
        <div class="big-card-question" id="cards-text"></div>
        <div style="margin-top:22px"><button class="btn btn-primary btn-big" id="cards-next">Next card 💞</button></div>
        <p class="muted" style="margin-top:14px;font-size:.85rem">Take turns answering — whoever the card says goes first.</p>
      </div>`;
    const deckSel = root.querySelector('#cards-deck');
    const askerEl = root.querySelector('#cards-asker');
    const textEl = root.querySelector('#cards-text');

    Object.entries(DATA.decks).forEach(([k, d]) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = d.name;
      deckSel.appendChild(o);
    });
    deckSel.value = S.deck;

    function show() {
      const deck = DATA.decks[S.deck];
      const card = deck.cards[S.idx % deck.cards.length];
      // alternation is anchored to the host so both screens agree
      const firstIsHost = S.idx % 2 === 0;
      const asker = firstIsHost === api.isHost ? api.myName : api.partnerName;
      askerEl.textContent = `💕 ${asker} answers first`;
      textEl.textContent = card;
      deckSel.value = S.deck;
    }

    deckSel.onchange = () => {
      S.deck = deckSel.value;
      S.idx = 0;
      show();
      api.send({ kind: 'deck', deck: S.deck });
    };

    root.querySelector('#cards-next').onclick = () => {
      S.idx++;
      show();
      api.send({ kind: 'next', idx: S.idx });
    };

    show();
    return {
      onMsg(d) {
        if (d.kind === 'next') { S.idx = d.idx; show(); }
        else if (d.kind === 'deck') { S.deck = d.deck; S.idx = 0; show(); }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 4. Who's more likely?
 * ===================================================== */
Games.likely = {
  name: "Who's More Likely?", icon: '🤔', desc: 'Guess each other',
  init(root, api) {
    const S = { q: 0, mine: null, theirs: null, score: 0, rounds: 0, synced: 0 };

    root.innerHTML = `
      <div class="game-panel">
        <div id="lk-question" class="likely-question"></div>
        <div class="likely-buttons" id="lk-buttons"></div>
        <div id="lk-status" class="game-prompt" style="margin-top:16px"></div>
        <div id="lk-result"></div>
        <div style="margin-top:10px"><button class="btn btn-primary" id="lk-next" style="display:none">Next question →</button></div>
        <div style="margin-top:14px"><button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="lk-restart">Restart ↺</button></div>
      </div>`;
    const qEl = root.querySelector('#lk-question');
    const btnsEl = root.querySelector('#lk-buttons');
    const statusEl = root.querySelector('#lk-status');
    const resultEl = root.querySelector('#lk-result');
    const nextBtn = root.querySelector('#lk-next');

    function render() {
      const q = DATA.likely[S.q % DATA.likely.length];
      qEl.textContent = `Who's more likely to…`;
      // question text without leading "…" is in DATA; display "Who's more likely to X?"
      qEl.textContent = 'Who’s more likely to ' + q.replace(/^…\s*/, '');
      btnsEl.innerHTML = '';
      [['me', api.myName], ['them', api.partnerName]].forEach(([who, label]) => {
        const b = document.createElement('button');
        b.className = 'likely-btn';
        b.textContent = label;
        b.dataset.who = who;
        const revealed = S.mine !== null && S.theirs !== null;
        const mineVal = who; // 'me' | 'them'
        if (revealed) {
          b.classList.add('reveal');
          const mine = S.mine, theirs = S.theirs; // 'me'|'them'
          const thisIsMine = mine === mineVal;
          const thisIsTheirs = theirs === mineVal;
          if (thisIsMine) b.classList.add('selected');
          if (mine === theirs && thisIsMine) b.classList.add('match');
          if (mine !== theirs) b.classList.add('mismatch');
          b.disabled = true;
          b.textContent += thisIsMine && thisIsTheirs ? ' ⭐' : (thisIsMine ? ' (you)' : ` (${api.partnerName})`);
        } else {
          if (S.mine === mineVal) b.classList.add('selected');
          b.onclick = () => pick(mineVal);
        }
        btnsEl.appendChild(b);
      });

      const revealed = S.mine !== null && S.theirs !== null;
      if (S.mine === null) {
        statusEl.textContent = 'Who do you think it is? Pick one!';
      } else if (S.theirs === null) {
        statusEl.textContent = `Waiting for ${api.partnerName} to pick…`;
      } else {
        statusEl.textContent = '';
        if (S.mine === S.theirs) {
          resultEl.innerHTML = `<div class="result-banner win">In sync! 💞 You both picked the same person. (+1)</div>`;
        } else {
          resultEl.innerHTML = `<div class="result-banner lose">Different answers! You said <b>${S.mine === 'me' ? esc(api.myName) : esc(api.partnerName)}</b>, they said <b>${S.theirs === 'me' ? esc(api.myName) : esc(api.partnerName)}</b>. Time to explain yourselves 😄</div>`;
        }
        nextBtn.style.display = 'inline-block';
      }
      api.setScore(`In sync: ${S.synced}/${S.rounds || 0}`);
    }

    function pick(v) {
      S.mine = v;
      render();
      api.send({ kind: 'pick', pick: v });
    }

    function next() {
      S.q++;
      S.mine = null;
      S.theirs = null;
      resultEl.innerHTML = '';
      nextBtn.style.display = 'none';
      render();
    }

    nextBtn.onclick = () => {
      if (!(S.mine !== null && S.theirs !== null)) return;
      next();
      api.send({ kind: 'next', q: S.q });
    };

    root.querySelector('#lk-restart').onclick = () => {
      S.q = 0; S.mine = null; S.theirs = null; S.score = 0; S.rounds = 0; S.synced = 0;
      resultEl.innerHTML = '';
      nextBtn.style.display = 'none';
      render();
      api.send({ kind: 'restart' });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'pick') {
          if (S.mine === null || S.theirs === null) {
            S.theirs = d.pick;
            S.rounds++;
            if (S.mine !== null && S.mine === S.theirs) S.synced++;
            render();
          }
        } else if (d.kind === 'next') {
          S.q = d.q;
          S.mine = null;
          S.theirs = null;
          resultEl.innerHTML = '';
          nextBtn.style.display = 'none';
          render();
        } else if (d.kind === 'restart') {
          S.q = 0; S.mine = null; S.theirs = null; S.score = 0; S.rounds = 0; S.synced = 0;
          resultEl.innerHTML = '';
          nextBtn.style.display = 'none';
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 6. Intimate (18+ — requires consent from BOTH partners)
 * ===================================================== */
Games.intimate = {
  name: 'Intimate 🔞', icon: '💋', desc: 'Just for you two · 18+',
  init(root, api) {
    const LEVELS = DATA.intimate;
    const S = {
      phase: 'select', // select | waiting | consent | play
      level: null,     // 'soft' | 'extreme'
      pending: null,   // level awaiting consent
      idx: 0,
    };

    root.innerHTML = `<div class="game-panel" id="in-panel"></div>`;
    const panel = root.querySelector('#in-panel');

    const label = lvl => LEVELS[lvl] ? LEVELS[lvl].name : lvl;

    function render() {
      panel.innerHTML = '';
      if (S.phase === 'select') {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Just for the two of you…</h3>
          <p class="game-prompt">🔞 18+ · Only play what you both want — every card can always be skipped.</p>
          <div class="likely-buttons" style="margin-top:18px">
            <button class="likely-btn" data-lvl="soft" style="font-size:1.3rem;padding:26px 10px">💋<br>Intimate</button>
            <button class="likely-btn" data-lvl="extreme" style="font-size:1.3rem;padding:26px 10px">🔥<br>Extremely Intimate</button>
          </div>
          <p class="muted" style="margin-top:16px;font-size:.85rem">Pick a level — ${esc(api.partnerName)} will be asked for consent before it starts.</p>`;
        panel.querySelectorAll('.likely-btn').forEach(b => {
          b.onclick = () => {
            S.pending = b.dataset.lvl;
            S.phase = 'waiting';
            render();
            api.send({ kind: 'req', level: S.pending });
          };
        });
      } else if (S.phase === 'waiting') {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">${esc(label(S.pending))}</h3>
          <p class="game-prompt">Waiting for ${esc(api.partnerName)} to consent… 💞</p>
          <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="in-cancel">Cancel</button>`;
        panel.querySelector('#in-cancel').onclick = () => {
          api.send({ kind: 'no' });
          S.phase = 'select';
          S.pending = null;
          render();
        };
      } else if (S.phase === 'consent') {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">${esc(label(S.pending))}</h3>
          <p class="game-prompt"><b>${esc(api.partnerName)}</b> wants to play the <b>${esc(label(S.pending))}</b> level. 🔞</p>
          <p class="game-prompt">Only say yes if you truly want to — “no” is always okay. 💛</p>
          <div class="likely-buttons" style="margin-top:16px">
            <button class="likely-btn match" id="in-yes" style="font-size:1.2rem">Yes 💕</button>
            <button class="likely-btn" id="in-no" style="font-size:1.2rem">Not now</button>
          </div>`;
        panel.querySelector('#in-yes').onclick = () => {
          S.level = S.pending;
          S.idx = 0;
          S.phase = 'play';
          render();
          api.send({ kind: 'ok', level: S.level });
        };
        panel.querySelector('#in-no').onclick = () => {
          api.send({ kind: 'no' });
          S.phase = 'select';
          S.pending = null;
          render();
          api.toast('Maybe another time 💛');
        };
      } else if (S.phase === 'play') {
        const deck = LEVELS[S.level];
        const card = deck.cards[S.idx % deck.cards.length];
        const firstIsHost = S.idx % 2 === 0;
        const asker = firstIsHost === api.isHost ? api.myName : api.partnerName;
        panel.innerHTML = `
          <div class="card-tag">${esc(deck.name)} · card ${S.idx % deck.cards.length + 1}</div>
          <div id="in-asker" class="card-tag" style="margin-left:6px">💕 ${esc(asker)} goes first</div>
          <div class="big-card-question">${esc(card)}</div>
          <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-big" id="in-next">Next card 💞</button>
            <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="in-skip">Skip ⏭️</button>
            <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="in-exit">Stop</button>
          </div>
          <p class="muted" style="margin-top:14px;font-size:.85rem">Anything can be skipped — no explanations needed.</p>`;
        const advance = (delta) => {
          S.idx = Math.max(0, S.idx + delta);
          render();
          api.send({ kind: 'next', idx: S.idx });
        };
        panel.querySelector('#in-next').onclick = () => advance(1);
        panel.querySelector('#in-skip').onclick = () => advance(1);
        panel.querySelector('#in-exit').onclick = () => {
          api.send({ kind: 'exit' });
          S.level = null;
          S.pending = null;
          S.idx = 0;
          S.phase = 'select';
          render();
        };
      }
    }

    render();
    return {
      onMsg(d) {
        switch (d.kind) {
          case 'req':
            S.pending = d.level;
            S.phase = 'consent';
            render();
            break;
          case 'ok':
            if (S.phase === 'waiting' && d.level === S.pending) {
              S.level = d.level;
              S.idx = 0;
              S.phase = 'play';
              render();
              api.toast(`${label(d.level)} — enjoy 💞`);
            }
            break;
          case 'no':
            S.phase = 'select';
            S.pending = null;
            render();
            if (S.phase) api.toast('Maybe another time 💛');
            break;
          case 'exit':
            S.level = null;
            S.pending = null;
            S.idx = 0;
            S.phase = 'select';
            render();
            break;
          case 'next':
            if (S.phase === 'play') { S.idx = d.idx; render(); }
            break;
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5. Draw & Guess (Pictionary)
 * ===================================================== */
Games.draw = {
  name: 'Draw & Guess', icon: '🎨', desc: 'Pictionary with hearts',
  init(root, api) {
    const S = {
      round: 0,             // even => host draws
      myRole: null,         // 'draw' | 'guess'
      word: '',
      colors: ['#e75480', '#3d6cb9', '#2e9e5b', '#f6b93b', '#5f27cd', '#000000'],
      color: '#e75480',
      size: 5,
      scores: { me: 0, them: 0 },
    };

    root.innerHTML = `
      <div class="game-panel draw-layout">
        <div id="dr-rolebar"></div>
        <canvas id="draw-canvas" width="800" height="500"></canvas>
        <div id="dr-tools"></div>
        <div class="chat-box">
          <div class="chat-log" id="dr-chat"></div>
          <div class="chat-input-row">
            <input type="text" id="dr-msg" placeholder="Type your guess…" maxlength="60">
            <button class="btn btn-primary" id="dr-send">Send</button>
          </div>
        </div>
        <div id="dr-result"></div>
      </div>`;

    const canvas = root.querySelector('#draw-canvas');
    const ctx = canvas.getContext('2d');
    const chatLog = root.querySelector('#dr-chat');
    const chatInput = root.querySelector('#dr-msg');
    const rolebar = root.querySelector('#dr-rolebar');
    const toolsEl = root.querySelector('#dr-tools');
    const resultEl = root.querySelector('#dr-result');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    /* ---------- roles & rounds ---------- */
    function amDrawing() { return (S.round % 2 === 0) === api.isHost; }

    function buildRoleUI() {
      resultEl.innerHTML = '';
      if (amDrawing()) {
        S.word = DATA.words[Math.floor(Math.random() * DATA.words.length)];
        rolebar.innerHTML = `<div class="draw-word">${esc(S.word)}</div>
          <div class="game-prompt">Draw this! ✏️ ${esc(api.partnerName)} is guessing. <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="dr-newword">New word 🔄</button> <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="dr-giveup">Give up 🏳️</button></div>`;
        root.querySelector('#dr-newword').onclick = againNewWord;
        root.querySelector('#dr-giveup').onclick = giveUp;
      } else {
        rolebar.innerHTML = `<div class="game-prompt">You're guessing! ${esc(api.partnerName)} is drawing 🎨 — type your guess below!</div>`;
      }
      setupTools();
    }

    function againNewWord() {
      S.word = DATA.words[Math.floor(Math.random() * DATA.words.length)];
      api.send({ kind: 'newword' });
      sysMsg('New word chosen! 🔄');
    }

    function giveUp() {
      api.send({ kind: 'reveal', word: S.word });
      sysMsg(`Nobody got it — the word was “${S.word}”`);
      setTimeout(endRound, 1500);
    }

    /* The host is the sole round authority: whoever stops drawing asks the
     * host to advance, and everyone rebuilds roles from the host's broadcast. */
    function endRound() {
      clearCanvas();
      api.send({ kind: 'clear' });
      if (api.isHost) {
        S.round++;
        api.send({ kind: 'round', round: S.round });
        buildRoleUI();
      } else {
        api.send({ kind: 'end' });
      }
    }

    function setupTools() {
      const drawing = amDrawing();
      canvas.style.cursor = drawing ? 'crosshair' : 'default';
      canvas.style.pointerEvents = drawing ? 'auto' : 'none';
      if (drawing) {
        toolsEl.innerHTML = '';
        S.colors.forEach(c => {
          const s = document.createElement('button');
          s.className = 'swatch' + (c === S.color ? ' selected' : '');
          s.style.background = c;
          s.onclick = () => { S.color = c; setupTools(); };
          toolsEl.appendChild(s);
        });
        const size = document.createElement('input');
        size.type = 'range'; size.min = 2; size.max = 24; size.value = S.size;
        size.oninput = () => { S.size = +size.value; };
        size.style.width = '110px';
        toolsEl.appendChild(size);
        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn btn-ghost btn-small';
        clearBtn.style.color = 'var(--rose-dark)';
        clearBtn.style.borderColor = 'var(--rose-light)';
        clearBtn.textContent = 'Clear 🧹';
        clearBtn.onclick = () => { clearCanvas(); api.send({ kind: 'clear' }); };
        toolsEl.appendChild(clearBtn);
      } else {
        toolsEl.innerHTML = '<span class="muted">Only the artist can draw ✏️</span>';
      }
    }

    function renderScore() {
      api.setScore(`You ${S.scores.me} — ${S.scores.them} ${api.partnerName}`);
    }

    function clearCanvas() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /* ---------- chat ---------- */
    function addMsg(who, text, isSys = false) {
      const div = document.createElement('div');
      if (isSys) div.className = 'sys';
      else div.innerHTML = `<span class="who">${esc(who)}:</span> ${esc(text)}`;
      if (isSys) div.textContent = text;
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
    function sysMsg(t) { addMsg('', t, true); }

    function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      addMsg(api.myName, text);
      api.send({ kind: 'chat', text });
      if (!amDrawing()) {
        // guesser sends; drawer validates. Locally just wait for verdict.
      }
    }
    root.querySelector('#dr-send').onclick = sendChat;
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

    /* ---------- drawing input ---------- */
    let drawingNow = false;
    let lastPt = null;
    let pending = []; // points to flush
    let strokeColor = null, strokeSize = null;

    function toCanvas(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    }

    function strokeTo(pt, broadcast) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeSize * (canvas.width / 800);
      ctx.beginPath();
      ctx.moveTo(lastPt.x * canvas.width, lastPt.y * canvas.height);
      ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      ctx.stroke();
      if (broadcast) pending.push([pt.x, pt.y]);
      lastPt = pt;
    }

    canvas.addEventListener('pointerdown', e => {
      if (!amDrawing()) return;
      drawingNow = true;
      lastPt = toCanvas(e);
      strokeColor = S.color;
      strokeSize = S.size;
      // draw a dot
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeSize;
      ctx.beginPath();
      ctx.arc(lastPt.x * canvas.width, lastPt.y * canvas.height, strokeSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      pending = [[lastPt.x, lastPt.y]];
      api.send({ kind: 'begin', x: lastPt.x, y: lastPt.y, color: strokeColor, size: strokeSize, dot: true });
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawingNow || !amDrawing()) return;
      const pt = toCanvas(e);
      strokeTo(pt, true);
    });
    const flush = () => {
      if (pending.length) {
        api.send({ kind: 'pts', pts: pending });
        pending = [];
      }
    };
    const flushInterval = setInterval(flush, 60);
    window.addEventListener('pointerup', () => {
      if (drawingNow) { drawingNow = false; flush(); }
    });

    /* ---------- incoming messages ---------- */
    function onIncoming(d) {
      switch (d.kind) {
        case 'begin': {
          strokeColor = d.color;
          strokeSize = d.size;
          lastPt = { x: d.x, y: d.y };
          if (d.dot) {
            ctx.strokeStyle = d.color;
            ctx.beginPath();
            ctx.arc(d.x * canvas.width, d.y * canvas.height, d.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = d.color;
            ctx.fill();
          }
          break;
        }
        case 'pts': {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeSize * (canvas.width / 800);
          for (const [x, y] of d.pts) {
            ctx.beginPath();
            ctx.moveTo(lastPt.x * canvas.width, lastPt.y * canvas.height);
            ctx.lineTo(x * canvas.width, y * canvas.height);
            ctx.stroke();
            lastPt = { x, y };
          }
          break;
        }
        case 'clear': clearCanvas(); break;
        case 'chat': {
          addMsg(api.partnerName, d.text);
          if (amDrawing()) {
            const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm(d.text) && norm(d.text) === norm(S.word)) {
              api.send({ kind: 'correct' });
              S.scores.them++;
              renderScore();
              resultEl.innerHTML = `<div class="result-banner lose">${esc(api.partnerName)} guessed it! The word was “${esc(S.word)}” 💡</div>`;
              sysMsg(`${api.partnerName} guessed it! 🎉`);
              setTimeout(endRound, 2500);
            }
          }
          break;
        }
        case 'correct': {
          // I'm the guesser and I got it — the drawer's side ends the round
          S.scores.me++;
          renderScore();
          resultEl.innerHTML = `<div class="result-banner win">YOU GUESSED IT! 🎉 +1 point</div>`;
          sysMsg(`You guessed it! 🎉`);
          break;
        }
        case 'reveal': {
          sysMsg(`Nobody got it — the word was “${d.word}”`);
          break;
        }
        case 'newword': {
          sysMsg('New word chosen! 🔄');
          break;
        }
        case 'end': {
          // non-host drawer finished their round; host advances and rebroadcasts
          if (api.isHost) {
            S.round++;
            api.send({ kind: 'round', round: S.round });
            buildRoleUI();
          }
          break;
        }
        case 'round': {
          S.round = d.round;
          buildRoleUI();
          break;
        }
      }
    }

    // first round setup
    buildRoleUI();
    renderScore();
    sysMsg(amDrawing()
      ? `Round ${S.round + 1}: you draw first! ✏️`
      : `Round ${S.round + 1}: ${api.partnerName} draws first! 🎨`);

    return { onMsg: onIncoming, destroy() { clearInterval(flushInterval); } };
  }
};
