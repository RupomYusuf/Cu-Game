/* ============ Board games: Battleship · UNO · Ludo · Chess ============
 * Host-authoritative engines: the host client validates every action and
 * broadcasts redacted per-player state views. Guest clients send intents only.
 */
/* ============ Board games — host-authoritative engines ============
 * The host player's client is the single authority: the guest can only send
 * intents, the host validates every action against the rules and broadcasts
 * redacted per-player state views. No hidden information ever reaches the
 * opponent's UI view.
 */
(function () {
  const TWO = 2;

  /* =====================================================
   * BATTLESHIP
   * ===================================================== */
  const BS_FLEET = [
    { name: 'Carrier', len: 5 },
    { name: 'Battleship', len: 4 },
    { name: 'Cruiser', len: 3 },
    { name: 'Submarine', len: 3 },
    { name: 'Destroyer', len: 2 },
  ];

  function bsEmptyGrid() { return Array(100).fill(null); } // null | {ship: idx, hit: bool}

  function bsValidateFleet(cells) {
    // cells: array of 5 ships, each {name, cells:[10 idx sorted ascending]}
    if (!Array.isArray(cells) || cells.length !== BS_FLEET.length) return 'wrong ship count';
    const names = BS_FLEET.map(s => s.name);
    const occ = new Set();
    for (let i = 0; i < cells.length; i++) {
      const ship = cells[i];
      const spec = BS_FLEET.find(f => f.name === ship.name);
      if (!spec) return 'unknown ship';
      if (!Array.isArray(ship.cells) || ship.cells.length !== spec.len) return ship.name + ' wrong length';
      const c = [...ship.cells].sort((a, b) => a - b);
      if (c.some(x => x < 0 || x > 99)) return ship.name + ' out of bounds';
      // horizontal or vertical contiguous
      const r0 = Math.floor(c[0] / 10), col0 = c[0] % 10;
      const horiz = c.every((x, k) => Math.floor(x / 10) === r0 && x === c[0] + k);
      const vert = c.every((x, k) => (x % 10) === col0 && x === c[0] + k * 10);
      if (!horiz && !vert) return ship.name + ' not a straight line';
      for (const x of c) {
        if (occ.has(x)) return 'overlapping ships';
        occ.add(x);
      }
    }
    if (occ.size !== 17) return 'fleet must cover 17 squares';
    return null;
  }

  function bsRandomFleet() {
    for (let attempt = 0; attempt < 200; attempt++) {
      const occ = new Set();
      const cells = [];
      let ok = true;
      for (const spec of BS_FLEET) {
        let placed = false;
        for (let t = 0; t < 200 && !placed; t++) {
          const horiz = Math.random() < 0.5;
          const r = Math.floor(Math.random() * (horiz ? 10 : 11 - spec.len));
          const col = Math.floor(Math.random() * (horiz ? 11 - spec.len : 10));
          const cs = [];
          for (let k = 0; k < spec.len; k++) cs.push(horiz ? r * 10 + col + k : (r + k) * 10 + col);
          if (cs.some(x => occ.has(x))) continue;
          cs.forEach(x => occ.add(x));
          cells.push({ name: spec.name, cells: cs });
          placed = true;
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return cells;
    }
    return null;
  }

  function bsSunkShips(fleet, shotsBy) {
    const shotSet = new Set(shotsBy);
    const out = [];
    for (const ship of fleet) {
      if (ship.cells.every(x => shotSet.has(x))) out.push({ name: ship.name, cells: ship.cells });
    }
    return out;
  }

  Games.battleship = {
    name: 'Battleship', icon: '🚢', desc: 'Sink their fleet — hidden info',
    init(root, api) {
      const key = k => k === 'h' ? 'h' : 'g';
      let S = {
        phase: 'place', // place | battle | done
        fleets: { h: null, g: null },
        confirmed: { h: false, g: false },
        shots: { h: [], g: [] }, // shots BY each player (into the other's grid)
        turn: 'h',
        winner: null,
        log: [],
      };
      // local placement UI state
      const local = { grid: bsEmptyGrid(), ships: [], orient: 'h', name: BS_FLEET[0].name };

      root.innerHTML = `<div class="game-panel" id="bs-panel"></div>`;
      const panel = root.querySelector('#bs-panel');

      function cellName(i) { return String.fromCharCode(65 + (i % 10)) + (Math.floor(i / 10) + 1); }

      /* ---------- host applies validated actions ---------- */
      function hostConfirmFleet(who, cells) {
        const err = bsValidateFleet(cells);
        if (err) return;
        S.fleets[who] = cells;
        S.confirmed[who] = true;
        S.log.push(`${nameOf(who)} confirmed their fleet`);
        if (S.confirmed.h && S.confirmed.g) {
          S.phase = 'battle';
          S.turn = Math.random() < 0.5 ? 'h' : 'g';
          S.log.push(`Battle begins! ${nameOf(S.turn)} shoots first`);
        }
        broadcast();
      }

      function hostAttack(who, idx) {
        if (S.phase !== 'battle' || S.turn !== who || S.winner) return;
        const foe = who === 'h' ? 'g' : 'h';
        if (idx < 0 || idx > 99) return;
        if (S.shots[who].includes(idx)) return; // repeated attack: reject, turn not consumed
        S.shots[who].push(idx);
        const foeFleet = S.fleets[foe];
        const hitShip = foeFleet.find(sh => sh.cells.includes(idx));
        let msg;
        if (hitShip) {
          const sunk = bsSunkShips(foeFleet, S.shots[who]).find(s => s.name === hitShip.name);
          msg = sunk ? `${cellName(idx)} — HIT! ${sunk.name} SUNK! 💥` : `${cellName(idx)} — HIT! 💥`;
        } else {
          msg = `${cellName(idx)} — miss 🌊`;
        }
        S.log.push(`${nameOf(who)}: ${msg}`);
        const allSunk = bsSunkShips(foeFleet, S.shots[who]).length === BS_FLEET.length;
        if (allSunk) {
          S.winner = who;
          S.phase = 'done';
          S.log.push(`${nameOf(who)} WINS! 🏆`);
        } else {
          S.turn = foe;
        }
        broadcast();
      }

      function nameOf(who) { return who === 'h' ? api.myName : api.partnerName; }

      /* ---------- state broadcast (redacted per player) ---------- */
      function view(who) {
        const foe = who === 'h' ? 'g' : 'h';
        const myFleet = S.fleets[who];
        const theirFleet = S.fleets[foe];
        const theirShots = S.shots[foe]; // shots INTO my grid
        const myShots = S.shots[who];
        // my grid: my ships + hits from their shots
        const myGrid = bsEmptyGrid();
        if (myFleet) for (const sh of myFleet) for (const x of sh.cells) myGrid[x] = { ship: true };
        for (const x of theirShots) myGrid[x] = Object.assign(myGrid[x] || {}, { hit: true, ship: !!(myFleet && myFleet.find(sh => sh.cells.includes(x))) });
        // target grid: my shots with hit/miss; sunk ships fully revealed
        const tGrid = bsEmptyGrid();
        for (const x of myShots) {
          const sh = theirFleet && theirFleet.find(f => f.cells.includes(x));
          tGrid[x] = { tried: true, hit: !!sh };
        }
        const sunk = theirFleet ? bsSunkShips(theirFleet, myShots) : [];
        for (const sh of sunk) for (const x of sh.cells) tGrid[x] = { tried: true, hit: true, sunk: true };
        return {
          phase: S.phase, turn: S.turn, winner: S.winner,
          log: S.log.slice(-6),
          myGrid, tGrid,
          myShipsLeft: myFleet ? BS_FLEET.length - bsSunkShips(myFleet, theirShots).length : BS_FLEET.length,
          theirShipsLeft: theirFleet ? BS_FLEET.length - sunk.length : BS_FLEET.length,
          sunk: sunk.map(s => s.name),
          confirmed: S.confirmed,
        };
      }

      function broadcast() {
        api.send({ kind: 'st', hv: view('h'), gv: view('g') });
        render(view(api.isHost ? 'h' : 'g'));
      }

      /* ---------- UI ---------- */
      let who = api.isHost ? 'h' : 'g';
      function gridHtml(grid, opts) {
        let h = '<div class="bs-grid">';
        for (let i = 0; i < 100; i++) {
          const c = grid[i];
          let cls = 'bs-cell';
          let label = '';
          if (c && c.ship && c.hit) { cls += ' bs-hit'; label = '💥'; }
          else if (c && c.ship && opts.showShips) { cls += ' bs-ship'; }
          else if (c && c.tried && c.sunk) { cls += ' bs-hit'; label = '💥'; }
          else if (c && c.tried && c.hit) { cls += ' bs-hit'; label = '💥'; }
          else if (c && c.tried) { cls += ' bs-miss'; label = '•'; }
          const click = opts.onCell ? ` data-i="${i}"` : '';
          h += `<button class="${cls}"${opts.onCell ? '' : ' disabled'}${click}>${label}</button>`;
        }
        return h + '</div>';
      }

      function renderPlacement(v) {
        const myConfirmed = v.confirmed[who];
        const waiting = v.confirmed[who === 'h' ? 'g' : 'h'];
        const grid = bsEmptyGrid();
        for (const sh of local.ships) for (const x of sh.cells) grid[x] = { ship: true };
        const nextShip = BS_FLEET.find(f => !local.ships.find(s => s.name === f.name));
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.5rem">Battleship 🚢 — place your fleet</h3>
          ${myConfirmed ? `
            <p class="game-prompt">Fleet locked 🔒 ${waiting ? '— waiting for ' + esc(api.partnerName) + ' to place…' : ''}</p>` : `
            <p class="game-prompt">Placing: <b>${esc(nextShip ? nextShip.name : 'done')}</b> (${nextShip ? nextShip.len : 0} squares) ·
            <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="bs-orient">Orientation: ${local.orient === 'h' ? 'Horizontal ↔' : 'Vertical ↕'}</button>
            <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="bs-random">🎲 Random</button>
            <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="bs-clear">Clear</button></p>`}
          ${gridHtml(grid, { showShips: true, onCell: !myConfirmed && !!nextShip })}
          ${nextShip && !myConfirmed ? '<p class="muted" style="font-size:.85rem">Tap the first square, then the last square of the ship (or two squares in line).</p>' : ''}
          ${!myConfirmed && local.ships.length === BS_FLEET.length ? '<button class="btn btn-primary" id="bs-confirm" style="margin-top:10px">Confirm fleet 🔒</button>' : ''}
          ${!myConfirmed ? '<p class="muted" style="font-size:.8rem;margin-top:6px">' + esc(api.partnerName) + ': ' + (waiting ? 'confirmed ✓' : 'placing…') + '</p>' : ''}`;
        const orientBtn = panel.querySelector('#bs-orient');
        if (orientBtn) orientBtn.onclick = () => { local.orient = local.orient === 'h' ? 'v' : 'h'; renderPlacement(v); };
        const rndBtn = panel.querySelector('#bs-random');
        if (rndBtn) rndBtn.onclick = () => {
          const f = bsRandomFleet();
          if (f) { local.ships = f; renderPlacement(v); }
        };
        const clearBtn = panel.querySelector('#bs-clear');
        if (clearBtn) clearBtn.onclick = () => { local.ships = []; renderPlacement(v); };
        // two-click placement
        if (!myConfirmed && nextShip) {
          let first = null;
          panel.querySelectorAll('.bs-cell').forEach(b => {
            b.onclick = () => {
              const i = +b.dataset.i;
              if (first === null) { first = i; b.classList.add('bs-pick'); return; }
              const len = nextShip.len;
              const r0 = Math.floor(first / 10), c0 = first % 10;
              const r1 = Math.floor(i / 10), c1 = i % 10;
              let cs = null;
              if (r0 === r1 && Math.abs(c1 - c0) === len - 1) {
                const a = Math.min(c0, c1);
                cs = Array.from({ length: len }, (_, k) => r0 * 10 + a + k);
              } else if (c0 === c1 && Math.abs(r1 - r0) === len - 1) {
                const a = Math.min(r0, r1);
                cs = Array.from({ length: len }, (_, k) => (a + k) * 10 + c0);
              }
              if (!cs) { first = null; renderPlacement(api.isHost ? view('h') : view('g')); return; }
              // bounds+overlap check happens on the host; pre-check locally for UX
              const tmp = local.ships.map(s => s.cells).flat();
              if (cs.some(x => tmp.includes(x)) || cs.some(x => x < 0 || x > 99)) { api.toast('Invalid placement!'); first = null; return; }
              local.ships.push({ name: nextShip.name, cells: cs });
              first = null;
              renderPlacement(v);
            };
          });
        }
        const conf = panel.querySelector('#bs-confirm');
        if (conf) conf.onclick = () => {
          const err = bsValidateFleet(local.ships);
          if (err) { api.toast('Fix your fleet: ' + err); return; }
          if (api.isHost) hostConfirmFleet('h', local.ships);
          else api.send({ kind: 'act', a: { type: 'confirm', cells: local.ships } });
        };
      }

      function renderBattle(v) {
        const myTurn = v.turn === who && !v.winner;
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.5rem">Battleship 🚢</h3>
          <p class="game-prompt">${v.winner
            ? (v.winner === who ? '🏆 You sank their whole fleet!' : esc(api.partnerName) + ' sank your fleet.')
            : (myTurn ? '🎯 Your turn — fire at their waters!' : `Waiting for ${esc(api.partnerName)} to fire…`)}</p>
          <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
            <div><p class="muted" style="font-size:.8rem;margin-bottom:4px">Their waters (${v.theirShipsLeft} ships left)</p>
            ${gridHtml(v.tGrid, { onCell: myTurn })}</div>
            <div><p class="muted" style="font-size:.8rem;margin-bottom:4px">Your waters (${v.myShipsLeft} ships left)</p>
            ${gridHtml(v.myGrid, { showShips: true })}</div>
          </div>
          ${v.sunk && v.sunk.length ? `<p class="muted" style="font-size:.85rem">Sunk: ${esc(v.sunk.join(', '))} ✅</p>` : ''}
          <div class="chat-log" style="height:90px;max-width:440px;margin:10px auto">${v.log.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
        if (myTurn) {
          panel.querySelectorAll('.bs-grid')[0].querySelectorAll('.bs-cell').forEach(b => {
            b.onclick = () => {
              const i = +b.dataset.i;
              if (api.isHost) hostAttack('h', i);
              else api.send({ kind: 'act', a: { type: 'attack', idx: i } });
            };
          });
        }
      }

      function render(v) {
        if (v.phase === 'place') renderPlacement(v);
        else renderBattle(v);
      }

      /* ---------- incoming ---------- */
      function applyView(d) {
        render(api.isHost ? d.hv : d.gv);
      }
      return {
        onMsg(d) {
          if (api.isHost) {
            if (d.kind === 'act' && d.a) {
              if (d.a.type === 'confirm') hostConfirmFleet('g', d.a.cells);
              else if (d.a.type === 'attack') hostAttack('g', d.a.idx);
            }
            return; // host renders from its own state
          }
          if (d.kind === 'st') applyView(d);
        },
        destroy() {}
      };
      // host renders initial placement immediately
      // (init ends with a broadcast)
    }
  };
})();


  /* =====================================================
   * UNO (2 players, host-authoritative)
   * ===================================================== */
  function unoDeck() {
    const d = [];
    for (const c of ['r', 'y', 'g', 'b']) {
      d.push({ c, v: '0' });
      for (let n = 1; n <= 9; n++) { d.push({ c, v: String(n) }); d.push({ c, v: String(n) }); }
      for (const v of ['s', 'r', 'd2']) { d.push({ c, v }); d.push({ c, v }); }
    }
    for (let i = 0; i < 4; i++) { d.push({ c: 'w', v: 'w' }); d.push({ c: 'w', v: 'wd4' }); }
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  const UNO_LABEL = { s: 'Skip ⏭️', r: 'Reverse ↩️', d2: 'Draw Two +2', w: 'Wild 🌈', wd4: 'Wild Draw Four +4' };
  function unoLabel(card) {
    if (card.c === 'w') return UNO_LABEL[card.v];
    const col = { r: 'Red', y: 'Yellow', g: 'Green', b: 'Blue' }[card.c];
    return card.v in UNO_LABEL ? col + ' ' + UNO_LABEL[card.v] : col + ' ' + card.v;
  }

  Games.uno = {
    name: 'UNO', icon: '🎴', desc: 'First to empty their hand',
    init(root, api) {
      let S = null;
      let unoDeadline = 0;

      if (api.isHost) {
        const deck = unoDeck();
        const handH = deck.splice(0, 7), handG = deck.splice(0, 7);
        let first = deck.pop();
        // WD4 as first card: return + reshuffle
        while (first.v === 'wd4') { deck.unshift(first); first = deck.pop(); }
        S = {
          deck, discard: [first], hands: { h: handH, g: handG },
          turn: 'h', color: first.c === 'w' ? null : first.c,
          // first-card specials
          log: [],
          over: false, winner: null,
          unoWindow: null, // {who, until}
          challenge: null, // {challenger, until, playedBy}
          starterSpecial: null,
        };
        if (first.v === 's') S.turn = S.turn === 'h' ? 'g' : 'h';
        else if (first.v === 'r') S.turn = S.turn === 'h' ? 'g' : 'h'; // 2p reverse = skip
        else if (first.v === 'd2') {
          const other = S.turn === 'h' ? 'g' : 'h';
          S.hands[other].push(deck.pop(), deck.pop());
          S.turn = other;
        }
        if (first.c === 'w') S.color = null; // first player chooses color
        S.log.push('Game on! ' + (S.turn === 'h' ? api.myName : api.partnerName) + ' starts.');
      }

      const myKey = () => api.isHost ? 'h' : 'g';
      const otherKey = () => api.isHost ? 'g' : 'h';
      const nameOf = k => k === 'h' ? api.myName : api.partnerName;
      const isMyTurn = () => S.turn === myKey() && !S.over;

      function unoPlayable(hand, color) { return hand.some(c => c.c === color || c.c === 'w'); }

      function reshuffleIfNeeded() {
        if (S.deck.length) return;
        const top = S.discard.pop();
        S.deck = S.discard.filter(c => c.v !== 'wd4'); // keep wd4s out? standard: shuffle all back
        S.deck = S.discard;
        S.discard = [top];
        for (let i = S.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S.deck[i], S.deck[j]] = [S.deck[j], S.deck[i]]; }
        S.log.push('Draw pile reshuffled');
      }

      /* host-side: play a card */
      function hostPlay(who, idx, chosen) {
        if (S.over || S.turn !== who) return 'Not your turn';
        const hand = S.hands[who];
        const card = hand[idx];
        if (!card) return 'No such card';
        const legal = card.c === 'w' || card.c === S.color || card.v === S.discard[S.discard.length - 1].v;
        if (!legal) return 'That card does not match';
        if (card.v === 'wd4' && unoPlayable(hand.filter((_, i) => i !== idx), S.color)) return 'Wild Draw Four only when you have no ' + S.color + ' card';
        hand.splice(idx, 1);
        S.discard.push(card);
        S.color = card.c === 'w' ? (chosen || 'r') : card.c;
        S.log.push(`${nameOf(who)} played ${unoLabel(card)}${card.c === 'w' ? ' → ' + ({ r: 'Red', y: 'Yellow', g: 'Green', b: 'Blue' }[S.color]) : ''}`);
        // UNO window: played down to 1 card
        if (hand.length === 1) {
          S.unoWindow = { who, until: Date.now() + 4000 };
          unoDeadline = Date.now() + 4000;
        } else if (S.unoWindow && S.unoWindow.who === who) S.unoWindow = null;
        // win
        if (hand.length === 0) {
          S.over = true; S.winner = who;
          S.log.push(`${nameOf(who)} WINS! 🏆`);
          return null;
        }
        // effects (2-player: reverse acts as skip)
        const other = who === 'h' ? 'g' : 'h';
        if (card.v === 's' || card.v === 'r') { S.turn = who; S.log.push(`${nameOf(other)} is skipped`); }
        else if (card.v === 'd2') {
          reshuffleIfNeeded();
          S.hands[other].push(S.deck.pop() || { c: 'r', v: '0' }, S.deck.pop() || { c: 'r', v: '0' });
          S.turn = other; S.log.push(`${nameOf(other)} draws 2`);
        } else if (card.v === 'wd4') {
          reshuffleIfNeeded();
          S.hands[other].push(S.deck.pop(), S.deck.pop(), S.deck.pop(), S.deck.pop());
          S.turn = other;
          // challenge window: other may challenge (checked against who's hand BEFORE playing — host kept the pre-play hand? we removed the card already; re-check via hands history: store flag
          S.challenge = { challenger: other, playedBy: who, until: Date.now() + 5000 };
          // legality was already enforced at play time, so challenge will fail — per prompt we still allow it
        } else {
          S.turn = other;
        }
        return null;
      }

      function hostDraw(who) {
        if (S.over || S.turn !== who) return;
        reshuffleIfNeeded();
        if (S.deck.length) S.hands[who].push(S.deck.pop());
        S.log.push(`${nameOf(who)} drew a card`);
        S.turn = who === 'h' ? 'g' : 'h';
        S.unoWindow = null;
      }

      function hostUno(who) {
        if (!S.unoWindow || S.unoWindow.who !== who) return;
        if (Date.now() > S.unoWindow.until) return;
        S.unoWindow = null;
        S.log.push(`${nameOf(who)}: UNO! 📣`);
      }

      function hostCatch(who) {
        if (!S.unoWindow || S.unoWindow.who === who) return;
        if (Date.now() > S.unoWindow.until) return;
        const culprit = S.unoWindow.who;
        reshuffleIfNeeded();
        S.hands[culprit].push(S.deck.pop() || { c: 'y', v: '3' }, S.deck.pop() || { c: 'y', v: '3' });
        S.unoWindow = null;
        S.log.push(`${nameOf(who)} caught ${nameOf(culprit)} not calling UNO! +2 cards`);
      }

      function hostChallenge(who) {
        if (!S.challenge || S.challenge.challenger !== who) return;
        if (Date.now() > S.challenge.until) return;
        const prev = S.challenge.playedBy;
        // legality was enforced at play time, so a challenge always fails
        reshuffleIfNeeded();
        S.hands[who].push(S.deck.pop(), S.deck.pop(), S.deck.pop(), S.deck.pop(), S.deck.pop(), S.deck.pop());
        S.log.push(`${nameOf(who)} challenged… and LOST the challenge! +6 cards`);
        S.challenge = null;
        S.turn = who; // challenger loses turn (already theirs? they draw 6 and lose turn)
      }

      /* per-player redacted view */
      function view() {
        const me = myKey(), them = otherKey();
        return {
          myHand: S.hands[me],
          theirCount: S.hands[them].length,
          top: S.discard[S.discard.length - 1],
          color: S.color,
          deckCount: S.deck.length,
          turn: S.turn,
          me, over: S.over, winner: S.winner,
          log: S.log.slice(-5),
          unoWindow: S.unoWindow ? { who: S.unoWindow.who } : null,
          challenge: S.challenge ? { challenger: S.challenge.challenger } : null,
        };
      }

      function broadcast() {
        api.send({ kind: 'st', hv: view(), gv: view() });
        render();
      }

      /* ---------- UI ---------- */
      root.innerHTML = `<div class="game-panel" id="uno-panel"></div>`;
      const panel = root.querySelector('#uno-panel');

      function cardHtml(c, extra) {
        const col = { r: '#d63031', y: '#fdcb6e', g: '#00b894', b: '#0984e3', w: '#2d3436' }[c.c];
        const face = c.c === 'w' ? UNO_LABEL[c.v].split(' ')[0] : c.v;
        return `<button class="uno-card" style="background:${col}" data-v="${c.v}" ${extra || ''}><span>${face}</span></button>`;
      }

      function render() {
        if (!S) { panel.innerHTML = '<p class="game-prompt">Waiting for the host to deal…</p>'; return; }
        const v = view();
        const myTurn = v.turn === v.me && !v.over;
        const top = v.top;
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.5rem">UNO 🎴</h3>
          <div style="display:flex;gap:16px;justify-content:center;align-items:center;margin:8px 0">
            <div class="uno-pile">${cardHtml(top)}</div>
            <div class="muted" style="font-size:.85rem">Color: <b>${esc(v.color ? ({ r: 'Red', y: 'Yellow', g: 'Green', b: 'Blue' }[v.color]) : '—')}</b><br>
            Deck: ${v.deckCount} · ${esc(api.partnerName)}: ${v.theirCount} cards</div>
          </div>
          ${v.unoWindow ? `<p class="game-prompt">📣 ${esc(nameOf(v.unoWindow.who))} has UNO window open… ${v.unoWindow.who !== v.me ? '<button class="btn btn-small btn-secondary" id="uno-catch">Catch! ✋</button>' : ''}</p>` : ''}
          ${v.challenge && v.challenge.challenger === v.me ? `<p class="game-prompt"><button class="btn btn-small btn-secondary" id="uno-challenge">Challenge the Wild Draw Four? 🤨</button></p>` : ''}
          <div class="uno-hand">${v.myHand.map((c, i) => cardHtml(c, myTurn ? ` data-i="${i}"` : ' disabled')).join('')}</div>
          <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-secondary" id="uno-draw" ${myTurn ? '' : 'disabled'}>Draw a card 🃏</button>
            <button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="uno-call" ${v.unoWindow && v.unoWindow.who === v.me ? '' : 'disabled'}>UNO! 📣</button>
          </div>
          <div id="uno-extras" style="margin-top:8px"></div>
          <div class="chat-log" style="height:80px;max-width:440px;margin:10px auto">${v.log.map(l => `<div>${esc(l)}</div>`).join('')}</div>
          ${v.over ? `<div class="result-banner ${v.winner === v.me ? 'win' : 'lose'}">${v.winner === v.me ? '🏆 You win!' : esc(api.partnerName) + ' wins!'}</div>` : ''}
          ${myTurn && !v.over ? '<p class="muted" style="font-size:.8rem">Tap a playable card, or draw. Wild cards ask for a color.</p>' : ''}`;
        // play
        if (myTurn) {
          panel.querySelectorAll('.uno-hand .uno-card').forEach(b => {
            b.onclick = () => {
              const idx = +b.dataset.i;
              const card = v.myHand[idx];
              const legal = card.c === 'w' || card.c === v.color || card.v === top.v;
              if (card.v === 'wd4' || card.c === 'w') {
                // color picker
                const extras = panel.querySelector('#uno-extras');
                extras.innerHTML = '<p class="muted">Choose a color:</p><div class="likely-buttons" style="margin-top:6px">' +
                  ['r', 'y', 'g', 'b'].map(cc => `<button class="likely-btn" data-c="${cc}" style="background:${{ r: '#d63031', y: '#fdcb6e', g: '#00b894', b: '#0984e3' }[cc]};color:#fff">●</button>`).join('') + '</div>';
                extras.querySelectorAll('.likely-btn').forEach(bb => {
                  bb.onclick = () => {
                    if (api.isHost) { const err = hostPlay('h', idx, bb.dataset.c); if (err) api.toast(err); broadcast(); }
                    else api.send({ kind: 'act', a: { type: 'play', idx, chosen: bb.dataset.c } });
                  };
                });
              } else {
                if (api.isHost) { const err = hostPlay('h', idx); if (err) api.toast(err); broadcast(); }
                else api.send({ kind: 'act', a: { type: 'play', idx } });
              }
            };
          });
          panel.querySelector('#uno-draw').onclick = () => {
            if (api.isHost) { hostDraw('h'); broadcast(); }
            else api.send({ kind: 'act', a: { type: 'draw' } });
          };
        }
        panel.querySelector('#uno-call').onclick = () => {
          if (api.isHost) { hostUno('h'); broadcast(); }
          else api.send({ kind: 'act', a: { type: 'uno' } });
        };
        const catchBtn = panel.querySelector('#uno-catch');
        if (catchBtn) catchBtn.onclick = () => {
          if (api.isHost) { hostCatch('h'); broadcast(); }
          else api.send({ kind: 'act', a: { type: 'catch' } });
        };
        const chBtn = panel.querySelector('#uno-challenge');
        if (chBtn) chBtn.onclick = () => {
          if (api.isHost) { hostChallenge('h'); broadcast(); }
          else api.send({ kind: 'act', a: { type: 'challenge' } });
        };
      }

      if (api.isHost) broadcast(); else render();
      return {
        onMsg(d) {
          if (api.isHost) {
            if (d.kind === 'act' && d.a && !S.over) {
              let err = null;
              if (d.a.type === 'play') err = hostPlay('g', d.a.idx, d.a.chosen);
              else if (d.a.type === 'draw') hostDraw('g');
              else if (d.a.type === 'uno') hostUno('g');
              else if (d.a.type === 'catch') hostCatch('g');
              else if (d.a.type === 'challenge') hostChallenge('g');
              if (err) api.send({ kind: 'st', hv: view(), gv: view() });
              else broadcast();
            }
            return;
          }
          if (d.kind === 'st') {
            S = d.gv; // guest's S mirrors its view; render uses view() shape
            render();
          }
        },
        destroy() {}
      };
    }
  };


  /* =====================================================
   * LUDO (2 players, host-authoritative dice + moves)
   * ===================================================== */
  const LUDO_START = { h: 0, g: 26 };
  const LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

  Games.ludo = {
    name: 'Ludo', icon: '🎲', desc: 'Race your 4 tokens home',
    init(root, api) {
      let S = null;
      const myKey = () => api.isHost ? 'h' : 'g';
      const nameOf = k => k === 'h' ? api.myName : api.partnerName;

      if (api.isHost) {
        S = {
          tokens: { h: [-1, -1, -1, -1], g: [-1, -1, -1, -1] }, // -1 yard, 0..50 track, 51..56 home col, 57 home
          turn: Math.random() < 0.5 ? 'h' : 'g',
          dice: null, rolled: false, sixes: 0,
          over: false, winner: null,
          log: [`${nameOf(S.turn)} goes first`],
        };
      }

      function trackPos(key, prog) { return (LUDO_START[key] + prog) % 52; }
      function tokensAt(key, prog) { // count tokens of `key` at track square of prog (prog<=50)
        return S.tokens[key].filter(p => p >= 0 && p <= 50 && trackPos(key, p) === trackPos(key, prog)).length;
      }
      function opponentAtTrack(key, tpos) { // how many opponent tokens on track square tpos
        const foe = key === 'h' ? 'g' : 'h';
        return S.tokens[foe].filter(p => p >= 0 && p <= 50 && trackPos(foe, p) === tpos).length;
      }
      function canMove(key, ti, d) {
        const p = S.tokens[key][ti];
        if (p === 57) return false; // done
        if (p === -1) return d === 6;
        if (p + d > 57) return false; // exact roll needed for home
        if (p + d <= 50) {
          // passing through / landing on opponent blockades
          for (let step = p + 1; step <= p + d; step++) {
            const tp = trackPos(key, step);
            const foe = key === 'h' ? 'g' : 'h';
            if (opponentAtTrack(key, tp) >= 2) return false; // blockade blocks path
          }
        }
        return true;
      }

      function hostRoll(who) {
        if (S.over || S.turn !== who || S.rolled) return;
        const d = 1 + Math.floor(Math.random() * 6);
        S.dice = d;
        S.rolled = true;
        if (d === 6) { S.sixes++; } else { S.sixes = 0; }
        if (d === 6 && S.sixes >= 3) {
          S.log.push(`${nameOf(who)} rolled a third 6 — turn forfeited!`);
          S.dice = null; S.rolled = false; S.sixes = 0;
          S.turn = who === 'h' ? 'g' : 'h';
        } else {
          S.log.push(`${nameOf(who)} rolled ${d}`);
        }
      }

      function hostMove(who, ti) {
        if (S.over || S.turn !== who || !S.rolled || S.dice === null) return;
        const d = S.dice;
        if (!canMove(who, ti, d)) { S.log.push(`${nameOf(who)}: illegal move with ${d}`); return; }
        const p = S.tokens[who][ti];
        if (p === -1) {
          S.tokens[who][ti] = 0;
          const foe = who === 'h' ? 'g' : 'h';
          const foeCount = opponentAtTrack(who, LUDO_START[who]);
          if (foeCount === 1 && !LUDO_SAFE.has(LUDO_START[who])) {
            // capture the single opponent token on my start
            const foe = who === 'h' ? 'g' : 'h';
            for (let i = 0; i < 4; i++) {
              if (S.tokens[foe][i] >= 0 && S.tokens[foe][i] <= 50 && trackPos(foe, S.tokens[foe][i]) === LUDO_START[who]) {
                S.tokens[foe][i] = -1;
                S.log.push(`${nameOf(who)} captured on entry! 💥`);
              }
            }
          }
        } else {
          const from = p;
          S.tokens[who][ti] = p + d;
          if (p + d <= 50) {
            const tp = trackPos(who, p + d);
            const foe = who === 'h' ? 'g' : 'h';
            const foeCount = opponentAtTrack(who, tp);
            if (foeCount === 1 && !LUDO_SAFE.has(tp)) {
              for (let i = 0; i < 4; i++) {
                if (S.tokens[foe][i] >= 0 && S.tokens[foe][i] <= 50 && trackPos(foe, S.tokens[foe][i]) === tp) {
                  S.tokens[foe][i] = -1;
                  S.log.push(`${nameOf(who)} captured ${nameOf(foe)}! 💥`);
                }
              }
            }
          }
          if (S.tokens[who][ti] === 57) S.log.push(`${nameOf(who)} brought a token home! 🏠`);
        }
        const won = S.tokens[who].every(p2 => p2 === 57);
        if (won) {
          S.over = true; S.winner = who;
          S.log.push(`${nameOf(who)} WINS! 🏆 All tokens home!`);
          return;
        }
        // extra roll only on a 6
        if (d === 6) {
          S.rolled = false; S.dice = null;
          S.log.push(`${nameOf(who)} rolls again! 🎲`);
        } else {
          S.rolled = false; S.dice = null; S.sixes = 0;
          S.turn = who === 'h' ? 'g' : 'h';
        }
      }

      function view() {
        const me = myKey();
        return {
          tokens: S.tokens, turn: S.turn, dice: S.dice, rolled: S.rolled,
          over: S.over, winner: S.winner, me,
          log: S.log.slice(-5),
          movable: S.dice !== null && !S.over ? S.tokens[myKey()].map((p, i) => canMove(myKey(), i, S.dice) ? i : -1).filter(i => i >= 0) : [],
        };
      }

      function broadcast() {
        api.send({ kind: 'st', hv: view(), gv: view() });
        render();
      }

      /* ---------- UI: linear ring + home columns ---------- */
      root.innerHTML = `<div class="game-panel" id="ld-panel"></div>`;
      const panel = root.querySelector('#ld-panel');

      function render() {
        if (!S) { panel.innerHTML = '<p class="game-prompt">Waiting for the host…</p>'; return; }
        const me = myKey();
        const myTurn = S.turn === me && !S.over;
        const ring = [];
        for (let i = 0; i < 52; i++) {
          let dot = '';
          for (const key of ['h', 'g']) {
            S.tokens[key].forEach((p, ti) => {
              if (p >= 0 && p <= 50 && trackPos(key, p) === i) {
                dot += `<span class="ld-tok ${key === 'h' ? 'ld-h' : 'ld-g'}" title="${nameOf(key)} ${ti + 1}">${key === 'h' ? '🔴' : '🟡'}</span>`;
              }
            });
          }
          ring.push(`<div class="ld-cell ${LUDO_SAFE.has(i) ? 'ld-safe' : ''}">${dot}</div>`);
        }
        const homeRow = key => {
          let h = '';
          for (let s = 51; s <= 56; s++) {
            const toks = S.tokens[key].map((p, ti) => p === s ? `<span class="ld-tok ${key === 'h' ? 'ld-h' : 'ld-g'}">●</span>` : '').join('');
            h += `<div class="ld-cell ld-home">${toks}</div>`;
          }
          return h;
        };
        const myToks = S.tokens[me].map((p, ti) => {
          const movable = S.movable && S.movable.includes(ti);
          const where = p === -1 ? 'Yard' : p === 57 ? '🏠 Home!' : p >= 51 ? 'Home column' : `Square ${trackPos(me, p) + 1}`;
          return `<button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:${movable ? 'var(--rose)' : 'var(--rose-light)'}" data-ti="${ti}" ${movable ? '' : 'disabled'}>Token ${ti + 1} · ${where}</button>`;
        }).join(' ');
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.5rem">Ludo 🎲</h3>
          <div style="text-align:center">
            <div style="display:grid;grid-template-columns:repeat(13,1fr);gap:2px;max-width:560px;margin:0 auto">
              ${ring.map(c => c).join('')}
            </div>
            <div style="display:flex;gap:2px;justify-content:center;margin-top:6px">
              <span class="muted" style="font-size:.75rem;margin-right:4px">${esc(api.myName)} home:</span>${homeRow(me)}
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;align-items:center;margin-top:12px">
            <button class="btn btn-primary btn-big" id="ld-roll" ${myTurn && !S.rolled ? '' : 'disabled'}>🎲 Roll</button>
            <div class="draw-word" style="font-size:2rem">${S.dice || '—'}</div>
          </div>
          ${S.over ? `<div class="result-banner ${S.winner === me ? 'win' : 'lose'}">${S.winner === me ? '🏆 You win!' : esc(api.partnerName) + ' wins!'}</div>` : ''}
          <div style="margin-top:10px">${myTurn && S.rolled ? `<p class="muted" style="font-size:.85rem">Rolled ${S.dice} — pick a token:</p>${myToks}` : (myTurn ? '<p class="muted" style="font-size:.85rem">Roll the dice!</p>' : `<p class="muted" style="font-size:.85rem">Waiting for ${esc(api.partnerName)}…</p>`)}</div>
          <div class="chat-log" style="height:70px;max-width:440px;margin:10px auto">${S.log.slice(-5).map(l => `<div>${esc(l)}</div>`).join('')}</div>
          <p class="muted" style="font-size:.75rem">🔴 you · 🟡 ${esc(api.partnerName)} · ⭐/start = safe · stack = blockade · 6 = extra roll · 3 sixes = forfeit</p>`;
        const rollBtn = panel.querySelector('#ld-roll');
        if (rollBtn) rollBtn.onclick = () => {
          if (api.isHost) { hostRoll('h'); broadcast(); }
          else api.send({ kind: 'act', a: { type: 'roll' } });
        };
        if (myTurn && S.rolled) {
          panel.querySelectorAll('button[data-ti]').forEach(b => {
            b.onclick = () => {
              const ti = +b.dataset.ti;
              if (api.isHost) { hostMove('h', ti); broadcast(); }
              else api.send({ kind: 'act', a: { type: 'move', ti } });
            };
          });
        }
      }

      function broadcast() {
        api.send({ kind: 'st', hv: view(), gv: view() });
        render();
      }

      if (api.isHost) broadcast(); else render();
      return {
        onMsg(d) {
          if (api.isHost) {
            if (d.kind === 'act' && d.a && !S.over) {
              if (d.a.type === 'roll') hostRoll('g');
              else if (d.a.type === 'move') hostMove('g', d.a.ti);
              broadcast();
            }
            return;
          }
          if (d.kind === 'st') { S = d.gv; render(); }
        },
        destroy() {}
      };
    }
  };

  /* =====================================================
   * CHESS (2 players, full rules, host-authoritative)
   * ===================================================== */
  function chessStart() {
    const b = Array(64).fill(null);
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++) {
      b[c] = { c: 'b', t: back[c] };
      b[8 + c] = { c: 'b', t: 'p' };
      b[48 + c] = { c: 'w', t: 'p' };
      b[56 + c] = { c: 'w', t: back[c] };
    }
    return b;
  }
  const chessInside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  function chessAttacked(b, r, c, by) {
    // pawns
    const dr = by === 'w' ? 1 : -1; // attacker pawns sit one row "behind" from target's perspective
    for (const dc of [-1, 1]) {
      const rr = r + dr, cc = c + dc;
      if (chessInside(rr, cc)) { const p = b[rr * 8 + cc]; if (p && p.c === by && p.t === 'p') return true; }
    }
    // knights
    for (const [dr2, dc2] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
      const rr = r + dr2, cc = c + dc2;
      if (chessInside(rr, cc)) { const p = b[rr * 8 + cc]; if (p && p.c === by && p.t === 'n') return true; }
    }
    // king
    for (let dr2 = -1; dr2 <= 1; dr2++) for (let dc2 = -1; dc2 <= 1; dc2++) {
      if (!dr2 && !dc2) continue;
      const rr = r + dr2, cc = c + dc2;
      if (chessInside(rr, cc)) { const p = b[rr * 8 + cc]; if (p && p.c === by && p.t === 'k') return true; }
    }
    // sliders
    const lines = [
      [[1, 0], [-1, 0], [0, 1], [0, -1], ['r']],
      [[1, 1], [1, -1], [-1, 1], [-1, -1], ['b']],
    ];
    for (const dirs of lines) {
      const types = dirs.pop();
      for (const [dr2, dc2] of dirs) {
        let rr = r + dr2, cc = c + dc2;
        while (chessInside(rr, cc)) {
          const p = b[rr * 8 + cc];
          if (p) {
            if (p.c === by && types.includes(p.t)) return true;
            if (p.c === by && p.t === 'q') return true;
            break;
          }
          rr += dr2; cc += dc2;
        }
      }
    }
    return false;
  }

  function chessKingIdx(b, color) {
    for (let i = 0; i < 64; i++) { const p = b[i]; if (p && p.c === color && p.t === 'k') return i; }
    return -1;
  }
  function chessInCheck(b, color) {
    const ki = chessKingIdx(b, color);
    return ki < 0 ? false : chessAttacked(b, Math.floor(ki / 8), ki % 8, color === 'w' ? 'b' : 'w');
  }

  function chessPseudo(S, from) {
    const b = S.b;
    const p = b[from];
    if (!p) return [];
    const r = Math.floor(from / 8), c = from % 8;
    const out = [];
    const push = (rr, cc, extra) => {
      if (!chessInside(rr, cc)) return;
      const t = b[rr * 8 + cc];
      if (t && t.c === p.c) return;
      out.push(Object.assign({ to: rr * 8 + cc }, extra || {}));
    };
    const slide = dirs => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (chessInside(rr, cc)) {
          const t = b[rr * 8 + cc];
          if (t && t.c === p.c) break;
          push(rr, cc);
          if (t) break;
          rr += dr; cc += dc;
        }
      }
    };
    if (p.t === 'p') {
      const dir = p.c === 'w' ? -1 : 1;
      const startRow = p.c === 'w' ? 6 : 1;
      const lastRow = p.c === 'w' ? 0 : 7;
      if (chessInside(r + dir, c) && !b[(r + dir) * 8 + c]) {
        push(r + dir, c, (r + dir) === lastRow ? { promo: true } : null);
        if (r === startRow && !b[(r + 2 * dir) * 8 + c]) push(r + 2 * dir, c);
      }
      for (const dc of [-1, 1]) {
        const rr = r + dir, cc = c + dc;
        if (!chessInside(rr, cc)) continue;
        const t = b[rr * 8 + cc];
        if (t && t.c !== p.c) push(rr, cc, rr === lastRow ? { promo: true } : null);
        else if (S.ep === rr * 8 + cc && !t) out.push({ to: rr * 8 + cc, ep: true });
      }
    } else if (p.t === 'n') {
      for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) push(r + dr, c + dc);
    } else if (p.t === 'b') slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    else if (p.t === 'r') slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    else if (p.t === 'q') slide([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
    else if (p.t === 'k') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (dr || dc) push(r + dr, c + dc); }
      // castling
      if (from === (p.c === 'w' ? 60 : 4) && !chessInCheck(b, p.c)) {
        const base = p.c === 'w' ? 7 : 0;
        // kingside: rook at (base,7)
        const rk = b[base * 8 + 7];
        if (S.cast[p.c + 'K'] && rk && rk.t === 'r' && rk.c === p.c && !b[base * 8 + 5] && !b[base * 8 + 6]) {
          if (!chessAttacked(b, base, 5, p.c === 'w' ? 'b' : 'w') && !chessAttacked(b, base, 6, p.c === 'w' ? 'b' : 'w')) {
            out.push({ to: base * 8 + 6, castle: 'K' });
          }
        }
        const rq = b[base * 8 + 0];
        if (S.cast[p.c + 'Q'] && rq && rq.t === 'r' && rq.c === p.c && !b[base * 8 + 1] && !b[base * 8 + 2] && !b[base * 8 + 3]) {
          if (!chessAttacked(b, base, 3, p.c === 'w' ? 'b' : 'w') && !chessAttacked(b, base, 2, p.c === 'w' ? 'b' : 'w')) {
            out.push({ to: base * 8 + 2, castle: 'Q' });
          }
        }
      }
    }
    return out;
  }

  function chessMake(S, from, m) {
    // returns {ok, undo} — applies on a copy-free basis with undo info
    const b = S.b;
    const undo = { captured: b[m.to], ep: S.ep, cast: Object.assign({}, S.cast), half: S.half, promoted: false, rookFrom: null, rookTo: null, epCap: null };
    const p = b[from];
    b[m.to] = b[from];
    b[from] = null;
    S.ep = -1;
    if (p.t === 'p') {
      S.half = 0;
      if (m.ep) {
        const capIdx = m.to + (p.c === 'w' ? 8 : -8);
        undo.epCap = { idx: capIdx, piece: b[capIdx] };
        b[capIdx] = null;
      }
      if (Math.abs(m.to - from) === 16) S.ep = (from + m.to) / 2;
      if (m.to < 8 || m.to >= 56) {
        const promo = m.promoPiece || 'q';
        b[m.to] = { c: p.c, t: promo };
        undo.promoted = true;
      }
    } else if (p.t === 'k') {
      S.half++;
      S.cast[p.c + 'K'] = false; S.cast[p.c + 'Q'] = false;
      if (m.castle === 'K') {
        const base = p.c === 'w' ? 7 : 0;
        b[base * 8 + 5] = b[base * 8 + 7]; b[base * 8 + 7] = null;
        undo.rookFrom = base * 8 + 7; undo.rookTo = base * 8 + 5;
      } else if (m.castle === 'Q') {
        const base = p.c === 'w' ? 7 : 0;
        b[base * 8 + 3] = b[base * 8 + 0]; b[base * 8 + 0] = null;
        undo.rookFrom = base * 8 + 0; undo.rookTo = base * 8 + 3;
      }
    } else {
      S.half++;
      if (p.t === 'r') {
        const base = p.c === 'w' ? 7 : 0;
        if (from === base * 8) S.cast[p.c + 'Q'] = false;
        if (from === base * 8 + 7) S.cast[p.c + 'K'] = false;
      }
    }
    if (undo.captured) S.half = 0;
    // rook captured on its original square cancels that castling right
    const foe = p.c === 'w' ? 'b' : 'w';
    const foeBase = foe === 'w' ? 7 : 0;
    if (m.to === foeBase * 8) S.cast[foe + 'Q'] = false;
    if (m.to === foeBase * 8 + 7) S.cast[foe + 'K'] = false;
    return undo;
  }

  function chessUndoMake(S, from, m, undo) {
    const b = S.b;
    b[from] = b[m.to];
    b[m.to] = undo.captured || null;
    if (undo.promoted) b[from] = { c: b[from].c, t: 'p' };
    if (undo.epCap) b[undo.epCap.idx] = undo.epCap.piece;
    if (undo.rookFrom !== null) { b[undo.rookFrom] = b[undo.rookTo]; b[undo.rookTo] = null; }
    S.ep = undo.ep; S.cast = undo.cast; S.half = undo.half;
  }

  function chessLegal(S, from) {
    const b = S.b;
    const p = b[from];
    if (!p) return [];
    const color = p.c;
    return chessPseudo(S, from).filter(m => {
      const undo = chessMake(S, from, m);
      const bad = chessInCheck(b, color);
      chessUndoMake(S, from, m, undo);
      return !bad;
    });
  }

  function chessAnyLegal(S) {
    for (let i = 0; i < 64; i++) {
      const p = S.b[i];
      if (p && p.c === S.turn) if (chessLegal(S, i).length) return true;
    }
    return false;
  }
  function chessPosKey(S) { return S.b.map(p => p ? p.c + p.t : '.').join('') + S.turn + JSON.stringify(S.cast) + S.ep; }
  function chessInsufficient(S) {
    const pieces = S.b.filter(Boolean);
    if (pieces.length > 4) return false;
    if (pieces.some(p => p.t === 'p' || p.t === 'r' || p.t === 'q')) return false;
    return true; // K vs K, K+minor vs K, K+B vs K+B same color (approx)
  }

  Games.chess = {
    name: 'Chess', icon: '♟️', desc: 'Full rules — checkmate them',
    init(root, api) {
      let S = null;
      const myColor = api.isHost ? 'w' : 'b';
      const nameOf = c => c === myColor ? api.myName : api.partnerName;

      if (api.isHost) {
        S = {
          b: chessStart(), turn: 'w',
          cast: { wK: true, wQ: true, bK: true, bQ: true },
          ep: -1, half: 0,
          reps: {}, over: null, winner: null, log: ['White moves first'],
          sel: -1, // selection lives client-side but kept per-view
        };
        const k = chessPosKey(S); S.reps[k] = 1;
      }
      let selIdx = -1;

      function hostApplyMove(from, to, promoPiece) {
        if (S.over) return;
        if (S.turn !== myColorOfTurn()) return;
        function myColorOfTurn() { return S.turn; } // host applies for whoever's turn via intents
        // (intents from guest carry their own color check below)
        const legal = chessLegal(S, from).find(m => m.to === to);
        if (!legal) { S.log.push('Illegal move rejected'); return; }
        const piece = S.b[from];
        const m = Object.assign({}, legal);
        if (legal.promo) m.promoPiece = promoPiece || 'q';
        const captured = S.b[to];
        const undo = chessMake(S, from, m);
        S.turn = S.turn === 'w' ? 'b' : 'w';
        const k = chessPosKey(S);
        S.reps[k] = (S.reps[k] || 0) + 1;
        S.log.push(`${piece.c === 'w' ? 'White' : 'Black'}: ${cellName(from)}→${cellName(to)}${legal.promo ? ' (promotes)' : ''}${captured ? ' ×' : ''}${chessInCheck(S.b, S.turn) ? ' — CHECK!' : ''}`);
        if (!chessAnyLegal(S)) {
          if (chessInCheck(S.b, S.turn)) { S.over = 'checkmate'; S.winner = piece.c; S.log.push(`Checkmate! ${piece.c === 'w' ? 'White' : 'Black'} wins 🏆`); }
          else { S.over = 'stalemate'; S.log.push('Stalemate — draw 🤝'); }
        } else if (S.half >= 100) { S.over = 'fifty'; S.log.push('Fifty-move rule — draw 🤝'); }
        else if (S.reps[k] >= 3) { S.over = 'repetition'; S.log.push('Threefold repetition — draw 🤝'); }
        else if (chessInsufficient(S)) { S.over = 'material'; S.log.push('Insufficient material — draw 🤝'); }
      }
      function cellName(i) { return String.fromCharCode(97 + (i % 8)) + (8 - Math.floor(i / 8)); }

      function view() {
        return { b: S.b, cast: S.cast, ep: S.ep, turn: S.turn, over: S.over, winner: S.winner, log: S.log.slice(-5), inCheck: chessInCheck(S.b, S.turn) };
      }
      function broadcast() {
        api.send({ kind: 'st', hv: view(), gv: view() });
        render(view());
      }

      root.innerHTML = `<div class="game-panel" id="ch-panel"></div>`;
      const panel = root.querySelector('#ch-panel');
      const GLYPH = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' };

      function render(v) {
        if (!v) { panel.innerHTML = '<p class="game-prompt">Waiting for the host…</p>'; return; }
        const myTurn = v.turn === myColor && !v.over;
        const legal = myTurn && selIdx >= 0 ? chessLegal(S || { b: v.b, cast: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1 }, selIdx).map(m => m.to) : [];
        let cells = '<div class="ch-grid">';
        for (let i = 0; i < 64; i++) {
          const r = Math.floor(i / 8), c = i % 8;
          const flipRow = myColor === 'w' ? r : 7 - r;
          const flipCol = myColor === 'w' ? c : 7 - c;
          const idx = flipRow * 8 + flipCol;
          const p = v.b[idx];
          const dark = (flipRow + flipCol) % 2 === 1;
          const isSel = selIdx === idx;
          const isTarget = legal.includes(idx);
          cells += `<button class="ch-cell ${dark ? 'ch-dark' : 'ch-light'} ${isSel ? 'ch-sel' : ''} ${isTarget ? 'ch-target' : ''}" data-i="${idx}" ${myTurn ? '' : 'disabled'}>${p ? GLYPH[p.c + p.t] : ''}</button>`;
        }
        cells += '</div>';
        panel.innerHTML = `
          <h3 class="likely-question" style="font-size:1.4rem">Chess ♟️ — you are ${myColor === 'w' ? 'White ♔' : 'Black ♚'}</h3>
          ${v.inCheck && !v.over ? '<p class="game-prompt" style="color:var(--rose-dark)">⚠️ CHECK!</p>' : ''}
          ${cells}
          ${v.over ? `<div class="result-banner ${v.winner === myColor ? 'win' : v.winner ? 'lose' : 'draw'}">${v.over === 'checkmate' ? (v.winner === myColor ? '🏆 Checkmate — you win!' : 'Checkmate — ' + esc(nameOf(v.winner)) + ' wins!') : 'Draw: ' + v.over}</div>
          <button class="btn btn-primary" id="ch-rematch" style="margin-top:10px">Rematch ↺</button>` : `<p class="muted" style="font-size:.8rem;margin-top:6px">${myTurn ? (selIdx >= 0 ? 'Tap a highlighted square to move.' : 'Tap your piece to see its moves.') : 'Waiting for ' + esc(nameOf(v.turn)) + '…'}</p>`}
          <div class="chat-log" style="height:70px;max-width:440px;margin:10px auto">${v.log.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
        // clicks
        const handler = idx => {
          const p = v.b[idx];
          if (selIdx >= 0 && legal.includes(idx)) {
            const legalMoves = chessLegal(S, selIdx);
            const m = legalMoves.find(mm => mm.to === idx);
            if (m && m.promo) {
              // promotion picker
              const extras = panel.querySelector('#ch-promo') || (() => { const d = document.createElement('div'); d.id = 'ch-promo'; panel.appendChild(d); return d; })();
              extras.innerHTML = '<p class="muted">Promote to:</p><div class="likely-buttons">' +
                [['q', 'Queen ♕'], ['r', 'Rook ♖'], ['b', 'Bishop ♗'], ['n', 'Knight ♘']].map(([t, l]) => `<button class="likely-btn" data-p="${t}">${l}</button>`).join('') + '</div>';
              extras.querySelectorAll('.likely-btn').forEach(bb => {
                bb.onclick = () => doMove(selIdx, idx, bb.dataset.p);
              });
              return;
            }
            doMove(selIdx, idx);
          } else if (p && p.c === myColor) {
            selIdx = idx;
          } else {
            selIdx = -1;
          }
          render(v);
        };
        function doMove(from, to, promoPiece) {
          if (api.isHost) { hostApplyMove(from, to, promoPiece); selIdx = -1; broadcast(); }
          else { api.send({ kind: 'act', a: { type: 'move', from, to, promo: promoPiece || 'q' } }); selIdx = -1; render(v); }
        }
        panel.querySelectorAll('.ch-cell').forEach(b => {
          b.onclick = () => handler(+b.dataset.i);
        });
        const rm = panel.querySelector('#ch-rematch');
        if (rm) rm.onclick = () => {
          if (api.isHost) { S.b = chessStart(); S.turn = 'w'; S.cast = { wK: true, wQ: true, bK: true, bQ: true }; S.ep = -1; S.half = 0; S.reps = {}; S.over = null; S.winner = null; S.log = ['White moves first']; selIdx = -1; broadcast(); }
          else api.send({ kind: 'act', a: { type: 'rematch' } });
        };
      }

      if (api.isHost) broadcast(); else render();
      return {
        onMsg(d) {
          if (api.isHost) {
            if (d.kind === 'st') { render(d.hv); return; }
            if (d.kind === 'act' && d.a) {
              if (d.a.type === 'move' && S.turn === 'b' && !S.over) {
                hostApplyMove(d.a.from, d.a.to, d.a.promo);
                selIdx = -1;
              } else if (d.a.type === 'rematch' && S.over) {
                S.b = chessStart(); S.turn = 'w'; S.cast = { wK: true, wQ: true, bK: true, bQ: true }; S.ep = -1; S.half = 0; S.reps = {}; S.over = null; S.winner = null; S.log = ['White moves first'];
              }
              broadcast();
            }
            return;
          }
          if (d.kind === 'st') { S = d.gv; render(d.gv); }
        },
        destroy() {}
      };
    }
  };

