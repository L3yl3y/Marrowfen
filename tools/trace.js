const G = require("./load.js")();
const E = G.E;
const BOT = G.BOT;
const seed = Number(process.argv[2] || 1);
const facs = (process.argv[3] || "company,synod,covenant,wayfarer").split(",");
const filter = process.argv[4] || "";

function mulberry(s0) {
  let t = s0 >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry(seed);
const s = E.createGame({ seed: seed, factions: facs });
let lastLog = 0;
while (!s.winner) {
  const p = s.pending;
  const r = E.applyAction(s, p.fac, BOT.act(s, p.fac, rnd));
  if (!r.ok) {
    console.log("REJECT", p.kind, r.error);
    break;
  }
  s.log.forEach(e => {
    if (e.n <= lastLog) {
      return;
    }
    lastLog = e.n;
    if (e.to) {
      return;
    }
    if (!filter || e.text.toLowerCase().indexOf(filter) >= 0 || e.text.indexOf("Round") === 0) {
      console.log(e.text);
    }
  });
}
console.log(JSON.stringify(E.vpTable(s)));
