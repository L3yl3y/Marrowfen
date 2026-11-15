const load = require("./load.js");
const G = load();
const E = G.E;
const BOT = G.BOT;
const R = G.RULES;

const games = Number(process.argv[2] || 100);
const facArg = process.argv[3] || "all";
const base = Number(process.env.SEED_BASE || 1000);
const stats = { wins: {}, how: {}, rounds: 0, errors: 0, rejects: 0, kinds: {}, steps: 0, vp: {}, collapses: 0, battles: 0 };
const rejectSamples = [];

function mulberry(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function facsFor(g) {
  if (facArg !== "all" && facArg !== "mix") {
    return facArg.split(",");
  }
  if (facArg === "all") {
    return ["company", "synod", "covenant", "wayfarer"];
  }
  const all = ["company", "synod", "covenant", "wayfarer"];
  const rnd = mulberry(g * 7919 + 13);
  const n = 2 + Math.floor(rnd() * 3);
  const pool = all.slice();
  const out = [];
  while (out.length < n) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

function invariants(state, label) {
  const problems = [];
  const counts = {};
  state.factions.forEach(f => {
    if (f === "wayfarer") {
      return;
    }
    let onMap = 0;
    E.ISLE_IDS.forEach(cid => {
      const n = E.warriors(state, cid, f);
      if (n < 0) {
        problems.push("negative warriors " + f + " " + cid);
      }
      onMap += n;
    });
    let extra = 0;
    if (f === "covenant") {
      extra = state.fac.covenant.wardens;
    }
    if (onMap + state.fac[f].supply + extra !== R.WARRIORS[f]) {
      problems.push(f + " warrior count " + onMap + "+" + state.fac[f].supply + "+" + extra);
    }
  });
  E.ISLE_IDS.forEach(cid => {
    if (E.freeSlots(state, cid) < 0) {
      problems.push("slots overflow " + cid);
    }
    let lan = state.map[cid].tok.filter(t => t.t === "lantern").length;
    if (lan > 1) {
      problems.push("two lanterns " + cid);
    }
    let sp = state.map[cid].b.filter(b => b.t === "spire").length;
    if (sp > 1) {
      problems.push("two spires " + cid);
    }
  });
  let cards = state.deck.length + state.discard.length + state.domAvail.length;
  if (state.battle && state.battle.ambushHeld) {
    cards++;
  }
  state.factions.forEach(f => {
    const p = state.fac[f];
    cards += p.hand.length + p.play.length;
    if (p.dom !== null && p.dom !== undefined) {
      cards++;
    }
    if (f === "covenant") {
      cards += p.followers.length;
    }
    if (f === "synod") {
      R.EDICT_COLUMNS.forEach(col => {
        cards += p.edict[col].filter(id => id !== "E1" && id !== "E2").length;
      });
    }
    if (p.vp < 0) {
      problems.push(f + " negative vp");
    }
  });
  let total = 54;
  if (state.factions.length === 2) {
    total = 50;
  }
  if (cards !== total) {
    problems.push("card count " + cards);
  }
  if (E.inGame(state, "company")) {
    const c = state.fac.company;
    let clay = 0;
    let bcount = { claypit: 0, forge: 0, barracks: 0 };
    E.ISLE_IDS.forEach(cid => {
      clay += state.map[cid].tok.filter(t => t.t === "clay").length;
      state.map[cid].b.forEach(b => {
        if (b.f === "company") {
          bcount[b.t]++;
        }
      });
    });
    if (clay + c.clay !== 8) {
      problems.push("clay count " + clay + "+" + c.clay);
    }
    ["claypit", "forge", "barracks"].forEach(b => {
      if (bcount[b] !== c.built[b]) {
        problems.push("built mismatch " + b);
      }
    });
  }
  if (E.inGame(state, "synod")) {
    let n = 0;
    E.ISLE_IDS.forEach(cid => {
      n += state.map[cid].b.filter(b => b.t === "spire").length;
    });
    if (n + state.fac.synod.spires !== 7) {
      problems.push("spire count");
    }
  }
  if (E.inGame(state, "covenant")) {
    let n = 0;
    E.ISLE_IDS.forEach(cid => {
      n += state.map[cid].tok.filter(t => t.t === "lantern").length;
    });
    if (n + state.fac.covenant.lanterns !== 10) {
      problems.push("lantern count");
    }
    if (E.hideoutsOnMap(state) === 0 && state.fac.covenant.followers.length > 5 && !(state.pending && state.pending.kind === "covenantTrim") && !state.stack.some(fr => fr.t === "covtrim")) {
      problems.push("followers over cap");
    }
  }
  if (E.inGame(state, "wayfarer")) {
    const w = state.fac.wayfarer;
    if (state.phase !== "setup" && !E.ISLE[w.loc] && !E.REED[w.loc]) {
      problems.push("wayfarer lost " + w.loc);
    }
  }
  if (problems.length > 0) {
    throw new Error(label + ": " + problems.join("; "));
  }
}

for (let g = 0; g < games; g++) {
  const seed = base + g;
  const facs = facsFor(g);
  const rnd = mulberry(seed * 31 + 5);
  let state;
  let steps = 0;
  try {
    state = E.createGame({ seed: seed, factions: facs });
    while (!state.winner) {
      steps++;
      if (steps > 30000) {
        throw new Error("game did not finish, round " + state.round);
      }
      if (state.round > 60) {
        throw new Error("game too long");
      }
      const p = state.pending;
      if (!p) {
        throw new Error("no pending");
      }
      stats.kinds[p.kind] = (stats.kinds[p.kind] || 0) + 1;
      const a = BOT.act(state, p.fac, rnd);
      const lb = state.lastBattle && state.lastBattle.n;
      const res = E.applyAction(state, p.fac, a);
      if (!res.ok) {
        stats.rejects++;
        if (rejectSamples.length < 15) {
          rejectSamples.push(p.kind + ": " + res.error + " " + JSON.stringify(a).slice(0, 160));
        }
        throw new Error("rejected " + p.kind + ": " + res.error + " " + JSON.stringify(a).slice(0, 200));
      }
      if (state.lastBattle && state.lastBattle.n !== lb) {
        stats.battles++;
      }
      invariants(state, "game " + g + " step " + steps + " after " + p.kind);
    }
    state.winner.facs.forEach(f => {
      stats.wins[f] = (stats.wins[f] || 0) + 1;
    });
    state.factions.forEach(f => {
      if (!stats.vp[f]) {
        stats.vp[f] = { sum: 0, n: 0 };
      }
      stats.vp[f].sum += state.fac[f].vp;
      stats.vp[f].n++;
    });
    state.log.forEach(e => {
      if (e.text.indexOf("collapses") >= 0) {
        stats.collapses++;
      }
    });
    const how = state.winner.how.split(",")[0];
    stats.how[how] = (stats.how[how] || 0) + 1;
    stats.rounds += state.round;
    stats.steps += steps;
  } catch (e) {
    stats.errors++;
    console.log("ERROR game", g, "seed", seed, facs.join(","), e.message);
    if (process.env.TRACE) {
      console.log(e.stack);
      console.log(state.log.slice(-25).map(x => x.text).join("\n"));
    }
    if (stats.errors > 5) {
      break;
    }
  }
}
console.log("games", games, "errors", stats.errors, "rejects", stats.rejects);
console.log("wins", stats.wins, "how", stats.how);
console.log("avg rounds", (stats.rounds / games).toFixed(2), "avg steps", (stats.steps / games).toFixed(0), "battles/game", (stats.battles / games).toFixed(1));
console.log("avg final vp", Object.keys(stats.vp).map(f => f + " " + (stats.vp[f].sum / stats.vp[f].n).toFixed(1)).join(", "), "collapses/game", (stats.collapses / games).toFixed(2));
if (process.env.KINDS) {
  console.log(stats.kinds);
}
rejectSamples.forEach(s => console.log("  reject:", s));
