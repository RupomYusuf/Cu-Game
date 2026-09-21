/* ============ No-repeat deck engine ============
 * Every content list becomes a "bag": drawn indices are remembered (per
 * device, in localStorage) and never repeat until the whole bag has been
 * used once — then it reshuffles. The drawing side broadcasts each draw so
 * both players' bags stay in sync during a session.
 */
const Deck = (() => {
  const KEY = 'cgn-decks-v1';
  let used = {};
  try { used = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { used = {}; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(used)); } catch (e) {}
  }

  function mark(key, i) {
    if (!used[key]) used[key] = [];
    if (!used[key].includes(i)) { used[key].push(i); save(); }
  }

  /* draw an index from 0..len-1, avoiding already-used ones.
   * limit (optional) restricts the draw to 0..limit-1 (mood curve). When the
   * allowed range is exhausted it reshuffles that range. */
  function draw(key, len, limit) {
    const max = Math.min(limit || len, len);
    if (!used[key]) used[key] = [];
    let avail = [];
    for (let i = 0; i < max; i++) if (!used[key].includes(i)) avail.push(i);
    if (!avail.length) {
      // range exhausted → reshuffle it (keep any used marks beyond the limit)
      used[key] = used[key].filter(idx => idx >= max);
      for (let i = 0; i < max; i++) avail.push(i);
    }
    const i = avail[Math.floor(Math.random() * avail.length)];
    mark(key, i);
    return i;
  }

  return { draw, mark };
})();
