const load = require("./load.js");
const G = load();
const E = G.E;
const R = G.RULES;
const BOT = G.BOT;

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    let extra = "";
    if (detail !== undefined) {
      extra = " :: " + JSON.stringify(detail);
    }
    failures.push(name + extra);
  }
}

function cardId(name, nth) {
  const list = R.CARD_LIST.filter(c => c.name === name);
  return list[nth || 0].id;
}

function fresh(factions, seed) {
  const s = E.createGame({ seed: seed || 11, factions: factions });
  const rnd = () => 0.5;
  while (s.phase === "setup" || (s.pending && s.pending.kind.indexOf("setup") === 0)) {
    const p = s.pending;
    if (p.kind === "setupCitadel") {
      E.applyAction(s, "company", { cid: "gallowmere" });
    } else if (p.kind === "setupBuildings") {
      E.applyAction(s, "company", { claypit: "gallowmere", forge: "gallowmere", barracks: "saltings" });
    } else if (p.kind === "setupSynod") {
      E.applyAction(s, "synod", { corner: p.corners[0], regent: "architect" });
    } else if (p.kind === "setupWayfarer") {
      E.applyAction(s, "wayfarer", { arch: "cutpurse", reed: "r1" });
    } else {
      break;
    }
  }
  wipe(s);
  return s;
}

function wipe(s) {
  E.ISLE_IDS.forEach(cid => {
    const c = s.map[cid];
    Object.keys(c.w).forEach(f => {
      s.fac[f].supply += c.w[f];
      c.w[f] = 0;
    });
    c.b = [];
    c.tok = [];
  });
  if (E.inGame(s, "company")) {
    s.fac.company.built = { claypit: 0, forge: 0, barracks: 0 };
    s.fac.company.clay = 8;
    s.fac.company.citadel = null;
  }
  if (E.inGame(s, "synod")) {
    s.fac.synod.spires = 7;
  }
  if (E.inGame(s, "covenant")) {
    s.fac.covenant.lanterns = 10;
    s.fac.covenant.hideout = { peat: null, willow: null, tide: null };
    s.fac.covenant.supply += s.fac.covenant.wardens;
    s.fac.covenant.wardens = 0;
    s.fac.covenant.followers.forEach(id => s.discard.push(id));
    s.fac.covenant.followers = [];
  }
  s.factions.forEach(f => {
    s.fac[f].hand.forEach(id => s.discard.push(id));
    s.fac[f].hand = [];
    s.fac[f].vp = 0;
  });
  s.log = [];
}

function give(s, f, names) {
  names.forEach(n => {
    const ids = R.CARD_LIST.filter(c => c.name === n).map(c => c.id);
    let id = null;
    for (const x of ids) {
      let where = s.deck.indexOf(x);
      if (where >= 0) {
        s.deck.splice(where, 1);
        id = x;
        break;
      }
      where = s.discard.indexOf(x);
      if (where >= 0) {
        s.discard.splice(where, 1);
        id = x;
        break;
      }
    }
    if (id === null) {
      throw new Error("card not free: " + n);
    }
    s.fac[f].hand.push(id);
  });
}

function put(s, cid, f, n) {
  s.fac[f].supply -= n;
  s.map[cid].w[f] = (s.map[cid].w[f] || 0) + n;
}

function build(s, cid, f, t, suit) {
  const b = { f: f, t: t };
  if (t === "hideout") {
    b.s = suit;
    s.fac.covenant.hideout[suit] = cid;
  }
  s.map[cid].b.push(b);
  if (f === "company") {
    s.fac.company.built[t]++;
  }
  if (f === "synod") {
    s.fac.synod.spires--;
  }
}

function token(s, cid, f, t) {
  s.map[cid].tok.push({ f: f, t: t });
  if (t === "clay") {
    s.fac.company.clay--;
  }
  if (t === "lantern") {
    s.fac.covenant.lanterns--;
  }
  if (t === "citadel") {
    s.fac.company.citadel = cid;
  }
}

function enter(s, f, frameType, turnStage, extra, tf) {
  s.phase = "daylight";
  s.turn = s.order.indexOf(f);
  s.tf = Object.assign(E.newTurnFlags(), tf || {});
  const fr = Object.assign({ t: frameType, fac: f, stage: 0 }, extra || {});
  s.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: f, stage: turnStage }, fr];
  s.pending = null;
  E.advance(s);
}

function act(s, f, a) {
  return E.applyAction(s, f, a);
}

function forceDice(s, a, b) {
  const orig = E.randInt;
  let calls = [a, b];
  s.__dice = calls;
}

function rigDice(s, hi, lo) {
  const target = [hi, lo];
  for (let seed = 1; seed < 200000; seed++) {
    let t = seed >>> 0;
    const rr = () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    const d1 = Math.floor(rr() * 4);
    const d2 = Math.floor(rr() * 4);
    if (Math.max(d1, d2) === target[0] && Math.min(d1, d2) === target[1]) {
      s.rng = seed;
      return;
    }
  }
  throw new Error("no seed for dice");
}

function skipAll(s, keep) {
  let guard = 0;
  while (s.pending && guard < 50) {
    guard++;
    const p = s.pending;
    if (keep && keep.indexOf(p.kind) >= 0) {
      break;
    }
    if (p.kind === "ambush" || p.kind === "foil" || p.kind === "surgeons" || p.kind === "warhorn" || p.kind === "punt") {
      act(s, p.fac, { type: "skip" });
    } else if (p.kind === "battleEffects") {
      act(s, p.fac, { use: [] });
    } else {
      break;
    }
  }
}

// 1. Rule
(function () {
  const s = fresh(["company", "synod", "covenant", "wayfarer"]);
  put(s, "fenhollow", "company", 2);
  put(s, "fenhollow", "covenant", 2);
  check("tie means no ruler", E.ruler(s, "fenhollow") === null);
  build(s, "fenhollow", "covenant", "hideout", "tide");
  check("buildings count for rule", E.rules(s, "covenant", "fenhollow"));
  token(s, "mirelight", "covenant", "lantern");
  put(s, "mirelight", "company", 1);
  check("tokens do not count for rule", E.rules(s, "company", "mirelight"));
  put(s, "saltings", "synod", 1);
  put(s, "saltings", "company", 1);
  check("Synod rules ties (Old Claim)", E.rules(s, "synod", "saltings") && !E.rules(s, "company", "saltings"));
  s.fac.wayfarer.loc = "oxbow";
  check("Wayfarer never rules", !E.rules(s, "wayfarer", "oxbow") && E.ruler(s, "oxbow") === null);
  check("empty isle has no ruler", E.ruler(s, "drownmere") === null);
})();

// 2. Movement
(function () {
  const s = fresh(["company", "covenant"]);
  put(s, "fenhollow", "company", 3);
  put(s, "fenhollow", "covenant", 3);
  put(s, "mirelight", "covenant", 2);
  check("cannot move when ruling neither isle", E.checkMove(s, "company", "fenhollow", "mirelight", 1) !== null);
  put(s, "lowmarket", "company", 1);
  check("can move into an isle you rule", E.checkMove(s, "company", "fenhollow", "lowmarket", 2) === null);
  check("cannot move to a non-adjacent isle", E.checkMove(s, "company", "fenhollow", "drownmere", 1) !== null);
  check("cannot move more warriors than present", E.checkMove(s, "company", "lowmarket", "fenhollow", 2) !== null);
})();

// 3. Battle basics
(function () {
  const s = fresh(["company", "synod"]);
  put(s, "fenhollow", "company", 1);
  put(s, "fenhollow", "synod", 3);
  build(s, "fenhollow", "synod", "spire");
  enter(s, "company", "company_daylight", "evening");
  rigDice(s, 3, 2);
  let r = act(s, "company", { type: "battle", cid: "fenhollow", target: "synod" });
  skipAll(s);
  check("battle accepted", r.ok, r);
  check("attacker rolled hits capped by its warriors (1 of 3)", E.warriors(s, "fenhollow", "synod") === 2, s.map.fenhollow.w);
  check("defender deals the lower roll (2) capped by attacker warriors", E.warriors(s, "fenhollow", "company") === 0);

  const t = fresh(["company", "synod"]);
  put(t, "fenhollow", "company", 4);
  build(t, "fenhollow", "synod", "spire");
  enter(t, "company", "company_daylight", "evening");
  rigDice(t, 1, 0);
  act(t, "company", { type: "battle", cid: "fenhollow", target: "synod" });
  skipAll(t);
  check("defenceless gives an extra hit and removes the spire", !E.hasBuilding(t, "fenhollow", "spire"));
  check("removing a building scores one point", t.fac.company.vp === 1, t.fac.company.vp);
  check("spire returns to the track", t.fac.synod.spires === 7);

  const u = fresh(["company", "synod"]);
  put(u, "fenhollow", "company", 1);
  build(u, "fenhollow", "company", "forge");
  put(u, "fenhollow", "synod", 3);
  u.fac.synod.regent = "marshal";
  u.fac.synod.edict = { recruit: [], move: [], battle: ["E1"], build: [] };
  enter(u, "synod", "synod_daylight", "evening", { stage: 1, col: 2, done: [] });
  rigDice(u, 1, 0);
  r = act(u, "synod", { index: 0, cid: "fenhollow", target: "company" });
  skipAll(u);
  check("Marshal extra hit removes warrior and forge", E.warriors(u, "fenhollow", "company") === 0 && !E.hasBuilding(u, "fenhollow", "forge"), r);

  const v = fresh(["company", "covenant"]);
  put(v, "fenhollow", "company", 3);
  put(v, "fenhollow", "covenant", 3);
  enter(v, "company", "company_daylight", "evening");
  rigDice(v, 3, 0);
  act(v, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  skipAll(v);
  check("Fen Fighters: the defending Covenant takes the higher roll", E.warriors(v, "fenhollow", "company") === 0 && E.warriors(v, "fenhollow", "covenant") === 3, v.map.fenhollow.w);
})();

// 4. Ambush
(function () {
  const s = fresh(["company", "covenant"]);
  put(s, "fenhollow", "company", 2);
  put(s, "fenhollow", "covenant", 1);
  give(s, "covenant", ["Tide Ambush"]);
  enter(s, "company", "company_daylight", "evening");
  act(s, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  check("defender is asked to ambush", s.pending && s.pending.kind === "ambush");
  act(s, "covenant", { card: s.pending.cards[0] });
  check("no foil prompt without a matching card", !s.pending || s.pending.kind !== "foil");
  check("ambush deals two hits and ends the battle", E.warriors(s, "fenhollow", "company") === 0 && E.warriors(s, "fenhollow", "covenant") === 1 && s.battle === null);

  const t = fresh(["company", "covenant"]);
  put(t, "fenhollow", "company", 3);
  put(t, "fenhollow", "covenant", 1);
  give(t, "covenant", ["Moonlit Ambush"]);
  give(t, "company", ["Tide Ambush"]);
  enter(t, "company", "company_daylight", "evening");
  act(t, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  act(t, "covenant", { card: t.pending.cards[0] });
  check("attacker may foil", t.pending && t.pending.kind === "foil");
  rigDice(t, 3, 3);
  act(t, "company", { card: t.pending.cards[0] });
  skipAll(t);
  check("foiled ambush deals no hits (only the one rolled hit lands)", E.warriors(t, "fenhollow", "company") === 2 && E.warriors(t, "fenhollow", "covenant") === 0, t.map.fenhollow.w);

  const u = fresh(["company", "covenant"]);
  put(u, "fenhollow", "company", 3);
  put(u, "fenhollow", "covenant", 1);
  give(u, "covenant", ["Tide Ambush"]);
  u.fac.company.play.push(cardId("Outriders"));
  u.deck.splice(u.deck.indexOf(cardId("Outriders")), 1);
  enter(u, "company", "company_daylight", "evening");
  act(u, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  check("Outriders: no ambush prompt", !u.pending || u.pending.kind !== "ambush");
  skipAll(u);

  const w = fresh(["company", "covenant"]);
  put(w, "fenhollow", "company", 2);
  put(w, "fenhollow", "covenant", 1);
  give(w, "covenant", ["Peat Ambush"]);
  enter(w, "company", "company_daylight", "evening");
  act(w, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  check("non-matching ambush cannot be played (Fenhollow is Tide)", !w.pending || w.pending.kind !== "ambush");
  skipAll(w);
})();

// 5. Field Surgeons
(function () {
  const s = fresh(["company", "covenant", "synod"]);
  token(s, "gallowmere", "company", "citadel");
  put(s, "fenhollow", "company", 2);
  put(s, "fenhollow", "covenant", 4);
  give(s, "company", ["Tide Supremacy", "Peat Ambush"]);
  enter(s, "covenant", "covenant_evening", "end", { stage: 1 }, { ops: 1 });
  rigDice(s, 3, 3);
  act(s, "covenant", { type: "battle", cid: "fenhollow", target: "company" });
  skipAll(s, ["surgeons"]);
  const before = s.pending && s.pending.kind;
  check("Field Surgeons prompt appears", before === "surgeons", s.pending);
  if (s.pending && s.pending.kind === "surgeons") {
    check("only matching cards offered", s.pending.cards.length === 1 && s.pending.cards[0] === cardId("Tide Supremacy"));
    act(s, "company", { card: s.pending.cards[0] });
  }
  check("warriors return to the Citadel isle", E.warriors(s, "gallowmere", "company") === 2);
  check("a Supremacy card spent goes to the available pile", s.domAvail.indexOf(cardId("Tide Supremacy")) >= 0);
})();

// 6. Unrest
(function () {
  const s = fresh(["company", "covenant"]);
  put(s, "fenhollow", "company", 3);
  token(s, "mirelight", "covenant", "lantern");
  give(s, "company", ["Willow Ambush", "Peat Fire"]);
  enter(s, "company", "company_daylight", "evening");
  act(s, "company", { type: "march", moves: [{ from: "fenhollow", to: "mirelight", n: 2 }] });
  check("matching card goes to followers automatically when only one matches", s.fac.covenant.followers.indexOf(cardId("Willow Ambush")) >= 0 && s.fac.company.hand.length === 1);
  const t = fresh(["company", "covenant"]);
  put(t, "fenhollow", "company", 3);
  token(t, "mirelight", "covenant", "lantern");
  give(t, "company", ["Peat Fire"]);
  const deckBefore = t.deck.length;
  enter(t, "company", "company_daylight", "evening");
  act(t, "company", { type: "march", moves: [{ from: "fenhollow", to: "mirelight", n: 1 }] });
  check("no matching card: Covenant draws a follower from the deck", t.fac.covenant.followers.length === 1 && t.fac.company.hand.length === 1);
  check("the hand is shown to the Covenant only", t.log.some(e => e.to && e.to[0] === "covenant" && e.text.indexOf("Peat Fire") >= 0));
  const u = fresh(["company", "covenant", "wayfarer"]);
  u.fac.wayfarer.loc = "fenhollow";
  token(u, "mirelight", "covenant", "lantern");
  give(u, "wayfarer", ["Willow Ambush"]);
  enter(u, "wayfarer", "wayfarer_daylight", "evening");
  act(u, "wayfarer", { type: "move", to: "mirelight" });
  check("the Wayfarer pawn never causes Unrest", u.fac.wayfarer.hand.length === 1 && u.fac.covenant.followers.length === 0);
})();

// 7. Company
(function () {
  const s = fresh(["company", "covenant"]);
  token(s, "gallowmere", "company", "citadel");
  put(s, "gallowmere", "company", 2);
  put(s, "saltings", "company", 1);
  put(s, "rushford", "company", 1);
  put(s, "mirelight", "covenant", 1);
  build(s, "gallowmere", "company", "claypit");
  build(s, "saltings", "company", "forge");
  build(s, "saltings", "company", "barracks");
  token(s, "rushford", "company", "clay");
  enter(s, "company", "company_daylight", "evening");
  check("clay reach follows ruled isles (Rushford via Saltings)", E.clayReach(s, "gallowmere") === 1);
  let r = act(s, "company", { type: "build", cid: "gallowmere", b: "claypit" });
  check("second claypit costs 1 and scores 1", r.ok && s.fac.company.vp === 1 && s.fac.company.built.claypit === 2, r);
  r = act(s, "company", { type: "build", cid: "gallowmere", b: "forge" });
  check("cannot build without clay", !r.ok);
  r = act(s, "company", { type: "recruit" });
  check("recruit places one warrior per barracks", r.ok && E.warriors(s, "saltings", "company") === 2);
  r = act(s, "company", { type: "recruit" });
  check("recruit only once per turn", !r.ok);
  give(s, "company", ["Moonlit Ambush"]);
  r = act(s, "company", { type: "craft", card: cardId("Moonlit Ambush") });
  check("cannot craft after taking actions", !r.ok);
  const t = fresh(["company", "covenant"]);
  put(t, "gallowmere", "company", 1);
  build(t, "gallowmere", "company", "claypit");
  give(t, "company", ["Peat Fire", "Moonlit Ambush"]);
  enter(t, "company", "company_daylight", "evening");
  r = act(t, "company", { type: "overwork", cid: "gallowmere", card: cardId("Peat Fire") });
  check("overwork places clay at a matching claypit", r.ok && E.clayIn(t, "gallowmere") === 1);
  r = act(t, "company", { type: "hawk", card: cardId("Moonlit Ambush", 0) });
  check("spending a Moon card gives an extra action", r.ok && t.tf.actions === 3);
  const u = fresh(["company", "covenant"]);
  put(u, "gallowmere", "company", 1);
  build(u, "gallowmere", "company", "barracks");
  build(u, "saltings", "company", "barracks");
  build(u, "fenhollow", "company", "barracks");
  u.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "company", stage: "end" }, { t: "company_evening", fac: "company", stage: 0 }];
  u.pending = null;
  E.advance(u);
  check("three barracks give two evening draws", u.fac.company.hand.length === 2);
  const v = fresh(["company", "covenant"]);
  put(v, "gallowmere", "company", 1);
  build(v, "gallowmere", "company", "claypit");
  build(v, "saltings", "company", "claypit");
  v.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "company", stage: "cards2" }, { t: "company_birdsong", fac: "company", stage: 0 }];
  v.pending = null;
  E.advance(v);
  check("birdsong places one clay per claypit", E.clayIn(v, "gallowmere") === 1 && E.clayIn(v, "saltings") === 1);
})();

// 8. Citadel placement
(function () {
  const s = fresh(["company", "covenant", "synod"]);
  token(s, "gallowmere", "company", "citadel");
  check("others cannot place in the Citadel isle", !E.canPlace(s, "covenant", "gallowmere") && !E.canPlace(s, "synod", "gallowmere") && E.canPlace(s, "company", "gallowmere"));
  s.fac.covenant.followers = [cardId("Peat Fire")];
  check("cannot light a lantern at the Citadel", !E.covenantSpreadOptions(s).some(o => o.cid === "gallowmere"));
})();

// 9. Synod
(function () {
  const s = fresh(["synod", "covenant"]);
  give(s, "synod", ["Moonlit Ambush", "Moonlit Sling", "Peat Fire"]);
  s.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "synod", stage: "cards2" }, { t: "synod_birdsong", fac: "synod", stage: 0 }];
  s.pending = null;
  E.advance(s);
  let r = act(s, "synod", { adds: [{ card: cardId("Moonlit Ambush"), col: "move" }, { card: cardId("Moonlit Sling"), col: "build" }] });
  check("only one Moon card may be added", !r.ok);
  r = act(s, "synod", { adds: [{ card: cardId("Moonlit Ambush"), col: "move" }, { card: cardId("Peat Fire"), col: "build" }] });
  check("adding two cards works", r.ok);
  check("new spire placed when none on the map", E.spiresOnMap(s) === 1 || (s.pending && s.pending.kind === "synodNewSpire"));
  const t = fresh(["synod", "covenant"]);
  build(t, "drownmere", "synod", "spire");
  put(t, "drownmere", "synod", 2);
  t.fac.synod.regent = "architect";
  t.fac.synod.edict = { recruit: ["E1"], move: ["E2"], battle: [cardId("Moonlit Sling")], build: [cardId("Peat Fire")] };
  t.deck.splice(t.deck.indexOf(cardId("Moonlit Sling")), 1);
  t.deck.splice(t.deck.indexOf(cardId("Peat Fire")), 1);
  t.fac.synod.vp = 5;
  enter(t, "synod", "synod_daylight", "evening", { stage: 1, col: 0, done: [] });
  r = act(t, "synod", { index: 0, cid: "drownmere" });
  check("edict recruit places a warrior", r.ok && E.warriors(t, "drownmere", "synod") === 3, r);
  r = act(t, "synod", { index: 0, from: "drownmere", to: "oxbow", n: 1 });
  check("edict move", r.ok, r);
  check("collapse when a battle card has no target", t.pending && t.pending.kind === "synodRegent", t.pending && t.pending.kind);
  check("collapse loses one point per Moon card incl. envoys (3)", t.fac.synod.vp === 2, t.fac.synod.vp);
  check("purge keeps no cards except envoys", t.fac.synod.edict.battle.length === 0 && t.fac.synod.edict.build.length === 0);
  r = act(t, "synod", { regent: "tyrant" });
  check("new regent tucks envoys into Move and Build", r.ok && t.fac.synod.edict.move.indexOf("E1") >= 0 && t.fac.synod.edict.build.indexOf("E2") >= 0);
  check("the deposed regent is set aside", t.fac.synod.deposed.indexOf("architect") >= 0);
  const u = fresh(["synod", "covenant"]);
  build(u, "drownmere", "synod", "spire");
  build(u, "oxbow", "synod", "spire");
  build(u, "brackwater", "synod", "spire");
  u.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "synod", stage: "end" }, { t: "synod_evening", fac: "synod", stage: 0 }];
  u.pending = null;
  E.advance(u);
  check("three spires score 2 and draw 2", u.fac.synod.vp === 2 && u.fac.synod.hand.length === 2, [u.fac.synod.vp, u.fac.synod.hand.length]);
  const v = fresh(["synod", "covenant"]);
  v.fac.synod.vp = 0;
  v.fac.synod.regent = "orator";
  v.fac.synod.edict = { recruit: [], move: [], battle: ["E1", "E2"], build: [] };
  enter(v, "synod", "synod_daylight", "evening", { stage: 1, col: 0, done: [] });
  check("VP never drops below zero on collapse", v.fac.synod.vp === 0);
})();

// 10. Covenant
(function () {
  const s = fresh(["company", "covenant"]);
  s.fac.covenant.followers = [cardId("Peat Fire"), cardId("Peatforged Blade"), cardId("Toll Money"), cardId("Moonlit Ambush")];
  ["Peat Fire", "Peatforged Blade", "Toll Money"].forEach(n => s.deck.splice(s.deck.indexOf(cardId(n)), 1));
  s.deck.splice(s.deck.indexOf(cardId("Moonlit Ambush")), 1);
  token(s, "lowmarket", "covenant", "lantern");
  put(s, "lowmarket", "company", 2);
  build(s, "lowmarket", "company", "forge");
  token(s, "drownmere", "covenant", "lantern");
  s.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "covenant", stage: "cards2" }, { t: "covenant_birdsong", fac: "covenant", stage: 0 }];
  s.pending = null;
  E.advance(s);
  let r = act(s, "covenant", { type: "revolt", cid: "lowmarket", cards: [cardId("Peat Fire"), cardId("Peatforged Blade")] });
  check("uprising accepted", r.ok, r);
  check("uprising removes enemy pieces and scores the forge", E.warriors(s, "lowmarket", "company") === 0 && !E.hasBuilding(s, "lowmarket", "forge") && s.fac.covenant.vp === 1);
  check("uprising places warriors equal to matching lanterns (2 Peat) and a warden", E.warriors(s, "lowmarket", "covenant") === 2 && s.fac.covenant.wardens === 1, [s.map.lowmarket.w, s.fac.covenant.wardens]);
  const t = fresh(["company", "covenant"]);
  token(t, "lowmarket", "covenant", "lantern");
  put(t, "fenhollow", "company", 3);
  t.fac.covenant.followers = [cardId("Tidesteel Blade"), cardId("Fisher's Creel")];
  t.deck.splice(t.deck.indexOf(cardId("Tidesteel Blade")), 1);
  t.deck.splice(t.deck.indexOf(cardId("Fisher's Creel")), 1);
  check("curfew adds one to the cost", E.spreadCost(t, "fenhollow") === 2);
  check("only isles next to lanterns can be lit", !E.covenantSpreadOptions(t).some(o => o.cid === "drownmere"));
  const u = fresh(["company", "covenant"]);
  build(u, "lowmarket", "covenant", "hideout", "peat");
  u.fac.covenant.wardens = 3;
  u.fac.covenant.supply -= 3;
  u.fac.covenant.followers = [cardId("Peat Fire"), cardId("Moonlit Ambush"), cardId("Market Day")];
  ["Peat Fire", "Market Day"].forEach(n => u.deck.splice(u.deck.indexOf(cardId(n)), 1));
  u.deck.splice(u.deck.indexOf(cardId("Moonlit Ambush")), 1);
  put(u, "lowmarket", "company", 3);
  enter(u, "company", "company_daylight", "evening");
  rigDice(u, 2, 0);
  act(u, "company", { type: "battle", cid: "lowmarket", target: "covenant" });
  skipAll(u);
  check("losing a hideout discards matching and Moon followers", u.fac.covenant.followers.length === 1 && u.fac.covenant.followers[0] === cardId("Market Day"), u.fac.covenant.followers);
  check("losing a hideout removes half the wardens rounded up", u.fac.covenant.wardens === 1);
  const v = fresh(["company", "covenant"]);
  v.fac.covenant.followers = [1, 2, 3, 4, 5].map(i => v.deck.pop());
  const extra = v.deck.pop();
  E.addFollower(v, extra);
  check("followers capped at five without hideouts", v.fac.covenant.followers.length === 5 && v.discard.indexOf(extra) >= 0);
  const w = fresh(["company", "covenant"]);
  put(w, "mirelight", "covenant", 2);
  w.fac.covenant.wardens = 1;
  w.fac.covenant.supply--;
  w.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "covenant", stage: "end" }, { t: "covenant_evening", fac: "covenant", stage: 0 }];
  w.pending = null;
  E.advance(w);
  r = act(w, "covenant", { type: "organize", cid: "mirelight" });
  check("kindle: remove a warrior, light a lantern (first scores 0)", r.ok && E.hasToken(w, "mirelight", "lantern") && E.warriors(w, "mirelight", "covenant") === 1 && w.fac.covenant.vp === 0);
})();

// 11. Wayfarer
(function () {
  const s = fresh(["company", "covenant", "wayfarer"]);
  s.fac.wayfarer.loc = "fenhollow";
  put(s, "fenhollow", "company", 1);
  give(s, "wayfarer", ["Tidesteel Blade", "Fisher's Creel", "Saltmarsh Tonic", "Tide Surge", "Eel Futures", "Tide Ambush", "Eelskin Sling"]);
  s.fac.wayfarer.items = ["waders", "waders", "lamp", "blade", "tonic", "tonic", "pack"].map(t => ({ t: t, ex: false, dmg: false }));
  enter(s, "wayfarer", "wayfarer_daylight", "evening");
  let r = act(s, "wayfarer", { type: "aid", target: "company", card: cardId("Tidesteel Blade"), item: "tonic" });
  check("first aid makes the Company Amiable for 1 point", r.ok && s.fac.wayfarer.standing.company === 1 && s.fac.wayfarer.vp === 1, r);
  act(s, "wayfarer", { type: "aid", target: "company", card: cardId("Fisher's Creel"), item: "tonic" });
  check("one more aid is not enough for Friendly", s.fac.wayfarer.standing.company === 1);
  act(s, "wayfarer", { type: "aid", target: "company", card: cardId("Saltmarsh Tonic"), item: "pack" });
  check("two aids in one turn make them Friendly for 2 more points", s.fac.wayfarer.standing.company === 2 && s.fac.wayfarer.vp === 3);
  const t = fresh(["company", "covenant", "wayfarer"]);
  t.fac.wayfarer.loc = "fenhollow";
  put(t, "fenhollow", "company", 2);
  t.fac.wayfarer.items = ["waders", "lamp", "blade", "blade", "sling"].map(x => ({ t: x, ex: false, dmg: false }));
  enter(t, "wayfarer", "wayfarer_daylight", "evening");
  r = act(t, "wayfarer", { type: "strike", target: "company" });
  check("snipe removes a warrior and makes the faction Hostile", r.ok && E.warriors(t, "fenhollow", "company") === 1 && t.fac.wayfarer.standing.company === -1);
  check("snipe gives no Infamy", t.fac.wayfarer.vp === 0);
  build(t, "fenhollow", "company", "forge");
  rigDice(t, 2, 0);
  act(t, "wayfarer", { type: "battle", target: "company" });
  skipAll(t);
  check("battle against a Hostile faction scores Infamy plus cardboard", t.fac.wayfarer.vp === 3, t.fac.wayfarer.vp);
  const u = fresh(["company", "covenant", "wayfarer"]);
  u.fac.wayfarer.loc = "fenhollow";
  u.fac.wayfarer.standing.company = -1;
  put(u, "mirelight", "company", 1);
  u.fac.wayfarer.items = ["waders", "lamp"].map(x => ({ t: x, ex: false, dmg: false }));
  enter(u, "wayfarer", "wayfarer_daylight", "evening");
  r = act(u, "wayfarer", { type: "move", to: "mirelight" });
  check("moving into Hostile warriors needs two Waders", !r.ok);
  const v = fresh(["company", "covenant", "wayfarer"]);
  v.fac.wayfarer.loc = "saltings";
  v.fac.wayfarer.items = ["waders", "lamp"].map(x => ({ t: x, ex: false, dmg: false }));
  enter(v, "wayfarer", "wayfarer_daylight", "evening");
  const before = v.map.saltings.barrow.length;
  r = act(v, "wayfarer", { type: "explore" });
  check("explore takes the barrow item, scores 1 and clears the ruin", r.ok && v.fac.wayfarer.items.length === 3 && v.fac.wayfarer.vp === 1 && !v.map.saltings.ruin && before === 1);
  r = act(v, "wayfarer", { type: "move", to: "r1" });
  check("daylight moves cannot enter a reedbed", !r.ok);
  const w = fresh(["company", "covenant", "wayfarer"]);
  w.fac.wayfarer.loc = "r1";
  w.fac.wayfarer.items = ["waders", "lamp", "blade", "tonic", "tonic", "pack"].map(x => ({ t: x, ex: true, dmg: false }));
  w.fac.wayfarer.items[0].dmg = true;
  w.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "wayfarer", stage: "cards2" }, { t: "wayfarer_birdsong", fac: "wayfarer", stage: 0 }];
  w.pending = null;
  E.advance(w);
  check("refresh three when no tonic is face up", w.pending.kind === "wayfarerRefresh" && w.pending.n === 3);
  act(w, "wayfarer", { items: [{ t: "tonic", dmg: false }, { t: "tonic", dmg: false }, { t: "lamp", dmg: false }] });
  check("slip offers reedbeds and isles", w.pending.kind === "wayfarerSlip" && w.pending.targets.some(t2 => t2.to === "r2") && w.pending.targets.some(t2 => t2.to === "fenhollow"));
  act(w, "wayfarer", { type: "stay" });
  check("refresh next turn counts two face-up tonics", E.refreshCount(w) === 7);
  const x = fresh(["company", "covenant", "wayfarer"]);
  x.fac.wayfarer.loc = "r1";
  x.fac.wayfarer.items = ["waders", "lamp", "blade"].map(y => ({ t: y, ex: false, dmg: true }));
  x.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "wayfarer", stage: "end" }, { t: "wayfarer_evening", fac: "wayfarer", stage: 0 }];
  x.pending = null;
  E.advance(x);
  check("resting in a reedbed repairs everything", x.fac.wayfarer.items.every(it => !it.dmg));
  const y = fresh(["company", "covenant", "wayfarer"]);
  y.fac.wayfarer.loc = "fenhollow";
  y.fac.wayfarer.items = ["waders", "lamp", "blade", "blade", "sling", "mallet", "waders", "lamp"].map(z => ({ t: z, ex: false, dmg: false }));
  y.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "wayfarer", stage: "end" }, { t: "wayfarer_evening", fac: "wayfarer", stage: 0 }];
  y.pending = null;
  E.advance(y);
  while (y.pending && y.pending.kind === "discard") {
    act(y, "wayfarer", { cards: y.fac.wayfarer.hand.slice(0, y.pending.n) });
  }
  check("carrying more than six items forces a choice", y.pending && y.pending.kind === "wayfarerCapacity" && y.pending.n === 2, y.pending);
})();

// 12. Dominance and coalition
(function () {
  const s = fresh(["company", "covenant"]);
  check("two-player games have no Supremacy cards", s.deck.concat(s.discard).every(id => R.CARDS[id].kind !== "dominance"));
  const t = fresh(["company", "covenant", "synod"]);
  give(t, "company", ["Tide Supremacy"]);
  t.fac.company.vp = 9;
  enter(t, "company", "company_daylight", "evening");
  let r = act(t, "company", { type: "dominance", card: cardId("Tide Supremacy") });
  check("Supremacy needs 10 points", !r.ok);
  t.fac.company.vp = 10;
  t.pending = null;
  E.advance(t);
  r = act(t, "company", { type: "dominance", card: cardId("Tide Supremacy") });
  check("Supremacy activates at 10 points", r.ok && t.fac.company.dom === cardId("Tide Supremacy"));
  E.score(t, "company", 5, "test");
  check("no more scoring after Supremacy", t.fac.company.vp === 10);
  ["fenhollow", "brackwater", "sedgewick"].forEach(cid => put(t, cid, "company", 1));
  t.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "company", stage: "start" }];
  t.pending = null;
  E.advance(t);
  check("Supremacy wins at the start of Birdsong", t.winner && t.winner.facs[0] === "company");
  const u = fresh(["company", "covenant", "synod", "wayfarer"]);
  give(u, "wayfarer", ["Peat Supremacy"]);
  u.fac.wayfarer.vp = 12;
  u.fac.company.vp = 3;
  u.fac.covenant.vp = 8;
  u.fac.synod.vp = 3;
  u.fac.wayfarer.loc = "r1";
  enter(u, "wayfarer", "wayfarer_daylight", "evening");
  r = act(u, "wayfarer", { type: "dominance", card: cardId("Peat Supremacy"), with: "covenant" });
  check("coalition only with the lowest-scoring player", !r.ok);
  r = act(u, "wayfarer", { type: "dominance", card: cardId("Peat Supremacy"), with: "synod" });
  check("coalition formed", r.ok && u.fac.wayfarer.coalition === "synod");
  check("coalition partners are not enemies", !E.isEnemy(u, "wayfarer", "synod") && E.isEnemy(u, "wayfarer", "company"));
  u.fac.synod.vp = 29;
  E.score(u, "synod", 1, "test");
  check("the Wayfarer wins with the coalition partner", u.winner && u.winner.facs.indexOf("wayfarer") >= 0 && u.winner.facs.indexOf("synod") >= 0);
  const v = fresh(["company", "covenant", "synod"]);
  v.domAvail.push(cardId("Willow Supremacy"));
  v.deck.splice(v.deck.indexOf(cardId("Willow Supremacy")), 1);
  give(v, "covenant", ["Borrowed Waders"]);
  enter(v, "covenant", "covenant_daylight", "evening");
  r = act(v, "covenant", { type: "takeDominance", dom: cardId("Willow Supremacy"), card: cardId("Borrowed Waders") });
  check("take an available Supremacy card by spending a matching card", r.ok && E.inHand(v, "covenant", cardId("Willow Supremacy")));
})();

// 13. Card effects
(function () {
  const s = fresh(["company", "covenant", "synod"]);
  put(s, "gallowmere", "covenant", 2);
  build(s, "gallowmere", "covenant", "hideout", "peat");
  put(s, "gallowmere", "company", 1);
  put(s, "rushford", "synod", 2);
  build(s, "rushford", "synod", "spire");
  build(s, "rushford", "company", "forge");
  build(s, "drownmere", "company", "forge");
  build(s, "lowmarket", "company", "forge");
  give(s, "company", ["Peat Fire"]);
  enter(s, "company", "company_daylight", "evening");
  let r = act(s, "company", { type: "craft", card: cardId("Peat Fire") });
  check("favour crafted with three Peat forges", r.ok, r);
  check("favour removes enemy pieces in matching isles only", E.warriors(s, "gallowmere", "covenant") === 0 && !E.hasBuilding(s, "gallowmere", "hideout") && E.warriors(s, "rushford", "synod") === 0 && E.warriors(s, "gallowmere", "company") === 1);
  check("favour scores the cardboard removed (2)", s.fac.company.vp === 2, s.fac.company.vp);
  const t = fresh(["company", "covenant"]);
  put(t, "fenhollow", "company", 2);
  put(t, "fenhollow", "covenant", 2);
  t.fac.covenant.play.push(cardId("Bulwark Smiths"));
  t.deck.splice(t.deck.indexOf(cardId("Bulwark Smiths")), 1);
  enter(t, "company", "company_daylight", "evening");
  rigDice(t, 2, 1);
  act(t, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  check("Bulwark Smiths offered to the defender", t.pending && t.pending.kind === "battleEffects" && t.pending.options.indexOf("bulwark") >= 0, t.pending);
  act(t, "covenant", { use: ["bulwark"] });
  skipAll(t);
  check("Bulwark Smiths ignores rolled hits", E.warriors(t, "fenhollow", "covenant") === 2 && E.warriors(t, "fenhollow", "company") === 0, t.map.fenhollow.w);
  const u = fresh(["company", "covenant"]);
  put(u, "fenhollow", "company", 3);
  put(u, "fenhollow", "covenant", 1);
  token(u, "fenhollow", "covenant", "lantern");
  u.fac.company.play.push(cardId("Ruthless Charge"));
  u.deck.splice(u.deck.indexOf(cardId("Ruthless Charge")), 1);
  enter(u, "company", "company_daylight", "evening");
  rigDice(u, 1, 1);
  act(u, "company", { type: "battle", cid: "fenhollow", target: "covenant" });
  act(u, "company", { use: ["ruthless"] });
  skipAll(u);
  while (u.pending && u.pending.kind === "unrest") {
    act(u, "company", { card: u.pending.cards[0] });
  }
  check("Ruthless Charge: extra hit and the defender scores 1", !E.hasToken(u, "fenhollow", "lantern") && u.fac.covenant.vp === 1 && u.fac.company.vp === 1, [u.fac.covenant.vp, u.fac.company.vp]);
  const v = fresh(["company", "covenant", "synod"]);
  put(v, "fenhollow", "company", 1);
  put(v, "drownmere", "company", 1);
  v.fac.company.play.push(cardId("Crown Of Reeds"));
  v.deck.splice(v.deck.indexOf(cardId("Crown Of Reeds")), 1);
  v.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "company", stage: "birdsong" }, { t: "bcards", fac: "company" }];
  v.pending = null;
  E.advance(v);
  r = act(v, "company", { type: "crown" });
  check("Crown Of Reeds scores one per ruled isle", r.ok && v.fac.company.vp === 2 && !E.hasEffect(v, "company", "crown"));
  const w = fresh(["company", "covenant"]);
  put(w, "fenhollow", "company", 2);
  w.fac.company.play.push(cardId("Tithe Reeve"));
  w.deck.splice(w.deck.indexOf(cardId("Tithe Reeve")), 1);
  enter(w, "company", "company_daylight", "evening");
  r = act(w, "company", { type: "reeve", cid: "fenhollow" });
  check("Tithe Reeve: remove a warrior, draw a card", r.ok && E.warriors(w, "fenhollow", "company") === 1 && w.fac.company.hand.length === 1);
  r = act(w, "company", { type: "reeve", cid: "fenhollow" });
  check("Tithe Reeve once per Daylight", !r.ok);
  const x = fresh(["company", "covenant"]);
  give(x, "covenant", ["Peat Fire", "Willow Ambush"]);
  x.fac.company.play.push(cardId("Toll Gate"));
  x.deck.splice(x.deck.indexOf(cardId("Toll Gate")), 1);
  x.stack = [{ t: "game", stage: "turns" }, { t: "turn", fac: "company", stage: "birdsong" }, { t: "bcards", fac: "company" }];
  x.pending = null;
  E.advance(x);
  r = act(x, "company", { type: "toll", target: "covenant" });
  check("Toll Gate takes a card and gives the victim a point", r.ok && x.fac.company.hand.length === 1 && x.fac.covenant.vp === 1);
})();

// 14. Victory at 30 and standing ties
(function () {
  const s = fresh(["company", "covenant"]);
  s.fac.company.vp = 29;
  E.score(s, "company", 1, "test");
  check("30 points wins immediately", s.winner && s.winner.facs[0] === "company" && s.pending === null);
})();

// 15. Visible state hides secrets
(function () {
  const s = fresh(["company", "covenant", "wayfarer"]);
  give(s, "company", ["Peat Fire"]);
  s.fac.covenant.followers = [s.deck.pop()];
  const v = E.visibleState(s, "covenant");
  check("other hands are hidden", v.fac.company.hand.length === 0 && v.fac.company.handCount === 1);
  check("deck order is hidden", v.deck.length === 0 && v.deckCount === s.deck.length);
  check("rng seed is hidden", v.rng === undefined);
  check("own followers visible to the Covenant", v.fac.covenant.followers.length === 1);
  const v2 = E.visibleState(s, "company");
  check("followers hidden from others", v2.fac.covenant.followers.length === 0 && v2.fac.covenant.followerCount === 1);
  check("barrow items hidden", Object.keys(v2.map).every(cid => v2.map[cid].barrow.length === 0));
})();

console.log("rules tests:", pass, "passed,", fail, "failed");
failures.forEach(f => console.log("  FAIL", f));
if (fail > 0) {
  process.exitCode = 1;
}
