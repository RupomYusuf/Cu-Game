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
      turn: 'X', // host randomizes and broadcasts immediately
      over: false,
      wins: { X: 0, O: 0 },
    };
    if (api.isHost) {
      S.turn = Math.random() < 0.5 ? 'X' : 'O';
      api.send({ kind: 'first', t: S.turn });
    }
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
      if (api.isHost) { S.turn = Math.random() < 0.5 ? 'X' : 'O'; }
      resultEl.innerHTML = '';
      againBtn.style.display = 'none';
      render();
      api.send({ kind: 'again', t: S.turn });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'move') {
          apply(d.i, S.mySym === 'X' ? 'O' : 'X');
          const res = winner(S.board);
          if (res) finish(res);
        } else if (d.kind === 'first') {
          S.turn = d.t; render();
        } else if (d.kind === 'again') {
          S.board = Array(9).fill('');
          S.over = false;
          S.turn = d.t;
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
      turn: 1, // host randomizes and broadcasts immediately
      over: false,
      wins: { 1: 0, 2: 0 },
    };
    if (api.isHost) {
      S.turn = Math.random() < 0.5 ? 1 : 2;
      api.send({ kind: 'first', t: S.turn });
    }
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
      if (api.isHost) { S.turn = Math.random() < 0.5 ? 1 : 2; }
      resultEl.innerHTML = '';
      againBtn.style.display = 'none';
      render();
      api.send({ kind: 'again', t: S.turn });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'move') {
          const col = d.col;
          for (let r = ROWS - 1; r >= 0; r--) if (S.board[r][col] === 0) { apply(col, r); break; }
        } else if (d.kind === 'first') {
          S.turn = d.t; render();
        } else if (d.kind === 'again') {
          S.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
          S.over = false;
          winCells = [];
          S.turn = d.t;
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
    const S = { deck: 'warm', idx: 0, turn: 0 };
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
      const list = deck.cards.filter(c => !api.isApart() || !c.startsWith('🏠'));
      const card = list[S.idx % list.length];
      // alternation is anchored to the host so both screens agree
      const firstIsHost = S.turn % 2 === 0;
      const asker = firstIsHost === api.isHost ? api.myName : api.partnerName;
      askerEl.textContent = `💕 ${asker} answers first`;
      textEl.textContent = card;
      deckSel.value = S.deck;
    }

    deckSel.onchange = () => {
      S.deck = deckSel.value;
      S.idx = api.draw('cards-' + S.deck, DATA.decks[S.deck].cards.filter(c => !api.isApart() || !c.startsWith('🏠')).length);
      S.turn = 0;
      show();
      api.send({ kind: 'deck', deck: S.deck, idx: S.idx, turn: S.turn });
    };

    root.querySelector('#cards-next').onclick = () => {
      S.idx = api.draw('cards-' + S.deck, DATA.decks[S.deck].cards.filter(c => !api.isApart() || !c.startsWith('🏠')).length);
      S.turn++;
      show();
      api.send({ kind: 'card', idx: S.idx, turn: S.turn });
    };

    show();
    return {
      onMsg(d) {
        if (d.kind === 'card') { S.idx = d.idx; S.turn = d.turn; show(); }
        else if (d.kind === 'deck') { S.deck = d.deck; S.idx = d.idx; S.turn = d.turn; show(); }
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
      S.q = api.draw('likely', DATA.likely.length);
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
            // sender's 'me' is our 'them' and vice versa - flip to stay aligned
            S.theirs = d.pick === 'me' ? 'them' : 'me';
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
 * 5b. This or That
 * ===================================================== */
Games.thisorthat = {
  name: 'This or That', icon: '💘', desc: 'How in sync are you?',
  init(root, api) {
    const S = { q: 0, mine: null, theirs: null, synced: 0, rounds: 0 };
    root.innerHTML = `
      <div class="game-panel">
        <div class="game-prompt">Pick whichever you prefer — secretly. Do you match?</div>
        <div id="tot-q" class="likely-question" style="font-size:1.9rem"></div>
        <div class="likely-buttons" id="tot-buttons"></div>
        <div id="tot-result"></div>
        <div style="margin-top:14px"><button class="btn btn-primary" id="tot-next" style="display:none">Next →</button></div>
      </div>`;
    const qEl = root.querySelector('#tot-q');
    const btnsEl = root.querySelector('#tot-buttons');
    const resultEl = root.querySelector('#tot-result');
    const nextBtn = root.querySelector('#tot-next');

    function render() {
      const pair = DATA.thisorthat[S.q % DATA.thisorthat.length];
      qEl.textContent = `${pair[0]}  or  ${pair[1]}?`;
      btnsEl.innerHTML = '';
      const revealed = S.mine !== null && S.theirs !== null;
      pair.forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'likely-btn';
        b.textContent = label;
        if (revealed) {
          b.disabled = true;
          if (S.mine === i) b.classList.add('selected');
          if (S.mine === S.theirs && S.mine === i) b.classList.add('match');
        } else {
          if (S.mine === i) b.classList.add('selected');
          b.onclick = () => {
            S.mine = i;
            render();
            api.send({ kind: 'pick', pick: i });
          };
        }
        btnsEl.appendChild(b);
      });
      if (revealed) {
        if (S.mine === S.theirs) {
          resultEl.innerHTML = `<div class="result-banner win">Match! 💞 You're in sync. (+1)</div>`;
        } else {
          resultEl.innerHTML = `<div class="result-banner lose">Different! Time to convince each other 😄</div>`;
        }
        nextBtn.style.display = 'inline-block';
      } else if (S.mine !== null) {
        resultEl.innerHTML = `<p class="game-prompt">Waiting for ${esc(api.partnerName)}…</p>`;
      } else {
        resultEl.innerHTML = '';
      }
      api.setScore(`In sync: ${S.synced}/${S.rounds}`);
    }

    nextBtn.onclick = () => {
      if (S.mine === null || S.theirs === null) return;
      S.q = api.draw('tot', DATA.thisorthat.length);
      S.mine = null;
      S.theirs = null;
      resultEl.innerHTML = '';
      nextBtn.style.display = 'none';
      render();
      api.send({ kind: 'next', q: S.q });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'pick' && S.theirs === null) {
          S.theirs = d.pick;
          S.rounds++;
          if (S.mine !== null && S.mine === S.theirs) S.synced++;
          render();
        } else if (d.kind === 'next') {
          S.q = d.q; S.mine = null; S.theirs = null;
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
 * 5c. Never Have I Ever
 * ===================================================== */
Games.nhie = {
  name: 'Never Have I Ever', icon: '🙈', desc: 'Confessions unlocked',
  init(root, api) {
    const S = { q: 0, mine: null, theirs: null };
    root.innerHTML = `
      <div class="game-panel">
        <div class="game-prompt">Never have I ever…</div>
        <div class="big-card-question" id="nhie-q" style="min-height:80px"></div>
        <div class="likely-buttons" id="nhie-buttons"></div>
        <div id="nhie-result"></div>
        <div style="margin-top:14px"><button class="btn btn-primary" id="nhie-next" style="display:none">Next →</button></div>
      </div>`;
    const qEl = root.querySelector('#nhie-q');
    const btnsEl = root.querySelector('#nhie-buttons');
    const resultEl = root.querySelector('#nhie-result');
    const nextBtn = root.querySelector('#nhie-next');

    function render() {
      qEl.textContent = DATA.nhie[S.q % DATA.nhie.length];
      btnsEl.innerHTML = '';
      const revealed = S.mine !== null && S.theirs !== null;
      [['have', 'I have 🙋'], ['never', 'Never 🙅']].forEach(([val, label]) => {
        const b = document.createElement('button');
        b.className = 'likely-btn';
        b.textContent = label;
        if (revealed) {
          b.disabled = true;
          if (S.mine === val) b.classList.add('selected');
          if (val === 'have' && (S.mine === val || S.theirs === val)) b.classList.add('selected');
        } else {
          if (S.mine === val) b.classList.add('selected');
          b.onclick = () => {
            S.mine = val;
            render();
            api.send({ kind: 'ans', ans: val });
          };
        }
        btnsEl.appendChild(b);
      });
      if (revealed) {
        const iHave = S.mine === 'have', theyHave = S.theirs === 'have';
        let msg;
        if (iHave && theyHave) msg = `BOTH of you have! 😂 Details. Now.`;
        else if (iHave) msg = `Guilty: ${esc(api.myName)} has 🙋 ${esc(api.partnerName)} never has 🙅`;
        else if (theyHave) msg = `Guilty: ${esc(api.partnerName)} has 🙋 ${esc(api.myName)} never has 🙅`;
        else msg = `Neither of you! Wholesome 💛`;
        resultEl.innerHTML = `<div class="result-banner ${iHave || theyHave ? 'lose' : 'win'}">${msg}</div>`;
        nextBtn.style.display = 'inline-block';
      } else if (S.mine !== null) {
        resultEl.innerHTML = `<p class="game-prompt">Waiting for ${esc(api.partnerName)}…</p>`;
      } else {
        resultEl.innerHTML = '';
      }
    }

    nextBtn.onclick = () => {
      if (S.mine === null || S.theirs === null) return;
      S.q = api.draw('nhie', DATA.nhie.length);
      S.mine = null;
      S.theirs = null;
      resultEl.innerHTML = '';
      nextBtn.style.display = 'none';
      render();
      api.send({ kind: 'next', q: S.q });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'ans' && S.theirs === null) {
          S.theirs = d.ans;
          render();
        } else if (d.kind === 'next') {
          S.q = d.q; S.mine = null; S.theirs = null;
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
 * 5d. Two Truths & a Lie
 * ===================================================== */
Games.ttl = {
  name: 'Two Truths & a Lie', icon: '🕵️', desc: 'Can you fool your love?',
  init(root, api) {
    const S = { turn: 0, items: null, lie: null, myPick: null, theirPick: null, score: { me: 0, them: 0 } };
    const myTurn = () => (S.turn === 0) === api.isHost;

    root.innerHTML = `<div class="game-panel" id="ttl-panel"></div>`;
    const panel = root.querySelector('#ttl-panel');

    function render() {
      panel.innerHTML = '';
      const mine = myTurn();
      if (S.items === null) {
        if (mine) {
          panel.innerHTML = `
            <h3 class="likely-question" style="font-size:1.6rem">Your turn — fool ${esc(api.partnerName)}!</h3>
            <p class="game-prompt">Write two truths and one lie. Mark which one is the lie.</p>
            ${[0, 1, 2].map(i => `
              <div style="display:flex;gap:8px;align-items:center;margin:8px 0">
                <input type="radio" name="ttl-lie" id="ttl-lie-${i}" style="accent-color:var(--rose)" ${i === 0 ? 'checked' : ''}>
                <input type="text" id="ttl-in-${i}" maxlength="80" placeholder="Statement ${i + 1}" style="text-align:left">
              </div>`).join('')}
            <button class="btn btn-primary" id="ttl-send" style="margin-top:8px">Send 🕵️</button>`;
          panel.querySelector('#ttl-send').onclick = () => {
            const items = [0, 1, 2].map(i => panel.querySelector(`#ttl-in-${i}`).value.trim());
            if (items.some(v => !v)) { api.toast('Fill in all three statements!'); return; }
            const lie = [0, 1, 2].findIndex(i => panel.querySelector(`#ttl-lie-${i}`).checked);
            S.items = items;
            S.lie = lie;
            render();
            api.send({ kind: 'set', items, lie });
          };
        } else {
          panel.innerHTML = `
            <h3 class="likely-question" style="font-size:1.6rem">Two Truths & a Lie 🕵️</h3>
            <p class="game-prompt">Waiting for ${esc(api.partnerName)} to write their three statements…</p>`;
        }
      } else if (S.myPick === null && S.theirPick === null) {
        if (!mine) {
          panel.innerHTML = `
            <h3 class="likely-question" style="font-size:1.6rem">Spot the lie!</h3>
            <p class="game-prompt">One of these is a lie:</p>
            ${S.items.map((t, i) => `<button class="likely-btn" data-i="${i}" style="display:block;width:100%;max-width:420px;margin:8px auto;text-align:left;font-weight:400;font-size:1rem">${esc(t)}</button>`).join('')}`;
          panel.querySelectorAll('.likely-btn').forEach(b => {
            b.onclick = () => {
              S.myPick = +b.dataset.i;
              render();
              api.send({ kind: 'pick', pick: S.myPick });
            };
          });
        } else {
          panel.innerHTML = `<p class="game-prompt">Waiting for ${esc(api.partnerName)} to guess the lie…🤞</p>`;
        }
      } else {
        const revealed = S.theirPick !== null || S.myPick !== null;
        const guess = mine ? S.theirPick : S.myPick;
        if (guess === null) {
          panel.innerHTML = `<p class="game-prompt">Waiting for the verdict…🤞</p>`;
          return;
        }
        const caught = guess === S.lie;
        const list = S.items.map((t, i) => {
          const marks = [];
          if (i === S.lie) marks.push('🤥 the lie');
          if (i === guess) marks.push('🎯 their guess');
          return `<p style="margin:8px 0;font-weight:${i === S.lie ? '700' : '400'}">${esc(t)} ${marks.length ? '<br><small style="color:var(--rose-dark)">' + marks.join(' · ') + '</small>' : ''}</p>`;
        }).join('');
        panel.innerHTML = `
          <div class="result-banner ${caught ? (mine ? 'lose' : 'win') : (mine ? 'win' : 'lose')}">
            ${caught ? `${esc(mine ? api.partnerName : api.myName)} caught the lie! 🎉` : `${esc(mine ? api.myName : api.partnerName)} was fooled! 🤥`}
          </div>
          ${list}
          <button class="btn btn-primary" id="ttl-next" style="margin-top:10px">Next round →</button>`;
        panel.querySelector('#ttl-next').onclick = () => {
          S.turn ^= 1;
          S.items = null; S.lie = null; S.myPick = null; S.theirPick = null;
          render();
          api.send({ kind: 'next' });
        };
        api.setScore(`Score: ${mine ? S.score.them : S.score.me} — ${mine ? S.score.me : S.score.them}`);
      }
    }

    render();
    return {
      onMsg(d) {
        if (d.kind === 'set') {
          S.items = d.items;
          S.lie = d.lie;
          render();
        } else if (d.kind === 'pick') {
          S.theirPick = d.pick;
          const caught = S.theirPick === S.lie;
          if (caught) S.score.them++; else S.score.me++;
          render();
        } else if (d.kind === 'next') {
          S.turn ^= 1;
          S.items = null; S.lie = null; S.myPick = null; S.theirPick = null;
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5e. Guess My Answer
 * ===================================================== */
Games.guessmy = {
  name: 'Guess My Answer', icon: '💭', desc: 'How well do you know us?',
  init(root, api) {
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const S = { q: 0, mine: null, theirs: null, right: { me: 0, them: 0 } };

    root.innerHTML = `
      <div class="game-panel">
        <div class="game-prompt">Answer for yourself — and guess what ${esc(api.partnerName)} will say. Match = +1!</div>
        <div class="likely-question" id="gm-q" style="font-size:1.6rem"></div>
        <div id="gm-form"></div>
        <div id="gm-reveal"></div>
        <div style="margin-top:12px"><button class="btn btn-primary" id="gm-next" style="display:none">Next question →</button></div>
      </div>`;
    const qEl = root.querySelector('#gm-q');
    const formEl = root.querySelector('#gm-form');
    const revealEl = root.querySelector('#gm-reveal');
    const nextBtn = root.querySelector('#gm-next');

    function wireForm() {
      const sendBtn = root.querySelector('#gm-send');
      if (!sendBtn) return;
      sendBtn.onclick = () => {
        const ans = root.querySelector('#gm-mine')?.value.trim();
        const guess = root.querySelector('#gm-guess')?.value.trim();
        if (!ans || !guess) { api.toast('Fill in both answers!'); return; }
        S.mine = { ans, guess };
        formEl.innerHTML = `<p class="game-prompt">Locked in 🔒 — waiting for ${esc(api.partnerName)}…</p>`;
        render();
        api.send({ kind: 'ans', mine: ans, guess });
      };
    }

    function showForm() {
      formEl.innerHTML = `
        <input type="text" id="gm-mine" maxlength="60" placeholder="My answer…" style="text-align:left;margin-bottom:8px">
        <input type="text" id="gm-guess" maxlength="60" placeholder="I bet ${esc(api.partnerName)} says…" style="text-align:left">
        <button class="btn btn-primary" id="gm-send" style="margin-top:10px">Lock it in 🔒</button>`;
      wireForm();
    }

    function render() {
      const q = DATA.guessmy[S.q % DATA.guessmy.length];
      qEl.textContent = q;
      if (!(S.mine && S.theirs)) return;
      const iRight = norm(S.mine.guess) === norm(S.theirs.ans);
      const tRight = norm(S.theirs.guess) === norm(S.mine.ans);
      if (iRight) S.right.me++;
      if (tRight) S.right.them++;
      revealEl.innerHTML = `
        <div style="text-align:left;max-width:440px;margin:0 auto">
          <p style="margin:8px 0">${iRight ? '✅' : '❌'} <b>${esc(api.partnerName)} said:</b> ${esc(S.theirs.ans)}<br>
          <small style="color:var(--muted)">You guessed: ${esc(S.mine.guess)}</small></p>
          <p style="margin:8px 0">${tRight ? '✅' : '❌'} <b>You said:</b> ${esc(S.mine.ans)}<br>
          <small style="color:var(--muted)">${esc(api.partnerName)} guessed: ${esc(S.theirs.guess)}</small></p>
        </div>
        <div class="result-banner ${iRight && tRight ? 'win' : (iRight || tRight ? 'draw' : 'lose')}">
          ${iRight && tRight ? 'Perfect match! 💞 Both guessed right!' : (iRight || tRight ? 'Half right! 💫' : 'Neither! You clearly need to talk more 😄')}
        </div>`;
      nextBtn.style.display = 'inline-block';
      api.setScore(`Guessed right: ${S.right.me} — ${S.right.them}`);
    }

    nextBtn.onclick = () => {
      if (!(S.mine && S.theirs)) return;
      S.q = api.draw('gma', DATA.guessmy.length);
      S.mine = null;
      S.theirs = null;
      revealEl.innerHTML = '';
      nextBtn.style.display = 'none';
      showForm();
      render();
      api.send({ kind: 'next', q: S.q });
    };

    showForm();
    render();
    return {
      onMsg(d) {
        if (d.kind === 'ans' && !S.theirs) {
          S.theirs = { ans: d.mine, guess: d.guess };
          render();
        } else if (d.kind === 'next') {
          S.q = d.q;
          S.mine = null;
          S.theirs = null;
          revealEl.innerHTML = '';
          nextBtn.style.display = 'none';
          showForm();
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5f. Rock Paper Scissors
 * ===================================================== */
Games.rps = {
  name: 'Rock Paper Scissors', icon: '⚡', desc: 'Pick in secret — best reflex wins',
  init(root, api) {
    const EMO = ['✊', '✋', '✌️'];
    const NAME = ['Rock', 'Paper', 'Scissors'];
    const S = { mine: null, theirs: null, score: { me: 0, them: 0 } };
    root.innerHTML = `
      <div class="game-panel">
        <div class="turn-indicator" id="rps-turn"></div>
        <div class="likely-buttons" id="rps-buttons"></div>
        <div id="rps-result"></div>
        <div style="margin-top:12px"><button class="btn btn-primary" id="rps-next" style="display:none">Next round →</button></div>
      </div>`;
    const turnEl = root.querySelector('#rps-turn');
    const btnsEl = root.querySelector('#rps-buttons');
    const resultEl = root.querySelector('#rps-result');
    const nextBtn = root.querySelector('#rps-next');

    function render() {
      btnsEl.innerHTML = '';
      resultEl.innerHTML = '';
      nextBtn.style.display = 'none';
      const revealed = S.mine !== null && S.theirs !== null;
      EMO.forEach((e, i) => {
        const b = document.createElement('button');
        b.className = 'likely-btn';
        b.style.fontSize = '2.2rem';
        b.textContent = e;
        if (revealed) {
          b.disabled = true;
          if (S.mine === i) b.classList.add('selected');
          if (S.theirs === i) b.classList.add('match');
        } else {
          b.onclick = () => {
            S.mine = i;
            render();
            api.send({ kind: 'pick', p: i });
          };
        }
        btnsEl.appendChild(b);
      });
      if (!revealed) {
        turnEl.textContent = S.mine === null ? 'Pick your weapon — in secret!' : 'Waiting for ' + esc(api.partnerName) + '…';
      } else {
        // a beats b iff b is the one a beats: rock>scissors, paper>rock, scissors>paper
        const beats = (a, b) => (b + 1) % 3 === a;
        turnEl.textContent = `You: ${NAME[S.mine]}  ·  ${esc(api.partnerName)}: ${NAME[S.theirs]}`;
        let msg;
        if (S.mine === S.theirs) msg = `<div class="result-banner draw">Tie! Great minds 🤝</div>`;
        else if (beats(S.mine, S.theirs)) { S.score.me++; msg = `<div class="result-banner win">You win the round! 🎉</div>`; }
        else { S.score.them++; msg = `<div class="result-banner lose">${esc(api.partnerName)} wins the round!</div>`; }
        resultEl.innerHTML = msg;
        nextBtn.style.display = 'inline-block';
        api.setScore(`Rounds: ${S.score.me} — ${S.score.them}`);
      }
    }

    nextBtn.onclick = () => {
      S.mine = null;
      S.theirs = null;
      render();
      api.send({ kind: 'next' });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'pick' && S.theirs === null) { S.theirs = d.p; render(); }
        else if (d.kind === 'next') { S.mine = null; S.theirs = null; render(); }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5g. Reaction Duel
 * ===================================================== */
Games.reaction = {
  name: 'Reaction Duel', icon: '⚡', desc: 'First tap on green wins — no false starts!',
  init(root, api) {
    const S = { ready: { me: false, them: false }, phase: 'idle', goAt: 0, timer: null, myMs: null, theirMs: null, score: { me: 0, them: 0 } };

    root.innerHTML = `<div class="game-panel"><div id="rd-area"></div></div>`;
    const area = root.querySelector('#rd-area');

    function stopTimers() { if (S.timer) { clearTimeout(S.timer); S.timer = null; } }

    function render() {
      stopTimers();
      if (S.phase === 'idle') {
        const both = S.ready.me && S.ready.them;
        area.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Reaction Duel ⚡</h3>
          <p class="game-prompt">Wait for GREEN, then tap as fast as you can. Tap early and you lose the round!</p>
          <button class="btn btn-primary btn-big" id="rd-ready" ${S.ready.me ? 'disabled' : ''}>${S.ready.me ? 'Ready ✓' : (both ? 'Go!' : 'I\'m ready 🙋')}</button>
          <p class="muted" style="margin-top:10px">${both ? 'Starting…' : `Waiting for ${esc(api.partnerName)} to ready up…`}</p>`;
        area.querySelector('#rd-ready').onclick = () => {
          S.ready.me = true;
          render();
          api.send({ kind: 'ready' });
          maybeArm();
        };
        maybeArm();
      } else if (S.phase === 'wait') {
        area.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Reaction Duel ⚡</h3>
          <div class="big-card-question" style="background:#3a1c2a;color:#fff;border-radius:16px;min-height:130px">Wait for it…<br>🔴</div>
          <p class="muted">Tap now and it's a false start!</p>
          <div id="rd-tapzone" style="position:absolute;inset:0"></div>`;
        S.timer = setTimeout(go, S.delay);
        area.parentElement.style.position = 'relative';
        area.parentElement.onclick = () => falseStart();
      } else if (S.phase === 'go') {
        area.innerHTML = `
          <div class="big-card-question" style="background:#2e9e5b;color:#fff;border-radius:16px;min-height:130px;font-size:2.4rem">TAP! 🟢</div>
          <div id="rd-tapzone" style="position:absolute;inset:0"></div>`;
        area.parentElement.style.position = 'relative';
        area.parentElement.onclick = () => tap();
      } else if (S.phase === 'result') {
        let msg;
        if (S.myMs < 0) { S.score.them++; msg = `<div class="result-banner lose">False start! You lose the round 😅</div>`; }
        else if (S.theirMs < 0) { S.score.me++; msg = `<div class="result-banner win">${esc(api.partnerName)} false-started! You win! 🎉</div>`; }
        else if (S.myMs < S.theirMs) { S.score.me++; msg = `<div class="result-banner win">You win! ${S.myMs}ms vs ${S.theirMs}ms ⚡</div>`; }
        else if (S.theirMs < S.myMs) { S.score.them++; msg = `<div class="result-banner lose">${esc(api.partnerName)} wins! ${S.theirMs}ms vs your ${S.myMs}ms</div>`; }
        else msg = `<div class="result-banner draw">Dead heat! 🤝</div>`;
        area.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Reaction Duel ⚡</h3>
          ${msg}
          <button class="btn btn-primary" id="rd-next" style="margin-top:10px">Next round →</button>`;
        api.setScore(`Rounds: ${S.score.me} — ${S.score.them}`);
        area.parentElement.onclick = null;
        area.querySelector('#rd-next').onclick = () => {
          Object.assign(S, { ready: { me: false, them: false }, phase: 'idle', myMs: null, theirMs: null });
          render();
          api.send({ kind: 'next' });
        };
      }
    }

    function maybeArm() {
      if (S.ready.me && S.ready.them && api.isHost && S.phase === 'idle') {
        S.phase = 'wait';
        S.delay = 1500 + Math.floor(Math.random() * 4000);
        render();
        api.send({ kind: 'arm', delay: S.delay });
      }
    }

    function go() {
      if (S.phase !== 'wait') return;
      S.phase = 'go';
      S.goAt = Date.now();
      render();
    }

    function falseStart() {
      if (S.phase !== 'wait' || S.myMs !== null) return;
      stopTimers();
      S.myMs = -1;
      S.phase = 'result';
      render();
      api.send({ kind: 'tap', ms: -1 });
    }

    function tap() {
      if (S.phase !== 'go' || S.myMs !== null) return;
      S.myMs = Date.now() - S.goAt;
      S.phase = 'result';
      render();
      api.send({ kind: 'tap', ms: S.myMs });
    }

    render();
    return {
      onMsg(d) {
        if (d.kind === 'ready') { S.ready.them = true; if (S.phase === 'idle') render(); maybeArm(); }
        else if (d.kind === 'arm') { S.delay = d.delay; S.phase = 'wait'; render(); }
        else if (d.kind === 'tap') { S.theirMs = d.ms; if (S.myMs !== null && S.phase !== 'idle') { S.phase = 'result'; render(); } }
        else if (d.kind === 'next') { Object.assign(S, { ready: { me: false, them: false }, phase: 'idle', myMs: null, theirMs: null }); render(); }
      },
      destroy() { stopTimers(); }
    };
  }
};

/* =====================================================
 * 5h. Memory Match
 * ===================================================== */
Games.memory = {
  name: 'Memory Match', icon: '🃏', desc: 'Find the emoji pairs — most pairs wins',
  init(root, api) {
    const EMO = ['💋', '🔥', '💕', '🌹', '😍', '🌙', '✨', '💘'];
    const S = { order: null, sel: [], matched: Array(16).fill(-1), turn: 0, lock: false, over: false, pairs: { 0: 0, 1: 0 }, timer: null };

    root.innerHTML = `<div class="game-panel"><div class="turn-indicator" id="mm-turn"></div><div id="mm-grid"></div><div id="mm-result"></div><div style="margin-top:12px"><button class="btn btn-primary" id="mm-again" style="display:none">Rematch 🔁</button></div></div>`;
    const turnEl = root.querySelector('#mm-turn');
    const gridEl = root.querySelector('#mm-grid');
    const resultEl = root.querySelector('#mm-result');
    const againBtn = root.querySelector('#mm-again');

    const myTurn = () => (S.turn === 0) === api.isHost;

    function deal() {
      const deck = [];
      EMO.forEach((e, i) => { deck.push(i, i); });
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      S.order = deck;
      S.sel = [];
      S.matched = Array(16).fill(-1);
      S.turn = api.isHost ? (Math.random() < 0.5 ? 0 : 1) : 0;
      S.lock = false;
      S.over = false;
      S.pairs = { 0: 0, 1: 0 };
      resultEl.innerHTML = '';
      againBtn.style.display = 'none';
      render();
      api.send({ kind: 'deal', order: S.order, turn: S.turn });
    }

    function render() {
      if (S.order === null) return;
      turnEl.textContent = S.over ? '' :
        myTurn() ? 'Your turn — flip two cards!' : `Waiting for ${esc(api.partnerName)}…`;
      api.setScore(`Pairs: ${S.pairs[api.isHost ? 0 : 1]} — ${S.pairs[api.isHost ? 1 : 0]}`);
      gridEl.innerHTML = '';
      gridEl.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:420px;margin:0 auto';
      S.order.forEach((pairIdx, i) => {
        const b = document.createElement('button');
        const isMatched = S.matched[i] !== -1;
        const isFlipped = S.sel.includes(i);
        b.style.cssText = `aspect-ratio:1;border:none;border-radius:12px;font-size:2rem;cursor:pointer;font-family:inherit;background:${isMatched ? (S.matched[i] === (api.isHost ? 0 : 1) ? '#d9f2e3' : '#ffd3e0') : (isFlipped ? '#fff0f5' : '#ffd3e0')};opacity:${isMatched ? 0.85 : 1}`;
        b.textContent = (isMatched || isFlipped) ? EMO[pairIdx] : '?';
        b.disabled = isMatched || isFlipped || S.lock || S.over || !myTurn();
        if (!b.disabled) b.onclick = () => flip(i);
        gridEl.appendChild(b);
      });
    }

    function flip(i) {
      if (S.lock || S.over || S.sel.length >= 2 || S.sel.includes(i) || S.matched[i] !== -1 || !myTurn()) return;
      applyFlip(i);
      api.send({ kind: 'flip', i });
    }

    function applyFlip(i) {
      S.sel.push(i);
      render();
      if (S.sel.length === 2) {
        const [a, b] = S.sel;
        if (S.order[a] === S.order[b]) {
          S.timer = setTimeout(() => {
            S.matched[a] = S.turn;
            S.matched[b] = S.turn;
            S.pairs[S.turn]++;
            S.sel = [];
            const done = S.matched.every(m => m !== -1);
            if (done) {
              S.over = true;
              const mine = S.pairs[api.isHost ? 0 : 1];
              const theirs = S.pairs[api.isHost ? 1 : 0];
              resultEl.innerHTML = `<div class="result-banner ${mine > theirs ? 'win' : mine < theirs ? 'lose' : 'draw'}">${mine > theirs ? 'You win! 🎉' : mine < theirs ? `${esc(api.partnerName)} wins!` : 'It\'s a tie! 🤝'}</div>`;
              againBtn.style.display = 'inline-block';
            }
            render();
          }, 500);
        } else {
          S.lock = true;
          S.timer = setTimeout(() => {
            S.sel = [];
            S.lock = false;
            S.turn ^= 1;
            render();
          }, 950);
        }
      }
    }

    againBtn.onclick = () => {
      if (api.isHost) deal();
      else api.send({ kind: 'rematch' });
    };

    // host deals immediately; guest waits for the deal
    if (api.isHost) deal();
    else render();

    return {
      onMsg(d) {
        if (d.kind === 'deal') {
          S.order = d.order;
          S.sel = [];
          S.matched = Array(16).fill(-1);
          S.turn = d.turn || 0;
          S.lock = false;
          S.over = false;
          S.pairs = { 0: 0, 1: 0 };
          resultEl.innerHTML = '';
          againBtn.style.display = 'none';
          render();
        } else if (d.kind === 'flip') {
          applyFlip(d.i);
        } else if (d.kind === 'rematch' && api.isHost) {
          deal();
          api.send({ kind: 'deal', order: S.order });
        }
      },
      destroy() { if (S.timer) clearTimeout(S.timer); }
    };
  }
};

/* =====================================================
 * 5i. 20 Questions
 * ===================================================== */
Games.twentyq = {
  name: '20 Questions', icon: '🎯', desc: 'Think of a thing — can they guess it?',
  init(root, api) {
    const S = { role: api.isHost ? 'hide' : 'ask', secret: '', questions: 0, feed: [], over: false, iWon: null };

    root.innerHTML = `<div class="game-panel" id="tq-panel"></div>`;
    const panel = root.querySelector('#tq-panel');

    function render() {
      panel.innerHTML = '';
      const iHide = S.role === 'hide';
      if (S.over) {
        const win = iHide ? S.iWon : !S.iWon;
        const msg = iHide
          ? (S.iWon ? `They couldn't guess “${esc(S.secret)}” — point for you! 🕵️` : 'They guessed it! Point for them 🎉')
          : (S.iWon ? 'Out of questions... or wrong guess — point for them 🙃' : 'You guessed it! Point for you 🎉');
        panel.innerHTML = `
          <div class="result-banner ${win ? 'win' : 'lose'}">${msg}</div>
          <button class="btn btn-primary" id="tq-next" style="margin-top:12px">Swap roles →</button>`;
        panel.querySelector('#tq-next').onclick = () => {
          S.role = S.role === 'hide' ? 'ask' : 'hide';
          S.questions = 0; S.feed = []; S.over = false; S.iWon = null; S.secret = '';
          render();
          api.send({ kind: 'next' });
        };
        return;
      }
      if (iHide && !S.secret) {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Think of something 🤫</h3>
          <p class="game-prompt">A person, place, food, object — anything. ${esc(api.partnerName)} gets 20 yes/no questions.</p>
          <input type="text" id="tq-secret" maxlength="40" placeholder="Your secret thing…" style="text-align:left">
          <button class="btn btn-primary" id="tq-start" style="margin-top:10px">Start the interrogation 🎯</button>`;
        panel.querySelector('#tq-start').onclick = () => {
          S.secret = panel.querySelector('#tq-secret').value.trim();
          if (!S.secret) return;
          render();
          api.send({ kind: 'start' });
        };
        return;
      }
      const asking = S.role === 'ask';
      const feedHtml = S.feed.map(f => {
        if (f.k === 'q') {
          let ansBtns = '';
          if (iHide && !f.ans) ansBtns = `<div style="margin-top:6px">
            <button class="btn btn-small btn-primary tq-a" data-v="Yes">Yes</button>
            <button class="btn btn-small btn-secondary tq-a" data-v="No">No</button>
            <button class="btn btn-small btn-ghost tq-a" style="color:var(--rose-dark);border-color:var(--rose-light)" data-v="Maybe">Maybe</button></div>`;
          return `<p style="margin:6px 0"><b>${esc(f.by)}:</b> ${esc(f.text)}${f.ans ? ` <b style="color:var(--rose-dark)">— ${esc(f.ans)}</b>` : ''}${ansBtns}</p>`;
        }
        if (f.k === 'sys') return `<p class="sys" style="color:var(--muted);font-style:italic;margin:6px 0">${esc(f.text)}</p>`;
        if (f.k === 'g') {
          let vBtns = '';
          if (iHide && !f.ans) vBtns = `<div style="margin-top:6px">
            <button class="btn btn-small btn-primary tq-v" data-ok="1">Correct! 🎉</button>
            <button class="btn btn-small btn-secondary tq-v" data-ok="0">Wrong! 🙃</button></div>`;
          return `<p style="margin:6px 0"><b>🎯 ${esc(f.by)}'s final guess:</b> ${esc(f.text)}${f.ans ? ` <b style="color:var(--rose-dark)">— ${esc(f.ans)}</b>` : ''}${vBtns}</p>`;
        }
        return '';
      }).join('');
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.5rem">${asking ? 'Ask yes/no questions!' : 'Answer their questions'}</h3>
        <div class="card-tag">${S.questions} / 20 questions used</div>
        <div class="chat-log" id="tq-feed" style="height:220px">${feedHtml}</div>
        <div id="tq-inputrow"></div>`;
      const feedEl = panel.querySelector('#tq-feed');
      feedEl.scrollTop = feedEl.scrollHeight;

      // answer buttons for the hider
      panel.querySelectorAll('.tq-a').forEach(b => {
        b.onclick = () => {
          const last = [...S.feed].reverse().find(f => f.k === 'q' && !f.ans);
          if (last) { last.ans = b.dataset.v; render(); api.send({ kind: 'a', v: b.dataset.v }); }
        };
      });

      // verdict buttons for the final guess
      panel.querySelectorAll('.tq-v').forEach(b => {
        b.onclick = () => {
          const g = [...S.feed].reverse().find(f => f.k === 'g' && !f.ans);
          if (g) {
            const ok = b.dataset.ok === '1';
            g.ans = ok ? 'CORRECT! 🎉' : 'Wrong! 🙃';
            S.over = true;
            S.iWon = !ok;
            render();
            api.send({ kind: 'verdict', ok });
          }
        };
      });

      const row = panel.querySelector('#tq-inputrow');
      if (asking) {
        row.innerHTML = `
          <div class="chat-input-row" style="margin-top:8px">
            <input type="text" id="tq-ask" maxlength="80" placeholder="Ask a yes/no question…">
            <button class="btn btn-primary" id="tq-askbtn">Ask</button>
          </div>
          <div class="chat-input-row" style="margin-top:6px">
            <input type="text" id="tq-guessin" maxlength="40" placeholder="Or make your final guess…">
            <button class="btn btn-secondary" id="tq-guessbtn">🎯 Guess</button>
          </div>`;
        const ask = () => {
          const v = row.querySelector('#tq-ask').value.trim();
          if (!v) return;
          S.questions++;
          S.feed.push({ k: 'q', by: api.myName, text: v });
          render();
          api.send({ kind: 'ask', text: v });
        };
        row.querySelector('#tq-askbtn').onclick = ask;
        row.querySelector('#tq-ask').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
        row.querySelector('#tq-guessbtn').onclick = () => {
          const v = row.querySelector('#tq-guessin').value.trim();
          if (!v) return;
          S.feed.push({ k: 'g', by: api.myName, text: v });
          render();
          api.send({ kind: 'guess', text: v });
        };
        row.querySelector('#tq-guessin').addEventListener('keydown', e => { if (e.key === 'Enter') row.querySelector('#tq-guessbtn').click(); });
      } else {
        row.innerHTML = `<p class="muted" style="margin-top:8px">Answer with the buttons above 🤫</p>`;
      }
    }

    render();
    return {
      onMsg(d) {
        if (d.kind === 'start') { S.feed.push({ k: 'sys', text: 'The interrogation begins! 🎯' }); render(); }
        else if (d.kind === 'ask') { S.questions++; S.feed.push({ k: 'q', by: api.partnerName, text: d.text }); render(); }
        else if (d.kind === 'a') {
          const last = [...S.feed].reverse().find(f => f.k === 'q' && !f.ans);
          if (last) { last.ans = d.v; render(); }
        } else if (d.kind === 'guess') { S.feed.push({ k: 'g', by: api.partnerName, text: d.text }); render(); }
        else if (d.kind === 'verdict') {
          const g = [...S.feed].reverse().find(f => f.k === 'g');
          if (g) g.ans = d.ok ? 'CORRECT! 🎉' : 'Wrong! 🙃';
          S.over = true;
          S.iWon = !d.ok;
          render();
        } else if (d.kind === 'next') {
          S.role = S.role === 'hide' ? 'ask' : 'hide';
          S.questions = 0; S.feed = []; S.over = false; S.iWon = null; S.secret = '';
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5j. Finish My Sentence + Word Association
 * ===================================================== */
Games.finish = {
  name: 'Finish My Sentence', icon: '✍️', desc: 'Complete it — then compare',
  init(root, api) {
    const S = { q: 0, mine: null, theirs: null };
    root.innerHTML = `
      <div class="game-panel">
        <div class="big-card-question" id="fi-q" style="min-height:80px"></div>
        <div id="fi-form"></div>
        <div id="fi-reveal"></div>
        <div style="margin-top:12px"><button class="btn btn-primary" id="fi-next" style="display:none">Next →</button></div>
      </div>`;
    const qEl = root.querySelector('#fi-q');
    const formEl = root.querySelector('#fi-form');
    const revealEl = root.querySelector('#fi-reveal');
    const nextBtn = root.querySelector('#fi-next');

    function wire() {
      formEl.querySelector('#fi-send').onclick = () => {
        const v = formEl.querySelector('#fi-in').value.trim();
        if (!v) return;
        S.mine = v;
        formEl.innerHTML = `<p class="game-prompt">Saved — waiting for ${esc(api.partnerName)}…</p>`;
        render();
        api.send({ kind: 'ans', ans: v });
      };
    }

    function showForm() {
      formEl.innerHTML = `
        <input type="text" id="fi-in" maxlength="80" placeholder="Your ending…" style="text-align:left">
        <button class="btn btn-primary" id="fi-send" style="margin-top:10px">Reveal time ✨</button>`;
      wire();
    }

    function render() {
      qEl.textContent = DATA.finish[S.q % DATA.finish.length];
      if (S.mine && S.theirs) {
        revealEl.innerHTML = `
          <div style="text-align:left;max-width:440px;margin:0 auto">
            <p style="margin:8px 0"><b>${esc(api.myName)}:</b> ${esc(S.mine)}</p>
            <p style="margin:8px 0"><b>${esc(api.partnerName)}:</b> ${esc(S.theirs)}</p>
          </div>
          <div class="result-banner draw">Same minds think alike… or hilariously don't 😄</div>`;
        nextBtn.style.display = 'inline-block';
      }
    }

    nextBtn.onclick = () => {
      if (!(S.mine && S.theirs)) return;
      S.q = api.draw('finish', DATA.finish.length);
      S.mine = null; S.theirs = null;
      revealEl.innerHTML = ''; nextBtn.style.display = 'none';
      showForm(); render();
      api.send({ kind: 'next', q: S.q });
    };

    showForm();
    render();
    return {
      onMsg(d) {
        if (d.kind === 'ans' && !S.theirs) { S.theirs = d.ans; render(); }
        else if (d.kind === 'next') {
          S.q = d.q; S.mine = null; S.theirs = null;
          revealEl.innerHTML = ''; nextBtn.style.display = 'none';
          showForm(); render();
        }
      },
      destroy() {}
    };
  }
};

Games.wordchain = {
  name: 'Word Association', icon: '🔗', desc: 'Build a chain of connected words',
  init(root, api) {
    const S = { chain: [], turn: 0 };
    const myTurn = () => (S.turn === 0) === api.isHost;

    root.innerHTML = `<div class="game-panel">
      <div class="game-prompt">Take turns typing a word connected to the last one. Follow the chain and see where your minds wander 🌀</div>
      <div class="turn-indicator" id="wc-turn"></div>
      <div id="wc-chain" style="min-height:60px;font-size:1.15rem;line-height:2;word-break:break-word"></div>
      <div class="chat-input-row" style="max-width:420px;margin:10px auto">
        <input type="text" id="wc-in" maxlength="30" placeholder="Your word…">
        <button class="btn btn-primary" id="wc-add">Add</button>
      </div>
      <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="wc-clear">New chain ↺</button>
    </div>`;
    const turnEl = root.querySelector('#wc-turn');
    const chainEl = root.querySelector('#wc-chain');
    const inEl = root.querySelector('#wc-in');
    const addBtn = root.querySelector('#wc-add');

    function render() {
      chainEl.innerHTML = S.chain.length
        ? S.chain.map(w => `<span style="background:var(--rose-light);border-radius:10px;padding:3px 10px;display:inline-block;margin:3px">${esc(w)}</span>`).join('<span style="opacity:.5"> → </span>')
        : '<span class="muted">The chain is empty — start with anything…</span>';
      turnEl.textContent = myTurn() ? 'Your word 🔤' : `Waiting for ${esc(api.partnerName)}…`;
      inEl.disabled = !myTurn();
      addBtn.disabled = !myTurn();
    }

    function add() {
      const v = inEl.value.trim();
      if (!v || !myTurn()) return;
      if (S.chain.length >= 50) { api.toast('Chain complete — 50 words! 🏆'); return; }
      inEl.value = '';
      S.chain.push(v);
      S.turn ^= 1;
      render();
      api.send({ kind: 'add', text: v });
    }
    addBtn.onclick = add;
    inEl.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    root.querySelector('#wc-clear').onclick = () => {
      S.chain = [];
      S.turn = 0;
      render();
      api.send({ kind: 'clear' });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'add') { S.chain.push(d.text); S.turn ^= 1; render(); }
        else if (d.kind === 'clear') { S.chain = []; S.turn = 0; render(); }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5k. Would You Rather
 * ===================================================== */
Games.wyr = {
  name: 'Would You Rather', icon: '🔀', desc: 'Impossible choices — together',
  init(root, api) {
    const S = { q: 0, mine: null, theirs: null, same: 0, rounds: 0 };
    root.innerHTML = `
      <div class="game-panel">
        <div class="likely-question" id="wyr-q" style="font-size:1.7rem">Would you rather…</div>
        <div class="likely-buttons" id="wyr-buttons"></div>
        <div id="wyr-result"></div>
        <div style="margin-top:12px"><button class="btn btn-primary" id="wyr-next" style="display:none">Next →</button></div>
      </div>`;
    const qEl = root.querySelector('#wyr-q');
    const btnsEl = root.querySelector('#wyr-buttons');
    const resultEl = root.querySelector('#wyr-result');
    const nextBtn = root.querySelector('#wyr-next');

    function render() {
      const pair = DATA.wyr[S.q % DATA.wyr.length];
      qEl.textContent = 'Would you rather…';
      btnsEl.innerHTML = '';
      const revealed = S.mine !== null && S.theirs !== null;
      pair.forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'likely-btn';
        b.style.cssText = 'font-weight:400;font-size:1.05rem;min-height:80px';
        b.textContent = label;
        if (revealed) {
          b.disabled = true;
          if (S.mine === i) b.classList.add('selected');
          if (S.mine === S.theirs && S.mine === i) b.classList.add('match');
        } else {
          if (S.mine === i) b.classList.add('selected');
          b.onclick = () => { S.mine = i; render(); api.send({ kind: 'pick', pick: i }); };
        }
        btnsEl.appendChild(b);
      });
      if (revealed) {
        resultEl.innerHTML = S.mine === S.theirs
          ? `<div class="result-banner win">Same choice! 💞 Great minds.</div>`
          : `<div class="result-banner lose">Different! Defend your choice 😄</div>`;
        nextBtn.style.display = 'inline-block';
        api.setScore(`Same choice: ${S.same}/${S.rounds}`);
      } else if (S.mine !== null) {
        resultEl.innerHTML = `<p class="game-prompt">Waiting for ${esc(api.partnerName)}…</p>`;
      }
    }

    nextBtn.onclick = () => {
      if (S.mine === null || S.theirs === null) return;
      S.q = api.draw('wyr', DATA.wyr.length);
      S.mine = null; S.theirs = null;
      resultEl.innerHTML = ''; nextBtn.style.display = 'none';
      render();
      api.send({ kind: 'next', q: S.q });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'pick' && S.theirs === null) {
          S.theirs = d.pick; S.rounds++;
          if (S.mine !== null && S.mine === S.theirs) S.same++;
          render();
        } else if (d.kind === 'next') {
          S.q = d.q; S.mine = null; S.theirs = null;
          resultEl.innerHTML = ''; nextBtn.style.display = 'none';
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5l. Desert Island
 * ===================================================== */
Games.island = {
  name: 'Desert Island', icon: '🏝️', desc: 'Pick 3 items — think alike?',
  init(root, api) {
    const S = { sc: 0, mine: null, theirs: null, sub: false };
    root.innerHTML = `<div class="game-panel" id="di-panel"></div>`;
    const panel = root.querySelector('#di-panel');

    function render() {
      panel.innerHTML = '';
      const scenario = DATA.islandScenarios[S.sc % DATA.islandScenarios.length];
      const rot = (S.sc * 5) % DATA.islandItems.length;
      const sceneItems = DATA.islandItems.slice(rot).concat(DATA.islandItems.slice(0, rot)).slice(0, 12);
      const revealed = S.sub && S.theirs !== null;
      const mine = S.mine || Array(sceneItems.length).fill(false);
      const theirs = S.theirs || Array(sceneItems.length).fill(false);
      const count = mine.filter(Boolean).length;
      let overlapHtml = '';
      if (revealed) {
        let overlap = 0;
        const rows = sceneItems.map((item, i) => {
          if (mine[i] && theirs[i]) { overlap++; return `<p style="margin:4px 0">⭐ <b>${esc(item)}</b> — you both picked it!</p>`; }
          if (mine[i]) return `<p style="margin:4px 0">🙋 ${esc(item)} <small style="color:var(--muted)">(only you)</small></p>`;
          if (theirs[i]) return `<p style="margin:4px 0">💗 ${esc(item)} <small style="color:var(--muted)">(only ${esc(api.partnerName)})</small></p>`;
          return '';
        }).join('');
        overlapHtml = `
          <div class="result-banner ${overlap >= 3 ? 'win' : overlap >= 1 ? 'draw' : 'lose'}">
            ${overlap} item${overlap === 1 ? '' : 's'} in common ${overlap >= 3 ? '— soulmates of survival! 💞' : overlap >= 1 ? '— decent teamwork 😄' : '— good luck surviving 😅'}
          </div>${rows}`;
      }
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.6rem">${esc(scenario)}</h3>
        <p class="game-prompt">Pick exactly 3 things to bring. ${revealed ? 'The results:' : S.theirs !== null ? `${esc(api.partnerName)} locked in their 3 — now you!` : `Choose wisely — ${count}/3 picked`}</p>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:460px;margin:0 auto">
          ${sceneItems.map((item, i) => {
            const sel = revealed ? false : mine[i];
            const both = revealed && mine[i] && theirs[i];
            const mineOnly = revealed && mine[i] && !theirs[i];
            const theirsOnly = revealed && theirs[i] && !mine[i];
            return `<button class="likely-btn ${sel && !revealed ? 'selected' : ''}" data-i="${i}" ${revealed || (!sel && count >= 3) ? 'disabled' : ''}
              style="font-weight:400;font-size:.95rem;padding:10px 6px;${both ? 'background:#d9f2e3;border-color:var(--good)' : mineOnly || theirsOnly ? 'background:var(--rose-light);border-color:var(--rose)' : ''}">
              ${both ? '⭐ ' : mineOnly || theirsOnly ? '✓ ' : ''}${esc(item)}</button>`;
          }).join('')}
        </div>
        ${overlapHtml}
        ${revealed
          ? `<button class="btn btn-primary" id="di-next" style="margin-top:14px">Next scenario →</button>`
          : `<button class="btn btn-primary btn-big" id="di-submit" style="margin-top:14px" ${count === 3 ? '' : 'disabled'}>Lock in 3 🔒</button>`}`;
      if (revealed) {
        panel.querySelector('#di-next').onclick = () => {
          S.sc = api.draw('island', DATA.islandScenarios.length); S.mine = null; S.theirs = null;
          render();
          api.send({ kind: 'next', sc: S.sc });
        };
      } else {
        panel.querySelectorAll('.likely-btn').forEach(b => {
          b.onclick = () => {
            const i = +b.dataset.i;
            S.mine = S.mine || Array(sceneItems.length).fill(false);
            S.mine[i] = !S.mine[i];
            render();
          };
        });
        panel.querySelector('#di-submit').onclick = () => {
          S.sub = true;
          render();
          api.send({ kind: 'pick', items: S.mine });
        };
      }
      api.setScore('');
    }

    render();
    return {
      onMsg(d) {
        if (d.kind === 'pick') {
          // partner submitted first — hold it; reveal only once I submit too
          S.theirs = d.items;
          render();
        } else if (d.kind === 'next') {
          S.sc = d.sc; S.mine = null; S.theirs = null; S.sub = false;
          render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5m. Emoji Riddles
 * ===================================================== */
Games.riddles = {
  name: 'Emoji Riddles', icon: '🧩', desc: 'Decode the emoji word',
  init(root, api) {
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const S = { q: 0, mine: null, theirs: null, revealed: false, right: { me: 0, them: 0 } };
    root.innerHTML = `
      <div class="game-panel">
        <div class="game-prompt">What word do these emojis make? Both type a guess, then reveal!</div>
        <div id="rd-emoji" style="font-size:4rem;margin:10px 0"></div>
        <div id="rd-form"></div>
        <div id="rd-reveal"></div>
        <div style="margin-top:12px"><button class="btn btn-primary" id="rd-next" style="display:none">Next riddle →</button></div>
      </div>`;
    const emojiEl = root.querySelector('#rd-emoji');
    const formEl = root.querySelector('#rd-form');
    const revealEl = root.querySelector('#rd-reveal');
    const nextBtn = root.querySelector('#rd-next');

    function wire() {
      const btn = formEl.querySelector('#rd-send');
      if (!btn) return;
      btn.onclick = () => {
        const v = formEl.querySelector('#rd-in').value.trim();
        if (!v) return;
        S.mine = v;
        formEl.innerHTML = `<p class="game-prompt">Guess saved — waiting for ${esc(api.partnerName)}…</p>`;
        render();
        api.send({ kind: 'guess', guess: v });
      };
    }

    function showForm() {
      formEl.innerHTML = `
        <input type="text" id="rd-in" maxlength="40" placeholder="Your guess…" style="text-align:left">
        <button class="btn btn-primary" id="rd-send" style="margin-top:10px">Lock guess 🔒</button>`;
      wire();
    }

    function render() {
      const r = DATA.riddles[S.q % DATA.riddles.length];
      emojiEl.textContent = r.e;
      if (S.revealed) {
        const iRight = norm(S.mine) === norm(r.a);
        const tRight = norm(S.theirs) === norm(r.a);
        if (iRight) S.right.me++;
        if (tRight) S.right.them++;
        revealEl.innerHTML = `
          <div class="result-banner win">The answer: <b>${esc(r.a)}</b></div>
          <p style="margin:8px 0">${iRight ? '✅' : '❌'} You: ${esc(S.mine)} &nbsp; ${tRight ? '✅' : '❌'} ${esc(api.partnerName)}: ${esc(S.theirs)}</p>`;
        nextBtn.style.display = 'inline-block';
        api.setScore(`Solved: ${S.right.me} — ${S.right.them}`);
      } else if (S.mine && S.theirs) {
        revealEl.innerHTML = `<button class="btn btn-primary btn-big" id="rd-open">Reveal answer 🔓</button>`;
        revealEl.querySelector('#rd-open').onclick = () => {
          S.revealed = true;
          render();
          api.send({ kind: 'reveal' });
        };
      } else if (S.mine) {
        revealEl.innerHTML = `<p class="game-prompt">Waiting for ${esc(api.partnerName)}…</p>`;
      }
    }

    nextBtn.onclick = () => {
      if (!(S.mine && S.theirs)) return;
      S.q = api.draw('riddles', DATA.riddles.length);
      S.mine = null; S.theirs = null; S.revealed = false;
      revealEl.innerHTML = ''; nextBtn.style.display = 'none';
      showForm(); render();
      api.send({ kind: 'next', q: S.q });
    };

    showForm();
    render();
    return {
      onMsg(d) {
        if (d.kind === 'guess' && !S.theirs) { S.theirs = d.guess; render(); }
        else if (d.kind === 'reveal') { S.revealed = true; render(); }
        else if (d.kind === 'next') {
          S.q = d.q; S.mine = null; S.theirs = null; S.revealed = false;
          revealEl.innerHTML = ''; nextBtn.style.display = 'none';
          showForm(); render();
        }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5n. Blind Countdown
 * ===================================================== */
Games.blindcount = {
  name: 'Blind Countdown', icon: '⏱️', desc: 'Stop at exactly 10s — no peeking!',
  init(root, api) {
    const S = { phase: 'idle', startAt: 0, myMs: null, theirMs: null, score: { me: 0, them: 0 }, iv: null };
    root.innerHTML = `<div class="game-panel" id="bc-area"></div>`;
    const area = root.querySelector('#bc-area');

    function render() {
      if (S.iv) { clearInterval(S.iv); S.iv = null; }
      if (S.phase === 'idle') {
        area.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Blind Countdown ⏱️</h3>
          <p class="game-prompt">The clock starts together — stop it as close to <b>10.00 seconds</b> as you can. No timer visible!</p>
          <button class="btn btn-primary btn-big" id="bc-start">Start the countdown 🎲</button>`;
        area.querySelector('#bc-start').onclick = () => {
          S.startAt = Date.now() + 500;
          S.phase = 'run';
          S.myMs = null;
          S.theirMs = null;
          render();
          api.send({ kind: 'start' });
        };
      } else if (S.phase === 'run') {
        area.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Stop at 10s…</h3>
          <div class="big-card-question" style="min-height:70px">⏱️ ???</div>
          <button class="btn btn-primary btn-big" id="bc-stop">STOP!</button>`;
        area.querySelector('#bc-stop').onclick = () => {
          S.myMs = Math.max(0, Date.now() - S.startAt);
          S.phase = 'wait';
          render();
          api.send({ kind: 'stop', ms: S.myMs });
        };
        S.iv = setInterval(() => {
          if (S.phase !== 'run') return;
          const el = Date.now() - S.startAt;
          if (el > 16000) { // safety: auto-stop well past target
            S.myMs = el;
            S.phase = 'wait';
            render();
            api.send({ kind: 'stop', ms: S.myMs });
          }
        }, 200);
      } else if (S.phase === 'wait') {
        area.innerHTML = `<p class="game-prompt">Stopped at <b>${(S.myMs / 1000).toFixed(2)}s</b> — waiting for ${esc(api.partnerName)}…</p>`;
      } else if (S.phase === 'result') {
        const myDiff = Math.abs(S.myMs - 10000);
        const theirDiff = Math.abs(S.theirMs - 10000);
        let msg;
        if (myDiff < theirDiff) { S.score.me++; msg = `<div class="result-banner win">You win! ${(S.myMs / 1000).toFixed(2)}s vs ${(S.theirMs / 1000).toFixed(2)}s ⏱️</div>`; }
        else if (theirDiff < myDiff) { S.score.them++; msg = `<div class="result-banner lose">${esc(api.partnerName)} wins! ${(S.theirMs / 1000).toFixed(2)}s vs your ${(S.myMs / 1000).toFixed(2)}s</div>`; }
        else msg = `<div class="result-banner draw">Identical timing! 🤝</div>`;
        area.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">Blind Countdown ⏱️</h3>
          ${msg}
          <button class="btn btn-primary" id="bc-next" style="margin-top:10px">Next round →</button>`;
        api.setScore(`Rounds: ${S.score.me} — ${S.score.them}`);
        area.querySelector('#bc-next').onclick = () => {
          S.phase = 'idle';
          S.myMs = null;
          S.theirMs = null;
          render();
          api.send({ kind: 'next' });
        };
      }
    }

    render();
    return {
      onMsg(d) {
        if (d.kind === 'start') { S.startAt = Date.now() + 500; S.phase = 'run'; S.myMs = null; S.theirMs = null; render(); }
        else if (d.kind === 'stop') { S.theirMs = d.ms; if (S.myMs !== null) { S.phase = 'result'; render(); } }
        else if (d.kind === 'next') { S.phase = 'idle'; S.myMs = null; S.theirMs = null; render(); }
      },
      destroy() { if (S.iv) clearInterval(S.iv); }
    };
  }
};

/* =====================================================
 * 5o. Story Builder
 * ===================================================== */
Games.story = {
  name: 'Story Builder', icon: '📖', desc: 'Write a story together, one line at a time',
  init(root, api) {
    const S = { lines: [], turn: 0 };
    const myTurn = () => (S.turn === 0) === api.isHost;
    root.innerHTML = `<div class="game-panel">
      <div class="game-prompt">Take turns adding one line. See what your combined brain creates 📖</div>
      <div class="turn-indicator" id="sb-turn"></div>
      <div id="sb-story" style="text-align:left;max-width:460px;margin:0 auto;font-size:1.05rem;line-height:1.6;min-height:60px"></div>
      <div id="sb-inputrow"></div>
      <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light);margin-top:8px" id="sb-end">The End 🏁</button>
    </div>`;
    const turnEl = root.querySelector('#sb-turn');
    const storyEl = root.querySelector('#sb-story');
    const rowEl = root.querySelector('#sb-inputrow');

    function render() {
      storyEl.innerHTML = S.lines.length
        ? S.lines.map((l, i) => `<p style="margin:6px 0"><small style="color:var(--muted)">${i + 1}.</small> ${esc(l)}</p>`).join('')
        : '<p class="muted">Once upon a time… your turn to start!</p>';
      turnEl.textContent = S.lines.length === 0 ? 'Anyone can start!' :
        myTurn() ? 'Your line ✍️' : `Waiting for ${esc(api.partnerName)}…`;
      rowEl.innerHTML = myTurn() ? `
        <div class="chat-input-row" style="max-width:460px;margin:10px auto">
          <input type="text" id="sb-in" maxlength="120" placeholder="And then…">
          <button class="btn btn-primary" id="sb-add">Add</button>
        </div>` : '';
      if (myTurn()) {
        const add = () => {
          const v = rowEl.querySelector('#sb-in').value.trim();
          if (!v) return;
          S.lines.push(v);
          S.turn ^= 1;
          render();
          api.send({ kind: 'add', text: v });
        };
        rowEl.querySelector('#sb-add').onclick = add;
        rowEl.querySelector('#sb-in').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      }
    }

    root.querySelector('#sb-end').onclick = () => {
      S.lines.push('🏆 THE END — written by you two.');
      S.turn = 0;
      render();
      api.send({ kind: 'add', text: '🏆 THE END — written by you two.' });
    };

    render();
    return {
      onMsg(d) {
        if (d.kind === 'add') { S.lines.push(d.text); S.turn ^= 1; render(); }
      },
      destroy() {}
    };
  }
};

/* =====================================================
 * 5p. Word Rush
 * ===================================================== */
Games.rush = {
  name: 'Word Rush', icon: '🔤', desc: 'Hidden answers — reveal after the timer! First to 20',
  init(root, api) {
    const TARGET = 20;
    const S = { cat: null, scores: { me: 0, them: 0 }, myWords: [], theirWords: [], revealed: false, endAt: 0, iv: null, winner: null };

    root.innerHTML = `<div class="game-panel" id="wr-area"></div>`;
    const area = root.querySelector('#wr-area');

    function render() {
      if (S.iv) { clearInterval(S.iv); S.iv = null; }
      const revealed = S.revealed;
      let wordsHtml = '';
      if (revealed) {
        const mine = S.myWords.map(w => `<p style="margin:3px 0"><b>🙋 ${esc(api.myName)}:</b> ${esc(w)}</p>`).join('');
        const theirs = S.theirWords.length
          ? S.theirWords.map(w => `<p style="margin:3px 0"><b>💗 ${esc(api.partnerName)}:</b> ${esc(w)}</p>`).join('')
          : '<p style="margin:3px 0"><i>💗 ' + esc(api.partnerName) + ' typed nothing this round</i></p>';
        wordsHtml = `<div style="text-align:left;max-width:440px;margin:10px auto;border-top:2px solid var(--rose-light);padding-top:8px">
          <p class="muted" style="font-size:.85rem;margin-bottom:4px">This round's answers:</p>
          ${mine}${theirs}</div>`;
      } else {
        wordsHtml = `<p class="muted" style="font-size:.9rem;margin-top:8px">🔒 Your answers are hidden until the timer ends — no cheating! You've typed <b>${S.myWords.length}</b>.</p>`;
      }
      let banner = '';
      if (S.winner) {
        banner = `<div class="result-banner ${S.winner === 'me' ? 'win' : 'lose'}" style="margin-top:10px">${S.winner === 'me' ? 'YOU WIN! 🏆 First to ' + TARGET + '!' : esc(api.partnerName) + ' reached ' + TARGET + ' first!'}</div>`;
      }
      area.innerHTML = `
        <h3 class="likely-question" style="font-size:1.5rem">Word Rush 🔤</h3>
        <p class="game-prompt">Category:</p>
        <div class="likely-question" style="font-size:1.8rem">${S.cat !== null ? esc(DATA.rush[S.cat % DATA.rush.length]) : '…'}</div>
        <div class="draw-word" id="wr-count" style="font-size:2.2rem">${S.winner ? '🏆' : '15'}</div>
        <p class="game-prompt">${S.winner ? '' : (revealed ? 'Next category coming up…' : 'Type anything that fits — each word = 1 point. First to ' + TARGET + ' wins!')}</p>
        <div id="wr-inputrow"></div>
        <div style="margin-top:12px"><span class="card-tag">You: ${S.scores.me}</span>
        <span class="card-tag" style="margin-left:6px">${esc(api.partnerName)}: ${S.scores.them}</span>
        <span class="card-tag" style="margin-left:6px;background:#f0e6d3">🎯 ${TARGET} to win</span></div>
        ${banner}
        ${wordsHtml}`;
      if (S.winner) {
        area.querySelector('#wr-inputrow').innerHTML = `<button class="btn btn-primary" id="wr-again" style="margin-top:10px">Play again ↺</button>`;
        area.querySelector('#wr-again').onclick = () => {
          if (api.isHost) {
            S.scores = { me: 0, them: 0 };
            S.winner = null;
            startRound();
          }
        };
        return;
      }
      if (revealed) return; // input hidden during reveal window
      const row = area.querySelector('#wr-inputrow');
      row.innerHTML = `
        <div class="chat-input-row" style="max-width:420px;margin:0 auto">
          <input type="text" id="wr-in" maxlength="40" placeholder="Type a word…">
          <button class="btn btn-primary" id="wr-add">Go!</button>
        </div>`;
      const submit = () => {
        const v = row.querySelector('#wr-in').value.trim();
        if (!v || S.winner) return;
        row.querySelector('#wr-in').value = '';
        S.myWords.push(v);
        S.scores.me++;
        render();
        api.send({ kind: 'wr-score', score: S.scores.me, win: S.scores.me >= TARGET });
        if (S.scores.me >= TARGET && !S.winner) {
          S.winner = 'me';
          revealMine();
          render();
        }
      };
      row.querySelector('#wr-add').onclick = submit;
      row.querySelector('#wr-in').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    }

    function startTimer(explicitEndAt) {
      S.endAt = explicitEndAt || (Date.now() + 15000);
      S.iv = setInterval(() => {
        const left = Math.max(0, Math.ceil((S.endAt - Date.now()) / 1000));
        const el = area.querySelector('#wr-count');
        if (el && !S.winner && !S.revealed) el.textContent = left;
        if (left <= 0 && !S.revealed) roundEnd();
      }, 250);
    }

    /* time's up: publish my words, reveal when both lists are in */
    function roundEnd() {
      if (S.revealed) return;
      S.revealed = true;
      if (S.iv) { clearInterval(S.iv); S.iv = null; }
      api.send({ kind: 'wr-reveal', words: S.myWords, score: S.scores.me });
      render();
    }

    startTimer(); // runs once per round

    /* host drives the next round after the reveal window */
    S.nextTimer = null;
    function scheduleNext() {
      if (!api.isHost || S.winner) return;
      if (S.nextTimer) clearTimeout(S.nextTimer);
      S.nextTimer = setTimeout(() => {
        S.cat = api.draw('rush', DATA.rush.length);
        S.myWords = [];
        S.theirWords = [];
        S.revealed = false;
        render();
        api.send({ kind: 'wr-start', cat: S.cat });
      }, 8000);
    }

    if (api.isHost) {
      S.cat = api.draw('rush', DATA.rush.length);
      api.send({ kind: 'wr-start', cat: S.cat });
    } else {
      api.send({ kind: 'wr-sync' }); // get the current round if one is running
    }
    return {
      onMsg(d) {
        if (d.kind === 'wr-sync') {
          // host answers a late opener with the live round
          if (S.cat !== null) api.send({ kind: 'wr-start', cat: S.cat, remain: Math.max(1, S.endAt - Date.now()) });
        } else if (d.kind === 'wr-start') {
          if (S.iv) { clearInterval(S.iv); S.iv = null; }
          if (S.nextTimer) { clearTimeout(S.nextTimer); S.nextTimer = null; }
          S.cat = d.cat;
          S.myWords = [];
          S.theirWords = [];
          S.revealed = false;
          render();
          startTimer(d.remain ? Date.now() + d.remain : undefined);
        } else if (d.kind === 'wr-score') {
          S.scores.them = d.score;
          if (d.win) S.winner = 'them';
          render();
        } else if (d.kind === 'wr-reveal') {
          S.theirWords = d.words || [];
          S.revealed = true;
          render();
          scheduleNext();
        }
      },
      destroy() {
        if (S.iv) clearInterval(S.iv);
        if (S.nextTimer) clearTimeout(S.nextTimer);
      }
    };
  }
};

Games.intimate = {
  name: 'Intimate 🔞', icon: '💋', desc: 'Real games · 18+ · you two only',
  init(root, api) {
    const L = DATA.intimate;
    const S = {
      phase: 'select', // select | waiting | consent | play
      level: null,     // 'soft' | 'extreme'
      pending: null,
      cardTurn: 0,
      mode: 'menu',    // menu | cards | dice | tod | timer | snaps | wheel | levels
      idx: 0,
      apart: true,     // playing from two different places (camera/snaps only)
      snap: null,      // index of the current snap challenge
      tod: null,       // { turn, showing:{type,text}|null, passes:{me,them} }
      timer: null,     // { end, iv, dare }
      lv: 0,           // level-up progress
      deg: 0,          // accumulated wheel rotation
      kiss: null,      // { i, end, iv } current kiss-roulette round
      serumFeed: [],   // truth serum Q&A
      wRound: 0, wGuess: null, wPhrase: '', wRevealed: false, wVerdictOk: null,
      wScore: { me: 0, them: 0 }, // whisper challenge
      kisses: 0,       // kiss tally
      mood: 0,         // rounds played — drives the warm -> intense curve
    };

    root.innerHTML = `<div class="game-panel" id="in-panel"></div>`;
    const panel = root.querySelector('#in-panel');

    const label = lvl => L[lvl] ? L[lvl].name : lvl;
    const rnd = arr => Math.floor(Math.random() * arr.length);
    const onMyTurn = () => (S.tod.turn === 0) === api.isHost;

    function stopTimer() {
      if (S.timer) { clearInterval(S.timer.iv); S.timer = null; }
    }

    function render() {
      panel.innerHTML = '';
      if (S.phase === 'select') {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Just for the two of you…</h3>
          <p class="game-prompt">🔞 18+ · Only play what you both want — everything can always be skipped.</p>
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
          <p class="game-prompt">Only say yes if you truly want to — "no" is always okay. 💛</p>
          <div class="likely-buttons" style="margin-top:16px">
            <button class="likely-btn match" id="in-yes" style="font-size:1.2rem">Yes 💕</button>
            <button class="likely-btn" id="in-no" style="font-size:1.2rem">Not now</button>
          </div>`;
        panel.querySelector('#in-yes').onclick = () => {
          S.level = S.pending;
          S.idx = 0;
          S.mode = 'menu';
          S.tod = null;
          stopTimer();
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
        if (S.mode === 'menu') renderMenu();
        else if (S.mode === 'cards') renderCards();
        else if (S.mode === 'dice') renderDice();
        else if (S.mode === 'snaps') renderSnaps();
        else if (S.mode === 'tod') renderTod();
        else if (S.mode === 'timer') renderTimer();
        else if (S.mode === 'wheel') renderWheel();
        else if (S.mode === 'levels') renderLevels();
        else if (S.mode === 'kiss') renderKiss();
        else if (S.mode === 'serum') renderSerum();
        else if (S.mode === 'whisper') renderWhisper();
      }
    }

    /* ---------- shared: back to game menu ---------- */
    function toMode(mode, sync = true) {
      stopTimer();
      if (S.kiss && S.kiss.iv) clearInterval(S.kiss.iv);
      S.kiss = null;
      S.mode = mode;
      S.snap = null;
      if (mode === 'tod' && !S.tod) S.tod = { turn: 0, showing: null, passes: { me: 0, them: 0 } };
      if (mode === 'levels') S.lv = 0;
      if (mode === 'whisper') { S.wRound = 0; S.wGuess = null; S.wRevealed = false; S.wVerdictOk = null; }
      render();
      if (sync) api.send({ kind: 'mode', mode });
    }

    function backBtn() {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'color:var(--rose-dark);border-color:var(--rose-light)';
      b.textContent = '◀ All games';
      b.onclick = () => toMode('menu');
      return b;
    }

    /* ---------- game menu ---------- */
    function renderMenu() {
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.7rem">${esc(label(S.level))} — pick a game</h3>
        <p class="game-prompt">🔞 Everything can be skipped. "Not now" is always okay. 💛</p>
        <div class="game-grid" style="margin-top:14px">
          <button class="game-card" data-mode="snaps"><span class="gc-icon">📷</span><span class="gc-name">Snaps</span></button>
          <button class="game-card" data-mode="cards"><span class="gc-icon">💌</span><span class="gc-name">Card deck</span></button>
          <button class="game-card" data-mode="dice"><span class="gc-icon">🎲</span><span class="gc-name">Love Dice</span></button>
          <button class="game-card" data-mode="tod"><span class="gc-icon">🎯</span><span class="gc-name">Truth or Dare</span></button>
          <button class="game-card" data-mode="timer"><span class="gc-icon">⏱️</span><span class="gc-name">60-Second Challenge</span></button>
          <button class="game-card" data-mode="wheel"><span class="gc-icon">🎡</span><span class="gc-name">${S.level === 'extreme' ? 'Wheel of Fire' : 'Spin the Wheel'}</span></button>
          <button class="game-card" data-mode="kiss"><span class="gc-icon">💋</span><span class="gc-name">Kiss Roulette</span></button>
          <button class="game-card" data-mode="serum"><span class="gc-icon">🧪</span><span class="gc-name">Truth Serum</span></button>
          <button class="game-card" data-mode="whisper"><span class="gc-icon">🤫</span><span class="gc-name">Whisper Challenge</span></button>
          ${S.level === 'extreme' ? '<button class="game-card" data-mode="levels"><span class="gc-icon">🏆</span><span class="gc-name">Level Up</span></button>' : ''}
        </div>
        <p class="muted" style="margin-top:10px;font-size:.8rem">${api.isApart()
          ? '📱 Apart mode: only camera & snap challenges.'
          : '🏠 Together mode: includes challenges for the same room.'}</p>`;
      panel.querySelectorAll('.game-card').forEach(b => b.onclick = () => toMode(b.dataset.mode));
    }

    /* ---------- card deck ---------- */
    function renderCards() {
      const deck = L[S.level];
      const list = deck.cards.filter(c => !api.isApart() || !c.startsWith('🏠'));
      const card = list[S.idx % list.length];
      const firstIsHost = S.cardTurn % 2 === 0;
      const asker = firstIsHost === api.isHost ? api.myName : api.partnerName;
      panel.innerHTML = `
        <div><span class="card-tag">${esc(deck.name)} · card ${S.idx % list.length + 1}</span>
        <span class="card-tag" style="margin-left:6px">💕 ${esc(asker)} goes first</span></div>
        <div class="big-card-question">${esc(card)}</div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" id="in-next">Next card 💞</button>
          ${backBtn().outerHTML.replace('<button', '<button id="in-back"')}
        </div>`;
      panel.querySelector('#in-next').onclick = () => {
        S.idx = api.draw('icards-' + S.level, list.length);
        S.cardTurn++;
        render();
        api.send({ kind: 'next', idx: S.idx, turn: S.cardTurn });
      };
      panel.querySelector('#in-back').onclick = () => toMode('menu');
    }

    /* ---------- love dice ---------- */
    function renderDice() {
      const cfg = L[S.level].dice;
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.7rem">Love Dice 🎲</h3>
        <p class="game-prompt">Roll and do what the dice say — to ${esc(api.partnerName)}… or yourself, your call 😉</p>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin:10px 0">
          <div class="draw-word" id="dice-a">?</div>
          <div class="draw-word" id="dice-t" style="font-size:1.4rem">&nbsp;</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-primary btn-big" id="dice-roll">Roll 🎲</button>
          ${backBtn().outerHTML.replace('<button', '<button id="dice-back"')}
        </div>`;
      panel.querySelector('#dice-back').onclick = () => toMode('menu');
      panel.querySelector('#dice-roll').onclick = () => {
        const pair = api.draw('dice-' + S.level, cfg.whats.length * cfg.hows.length);
        const a = Math.floor(pair / cfg.hows.length), ti = pair % cfg.hows.length;
        animateDice(cfg, a, ti);
        api.send({ kind: 'dice', a, ti });
      };
    }

    function animateDice(cfg, aFinal, tFinal) {
      const aEl = panel.querySelector('#dice-a'), tEl = panel.querySelector('#dice-t');
      const rollBtn = panel.querySelector('#dice-roll');
      if (rollBtn) rollBtn.disabled = true;
      let n = 0;
      const iv = setInterval(() => {
        n++;
        if (aEl) aEl.textContent = cfg.whats[rnd(cfg.whats)];
        if (tEl) tEl.textContent = '— ' + cfg.hows[rnd(cfg.hows)];
        if (n >= 8) {
          clearInterval(iv);
          if (aEl) aEl.textContent = cfg.whats[aFinal];
          if (tEl) tEl.textContent = '— ' + cfg.hows[tFinal];
          if (rollBtn) rollBtn.disabled = false;
        }
      }, 90);
    }

    /* dare pool depends on apart/together mode */
    function moodLimit() {
      const pool = darePool();
      return Math.max(3, Math.round(pool.length * Math.min(1, 0.4 + S.mood * 0.15)));
    }

    function darePool() {
      const cfg = L[S.level];
      return api.isApart() ? cfg.daresApart : cfg.daresTogether;
    }

    /* mood curve: pools are ordered warm -> intense; early rounds only draw
     * from the milder start, unlocking the spicier end as the night goes on */
    function pickByMood(pool) {
      const frac = Math.min(1, 0.4 + S.mood * 0.15);
      const n = Math.max(3, Math.round(pool.length * frac));
      return rnd(pool.slice(0, n));
    }

    /* animate the wheel to a wedge (works for both local spins and partner spins) */
    function wheelSpinTo(i) {
      const cv = panel.querySelector('#wheel-cv');
      if (!cv) return;
      const cfg = L[S.level];
      const N = cfg.wheel.length;
      const target = ((90 - i * (360 / N) - 180 / N) % 360 + 360) % 360;
      const cur = ((S.deg % 360) + 360) % 360;
      S.deg += (target - cur + 360) % 360 + 1440;
      requestAnimationFrame(() => { cv.style.transform = `rotate(${S.deg}deg)`; });
      const spinBtn = panel.querySelector('#wheel-spin');
      if (spinBtn) spinBtn.disabled = true;
      panel.querySelector('#wheel-out').textContent = '…';
      setTimeout(() => {
        panel.querySelector('#wheel-out').textContent = cfg.wheel[i];
        const btn = panel.querySelector('#wheel-spin');
        if (btn) btn.disabled = false;
      }, 3200);
    }

    /* ---------- snaps ---------- */
    function customKey() { return 'cgn-custom-snaps-' + S.level; }
    function getCustomSnaps() {
      try { return JSON.parse(localStorage.getItem(customKey()) || '[]'); } catch (e) { return []; }
    }
    function saveCustomSnaps(list) {
      try { localStorage.setItem(customKey(), JSON.stringify(list)); } catch (e) {}
    }
    function snapPool() { return L[S.level].snaps.concat(getCustomSnaps()); }

    function renderSnaps() {
      const cfg = L[S.level];
      if (S.snap === null) {
        const custom = getCustomSnaps();
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Snaps 📷</h3>
          <p class="game-prompt">One of you draws a snap challenge, takes the photo on your phone and sends it privately. The game never sees or stores your snaps 🔒</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px">
            <button class="btn btn-primary btn-big" id="snap-get">Get a snap challenge 📸</button>
            ${backBtn().outerHTML.replace('<button', '<button id="snap-back"')}
          </div>
          <div style="margin-top:22px;text-align:left;max-width:440px;margin-left:auto;margin-right:auto;border-top:1px solid var(--rose-light);padding-top:14px">
            <p class="muted" style="font-size:.85rem;margin-bottom:8px">✍️ <b>Your private challenges</b> — write your own. Stored only on this device, never uploaded:</p>
            <div id="snap-custom-list">${custom.length ? '' : '<p class="muted" style="font-size:.8rem">Nothing yet — anything you add gets mixed into the draw.</p>'}</div>
            <div class="chat-input-row" style="margin-top:8px">
              <input type="text" id="snap-custom-in" maxlength="120" placeholder="Add your own challenge…">
              <button class="btn btn-primary" id="snap-custom-add">➕</button>
            </div>
          </div>`;
        panel.querySelector('#snap-back').onclick = () => toMode('menu');
        panel.querySelector('#snap-get').onclick = () => {
          const pool = snapPool();
          S.snap = api.draw('snaps-' + S.level, pool.length);
          S.snapText = pool[S.snap];
          S.snapWho = api.myName;
          render();
          api.send({ kind: 'snap', i: S.snap, who: S.snapWho, txt: S.snapText });
        };
        const customList = panel.querySelector('#snap-custom-list');
        custom.forEach((t, i) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0;font-size:.9rem';
          row.innerHTML = `<span>🔥 ${esc(t)}</span>`;
          const del = document.createElement('button');
          del.className = 'btn btn-ghost btn-small';
          del.style.cssText = 'color:var(--rose-dark);border-color:var(--rose-light);padding:2px 10px';
          del.textContent = '✕';
          del.onclick = () => {
            const list = getCustomSnaps();
            list.splice(i, 1);
            saveCustomSnaps(list);
            render();
          };
          row.appendChild(del);
          customList.appendChild(row);
        });
        const addCustom = () => {
          const inp = panel.querySelector('#snap-custom-in');
          const val = inp.value.trim();
          if (!val) return;
          const list = getCustomSnaps();
          list.push(val);
          saveCustomSnaps(list);
          render();
        };
        panel.querySelector('#snap-custom-add').onclick = addCustom;
        panel.querySelector('#snap-custom-in').addEventListener('keydown', e => { if (e.key === 'Enter') addCustom(); });
      } else {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Snaps 📷</h3>
          <div class="card-tag">📸 for ${esc(S.snapWho || api.myName)}</div>
          <div class="big-card-question">${esc(S.snapText || '')}</div>
          <p class="muted" style="font-size:.85rem">Take it, send it privately, make their day 😏</p>
          <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" id="snap-new">Another one 🔄</button>
            <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="snap-back2">◀ All games</button>
          </div>`;
        panel.querySelector('#snap-new').onclick = () => {
          const pool = snapPool();
          S.snap = api.draw('snaps-' + S.level, pool.length);
          S.snapText = pool[S.snap];
          S.snapWho = api.myName;
          render();
          api.send({ kind: 'snap', i: S.snap, who: S.snapWho, txt: S.snapText });
        };
        panel.querySelector('#snap-back2').onclick = () => { S.snap = null; toMode('menu'); };
      }
    }


    /* ---------- truth serum ---------- */
    function renderSerum() {
      const last = S.serumFeed[S.serumFeed.length - 1];
      const needAns = last && last.k === 'q';
      const feedHtml = S.serumFeed.length ? S.serumFeed.map(f =>
        f.k === 'q'
          ? `<p style="margin:8px 0"><b>🧪 ${esc(f.by)} asks:</b> ${esc(f.text)}</p>`
          : `<p style="margin:8px 0;padding-left:16px">💬 <i>${esc(f.text)}</i></p>`
      ).join('') : '<p class="muted" style="font-size:.9rem">Ask anything — the other one MUST answer truthfully. No skipping! 🧪</p>';
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.6rem">Truth Serum 🧪</h3>
        <div class="chat-log" id="ts-feed" style="height:230px">${feedHtml}</div>
        <div id="ts-row"></div>
        <div style="margin-top:10px">${backBtn().outerHTML.replace('<button', '<button id="ts-back"')}</div>`;
      panel.querySelector('#ts-back').onclick = () => toMode('menu');
      const feedEl = panel.querySelector('#ts-feed');
      feedEl.scrollTop = feedEl.scrollHeight;
      const row = panel.querySelector('#ts-row');
      if (needAns) {
        const iAnswer = last.by !== api.myName;
        row.innerHTML = iAnswer ? `
          <div class="chat-input-row" style="margin-top:8px">
            <input type="text" id="ts-ans" maxlength="200" placeholder="Your truthful answer…">
            <button class="btn btn-primary" id="ts-ansbtn">Answer 💬</button>
          </div>` : `<p class="muted" style="margin-top:8px">Waiting for the truth…</p>`;
        if (iAnswer) {
          const ans = () => {
            const v = row.querySelector('#ts-ans').value.trim();
            if (!v) return;
            S.serumFeed.push({ k: 'a', text: v });
            render();
            api.send({ kind: 'sa', text: v });
          };
          row.querySelector('#ts-ansbtn').onclick = ans;
          row.querySelector('#ts-ans').addEventListener('keydown', e => { if (e.key === 'Enter') ans(); });
        }
      } else {
        row.innerHTML = `
          <div class="chat-input-row" style="margin-top:8px">
            <input type="text" id="ts-q" maxlength="150" placeholder="Ask anything — they must answer…">
            <button class="btn btn-primary" id="ts-qbtn">Ask 🧪</button>
          </div>`;
        const ask = () => {
          const v = row.querySelector('#ts-q').value.trim();
          if (!v) return;
          S.serumFeed.push({ k: 'q', by: api.myName, text: v });
          render();
          api.send({ kind: 'sq', text: v });
        };
        row.querySelector('#ts-qbtn').onclick = ask;
        row.querySelector('#ts-q').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
      }
    }

    /* ---------- whisper challenge ---------- */
    function renderWhisper() {
      const cfg = L[S.level];
      const whisperList = DATA.whisper[S.level];
      const iMute = (S.wRound % 2 === 0) === api.isHost;
      if (S.wGuess === null && !S.wRevealed) {
        if (iMute) {
          S.wPhrase = whisperList[api.draw('whisper-' + S.level, whisperList.length)];
          const phrase = S.wPhrase;
          panel.innerHTML = `
            <h3 class="likely-question" style="font-size:1.6rem">Whisper Challenge 🤫</h3>
            <p class="game-prompt">Mute your mic! Mouth this phrase clearly on camera — ${esc(api.partnerName)} reads your lips:</p>
            <div class="big-card-question" style="min-height:70px">“${esc(phrase)}”</div>
            <p class="muted" style="font-size:.85rem;margin-top:10px">Their typed guess will appear here for you to judge.</p>
            <div id="wv-row"></div>`;
        } else {
          panel.innerHTML = `
            <h3 class="likely-question" style="font-size:1.6rem">Whisper Challenge 🤫</h3>
            <p class="game-prompt">${esc(api.partnerName)} is mouthing a phrase (mic muted!). Read their lips and type what you see:</p>
            <div class="chat-input-row" style="max-width:420px;margin:10px auto">
              <input type="text" id="wv-guess" maxlength="80" placeholder="I think they're saying…">
              <button class="btn btn-primary" id="wv-guessbtn">Guess 🤫</button>
            </div>
            <p class="muted" style="font-size:.85rem">Score: you ${S.wScore.me} — ${S.wScore.them} ${esc(api.partnerName)}</p>
            <div style="margin-top:10px">${backBtn().outerHTML.replace('<button', '<button id="wv-back"')}</div>`;
          panel.querySelector('#wv-back').onclick = () => toMode('menu');
          const guess = () => {
            const v = panel.querySelector('#wv-guess').value.trim();
            if (!v) return;
            S.wGuess = v;
            render();
            api.send({ kind: 'wg', text: v });
          };
          panel.querySelector('#wv-guessbtn').onclick = guess;
          panel.querySelector('#wv-guess').addEventListener('keydown', e => { if (e.key === 'Enter') guess(); });
        }
      } else if (S.wGuess !== null && !S.wRevealed) {
        if (iMute) {
          panel.innerHTML = `
            <h3 class="likely-question" style="font-size:1.6rem">Whisper Challenge 🤫</h3>
            <p class="game-prompt">Their guess: <b>“${esc(S.wGuess)}”</b></p>
            <p class="game-prompt">The phrase was: <b>“${esc(S.wPhrase)}”</b></p>
            <div class="likely-buttons" style="margin-top:14px">
              <button class="likely-btn match" id="wv-ok" style="font-size:1.1rem">Correct! 🎉</button>
              <button class="likely-btn" id="wv-no" style="font-size:1.1rem">Wrong! 🙃</button>
            </div>
            <div style="margin-top:10px">${backBtn().outerHTML.replace('<button', '<button id="wv-back2"')}</div>`;
          panel.querySelector('#wv-back2').onclick = () => toMode('menu');
          panel.querySelector('#wv-ok').onclick = () => verdict(true);
          panel.querySelector('#wv-no').onclick = () => verdict(false);
        } else {
          panel.innerHTML = `<p class="game-prompt">Guess sent — waiting for the verdict…🤞</p>
            <div style="margin-top:10px">${backBtn().outerHTML.replace('<button', '<button id="wv-back3"')}</div>`;
          panel.querySelector('#wv-back3').onclick = () => toMode('menu');
        }
      } else {
        const ok = S.wVerdictOk;
        if (iMute) {
          S.wScore.them += ok ? 1 : 0;
          panel.innerHTML = `
            <div class="result-banner ${ok ? 'lose' : 'win'}">${ok ? `${esc(api.partnerName)} guessed it! Point for them 🎉` : 'They got it wrong! Point for you 🕵️'}</div>
            <p class="game-prompt">Score: you ${S.wScore.them} — ${S.wScore.me} ${esc(api.partnerName)}</p>
            <button class="btn btn-primary" id="wv-next" style="margin-top:10px">Next phrase →</button>
            <div style="margin-top:8px">${backBtn().outerHTML.replace('<button', '<button id="wv-back4"')}</div>`;
        } else {
          S.wScore.me += ok ? 1 : 0;
          panel.innerHTML = `
            <div class="result-banner ${ok ? 'win' : 'lose'}">${ok ? `You guessed it! 🎉` : `So close — the phrase was “${esc(S.wPhrase)}”`}</div>
            <p class="game-prompt">Score: you ${S.wScore.me} — ${S.wScore.them} ${esc(api.partnerName)}</p>
            <button class="btn btn-primary" id="wv-next" style="margin-top:10px">Next phrase →</button>
            <div style="margin-top:8px">${backBtn().outerHTML.replace('<button', '<button id="wv-back4"')}</div>`;
        }
        panel.querySelector('#wv-next').onclick = () => {
          S.wRound++;
          S.wGuess = null;
          S.wRevealed = false;
          S.wVerdictOk = null;
          render();
          api.send({ kind: 'wround', r: S.wRound });
        };
        panel.querySelector('#wv-back4').onclick = () => toMode('menu');
      }

      function verdict(ok) {
        S.wVerdictOk = ok;
        S.wRevealed = true;
        if (ok) S.wScore.them++;
        render();
        api.send({ kind: 'wv', ok, phrase: S.wPhrase });
      }
    }
    /* ---------- spin the wheel / wheel of fire ---------- */
    function renderWheel() {
      const cfg = L[S.level];
      const isExtreme = S.level === 'extreme';
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.7rem">${isExtreme ? 'Wheel of Fire 🔥' : 'Spin the Wheel 💋'}</h3>
        <p class="game-prompt">Whatever it lands on, you do. Either of you can spin!</p>
        <div style="position:relative;width:320px;margin:0 auto">
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);border-left:15px solid transparent;border-right:15px solid transparent;border-top:24px solid var(--gold);z-index:2"></div>
          <canvas id="wheel-cv" width="320" height="320" style="display:block;transition:transform 3s cubic-bezier(.12,.8,.2,1)"></canvas>
        </div>
        <div id="wheel-out" class="big-card-question" style="min-height:70px"></div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-primary btn-big" id="wheel-spin">Spin 🎡</button>
          ${backBtn().outerHTML.replace('<button', '<button id="wheel-back"')}
        </div>`;
      panel.querySelector('#wheel-back').onclick = () => toMode('menu');

      const cv = panel.querySelector('#wheel-cv');
      const ctx = cv.getContext('2d');
      const N = cfg.wheel.length;
      const EMO = ['💋', '🔥', '💝', '😏', '🌹', '🌙', '✨', '😈', '💌', '⭐'];
      for (let i = 0; i < N; i++) {
        const a0 = (i * 360 / N - 90) * Math.PI / 180;
        const a1 = ((i + 1) * 360 / N - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(160, 160);
        ctx.arc(160, 160, 155, a0, a1);
        ctx.fillStyle = isExtreme ? (i % 2 ? '#8f1d3f' : '#c22e57') : (i % 2 ? '#f6b93b' : '#e75480');
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        const mid = (i * 360 / N - 90 + 180 / N) * Math.PI / 180;
        ctx.translate(160 + Math.cos(mid) * 105, 160 + Math.sin(mid) * 105);
        ctx.font = '30px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(EMO[i % EMO.length], 0, 0);
        ctx.restore();
      }

      let spinning = false;
      panel.querySelector('#wheel-spin').onclick = () => {
        if (spinning) return;
        spinning = true;
        const i = api.draw('wheel-' + S.level, cfg.wheel.length);
        wheelSpinTo(i);
        api.send({ kind: 'spin', i });
        setTimeout(() => { spinning = false; }, 3300);
      };
    }

    /* ---------- level up (extreme only) ---------- */
    function renderLevels() {
      const cfg = L[S.level];
      if (S.lv >= cfg.levels.length) {
        panel.innerHTML = `
          <div class="big-card-question">All 10 levels complete 🏆🔥</div>
          <p class="game-prompt">You two are unstoppable. Or unstoppable-adjacent 😏</p>
          <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" id="lv-restart">Play again ↺</button>
            ${backBtn().outerHTML.replace('<button', '<button id="lv-back"')}
          </div>`;
        panel.querySelector('#lv-restart').onclick = () => { S.lv = 0; render(); api.send({ kind: 'lv', v: 0 }); };
        panel.querySelector('#lv-back').onclick = () => toMode('menu');
        return;
      }
      panel.innerHTML = `
        <h3 class="likely-question" style="font-size:1.7rem">Level Up 🔥</h3>
        <div class="card-tag">Level ${S.lv + 1} of ${cfg.levels.length}</div>
        <div class="big-card-question">${esc(cfg.levels[S.lv])}</div>
        <p class="game-prompt">Complete the level to unlock the next one. Either of you can advance.</p>
        <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" id="lv-done">Done ✓</button>
          ${backBtn().outerHTML.replace('<button', '<button id="lv-back2"')}
        </div>
        <p class="muted" style="margin-top:10px;font-size:.8rem">Can't or won't? Skip nothing — stop anytime. No pressure, ever. 💛</p>`;
      panel.querySelector('#lv-back2').onclick = () => toMode('menu');
      panel.querySelector('#lv-done').onclick = () => {
        S.lv++;
        render();
        api.send({ kind: 'lv', v: S.lv });
      };
    }

    /* ---------- kiss roulette ---------- */
    function renderKiss() {
      const cfg = L[S.level];
      if (S.kiss) {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Kiss Roulette 💋</h3>
          <div class="big-card-question">${esc(cfg.kissStyles[S.kiss.i])}</div>
          <div class="draw-word" id="kiss-count" style="font-size:2.6rem">10</div>
          <div id="kiss-after"></div>
          <div style="margin-top:10px">${backBtn().outerHTML.replace('<button', '<button id="kiss-back"')}</div>`;
        panel.querySelector('#kiss-back').onclick = () => toMode('menu');
        S.kiss.iv = setInterval(() => {
          const left = Math.max(0, Math.ceil((S.kiss.end - Date.now()) / 1000));
          const el = panel.querySelector('#kiss-count');
          if (el) el.textContent = left;
          if (left <= 0) {
            if (S.kiss && S.kiss.iv) { clearInterval(S.kiss.iv); S.kiss.iv = null; }
            const after = panel.querySelector('#kiss-after');
            if (!after) return;
            after.innerHTML = `
              <div class="result-banner win">Time! Tally: ${S.kisses} kisses delivered 💋</div>
              <div style="margin-top:10px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                <button class="btn btn-primary" id="kiss-done">Delivered 💋 +1</button>
                <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="kiss-again">Another kiss 🔄</button>
              </div>`;
            panel.querySelector('#kiss-done').onclick = () => {
              S.kisses++;
              S.kiss = null;
              render();
              api.send({ kind: 'kissdone', n: S.kisses });
            };
            panel.querySelector('#kiss-again').onclick = () => { S.kiss = null; render(); };
          }
        }, 250);
      } else {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Kiss Roulette 💋</h3>
          <p class="game-prompt">Draw a kiss style, deliver it to the camera in 10 seconds, and count your kisses. Either of you can draw!</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px">
            <button class="btn btn-primary btn-big" id="kiss-get">Draw a kiss 💋</button>
            ${backBtn().outerHTML.replace('<button', '<button id="kiss-back2"')}
          </div>
          <p class="muted" style="margin-top:12px;font-size:.9rem">Kisses delivered so far: ${S.kisses} 💋</p>`;
        panel.querySelector('#kiss-back2').onclick = () => toMode('menu');
        panel.querySelector('#kiss-get').onclick = () => {
          S.kiss = { i: api.draw('kiss-' + S.level, cfg.kissStyles.length), end: Date.now() + 10000, iv: null };
          render();
          api.send({ kind: 'kiss', i: S.kiss.i });
        };
      }
    }

    /* ---------- truth or dare ---------- */
    function renderTod() {
      const cfg = L[S.level];
      const passRule = S.level === 'extreme' ? '<p class="muted" style="font-size:.85rem">Passing = remove one item of clothing 🙈</p>' : '';
      if (S.tod.showing) {
        panel.innerHTML = `
          <div class="card-tag">${S.tod.showing.type === 'truth' ? '💛 Truth' : '🔥 Dare'}</div>
          <div class="big-card-question">${esc(S.tod.showing.text)}</div>
          <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" id="tod-done">Done ✓</button>
            <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="tod-pass">Pass</button>
          </div>${passRule}`;
        panel.querySelector('#tod-done').onclick = () => {
          S.tod.showing = null;
          S.tod.spin = null;
          S.tod.turn ^= 1;
          render();
          api.send({ kind: 'tod-done' });
        };
        panel.querySelector('#tod-pass').onclick = () => {
          S.tod.showing = null;
          S.tod.spin = null;
          S.tod.passes.me++;
          S.tod.turn ^= 1;
          render();
          api.send({ kind: 'tod-pass' });
        };
      } else if (S.tod.spin) {
        const targetName = S.tod.spin.target === 0 ? (api.isHost ? api.myName : api.partnerName) : (api.isHost ? api.partnerName : api.myName);
        const forMe = (S.tod.spin.target === 0) === api.isHost;
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.6rem">🎡 The wheel says…</h3>
          <div class="card-tag">${S.tod.spin.type === 'truth' ? '💛 TRUTH' : '🔥 DARE'} · for ${esc(targetName)}</div>
          <div id="tod-spin-body" style="margin-top:10px"></div>
          <div style="margin-top:14px">${backBtn().outerHTML.replace('<button', '<button id="tod-back"')}</div>`;
        panel.querySelector('#tod-back').onclick = () => toMode('menu');
        const body = panel.querySelector('#tod-spin-body');
        if (forMe) {
          body.innerHTML = `
            <div class="likely-buttons">
              <button class="likely-btn" id="tod-write" style="font-size:1.05rem">✍️<br>Write my own</button>
              <button class="likely-btn" id="tod-pre" style="font-size:1.05rem">🎁<br>Surprise me</button>
            </div>
            <div id="tod-spin-input" style="margin-top:10px"></div>`;
          body.querySelector('#tod-write').onclick = () => {
            body.querySelector('#tod-spin-input').innerHTML = `
              <input type="text" id="tod-mytext" maxlength="150" placeholder="Write the ${S.tod.spin.type} for yourself…" style="text-align:left">
              <button class="btn btn-primary" id="tod-mytextbtn" style="margin-top:8px">Show it 💞</button>`;
            body.querySelector('#tod-mytextbtn').onclick = () => {
              const v = body.querySelector('#tod-mytext').value.trim();
              if (!v) return;
              const t2 = S.tod.spin.type;
              S.tod.showing = { type: t2, text: v };
              S.tod.spin = null;
              render();
              api.send({ kind: 'tod-custom', type: t2, text: v });
            };
          };
          body.querySelector('#tod-pre').onclick = () => {
            const type = S.tod.spin.type;
            const list = type === 'truth' ? L[S.level].truths : darePool();
            const i = api.drawLimited('todd-' + S.level + (api.isApart() ? '-a' : '-t'), list.length, moodLimit());
            S.mood++;
            S.tod.showing = { type, text: list[i] };
            S.tod.spin = null;
            render();
            api.send({ kind: 'tod', type, i });
          };
        } else {
          body.innerHTML = `<p class="game-prompt">Waiting for ${esc(targetName)} to respond…</p>`;
        }
      } else {
        const mine = onMyTurn();
        const passCount = S.tod.passes.me + S.tod.passes.them;
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">Truth or Dare 🎯</h3>
          <p class="game-prompt">${mine
            ? `Your turn, ${esc(api.myName)} — what'll it be?`
            : `Waiting for ${esc(api.partnerName)} to choose…`}</p>
          ${passCount ? `<p class="muted" style="font-size:.85rem">Passes so far: ${passCount}</p>` : passRule}
          <div class="likely-buttons" style="margin-top:16px">
            <button class="likely-btn" id="tod-truth" ${mine ? '' : 'disabled'} style="font-size:1.2rem">💛<br>Truth</button>
            <button class="likely-btn" id="tod-dare" ${mine ? '' : 'disabled'} style="font-size:1.2rem">🔥<br>Dare</button>
          </div>
          <div style="margin-top:12px"><button class="btn btn-primary" id="tod-spinwheel" ${mine ? '' : 'disabled'}>🎡 Spin — random Truth or Dare, random player</button></div>
          <div style="margin-top:18px">${backBtn().outerHTML.replace('<button', '<button id="tod-back"')}</div>`;
        panel.querySelector('#tod-back').onclick = () => toMode('menu');
        if (mine) {
          const pick = type => {
            const list = type === 'truth' ? cfg.truths : darePool();
            const i = type === 'truth' ? api.draw('todt-' + S.level, cfg.truths.length) : api.drawLimited('todd-' + S.level + (api.isApart() ? '-a' : '-t'), darePool().length, moodLimit());
            S.mood++;
            S.tod.showing = { type, text: list[i] };
            render();
            api.send({ kind: 'tod', type, i });
          };
          panel.querySelector('#tod-truth').onclick = () => pick('truth');
          panel.querySelector('#tod-dare').onclick = () => pick('dare');
          panel.querySelector('#tod-spinwheel').onclick = () => {
            const type = Math.random() < 0.5 ? 'truth' : 'dare';
            const target = Math.random() < 0.5 ? 0 : 1; // 0=host 1=guest
            S.tod.spin = { type, target };
            render();
            api.send({ kind: 'tod-spin', type, target });
          };
        }
      }
    }

    /* ---------- 60-second challenge ---------- */
    function renderTimer() {
      const cfg = L[S.level];
      if (S.timer) {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">60-Second Challenge ⏱️</h3>
          <div class="big-card-question" style="min-height:60px">${esc(S.timer.dare)}</div>
          <div class="draw-word" id="timer-count" style="font-size:3rem">60</div>
          <div style="margin-top:10px">${backBtn().outerHTML.replace('<button', '<button id="timer-back"')}</div>`;
        panel.querySelector('#timer-back').onclick = () => toMode('menu');
        S.timer.iv = setInterval(() => {
          const left = Math.max(0, Math.ceil((S.timer.end - Date.now()) / 1000));
          const el = panel.querySelector('#timer-count');
          if (el) el.textContent = left;
          if (left <= 0) {
            stopTimer();
            panel.innerHTML = `
              <div class="big-card-question">Time's up! 💋</div>
              <div style="margin-top:14px">${backBtn().outerHTML.replace('<button', '<button id="timer-back2"')}</div>`;
            panel.querySelector('#timer-back2').onclick = () => toMode('menu');
          }
        }, 250);
      } else {
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.7rem">60-Second Challenge ⏱️</h3>
          <p class="game-prompt">One dare, sixty seconds, zero excuses. Either of you can start it.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px">
            <button class="btn btn-primary btn-big" id="timer-start">Start 💋</button>
            ${backBtn().outerHTML.replace('<button', '<button id="timer-back3"')}
          </div>`;
        panel.querySelector('#timer-back3').onclick = () => toMode('menu');
        panel.querySelector('#timer-start').onclick = () => {
          const pool = api.isApart() ? L[S.level].videoDares : darePool();
          const i = api.drawLimited('timer-' + S.level + (api.isApart() ? '-a' : '-t'), pool.length, Math.max(3, Math.round(pool.length * Math.min(1, 0.4 + S.mood * 0.15))));
          S.mood++;
          S.timer = { end: Date.now() + 60000, dare: pool[i], iv: null };
          render();
          api.send({ kind: 'timer', i });
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
              S.mode = 'menu';
              S.tod = null;
              stopTimer();
              S.phase = 'play';
              render();
              api.toast(`${label(d.level)} — enjoy 💞`);
            }
            break;
          case 'no':
            stopTimer();
            S.phase = 'select';
            S.pending = null;
            render();
            api.toast('Maybe another time 💛');
            break;
          case 'exit':
            stopTimer();
            S.level = null;
            S.pending = null;
            S.idx = 0;
            S.phase = 'select';
            render();
            break;
          case 'next':
            if (S.phase === 'play' && S.mode === 'cards') { S.idx = d.idx; S.cardTurn = d.turn || 0; render(); }
            break;
          case 'mode':
            if (S.phase === 'play') {
              stopTimer();
              S.mode = d.mode;
              S.snap = null;
              if (d.mode === 'tod' && !S.tod) S.tod = { turn: 0, showing: null, passes: { me: 0, them: 0 } };
              if (d.mode === 'levels') S.lv = 0;
              render();
            }
            break;
          case 'spin':
            if (S.phase === 'play' && S.mode === 'wheel') wheelSpinTo(d.i);
            break;
          case 'lv':
            if (S.phase === 'play' && S.mode === 'levels') { S.lv = d.v; render(); }
            break;
          case 'kiss':
            if (S.phase === 'play' && S.mode === 'kiss') {
              S.kiss = { i: d.i, end: Date.now() + 10000, iv: null };
              render();
            }
            break;
          case 'kissdone':
            S.kisses = Math.max(S.kisses, d.n || 0);
            if (S.phase === 'play' && S.mode === 'kiss') {
              if (S.kiss && S.kiss.iv) { clearInterval(S.kiss.iv); S.kiss.iv = null; }
              render();
            }
            break;
          case 'sq':
            if (S.phase === 'play' && S.mode === 'serum') { S.serumFeed.push({ k: 'q', by: api.partnerName, text: d.text }); render(); }
            break;
          case 'sa':
            if (S.phase === 'play' && S.mode === 'serum') { S.serumFeed.push({ k: 'a', text: d.text }); render(); }
            break;
          case 'wg':
            if (S.phase === 'play' && S.mode === 'whisper') { S.wGuess = d.text; render(); }
            break;
          case 'wv':
            if (S.phase === 'play' && S.mode === 'whisper') { S.wVerdictOk = d.ok; S.wRevealed = true; S.wPhrase = d.phrase || S.wPhrase; if (d.ok) S.wScore.them++; render(); }
            break;
          case 'wround':
            if (S.phase === 'play' && S.mode === 'whisper') { S.wRound = d.r; S.wGuess = null; S.wRevealed = false; S.wVerdictOk = null; render(); }
            break;
          case 'apart':
            if (S.phase === 'play') {
              if (S.mode === 'menu') render();
              api.toast(d.v ? '📱 Playing apart' : '🏠 Playing together');
            }
            break;
          case 'snap':
            if (S.phase === 'play' && S.mode === 'snaps') {
              S.snap = d.i;
              S.snapText = d.txt || (L[S.level].snaps[d.i]);
              S.snapWho = d.who;
              render();
            }
            break;
          case 'dice':
            if (S.phase === 'play' && S.mode === 'dice') animateDice(L[S.level].dice, d.a, d.ti);
            break;
          case 'tod':
            if (S.phase === 'play' && S.mode === 'tod' && S.tod) {
              const list = d.type === 'truth' ? L[S.level].truths : darePool();
              S.tod.showing = { type: d.type, text: list[d.i] };
              render();
            }
            break;
          case 'tod-spin':
            if (S.tod) { S.tod.spin = { type: d.type, target: d.target }; if (S.mode === 'tod') render(); }
            break;
          case 'tod-custom':
            if (S.tod) { S.tod.showing = { type: d.type, text: d.text }; S.tod.spin = null; if (S.mode === 'tod') render(); }
            break;
          case 'tod-done':
            // both sides toggle once so local turn state stays in sync
            if (S.tod) { S.tod.showing = null; S.tod.turn ^= 1; if (S.mode === 'tod') render(); }
            break;
          case 'tod-pass':
            // both sides toggle once so local turn state stays in sync
            if (S.tod) { S.tod.showing = null; S.tod.passes.them++; S.tod.turn ^= 1; if (S.mode === 'tod') render(); }
            break;
          case 'timer':
            if (S.phase === 'play' && S.mode === 'timer') {
              const pool = d.video ? L[S.level].videoDares : darePool();
              S.timer = { end: Date.now() + 60000, dare: pool[d.i], iv: null };
              render();
            }
            break;
        }
      },
      destroy() { stopTimer(); }
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
        S.word = DATA.words[api.draw('drawwords', DATA.words.length)];
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
      S.word = DATA.words[api.draw('drawwords', DATA.words.length)];
      const wEl = rolebar.querySelector('.draw-word');
      if (wEl) wEl.textContent = S.word; // update the shown word too
      api.send({ kind: 'newword' });
      sysMsg('New word chosen! 🔄');
    }

    function giveUp() {
      api.send({ kind: 'reveal', word: S.word });
      sysMsg(`Nobody got it — the word was "${S.word}"`);
      scheduleEnd(1500);
    }

    /* The host is the sole round authority: whoever stops drawing asks the
     * host to advance, and everyone rebuilds roles from the host's broadcast.
     * Only one end timer may exist per round, and the host ignores duplicate
     * end requests for a round it has already advanced. */
    function scheduleEnd(ms) {
      if (S.endTimer) clearTimeout(S.endTimer);
      S.endTimer = setTimeout(() => { S.endTimer = null; endRound(); }, ms);
    }

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
        const eraser = document.createElement('button');
        eraser.className = 'swatch' + (S.color === '#ffffff' ? ' selected' : '');
        eraser.style.background = '#ffffff';
        eraser.style.fontSize = '1rem';
        eraser.textContent = '🧽';
        eraser.title = 'Eraser';
        eraser.onclick = () => { S.color = '#ffffff'; setupTools(); };
        toolsEl.appendChild(eraser);
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
    const flushInterval = setInterval(flush, 150);
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
              resultEl.innerHTML = `<div class="result-banner lose">${esc(api.partnerName)} guessed it! The word was "${esc(S.word)}" 💡</div>`;
              sysMsg(`${api.partnerName} guessed it! 🎉`);
              scheduleEnd(2500);
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
          sysMsg(`Nobody got it — the word was "${d.word}"`);
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
