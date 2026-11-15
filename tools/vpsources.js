const G = require("./load.js")();
const E = G.E, BOT = G.BOT;
function mulberry(seed) { let t = seed >>> 0; return function () { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
const src = {};
const games = Number(process.argv[2] || 50);
for (let g = 0; g < games; g++) {
  const rnd = mulberry(g + 77);
  const s = E.createGame({ seed: 500 + g, factions: ["company", "synod", "covenant", "wayfarer"] });
  let last = 0;
  while (!s.winner) {
    const p = s.pending;
    E.applyAction(s, p.fac, BOT.act(s, p.fac, rnd));
    s.log.forEach(e => {
      if (e.n > last) {
        last = e.n;
        const m = e.text.match(/^(\w+) scores (\d+) \(([^,)]+)/);
        if (m && !e.to) {
          let why = m[3].replace(/crafting .*/, "crafting").replace(/building a .*/, "building").replace(/standing with .*/, "standing").replace(/\d+ spires?/, "spires").replace(/.* errands/, "errands");
          const k = m[1] + ":" + why;
          src[k] = (src[k] || 0) + Number(m[2]);
        }
      }
    });
  }
}
Object.keys(src).sort().forEach(k => console.log(k.padEnd(40), (src[k] / games).toFixed(2)));
