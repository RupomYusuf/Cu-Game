/* Pack Games: Red Flag, Yes/No, True/False, Rapid Fire, Mad Libs, Kiss Marry Kill */
  window.__m1 = true;
function makePollGame(name, icon, desc, opts, cards, kind) {
    return {
      name: name, icon: icon, desc: desc,
      init: function(root, api) {
        var S = { q: 0, mine: null, theirs: null, synced: 0, rounds: 0 };
        root.innerHTML = '<div class="game-panel"><div class="game-prompt">' + desc + '</div><div class="big-card-question" id="pg-q"></div><div class="likely-buttons" id="pg-btns"></div><div id="pg-res"></div><div style="margin-top:12px"><button class="btn btn-primary" id="pg-next" style="display:none">Next \u2192</button></div></div>';
        var qEl = root.querySelector('#pg-q');
        var btnsEl = root.querySelector('#pg-btns');
        var resEl = root.querySelector('#pg-res');
        var nextBtn = root.querySelector('#pg-next');
        function render() {
          var card = cards[S.q % cards.length];
          var isObj = typeof card === 'object';
          qEl.textContent = isObj ? card.s : card;
          btnsEl.innerHTML = '';
          var revealed = S.mine !== null && S.theirs !== null;
          for (var i = 0; i < opts.length; i++) {
            (function(opt) {
              var b = document.createElement('button');
              b.className = 'likely-btn ' + (opt[2] || '');
              b.textContent = opt[0];
              if (revealed) {
                b.disabled = true;
                var both = S.mine === opt[1] && S.theirs === opt[1];
                var myP = S.mine === opt[1];
                var thP = S.theirs === opt[1];
                if (both) { b.classList.add('match'); b.textContent += ' \u2b50 both'; }
                else if (myP) { b.classList.add('selected'); b.textContent += ' (you)'; }
                else if (thP) { b.classList.add('selected'); b.textContent += ' (' + api.partnerName + ')'; }
              } else {
                if (S.mine === opt[1]) b.classList.add('selected');
                b.onclick = function() { S.mine = opt[1]; render(); api.send({ kind: 'pick', pick: opt[1] }); };
              }
              btnsEl.appendChild(b);
            })(opts[i]);
          }
          if (revealed) {
            var html = '';
            var match = S.mine === S.theirs;
            if (kind === 'flag') {
              html = match ? '<div class="result-banner ' + (S.mine === 'green' ? 'win' : 'lose') + '">Both agree: ' + (S.mine === 'green' ? '\ud83d\udfe2 Green flag!' : '\ud83d\udea9 Red flag!') + '</div>' : '<div class="result-banner draw">You disagree! Discuss \ud83d\ude04</div>';
            } else if (kind === 'yn') {
              html = match ? '<div class="result-banner win">Same answer! ' + (S.mine === 'yes' ? 'YES \ud83d\udcaa' : 'NO \ud83d\ude45') + '</div>' : '<div class="result-banner draw">Different! One YES one NO \ud83d\ude04</div>';
            } else if (kind === 'tf') {
              var correct = isObj ? card.a : false;
              var meR = S.mine === correct, thR = S.theirs === correct;
              html = '<div class="result-banner ' + (meR && thR ? 'win' : meR || thR ? 'draw' : 'lose') + '">Answer: <b>' + (correct ? 'TRUE \u2705' : 'FALSE \u274c') + '</b>! ' + (isObj ? card.e : '') + '<br>' + (meR ? '\u2705 You!' : '\u274c You') + ' \u00b7 ' + (thR ? '\u2705 ' + api.partnerName + '!' : '\u274c ' + api.partnerName) + '</div>';
            }
            resEl.innerHTML = html;
            nextBtn.style.display = 'inline-block';
          } else if (S.mine !== null) {
            resEl.innerHTML = '<p class="game-prompt">Waiting for ' + api.partnerName + '\u2026</p>';
          }
          if (kind !== 'tf') api.setScore('Match: ' + S.synced + '/' + S.rounds);
        }
        nextBtn.onclick = function() {
          if (S.mine === null || S.theirs === null) return;
          S.q = api.draw(kind, cards.length);
          S.mine = null; S.theirs = null;
          resEl.innerHTML = ''; nextBtn.style.display = 'none';
          render();
          api.send({ kind: 'next', q: S.q });
        };
        render();
        return {
          onMsg: function(d) {
            if (d.kind === 'pick' && S.theirs === null) { S.theirs = d.pick; S.rounds++; if (S.mine !== null && S.mine === S.theirs) S.synced++; render(); }
            else if (d.kind === 'next') { S.q = d.q; S.mine = null; S.theirs = null; resEl.innerHTML = ''; nextBtn.style.display = 'none'; render(); }
          },
          destroy: function() {}
        };
      }
    }

    window.__m2 = true;
Games.flag = makePollGame('Red Flag or Green Flag', '\ud83d\udea9', 'Is this a red flag or a green flag? Pick secretly!', [['\ud83d\udfe2 Green Flag', 'green', ''], ['\ud83d\udea9 Red Flag', 'red', '']], DATA.flag, 'flag');
    Games.yn = makePollGame('Yes or No', '\ud83d\udcad', 'Answer Yes or No \u2014 do you match?', [['YES \ud83d\udcaa', 'yes', ''], ['NO \ud83d\ude45', 'no', '']], DATA.yn, 'yn');
    Games.tf = makePollGame('True or False', '\ud83e\udde0', 'Is this statement true or false?', [['TRUE \u2705', true, ''], ['FALSE \u274c', false, '']], DATA.tf, 'tf');

    window.__m3 = true;
Games.rf = {
      name: 'Rapid Fire', icon: '\u26a1', desc: 'Quick answers \u2014 see how in sync you are!',
      init: function(root, api) {
        var S = { q: 0, mine: null, theirs: null };
        root.innerHTML = '<div class="game-panel"><div class="game-prompt">Quick! Answer then compare!</div><div class="big-card-question" id="rf-q"></div><div id="rf-form"></div><div id="rf-res"></div><div style="margin-top:12px"><button class="btn btn-primary" id="rf-next" style="display:none">Next \u2192</button></div></div>';
        var qEl = root.querySelector('#rf-q');
        var formEl = root.querySelector('#rf-form');
        var resEl = root.querySelector('#rf-res');
        var nextBtn = root.querySelector('#rf-next');
        function showForm() {
          formEl.innerHTML = '<input type="text" id="rf-in" maxlength="100" placeholder="Your answer\u2026" style="text-align:left"><button class="btn btn-primary" id="rf-send" style="margin-top:8px">Reveal \u26a1</button>';
          formEl.querySelector('#rf-send').onclick = function() {
            var v = formEl.querySelector('#rf-in').value.trim();
            if (!v) return;
            S.mine = v;
            formEl.innerHTML = '<p class="game-prompt">Locked \u26a1 waiting for ' + api.partnerName + '\u2026</p>';
            render();
            api.send({ kind: 'ans', ans: v });
          };
        }
        function render() {
          qEl.textContent = DATA.rf[S.q % DATA.rf.length];
          if (S.mine && S.theirs) {
            var same = S.mine.toLowerCase().trim() === S.theirs.toLowerCase().trim();
            resEl.innerHTML = '<div style="text-align:left;max-width:440px;margin:0 auto"><p><b>' + api.myName + ':</b> ' + S.mine + '</p><p><b>' + api.partnerName + ':</b> ' + S.theirs + '</p></div><div class="result-banner ' + (same ? 'win' : 'draw') + '">' + (same ? 'SAME ANSWER! \ud83c\udf89' : 'Different! Discuss \ud83d\ude04') + '</div>';
            nextBtn.style.display = 'inline-block';
          }
        }
        nextBtn.onclick = function() {
          if (!(S.mine && S.theirs)) return;
          S.q = api.draw('rfgame', DATA.rf.length);
          S.mine = null; S.theirs = null;
          resEl.innerHTML = ''; nextBtn.style.display = 'none';
          showForm(); render();
          api.send({ kind: 'next', q: S.q });
        };
        showForm(); render();
        return {
          onMsg: function(d) {
            if (d.kind === 'ans' && !S.theirs) { S.theirs = d.ans; render(); }
            else if (d.kind === 'next') { S.q = d.q; S.mine = null; S.theirs = null; resEl.innerHTML = ''; nextBtn.style.display = 'none'; showForm(); render(); }
          },
          destroy: function() {}
        };
      }
    };

    Games.mad = {
      name: 'Love Mad Libs', icon: '\ud83d\udcdd', desc: 'Fill in blanks \u2014 hilarious stories!',
      init: function(root, api) {
        var S = { r: 0, mine: null, theirs: null, revealed: false };
        root.innerHTML = '<div class="game-panel" id="ml-panel"></div>';
        var panel = root.querySelector('#ml-panel');
        function getSlots(tpl) {
          var slots = []; var re = /\{(\w+)\}/g, m;
          while ((m = re.exec(tpl)) !== null) slots.push(m[1]);
          return slots;
        }
        function fillTpl(tpl, words) {
          var idx = 0;
          return tpl.replace(/\{(\w+)\}/g, function() {
            var w = words[idx] || '___'; idx++;
            return '<b style="color:var(--rose-dark)">' + w + '</b>';
          });
        }
        function render() {
          var tpl = DATA.madTemplates[DATA.madRounds[S.r % DATA.madRounds.length].t];
          var slots = getSlots(tpl);
          if (!S.revealed && S.mine === null) {
            var inputs = '';
            for (var i = 0; i < slots.length; i++) {
              inputs += '<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><span class="card-tag" style="min-width:90px">' + slots[i] + '</span><input type="text" class="ml-in" data-i="' + i + '" maxlength="40" placeholder="' + slots[i] + '\u2026" style="text-align:left"></div>';
            }
            panel.innerHTML = '<h3 class="likely-question" style="font-size:1.4rem">Love Mad Libs \ud83d\udcdd</h3><p class="game-prompt">Fill in the blanks \u2014 don\u2019t show ' + api.partnerName + '! \ud83d\ude04</p>' + inputs + '<button class="btn btn-primary" id="ml-done" style="margin-top:12px">Done \u2014 reveal! \ud83c\udf89</button><button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light);margin-top:8px" id="ml-back">\u25c0 All games</button>';
            panel.querySelector('#ml-back').onclick = function() { document.querySelector('#btn-back').click(); };
            panel.querySelector('#ml-done').onclick = function() {
              var words = [];
              var inps = panel.querySelectorAll('.ml-in');
              for (var i = 0; i < inps.length; i++) words.push(inps[i].value.trim());
              if (words.some(function(w) { return !w; })) { api.toast('Fill in ALL the blanks!'); return; }
              S.mine = words; render();
              api.send({ kind: 'fill', words: words });
            };
          } else if (!S.revealed && S.theirs === null) {
            panel.innerHTML = '<h3 class="likely-question" style="font-size:1.4rem">Love Mad Libs \ud83d\udcdd</h3><p class="game-prompt">Waiting for ' + api.partnerName + ' to fill their blanks\u2026</p><button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light);margin-top:8px" id="ml-back">\u25c0 All games</button>';
            panel.querySelector('#ml-back').onclick = function() { document.querySelector('#btn-back').click(); };
          } else {
            var myStory = fillTpl(tpl, S.mine);
            var theirStory = fillTpl(tpl, S.theirs);
            panel.innerHTML = '<h3 class="likely-question" style="font-size:1.4rem">\ud83d\udcd6 The Stories!</h3><div style="text-align:left;max-width:460px;margin:10px auto"><p class="card-tag">' + api.myName + '\'s version:</p><p style="margin:10px 0;font-size:1.05rem;line-height:1.6">' + myStory + '</p><p class="card-tag" style="margin-top:16px">' + api.partnerName + '\'s version:</p><p style="margin:10px 0;font-size:1.05rem;line-height:1.6">' + theirStory + '</p></div><div style="margin-top:16px"><button class="btn btn-primary" id="ml-next">Next story \u2192</button><button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light)" id="ml-back">\u25c0 All games</button></div>';
            panel.querySelector('#ml-next').onclick = function() {
              S.r = api.draw('madlib', DATA.madRounds.length);
              S.mine = null; S.theirs = null; S.revealed = false;
              render();
              api.send({ kind: 'next', r: S.r });
            };
            panel.querySelector('#ml-back').onclick = function() { document.querySelector('#btn-back').click(); };
          }
        }
        render();
        return {
          onMsg: function(d) {
            if (d.kind === 'fill') { S.theirs = d.words; if (S.mine) S.revealed = true; render(); }
            else if (d.kind === 'next') { S.r = d.r; S.mine = null; S.theirs = null; S.revealed = false; render(); }
          },
          destroy: function() {}
        };
      }
    };

    Games.kmk = {
      name: 'Kiss, Marry, Kill', icon: '\ud83d\udc8b', desc: 'Assign all three \u2014 then reveal!',
      init: function(root, api) {
        var S = { q: 0, mine: null, theirs: null };
        root.innerHTML = '<div class="game-panel" id="kmk-panel"></div>';
        var panel = root.querySelector('#kmk-panel');
        function render() {
          var trio = DATA.kmk[S.q % DATA.kmk.length];
          if (S.mine === null) {
            var html = '<h3 class="likely-question" style="font-size:1.4rem">\ud83d\udc8b Kiss, Marry, Kill</h3><p class="game-prompt">Assign each label to one choice. No repeats!</p><div style="text-align:left;max-width:440px;margin:10px auto">';
            for (var oi = 0; oi < 3; oi++) {
              html += '<div style="margin:10px 0;padding:10px;background:#fff0f5;border-radius:12px"><p style="font-weight:700;margin:0 0 6px">' + trio[oi] + '</p><div style="display:flex;gap:6px;flex-wrap:wrap">';
              var labels = [['\ud83d\udc8b', 'kiss'], ['\ud83d\udc8d', 'marry'], ['\ud83d\udc80', 'kill']];
              for (var li = 0; li < 3; li++) {
                html += '<button class="btn btn-ghost btn-small kmk-btn" data-oi="' + oi + '" data-label="' + labels[li][1] + '" style="color:var(--rose-dark);border-color:var(--rose-light)">' + labels[li][0] + ' ' + labels[li][1] + '</button>';
              }
              html += '</div></div>';
            }
            html += '</div><button class="btn btn-primary" id="kmk-done" style="display:none;margin-top:8px">Lock it in \ud83d\udd12</button><p class="muted" style="font-size:.8rem;margin-top:6px">Assign each label exactly once!</p>';
            panel.innerHTML = html;
            var assignment = {};
            var btns = panel.querySelectorAll('.kmk-btn');
            for (var i = 0; i < btns.length; i++) {
              (function(btn) {
                btn.onclick = function() {
                  var oi = btn.getAttribute('data-oi');
                  var label = btn.getAttribute('data-label');
                  for (var k in assignment) { if (assignment[k] === label) delete assignment[k]; }
                  assignment[oi] = label;
                  for (var j = 0; j < btns.length; j++) btns[j].classList.remove('selected');
                  for (var j = 0; j < btns.length; j++) {
                    if (assignment[btns[j].getAttribute('data-oi')] === btns[j].getAttribute('data-label')) btns[j].classList.add('selected');
                  }
                  var doneBtn = panel.querySelector('#kmk-done');
                  if (Object.keys(assignment).length === 3) doneBtn.style.display = 'inline-block';
                  else doneBtn.style.display = 'none';
                };
              })(btns[i]);
            }
            panel.querySelector('#kmk-done').onclick = function() {
              S.mine = { 0: assignment[0] || '', 1: assignment[1] || '', 2: assignment[2] || '' };
              render();
              api.send({ kind: 'assign', a: S.mine });
            };
          } else if (S.theirs === null) {
            panel.innerHTML = '<h3 class="likely-question" style="font-size:1.4rem">\ud83d\udc8b Kiss, Marry, Kill</h3><p class="game-prompt">Locked in \ud83d\udd12 waiting for ' + api.partnerName + '\u2026</p>';
          } else {
            var emoji = { kiss: '\ud83d\udc8b', marry: '\ud83d\udc8d', kill: '\ud83d\udc80' };
            var rows = '';
            for (var oi = 0; oi < 3; oi++) {
              var myL = S.mine[oi], theirL = S.theirs[oi];
              var match = myL === theirL;
              rows += '<div style="margin:10px 0;padding:10px;background:' + (match ? '#d9f2e3' : '#fff0f5') + ';border-radius:12px"><p style="font-weight:700;margin:0 0 4px">' + trio[oi] + '</p><p style="margin:0;font-size:.95rem">' + emoji[myL] + ' You: <b>' + myL + '</b> \u00b7 ' + emoji[theirL] + ' ' + api.partnerName + ': <b>' + theirL + '</b>' + (match ? ' \u2b50 same!' : '') + '</p></div>';
            }
            panel.innerHTML = '<h3 class="likely-question" style="font-size:1.4rem">\ud83d\udc8b Reveal!</h3>' + rows + '<button class="btn btn-primary" id="kmk-next" style="margin-top:12px">Next round \u2192</button><button class="btn btn-ghost btn-small" style="color:var(--rose-dark);border-color:var(--rose-light);margin-top:8px" id="kmk-back">\u25c0 All games</button>';
            panel.querySelector('#kmk-next').onclick = function() {
              S.q = api.draw('kmkgame', DATA.kmk.length);
              S.mine = null; S.theirs = null;
              render();
              api.send({ kind: 'next', q: S.q });
            };
            panel.querySelector('#kmk-back').onclick = function() { document.querySelector('#btn-back').click(); };
          }
        }
        render();
        return {
          onMsg: function(d) {
            if (d.kind === 'assign') { S.theirs = d.a; if (S.mine) render(); }
            else if (d.kind === 'next') { S.q = d.q; S.mine = null; S.theirs = null; render(); }
          },
          destroy: function() {}
        };
      }
    };
  };