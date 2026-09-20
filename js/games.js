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
      S.q++;
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
      S.q++;
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
      S.q++;
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
 * 6. Intimate (18+ — requires consent from BOTH partners)
 * ===================================================== */
Games.intimate = {
  name: 'Intimate 🔞', icon: '💋', desc: 'Real games · 18+ · you two only',
  init(root, api) {
    const L = DATA.intimate;
    const S = {
      phase: 'select', // select | waiting | consent | play
      level: null,     // 'soft' | 'extreme'
      pending: null,
      mode: 'menu',    // menu | cards | dice | tod | timer | snaps | wheel | levels
      idx: 0,
      apart: true,     // playing from two different places (camera/snaps only)
      snap: null,      // index of the current snap challenge
      tod: null,       // { turn, showing:{type,text}|null, passes:{me,them} }
      timer: null,     // { end, iv, dare }
      lv: 0,           // level-up progress
      deg: 0,          // accumulated wheel rotation
      kiss: null,      // { i, end, iv } current kiss-roulette round
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
          ${S.level === 'extreme' ? '<button class="game-card" data-mode="levels"><span class="gc-icon">🏆</span><span class="gc-name">Level Up</span></button>' : ''}
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-ghost" style="color:var(--rose-dark);border-color:var(--rose-light)" id="in-apart">${S.apart ? '📱 Playing apart' : '🏠 Playing together'}</button>
        </div>
        <p class="muted" style="margin-top:10px;font-size:.8rem">${S.apart
          ? 'Apart mode: only challenges you can do on camera or with snaps.'
          : 'Together mode: includes challenges that need you in the same room.'}</p>`;
      panel.querySelectorAll('.game-card').forEach(b => b.onclick = () => toMode(b.dataset.mode));
      panel.querySelector('#in-apart').onclick = () => {
        S.apart = !S.apart;
        render();
        api.send({ kind: 'apart', v: S.apart });
      };
    }

    /* ---------- card deck ---------- */
    function renderCards() {
      const deck = L[S.level];
      const list = deck.cards.filter(c => !S.apart || !c.startsWith('🏠'));
      const card = list[S.idx % list.length];
      const firstIsHost = S.idx % 2 === 0;
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
        S.idx++;
        render();
        api.send({ kind: 'next', idx: S.idx });
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
        const a = rnd(cfg.whats), ti = rnd(cfg.hows);
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
    function darePool() {
      const cfg = L[S.level];
      return S.apart ? cfg.daresApart : cfg.daresTogether;
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
          S.snap = rnd(pool);
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
          S.snap = rnd(pool);
          S.snapText = pool[S.snap];
          S.snapWho = api.myName;
          render();
          api.send({ kind: 'snap', i: S.snap, who: S.snapWho, txt: S.snapText });
        };
        panel.querySelector('#snap-back2').onclick = () => { S.snap = null; toMode('menu'); };
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
        const i = rnd(cfg.wheel);
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
          S.kiss = { i: rnd(cfg.kissStyles), end: Date.now() + 10000, iv: null };
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
          S.tod.turn ^= 1;
          render();
          api.send({ kind: 'tod-done' });
        };
        panel.querySelector('#tod-pass').onclick = () => {
          S.tod.showing = null;
          S.tod.passes.me++;
          S.tod.turn ^= 1;
          render();
          api.send({ kind: 'tod-pass' });
        };
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
          <div style="margin-top:18px">${backBtn().outerHTML.replace('<button', '<button id="tod-back"')}</div>`;
        panel.querySelector('#tod-back').onclick = () => toMode('menu');
        if (mine) {
          const pick = type => {
            const list = type === 'truth' ? cfg.truths : darePool();
            const i = type === 'truth' ? rnd(list) : pickByMood(list);
            S.mood++;
            S.tod.showing = { type, text: list[i] };
            render();
            api.send({ kind: 'tod', type, i });
          };
          panel.querySelector('#tod-truth').onclick = () => pick('truth');
          panel.querySelector('#tod-dare').onclick = () => pick('dare');
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
          const pool = darePool();
          const i = pickByMood(pool);
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
            if (S.phase === 'play' && S.mode === 'cards') { S.idx = d.idx; render(); }
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
          case 'apart':
            if (S.phase === 'play') {
              S.apart = d.v;
              if (S.mode === 'menu') render();
              api.toast(S.apart ? '📱 Playing apart' : '🏠 Playing together');
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
          case 'tod-done':
            if (S.tod) { S.tod.showing = null; S.tod.turn ^= 1; if (S.mode === 'tod') render(); }
            break;
          case 'tod-pass':
            if (S.tod) { S.tod.showing = null; S.tod.passes.them++; S.tod.turn ^= 1; if (S.mode === 'tod') render(); }
            break;
          case 'timer':
            if (S.phase === 'play' && S.mode === 'timer') {
              const pool = darePool();
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
      sysMsg(`Nobody got it — the word was "${S.word}"`);
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
              resultEl.innerHTML = `<div class="result-banner lose">${esc(api.partnerName)} guessed it! The word was "${esc(S.word)}" 💡</div>`;
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
