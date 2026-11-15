var E = (function () {
  var R = RULES;
  var M = MAPDATA;
  var ISLE = {};
  var REED = {};
  M.isles.forEach(function (c) {
    ISLE[c.id] = c;
  });
  M.reedbeds.forEach(function (r) {
    REED[r.id] = r;
  });
  var ISLE_IDS = M.isles.map(function (c) {
    return c.id;
  });
  var CORNERS = M.isles.filter(function (c) {
    return c.corner;
  }).map(function (c) {
    return c.id;
  });

  var E = { R: R, M: M, ISLE: ISLE, REED: REED, ISLE_IDS: ISLE_IDS, CORNERS: CORNERS, STEP: {}, ANSWER: {} };

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  E.clone = clone;

  function rand(state) {
    var t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randInt(state, n) {
    return Math.floor(rand(state) * n);
  }
  function shuffle(state, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(state, i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
  E.rand = rand;
  E.randInt = randInt;
  E.shuffle = shuffle;

  function log(state, text, to) {
    state.logN = (state.logN || 0) + 1;
    var entry = { n: state.logN, text: text };
    if (to) {
      entry.to = to;
    }
    state.log.push(entry);
    if (state.log.length > 250) {
      state.log.splice(0, state.log.length - 250);
    }
  }
  E.log = log;

  function fname(f) {
    return R.FACTION_SHORT[f];
  }
  function iname(cid) {
    if (ISLE[cid]) {
      return ISLE[cid].name;
    }
    if (REED[cid]) {
      return REED[cid].name;
    }
    return String(cid);
  }
  function cname(id) {
    if (id === "E1" || id === "E2") {
      return "Sworn Envoy";
    }
    return R.CARDS[id].name;
  }
  E.fname = fname;
  E.iname = iname;
  E.cname = cname;

  function cardSuit(id) {
    if (id === "E1" || id === "E2") {
      return "moon";
    }
    return R.CARDS[id].suit;
  }
  E.cardSuit = cardSuit;

  function suitMatches(cardSuitValue, target) {
    if (target === "any") {
      return true;
    }
    if (cardSuitValue === "moon") {
      return true;
    }
    return cardSuitValue === target;
  }
  E.suitMatches = suitMatches;

  function inGame(state, f) {
    return state.factions.indexOf(f) >= 0;
  }
  E.inGame = inGame;

  function warriorFactions(state) {
    return state.factions.filter(function (f) {
      return f !== "wayfarer";
    });
  }
  E.warriorFactions = warriorFactions;

  function isEnemy(state, a, b) {
    if (a === b) {
      return false;
    }
    var w = state.fac.wayfarer;
    if (w && w.coalition) {
      if ((a === "wayfarer" && b === w.coalition) || (b === "wayfarer" && a === w.coalition)) {
        return false;
      }
    }
    return true;
  }
  E.isEnemy = isEnemy;

  function warriors(state, cid, f) {
    var c = state.map[cid];
    if (!c || !c.w[f]) {
      return 0;
    }
    return c.w[f];
  }
  E.warriors = warriors;

  function buildingsOf(state, cid, f) {
    return state.map[cid].b.filter(function (b) {
      return b.f === f;
    });
  }
  E.buildingsOf = buildingsOf;

  function tokensOf(state, cid, f) {
    return state.map[cid].tok.filter(function (t) {
      return t.f === f;
    });
  }
  E.tokensOf = tokensOf;

  function hasToken(state, cid, t) {
    return state.map[cid].tok.some(function (x) {
      return x.t === t;
    });
  }
  E.hasToken = hasToken;

  function hasBuilding(state, cid, t) {
    return state.map[cid].b.some(function (x) {
      return x.t === t;
    });
  }
  E.hasBuilding = hasBuilding;

  function wayfarerAt(state, cid) {
    return inGame(state, "wayfarer") && state.fac.wayfarer.loc === cid;
  }
  E.wayfarerAt = wayfarerAt;

  function hasPieces(state, cid, f) {
    if (f === "wayfarer") {
      return wayfarerAt(state, cid);
    }
    return warriors(state, cid, f) > 0 || buildingsOf(state, cid, f).length > 0 || tokensOf(state, cid, f).length > 0;
  }
  E.hasPieces = hasPieces;

  function ruleCount(state, cid, f) {
    return warriors(state, cid, f) + buildingsOf(state, cid, f).length;
  }
  E.ruleCount = ruleCount;

  function rules(state, f, cid) {
    if (f === "wayfarer") {
      return false;
    }
    var mine = ruleCount(state, cid, f);
    if (mine === 0) {
      return false;
    }
    var best = 0;
    warriorFactions(state).forEach(function (o) {
      if (o !== f) {
        best = Math.max(best, ruleCount(state, cid, o));
      }
    });
    if (mine > best) {
      return true;
    }
    if (f === "synod" && mine === best) {
      return true;
    }
    return false;
  }
  E.rules = rules;

  function ruler(state, cid) {
    var who = null;
    warriorFactions(state).forEach(function (f) {
      if (rules(state, f, cid)) {
        who = f;
      }
    });
    return who;
  }
  E.ruler = ruler;

  function freeSlots(state, cid) {
    var c = state.map[cid];
    var used = c.b.length;
    if (c.ruin) {
      used++;
    }
    return ISLE[cid].slots - used;
  }
  E.freeSlots = freeSlots;

  function citadelIsle(state) {
    if (!inGame(state, "company")) {
      return null;
    }
    return state.fac.company.citadel;
  }
  E.citadelIsle = citadelIsle;

  function canPlace(state, f, cid) {
    var keep = citadelIsle(state);
    if (keep && keep === cid && f !== "company") {
      return false;
    }
    return true;
  }
  E.canPlace = canPlace;

  function adjacent(a, b) {
    return ISLE[a].adj.indexOf(b) >= 0;
  }
  E.adjacent = adjacent;

  function supplyOf(state, f) {
    return state.fac[f].supply;
  }
  E.supplyOf = supplyOf;

  function placeWarriors(state, f, cid, n) {
    var p = state.fac[f];
    var k = Math.min(n, p.supply);
    if (k <= 0) {
      return 0;
    }
    p.supply -= k;
    state.map[cid].w[f] = (state.map[cid].w[f] || 0) + k;
    return k;
  }
  E.placeWarriors = placeWarriors;

  function totalWarriors(state, cid) {
    var n = 0;
    warriorFactions(state).forEach(function (f) {
      n += warriors(state, cid, f);
    });
    return n;
  }
  E.totalWarriors = totalWarriors;

  function score(state, f, n, why) {
    if (state.winner || n === 0) {
      return;
    }
    var p = state.fac[f];
    if (p.dom !== null && p.dom !== undefined) {
      return;
    }
    if (f === "wayfarer" && p.coalition) {
      return;
    }
    var before = p.vp;
    p.vp = Math.max(0, p.vp + n);
    var diff = p.vp - before;
    if (diff !== 0 && why) {
      if (diff > 0) {
        log(state, fname(f) + " scores " + diff + " (" + why + ").");
      } else {
        log(state, fname(f) + " loses " + (-diff) + " (" + why + ").");
      }
    }
    if (p.vp >= R.WIN_VP) {
      declareWinner(state, f, "reached " + R.WIN_VP + " points");
    }
  }
  E.score = score;

  function declareWinner(state, f, how) {
    if (state.winner) {
      return;
    }
    var facs = [f];
    var w = state.fac.wayfarer;
    if (w && w.coalition === f) {
      facs.push("wayfarer");
    }
    state.winner = { facs: facs, how: how };
    state.pending = null;
    state.stack = [];
    state.phase = "over";
    log(state, R.FACTION_NAME[f] + " wins: " + how + ".");
  }
  E.declareWinner = declareWinner;

  function drawCards(state, f, n) {
    var got = [];
    for (var i = 0; i < n; i++) {
      if (state.deck.length === 0) {
        if (state.discard.length === 0) {
          break;
        }
        state.deck = shuffle(state, state.discard.slice());
        state.discard = [];
        log(state, "The discard pile is shuffled into a new deck.");
      }
      var id = state.deck.pop();
      state.fac[f].hand.push(id);
      got.push(id);
    }
    if (state.deck.length === 0 && state.discard.length > 0) {
      state.deck = shuffle(state, state.discard.slice());
      state.discard = [];
    }
    return got;
  }
  E.drawCards = drawCards;

  function drawOne(state) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) {
        return null;
      }
      state.deck = shuffle(state, state.discard.slice());
      state.discard = [];
    }
    var id = state.deck.pop();
    if (state.deck.length === 0 && state.discard.length > 0) {
      state.deck = shuffle(state, state.discard.slice());
      state.discard = [];
    }
    return id;
  }
  E.drawOne = drawOne;

  function discardCard(state, id) {
    if (id === "E1" || id === "E2") {
      return;
    }
    if (R.CARDS[id].kind === "dominance") {
      state.domAvail.push(id);
    } else {
      state.discard.push(id);
    }
  }
  E.discardCard = discardCard;

  function takeFromHand(state, f, id) {
    var hand = state.fac[f].hand;
    var i = hand.indexOf(id);
    if (i < 0) {
      return false;
    }
    hand.splice(i, 1);
    return true;
  }
  E.takeFromHand = takeFromHand;

  function inHand(state, f, id) {
    return state.fac[f].hand.indexOf(id) >= 0;
  }
  E.inHand = inHand;

  function hasEffect(state, f, key) {
    return state.fac[f].play.some(function (id) {
      return R.CARDS[id].effect === key;
    });
  }
  E.hasEffect = hasEffect;

  function removeEffect(state, f, key) {
    var p = state.fac[f];
    for (var i = 0; i < p.play.length; i++) {
      if (R.CARDS[p.play[i]].effect === key) {
        var id = p.play[i];
        p.play.splice(i, 1);
        discardCard(state, id);
        return true;
      }
    }
    return false;
  }
  E.removeEffect = removeEffect;

  function matchingCards(state, f, suit) {
    return state.fac[f].hand.filter(function (id) {
      return suitMatches(cardSuit(id), suit);
    });
  }
  E.matchingCards = matchingCards;

  function push(state, frame) {
    state.stack.push(frame);
  }
  E.push = push;

  function top(state) {
    return state.stack[state.stack.length - 1];
  }
  E.top = top;

  function pop(state) {
    state.stack.pop();
  }
  E.pop = pop;

  function ask(state, f, kind, info) {
    var p = { kind: kind, fac: f, id: (state.pendingSeq = (state.pendingSeq || 0) + 1) };
    if (info) {
      Object.keys(info).forEach(function (k) {
        p[k] = info[k];
      });
    }
    state.pending = p;
  }
  E.ask = ask;

  function advance(state) {
    var guard = 0;
    while (!state.winner && !state.pending) {
      guard++;
      if (guard > 100000) {
        throw new Error("advance loop");
      }
      var fr = top(state);
      if (!fr) {
        throw new Error("empty stack");
      }
      var fn = E.STEP[fr.t];
      if (!fn) {
        throw new Error("no step " + fr.t);
      }
      fn(state, fr);
    }
  }
  E.advance = advance;

  function applyAction(state, f, action) {
    if (state.winner) {
      return { ok: false, error: "The game is over." };
    }
    var p = state.pending;
    if (!p) {
      return { ok: false, error: "Nothing is waiting for a decision." };
    }
    if (p.fac !== f) {
      return { ok: false, error: "It is not your decision." };
    }
    if (!action || typeof action !== "object") {
      return { ok: false, error: "No action given." };
    }
    if (action.pid !== undefined && action.pid !== p.id) {
      return { ok: false, error: "That decision has already been made." };
    }
    var fr = top(state);
    var fn = E.ANSWER[fr.t];
    if (!fn) {
      return { ok: false, error: "No handler for " + fr.t };
    }
    var err = fn(state, fr, action);
    if (err) {
      return { ok: false, error: err };
    }
    state.pending = null;
    state.v++;
    advance(state);
    return { ok: true };
  }
  E.applyAction = applyAction;

  function newTurnFlags() {
    return { used: {}, reeve: false, eaves: false, actions: 0, recruit: false, crafted: false, acted: false, tollgate: false, granary: false, warhorn: false, punt: false };
  }
  E.newTurnFlags = newTurnFlags;

  function createGame(opts) {
    var factions = opts.factions.slice();
    if (factions.length < 2 || factions.length > 4) {
      throw new Error("Choose two to four factions.");
    }
    var state = {
      v: 1,
      seed: opts.seed,
      rng: (opts.seed >>> 0) || 1,
      factions: [],
      order: [],
      turn: 0,
      round: 1,
      phase: "setup",
      map: {},
      deck: [],
      discard: [],
      domAvail: [],
      items: clone(R.ITEM_SUPPLY),
      fac: {},
      errands: { deck: [], up: [] },
      stack: [],
      pending: null,
      log: [],
      winner: null,
      tf: newTurnFlags(),
      battle: null,
      lastBattle: null
    };
    R.FACTIONS.forEach(function (f) {
      if (factions.indexOf(f) >= 0) {
        state.factions.push(f);
      }
    });
    state.order = shuffle(state, state.factions.slice());
    ISLE_IDS.forEach(function (cid) {
      state.map[cid] = { w: {}, b: [], tok: [], ruin: ISLE[cid].ruin, barrow: [] };
    });
    var deck = R.CARD_LIST.map(function (c) {
      return c.id;
    });
    if (state.factions.length === 2) {
      deck = deck.filter(function (id) {
        return R.CARDS[id].kind !== "dominance";
      });
    }
    state.deck = shuffle(state, deck);
    state.factions.forEach(function (f) {
      state.fac[f] = { vp: 0, hand: [], play: [], crafted: [], dom: null };
      if (R.WARRIORS[f]) {
        state.fac[f].supply = R.WARRIORS[f];
      }
    });
    state.order.forEach(function (f) {
      drawCards(state, f, 3);
    });
    if (inGame(state, "company")) {
      Object.assign(state.fac.company, { clay: 8, built: { claypit: 0, forge: 0, barracks: 0 }, citadel: null });
    }
    if (inGame(state, "synod")) {
      Object.assign(state.fac.synod, { spires: 7, regent: null, deposed: [], edict: { recruit: [], move: [], battle: [], build: [] } });
    }
    if (inGame(state, "covenant")) {
      Object.assign(state.fac.covenant, { wardens: 0, followers: [], hideout: { peat: null, willow: null, tide: null }, lanterns: 10 });
    }
    if (inGame(state, "wayfarer")) {
      var standing = {};
      state.factions.forEach(function (f) {
        if (f !== "wayfarer") {
          standing[f] = 0;
        }
      });
      Object.assign(state.fac.wayfarer, { arch: null, loc: null, items: [], errands: [], standing: standing, aids: {}, coalition: null });
      var barrowItems = shuffle(state, R.BARROW_ITEMS.slice());
      var k = 0;
      ISLE_IDS.forEach(function (cid) {
        if (ISLE[cid].ruin) {
          state.map[cid].barrow = [barrowItems[k]];
          k++;
        }
      });
      state.errands.deck = shuffle(state, R.ERRANDS.map(function (q, i) {
        return i;
      }));
      for (var i = 0; i < 3; i++) {
        state.errands.up.push(state.errands.deck.pop());
      }
    }
    log(state, "Turn order: " + state.order.map(fname).join(", ") + ".");
    push(state, { t: "game", stage: "setup", i: 0 });
    advance(state);
    return state;
  }
  E.createGame = createGame;

  E.STEP.game = function (state, fr) {
    if (fr.stage === "setup") {
      var order = R.SETUP_ORDER.filter(function (f) {
        return inGame(state, f);
      });
      if (fr.i >= order.length) {
        fr.stage = "turns";
        state.phase = "birdsong";
        log(state, "Setup is complete. Round 1 begins.");
        return;
      }
      var f = order[fr.i];
      fr.i++;
      push(state, { t: "setup_" + f, stage: 0 });
      return;
    }
    var cur = state.order[state.turn];
    state.tf = newTurnFlags();
    push(state, { t: "turn", fac: cur, stage: "start" });
  };

  E.STEP.turn = function (state, fr) {
    var f = fr.fac;
    if (fr.stage === "start") {
      state.phase = "birdsong";
      log(state, "Round " + state.round + ": " + R.FACTION_NAME[f] + " begins their turn.");
      if (inGame(state, "wayfarer")) {
        state.fac.wayfarer.aids = {};
      }
      checkDominanceWin(state, f);
      if (state.winner) {
        return;
      }
      fr.stage = "granary";
      return;
    }
    if (fr.stage === "granary") {
      fr.stage = "cards1";
      if (hasEffect(state, f, "granary")) {
        push(state, { t: "granary", fac: f });
      }
      return;
    }
    if (fr.stage === "cards1") {
      fr.stage = "birdsong";
      push(state, { t: "bcards", fac: f });
      return;
    }
    if (fr.stage === "birdsong") {
      fr.stage = "cards2";
      push(state, { t: f + "_birdsong", fac: f, stage: 0 });
      return;
    }
    if (fr.stage === "cards2") {
      fr.stage = "daylight";
      push(state, { t: "bcards", fac: f });
      return;
    }
    if (fr.stage === "daylight") {
      state.phase = "daylight";
      fr.stage = "daymain";
      if (hasEffect(state, f, "warhorn")) {
        push(state, { t: "warhorn", fac: f });
      }
      return;
    }
    if (fr.stage === "daymain") {
      fr.stage = "evening";
      push(state, { t: f + "_daylight", fac: f, stage: 0 });
      return;
    }
    if (fr.stage === "evening") {
      state.phase = "evening";
      fr.stage = "evemain";
      if (hasEffect(state, f, "punt")) {
        push(state, { t: "punt", fac: f });
      }
      return;
    }
    if (fr.stage === "evemain") {
      fr.stage = "end";
      push(state, { t: f + "_evening", fac: f, stage: 0 });
      return;
    }
    if (fr.stage === "end") {
      pop(state);
      state.turn++;
      if (state.turn >= state.order.length) {
        state.turn = 0;
        state.round++;
      }
      state.v++;
    }
  };

  function checkDominanceWin(state, f) {
    var p = state.fac[f];
    if (p.dom === null || p.dom === undefined) {
      return;
    }
    var suit = R.CARDS[p.dom].suit;
    if (suit === "moon") {
      var pairs = [["gallowmere", "drownmere"], ["staithe", "sedgewick"]];
      for (var i = 0; i < pairs.length; i++) {
        if (rules(state, f, pairs[i][0]) && rules(state, f, pairs[i][1])) {
          declareWinner(state, f, "Moon Supremacy, ruling two opposite corners");
          return;
        }
      }
      return;
    }
    var n = ISLE_IDS.filter(function (cid) {
      return ISLE[cid].suit === suit && rules(state, f, cid);
    }).length;
    if (n >= 3) {
      declareWinner(state, f, R.SUIT_NAME[suit] + " Supremacy, ruling three " + R.SUIT_NAME[suit] + " isles");
    }
  }
  E.checkDominanceWin = checkDominanceWin;

  E.STEP.granary = function (state, fr) {
    var others = state.factions.filter(function (o) {
      return o !== fr.fac;
    });
    ask(state, fr.fac, "granary", { others: others });
  };
  E.ANSWER.granary = function (state, fr, a) {
    var others = state.factions.filter(function (o) {
      return o !== fr.fac;
    });
    if (others.indexOf(a.target) < 0) {
      return "Choose another player.";
    }
    drawCards(state, fr.fac, 1);
    drawCards(state, a.target, 1);
    log(state, fname(fr.fac) + " uses the Common Granary: they and " + fname(a.target) + " each draw a card.");
    pop(state);
    return null;
  };

  function crownValue(state, f) {
    return ISLE_IDS.filter(function (cid) {
      return rules(state, f, cid);
    }).length;
  }
  E.crownValue = crownValue;

  function tollTargets(state, f) {
    return state.factions.filter(function (o) {
      return o !== f && state.fac[o].hand.length > 0;
    });
  }
  E.tollTargets = tollTargets;

  E.STEP.bcards = function (state, fr) {
    var f = fr.fac;
    var crown = hasEffect(state, f, "crown");
    var toll = hasEffect(state, f, "tollgate") && !state.tf.tollgate && tollTargets(state, f).length > 0;
    if (!crown && !toll) {
      pop(state);
      return;
    }
    ask(state, f, "bcards", { crown: crown, crownValue: crownValue(state, f), toll: toll, tollTargets: tollTargets(state, f) });
  };
  E.ANSWER.bcards = function (state, fr, a) {
    var f = fr.fac;
    if (a.type === "done") {
      pop(state);
      return null;
    }
    if (a.type === "crown") {
      if (!hasEffect(state, f, "crown")) {
        return "You have no Crown Of Reeds.";
      }
      var n = crownValue(state, f);
      removeEffect(state, f, "crown");
      log(state, fname(f) + " discards the Crown Of Reeds.");
      score(state, f, n, "Crown Of Reeds, " + n + " isles ruled");
      return null;
    }
    if (a.type === "toll") {
      if (!hasEffect(state, f, "tollgate") || state.tf.tollgate) {
        return "The Toll Gate cannot be used now.";
      }
      if (tollTargets(state, f).indexOf(a.target) < 0) {
        return "Choose a player who has cards.";
      }
      state.tf.tollgate = true;
      var hand = state.fac[a.target].hand;
      var id = hand.splice(randInt(state, hand.length), 1)[0];
      state.fac[f].hand.push(id);
      log(state, fname(f) + " uses the Toll Gate to take a random card from " + fname(a.target) + ".");
      log(state, "You took " + cname(id) + " from " + fname(a.target) + ".", [f]);
      log(state, fname(f) + " took your " + cname(id) + ".", [a.target]);
      score(state, a.target, 1, "Toll Gate");
      return null;
    }
    return "Unknown choice.";
  };

  E.STEP.warhorn = function (state, fr) {
    var opts = battleOptions(state, fr.fac);
    if (opts.length === 0 || state.tf.warhorn) {
      pop(state);
      return;
    }
    ask(state, fr.fac, "warhorn", { battles: opts });
  };
  E.ANSWER.warhorn = function (state, fr, a) {
    if (a.type === "skip") {
      pop(state);
      return null;
    }
    if (a.type !== "battle") {
      return "Unknown choice.";
    }
    var err = checkBattle(state, fr.fac, a.cid, a.target);
    if (err) {
      return err;
    }
    state.tf.warhorn = true;
    pop(state);
    log(state, fname(fr.fac) + " sounds the War Horn.");
    startBattle(state, fr.fac, a.cid, a.target, { ally: a.ally });
    return null;
  };

  E.STEP.punt = function (state, fr) {
    var opts = moveOptions(state, fr.fac);
    if (fr.fac === "wayfarer") {
      opts = E.wayfarerMoveTargets(state, false);
    }
    if (opts.length === 0 || state.tf.punt) {
      pop(state);
      return;
    }
    ask(state, fr.fac, "punt", { moves: opts });
  };
  E.ANSWER.punt = function (state, fr, a) {
    if (a.type === "skip") {
      pop(state);
      return null;
    }
    if (a.type !== "move") {
      return "Unknown choice.";
    }
    var err;
    if (fr.fac === "wayfarer") {
      err = E.wayfarerMove(state, a, { free: true });
    } else {
      err = doMove(state, fr.fac, a.from, a.to, a.n);
    }
    if (err) {
      return err;
    }
    state.tf.punt = true;
    log(state, fname(fr.fac) + " uses the Punt Builder to move.");
    pop(state);
    return null;
  };

  function moveOptions(state, f) {
    var list = [];
    ISLE_IDS.forEach(function (from) {
      var n = warriors(state, from, f);
      if (n <= 0) {
        return;
      }
      ISLE[from].adj.forEach(function (to) {
        if (rules(state, f, from) || rules(state, f, to)) {
          list.push({ from: from, to: to, max: n });
        }
      });
    });
    return list;
  }
  E.moveOptions = moveOptions;

  function checkMove(state, f, from, to, n) {
    if (!ISLE[from] || !ISLE[to]) {
      return "Choose two isles.";
    }
    if (!adjacent(from, to)) {
      return "Those isles are not joined by a causeway.";
    }
    if (!(n >= 1) || Math.floor(n) !== n) {
      return "Move at least one warrior.";
    }
    if (warriors(state, from, f) < n) {
      return "You do not have that many warriors there.";
    }
    if (!rules(state, f, from) && !rules(state, f, to)) {
      return "You must rule the isle you leave or the isle you enter.";
    }
    return null;
  }
  E.checkMove = checkMove;

  function doMove(state, f, from, to, n) {
    var err = checkMove(state, f, from, to, n);
    if (err) {
      return err;
    }
    moveRaw(state, f, from, to, n);
    return null;
  }
  E.doMove = doMove;

  function moveRaw(state, f, from, to, n) {
    state.map[from].w[f] -= n;
    state.map[to].w[f] = (state.map[to].w[f] || 0) + n;
    log(state, fname(f) + " moves " + n + " warrior" + plural(n) + " from " + iname(from) + " to " + iname(to) + ".");
    if (f !== "covenant" && inGame(state, "covenant") && hasToken(state, to, "lantern")) {
      push(state, { t: "unrest", payer: f, cid: to });
    }
  }
  E.moveRaw = moveRaw;

  function plural(n) {
    if (n === 1) {
      return "";
    }
    return "s";
  }
  E.plural = plural;

  E.STEP.unrest = function (state, fr) {
    var f = fr.payer;
    var suit = ISLE[fr.cid].suit;
    var match = matchingCards(state, f, suit);
    if (match.length === 0) {
      var handNames = state.fac[f].hand.map(cname);
      log(state, fname(f) + " has no matching card for the Unrest in " + iname(fr.cid) + ", shows their hand, and the Covenant draws a follower.");
      if (handNames.length > 0) {
        log(state, fname(f) + " shows their hand: " + handNames.join(", ") + ".", ["covenant"]);
      } else {
        log(state, fname(f) + " shows an empty hand.", ["covenant"]);
      }
      var id = drawOne(state);
      if (id !== null) {
        E.addFollower(state, id);
      }
      pop(state);
      return;
    }
    var distinct = {};
    match.forEach(function (id) {
      distinct[R.CARDS[id].name + "|" + cardSuit(id)] = true;
    });
    if (Object.keys(distinct).length === 1) {
      giveUnrest(state, fr, match[0]);
      return;
    }
    ask(state, f, "unrest", { cid: fr.cid, suit: suit, cards: match });
  };
  function giveUnrest(state, fr, id) {
    takeFromHand(state, fr.payer, id);
    log(state, fname(fr.payer) + " gives a card to the Covenant's followers (Unrest in " + iname(fr.cid) + ").");
    log(state, "You gave " + cname(id) + " to the Covenant.", [fr.payer]);
    E.addFollower(state, id);
    pop(state);
  }
  E.ANSWER.unrest = function (state, fr, a) {
    var suit = ISLE[fr.cid].suit;
    if (!inHand(state, fr.payer, a.card) || !suitMatches(cardSuit(a.card), suit)) {
      return "Choose a matching card from your hand.";
    }
    giveUnrest(state, fr, a.card);
    return null;
  };

  function removeWarriors(state, cid, f, n, by, ctx) {
    var have = warriors(state, cid, f);
    var k = Math.min(have, n);
    if (k <= 0) {
      return 0;
    }
    state.map[cid].w[f] -= k;
    state.fac[f].supply += k;
    if (f === "company" && state.fac.company.citadel) {
      push(state, { t: "surgeons", cid: cid, n: k });
    }
    if (by === "wayfarer" && f !== "wayfarer") {
      var w = state.fac.wayfarer;
      if (w.standing[f] !== -1) {
        w.standing[f] = -1;
        log(state, R.FACTION_NAME[f] + " is now Hostile to the Wayfarer.");
        if (ctx && ctx.battle) {
          ctx.battle.hostileFree = (ctx.battle.hostileFree || 0) + 1;
        }
      }
    }
    return k;
  }
  E.removeWarriors = removeWarriors;

  E.STEP.surgeons = function (state, fr) {
    var keep = state.fac.company.citadel;
    var suit = ISLE[fr.cid].suit;
    var match = matchingCards(state, "company", suit);
    if (!keep || match.length === 0 || state.fac.company.supply < fr.n) {
      pop(state);
      return;
    }
    ask(state, "company", "surgeons", { cid: fr.cid, n: fr.n, cards: match });
  };
  E.ANSWER.surgeons = function (state, fr, a) {
    if (a.type === "skip") {
      pop(state);
      return null;
    }
    var suit = ISLE[fr.cid].suit;
    if (!inHand(state, "company", a.card) || !suitMatches(cardSuit(a.card), suit)) {
      return "Choose a matching card.";
    }
    var keep = state.fac.company.citadel;
    takeFromHand(state, "company", a.card);
    discardCard(state, a.card);
    var k = placeWarriors(state, "company", keep, fr.n);
    log(state, "Company Field Surgeons return " + k + " warrior" + plural(k) + " to the Citadel at " + iname(keep) + ".");
    pop(state);
    return null;
  };

  function removeBuilding(state, cid, b, by) {
    var c = state.map[cid];
    var i = c.b.indexOf(b);
    if (i < 0) {
      return;
    }
    c.b.splice(i, 1);
    log(state, fname(b.f) + " " + R.BUILDING_NAME[b.t] + " in " + iname(cid) + " is removed.");
    if (b.f === "company") {
      state.fac.company.built[b.t]--;
    } else if (b.f === "synod") {
      state.fac.synod.spires++;
    } else if (b.f === "covenant") {
      E.hideoutLost(state, b.s);
    }
    if (by && isEnemy(state, by, b.f)) {
      score(state, by, 1, "removing a building");
    }
  }
  E.removeBuilding = removeBuilding;

  function removeToken(state, cid, tk, by) {
    var c = state.map[cid];
    var i = c.tok.indexOf(tk);
    if (i < 0) {
      return;
    }
    c.tok.splice(i, 1);
    if (tk.t === "clay") {
      state.fac.company.clay++;
      log(state, "Company clay in " + iname(cid) + " is removed.");
    } else if (tk.t === "citadel") {
      state.fac.company.citadel = null;
      log(state, "The Company's Citadel in " + iname(cid) + " is destroyed.");
    } else if (tk.t === "lantern") {
      state.fac.covenant.lanterns++;
      log(state, "A Covenant lantern in " + iname(cid) + " is put out.");
      if (by && by !== "covenant") {
        push(state, { t: "unrest", payer: by, cid: cid });
      }
    }
    if (by && isEnemy(state, by, tk.f)) {
      score(state, by, 1, "removing a token");
    }
  }
  E.removeToken = removeToken;

  function cardboardOf(state, cid, f) {
    var list = [];
    state.map[cid].b.forEach(function (b) {
      if (b.f === f) {
        list.push({ kind: "b", ref: b, label: R.BUILDING_NAME[b.t] });
      }
    });
    state.map[cid].tok.forEach(function (t) {
      if (t.f === f) {
        list.push({ kind: "t", ref: t, label: tokenLabel(t.t) });
      }
    });
    return list;
  }
  E.cardboardOf = cardboardOf;

  function tokenLabel(t) {
    if (t === "clay") {
      return "Clay";
    }
    if (t === "citadel") {
      return "Citadel";
    }
    return "Lantern";
  }
  E.tokenLabel = tokenLabel;

  function pieceKey(piece) {
    if (piece.kind === "b") {
      if (piece.ref.t === "hideout") {
        return "hideout";
      }
      return piece.ref.t;
    }
    return piece.ref.t;
  }
  E.pieceKey = pieceKey;

  function removeCardboard(state, cid, piece, by) {
    if (piece.kind === "b") {
      removeBuilding(state, cid, piece.ref, by);
    } else {
      removeToken(state, cid, piece.ref, by);
    }
  }
  E.removeCardboard = removeCardboard;

  function fullRemoval(state, cid, by) {
    var removedCardboard = 0;
    warriorFactions(state).forEach(function (f) {
      if (!isEnemy(state, by, f)) {
        return;
      }
      var n = warriors(state, cid, f);
      if (n > 0) {
        removeWarriors(state, cid, f, n, by, null);
      }
    });
    warriorFactions(state).forEach(function (f) {
      if (!isEnemy(state, by, f)) {
        return;
      }
      cardboardOf(state, cid, f).forEach(function (piece) {
        removeCardboard(state, cid, piece, by);
        removedCardboard++;
      });
    });
    if (wayfarerAt(state, cid) && isEnemy(state, by, "wayfarer")) {
      push(state, { t: "wdamage", n: 3, why: "full removal in " + iname(cid) });
    }
    return removedCardboard;
  }
  E.fullRemoval = fullRemoval;

  function battleTargets(state, f, cid) {
    var list = [];
    state.factions.forEach(function (o) {
      if (o !== f && isEnemy(state, f, o) && hasPieces(state, cid, o)) {
        list.push(o);
      }
    });
    return list;
  }
  E.battleTargets = battleTargets;

  function canAttackFrom(state, f, cid) {
    if (f === "wayfarer") {
      return wayfarerAt(state, cid);
    }
    return warriors(state, cid, f) > 0;
  }
  E.canAttackFrom = canAttackFrom;

  function battleOptions(state, f, suitFilter) {
    var list = [];
    ISLE_IDS.forEach(function (cid) {
      if (suitFilter && !suitMatches(suitFilter, ISLE[cid].suit)) {
        return;
      }
      if (!canAttackFrom(state, f, cid)) {
        return;
      }
      var t = battleTargets(state, f, cid);
      if (t.length > 0) {
        list.push({ cid: cid, targets: t });
      }
    });
    return list;
  }
  E.battleOptions = battleOptions;

  function checkBattle(state, f, cid, target) {
    if (!ISLE[cid]) {
      return "Choose an isle.";
    }
    if (!canAttackFrom(state, f, cid)) {
      return "You need warriors there to battle.";
    }
    if (battleTargets(state, f, cid).indexOf(target) < 0) {
      return "Choose an enemy with pieces in that isle.";
    }
    return null;
  }
  E.checkBattle = checkBattle;

  function startBattle(state, att, cid, def, opts) {
    var b = { att: att, def: def, cid: cid, stage: "ambush", ally: null, ambush: null, hitsOnAtt: 0, hitsOnDef: 0, removed: { att: 0, def: 0 }, cardboardByAtt: 0, hostileFree: 0, log: [] };
    if (att === "wayfarer" && opts && opts.ally) {
      var w = state.fac.wayfarer;
      if (w.standing[opts.ally] === 3 && opts.ally !== def && warriors(state, cid, opts.ally) > 0) {
        b.ally = opts.ally;
      }
    }
    log(state, fname(att) + " attacks " + fname(def) + " in " + iname(cid) + ".");
    push(state, { t: "battle", b: b });
  }
  E.startBattle = startBattle;

  function ambushCards(state, f, cid) {
    var suit = ISLE[cid].suit;
    return state.fac[f].hand.filter(function (id) {
      var c = R.CARDS[id];
      return c.kind === "ambush" && (c.suit === "moon" || c.suit === suit);
    });
  }
  E.ambushCards = ambushCards;

  function maxRolled(state, b, side) {
    var f = b[side];
    if (f === "wayfarer") {
      var n = E.undamagedCount(state, "blade");
      if (side === "att" && b.ally) {
        n += warriors(state, b.cid, b.ally);
      }
      return n;
    }
    return warriors(state, b.cid, f);
  }
  E.maxRolled = maxRolled;

  function defenceless(state, b) {
    if (b.def === "wayfarer") {
      return E.undamagedCount(state, "blade") === 0;
    }
    return warriors(state, b.cid, b.def) === 0;
  }
  E.defenceless = defenceless;

  function attackerGone(state, b) {
    if (b.att === "wayfarer") {
      return false;
    }
    return warriors(state, b.cid, b.att) === 0;
  }

  E.STEP.battle = function (state, fr) {
    var b = fr.b;
    state.battle = b;
    if (b.stage === "ambush") {
      b.stage = "roll";
      if (b.att !== "wayfarer" || true) {
        if (hasEffect(state, b.att, "outriders")) {
          return;
        }
      }
      var cards = ambushCards(state, b.def, b.cid);
      if (cards.length > 0) {
        b.stage = "ambushAsk";
        ask(state, b.def, "ambush", { cid: b.cid, att: b.att, cards: cards });
      }
      return;
    }
    if (b.stage === "foilAsk") {
      var foils = ambushCards(state, b.att, b.cid);
      if (foils.length === 0) {
        discardCard(state, b.ambush);
        b.ambushHeld = false;
        b.stage = "ambushHits";
        return;
      }
      ask(state, b.att, "foil", { cid: b.cid, def: b.def, cards: foils });
      return;
    }
    if (b.stage === "ambushHits") {
      b.stage = "ambushCheck";
      b.hitsOnAtt = 2;
      b.ambushPhase = true;
      push(state, { t: "hits", b: b, side: "att", n: 2, rolled: 0, by: b.def });
      return;
    }
    if (b.stage === "ambushCheck") {
      b.ambushPhase = false;
      if (attackerGone(state, b)) {
        log(state, "The ambush leaves no attackers. The battle ends.");
        b.stage = "end";
        return;
      }
      b.stage = "roll";
      return;
    }
    if (b.stage === "roll") {
      var r1 = randInt(state, 4);
      var r2 = randInt(state, 4);
      var hi = Math.max(r1, r2);
      var lo = Math.min(r1, r2);
      b.dice = [r1, r2];
      var attRoll = hi;
      var defRoll = lo;
      if (b.def === "covenant") {
        attRoll = lo;
        defRoll = hi;
      }
      b.attRolled = Math.min(attRoll, maxRolled(state, b, "att"));
      b.defRolled = Math.min(defRoll, maxRolled(state, b, "def"));
      b.attExtra = 0;
      b.defExtra = 0;
      if (defenceless(state, b)) {
        b.attExtra++;
        b.defenceless = true;
      }
      if (b.att === "synod" && state.fac.synod.regent === "marshal") {
        b.attExtra++;
        b.marshal = true;
      }
      log(state, "Dice show " + r1 + " and " + r2 + ". " + fname(b.att) + " rolls " + b.attRolled + " hit" + plural(b.attRolled) + ", " + fname(b.def) + " rolls " + b.defRolled + ".");
      b.stage = "attEffects";
      return;
    }
    if (b.stage === "attEffects") {
      b.stage = "defEffects";
      var ae = battleEffectOptions(state, b, "att");
      if (ae.length > 0) {
        ask(state, b.att, "battleEffects", { side: "att", options: ae, battle: battleSummary(b) });
      }
      return;
    }
    if (b.stage === "defEffects") {
      b.stage = "allocate";
      var de = battleEffectOptions(state, b, "def");
      if (de.length > 0) {
        ask(state, b.def, "battleEffects", { side: "def", options: de, battle: battleSummary(b) });
      }
      return;
    }
    if (b.stage === "allocate") {
      var toDef = b.attRolled + b.attExtra;
      var toAtt = b.defRolled + b.defExtra;
      if (b.defBulwark) {
        toDef = b.attExtra;
      }
      if (b.attBulwark) {
        toAtt = b.defExtra;
      }
      b.toDef = toDef;
      b.toAtt = toAtt;
      b.stage = "afterDeal";
      push(state, { t: "hits", b: b, side: "att", n: toAtt, by: b.def });
      push(state, { t: "hits", b: b, side: "def", n: toDef, by: b.att });
      return;
    }
    if (b.stage === "afterDeal") {
      if (b.att === "synod" && state.fac.synod.regent === "tyrant" && b.cardboardByAtt > 0) {
        score(state, "synod", 1, "the Tyrant's cruelty");
      }
      b.stage = "end";
      return;
    }
    if (b.stage === "end") {
      state.lastBattle = { att: b.att, def: b.def, cid: b.cid, dice: b.dice || null, toAtt: b.toAtt || b.hitsOnAtt || 0, toDef: b.toDef || 0, ambush: b.ambush, foiled: b.foiled || false, n: (state.lastBattle && state.lastBattle.n || 0) + 1 };
      state.battle = null;
      pop(state);
    }
  };

  function battleSummary(b) {
    return { att: b.att, def: b.def, cid: b.cid, dice: b.dice, attRolled: b.attRolled, defRolled: b.defRolled, attExtra: b.attExtra, defExtra: b.defExtra };
  }

  function battleEffectOptions(state, b, side) {
    var f = b[side];
    var list = [];
    if (side === "att" && hasEffect(state, f, "ruthless")) {
      list.push("ruthless");
    }
    if (side === "def" && hasEffect(state, f, "sappers")) {
      list.push("sappers");
    }
    if (hasEffect(state, f, "bulwark")) {
      var incoming = b.defRolled;
      if (side === "def") {
        incoming = b.attRolled;
      }
      if (incoming > 0) {
        list.push("bulwark");
      }
    }
    return list;
  }

  E.ANSWER.battle = function (state, fr, a) {
    var b = fr.b;
    var p = state.pending;
    if (p.kind === "ambush") {
      if (a.type === "skip") {
        b.stage = "roll";
        return null;
      }
      if (ambushCards(state, b.def, b.cid).indexOf(a.card) < 0) {
        return "Choose a matching ambush card.";
      }
      takeFromHand(state, b.def, a.card);
      b.ambush = a.card;
      b.ambushHeld = true;
      log(state, fname(b.def) + " springs an ambush with " + cname(a.card) + "!");
      b.stage = "foilAsk";
      return null;
    }
    if (p.kind === "foil") {
      if (a.type === "skip") {
        discardCard(state, b.ambush);
        b.ambushHeld = false;
        b.stage = "ambushHits";
        return null;
      }
      if (ambushCards(state, b.att, b.cid).indexOf(a.card) < 0) {
        return "Choose a matching ambush card.";
      }
      takeFromHand(state, b.att, a.card);
      discardCard(state, a.card);
      discardCard(state, b.ambush);
      b.ambushHeld = false;
      b.foiled = true;
      log(state, fname(b.att) + " foils the ambush with " + cname(a.card) + ".");
      b.stage = "roll";
      return null;
    }
    if (p.kind === "battleEffects") {
      var side = p.side;
      var f = b[side];
      var use = a.use || [];
      if (!Array.isArray(use)) {
        return "Bad choice.";
      }
      var allowed = battleEffectOptions(state, b, side);
      for (var i = 0; i < use.length; i++) {
        if (allowed.indexOf(use[i]) < 0) {
          return "You cannot use that effect now.";
        }
      }
      use.forEach(function (key) {
        if (key === "ruthless") {
          b.attExtra++;
          b.ruthless = true;
          log(state, fname(f) + " uses Ruthless Charge for an extra hit.");
          score(state, b.def, 1, "Ruthless Charge");
        } else if (key === "sappers") {
          removeEffect(state, f, "sappers");
          b.defExtra++;
          log(state, fname(f) + " discards Silt Sappers for an extra hit.");
        } else if (key === "bulwark") {
          removeEffect(state, f, "bulwark");
          if (side === "att") {
            b.attBulwark = true;
          } else {
            b.defBulwark = true;
          }
          log(state, fname(f) + " discards Bulwark Smiths to ignore all rolled hits.");
        }
      });
      return null;
    }
    return "Unexpected decision.";
  };

  function hitPlan(state, cid, f, n, b, side) {
    var plan = { warriors: 0, cardboard: [], items: [], ally: 0, choice: false };
    if (n <= 0) {
      return plan;
    }
    if (f === "wayfarer") {
      var undamaged = E.undamagedItems(state);
      var allyN = 0;
      if (b && side === "att" && b.ally) {
        allyN = warriors(state, cid, b.ally);
      }
      var kinds = {};
      undamaged.forEach(function (it) {
        kinds[it.t + "|" + !!it.ex] = true;
      });
      if (allyN > 0 || Object.keys(kinds).length > 1) {
        if (undamaged.length + allyN > 0) {
          plan.choice = true;
        }
      }
      if (!plan.choice) {
        plan.items = undamaged.slice(0, n);
      }
      return plan;
    }
    var w = warriors(state, cid, f);
    plan.warriors = Math.min(w, n);
    var rest = n - plan.warriors;
    if (rest > 0) {
      var cb = cardboardOf(state, cid, f);
      if (rest >= cb.length) {
        plan.cardboard = cb;
      } else {
        var keys = {};
        cb.forEach(function (piece) {
          keys[pieceKey(piece)] = true;
        });
        if (Object.keys(keys).length === 1) {
          plan.cardboard = cb.slice(0, rest);
        } else {
          plan.choice = true;
          plan.rest = rest;
        }
      }
    }
    return plan;
  }
  E.hitPlan = hitPlan;

  E.STEP.hits = function (state, fr) {
    var b = fr.b;
    var f = b[fr.side];
    if (fr.n <= 0) {
      pop(state);
      return;
    }
    var plan = hitPlan(state, b.cid, f, fr.n, b, fr.side);
    if (!plan.choice) {
      applyHits(state, fr, plan);
      return;
    }
    if (f === "wayfarer") {
      var allyN = 0;
      if (fr.side === "att" && b.ally) {
        allyN = warriors(state, b.cid, b.ally);
      }
      ask(state, f, "hits", { cid: b.cid, n: fr.n, wayfarer: true, items: E.undamagedItems(state).map(function (it) {
        return { t: it.t, ex: it.ex };
      }), ally: b.ally, allyN: allyN });
      return;
    }
    var cb = cardboardOf(state, b.cid, f).map(function (piece) {
      return pieceKey(piece);
    });
    ask(state, f, "hits", { cid: b.cid, n: fr.n, warriors: plan.warriors, rest: plan.rest, pieces: cb });
  };

  E.ANSWER.hits = function (state, fr, a) {
    var b = fr.b;
    var f = b[fr.side];
    var plan = { warriors: 0, cardboard: [], items: [], ally: 0 };
    if (f === "wayfarer") {
      var undamaged = E.undamagedItems(state);
      var allyN = 0;
      if (fr.side === "att" && b.ally) {
        allyN = warriors(state, b.cid, b.ally);
      }
      var picks = a.items || [];
      var ally = a.ally || 0;
      if (!Array.isArray(picks) || ally < 0 || ally > allyN) {
        return "Bad choice.";
      }
      var need = Math.min(fr.n, undamaged.length + allyN);
      if (picks.length + ally !== need) {
        return "Assign exactly " + need + " hit" + plural(need) + ".";
      }
      var pool = undamaged.slice();
      for (var i = 0; i < picks.length; i++) {
        var found = -1;
        for (var j = 0; j < pool.length; j++) {
          if (pool[j].t === picks[i].t && !!pool[j].ex === !!picks[i].ex) {
            found = j;
            break;
          }
        }
        if (found < 0) {
          return "You do not have that undamaged item.";
        }
        plan.items.push(pool[found]);
        pool.splice(found, 1);
      }
      plan.ally = ally;
      applyHits(state, fr, plan);
      return null;
    }
    var w = warriors(state, b.cid, f);
    plan.warriors = Math.min(w, fr.n);
    var rest = fr.n - plan.warriors;
    var cb = cardboardOf(state, b.cid, f);
    var keys = a.pieces || [];
    if (!Array.isArray(keys) || keys.length !== Math.min(rest, cb.length)) {
      return "Choose " + Math.min(rest, cb.length) + " piece" + plural(Math.min(rest, cb.length)) + " to remove.";
    }
    var left = cb.slice();
    for (var k = 0; k < keys.length; k++) {
      var idx = -1;
      for (var m = 0; m < left.length; m++) {
        if (pieceKey(left[m]) === keys[k]) {
          idx = m;
          break;
        }
      }
      if (idx < 0) {
        return "That piece is not there.";
      }
      plan.cardboard.push(left[idx]);
      left.splice(idx, 1);
    }
    applyHits(state, fr, plan);
    return null;
  };

  function applyHits(state, fr, plan) {
    var b = fr.b;
    var f = b[fr.side];
    var by = fr.by;
    pop(state);
    var ctx = { battle: b };
    var removedPieces = 0;
    var hostileBefore = null;
    if (by === "wayfarer") {
      hostileBefore = state.fac.wayfarer.standing[f] === -1;
    }
    if (f === "wayfarer") {
      plan.items.forEach(function (it) {
        it.dmg = true;
      });
      if (plan.items.length > 0) {
        log(state, "The Wayfarer damages " + plan.items.map(function (it) {
          return R.ITEM_NAME[it.t];
        }).join(", ") + ".");
      }
      if (plan.ally > 0) {
        removeWarriors(state, b.cid, b.ally, plan.ally, null, null);
        log(state, plan.ally + " allied " + fname(b.ally) + " warrior" + plural(plan.ally) + " fall in the Wayfarer's place.");
        b.allyLost = (b.allyLost || 0) + plan.ally;
        b.itemsLost = (b.itemsLost || 0) + plan.items.length;
        if (b.allyLost > b.itemsLost && state.fac.wayfarer.standing[b.ally] !== -1) {
          state.fac.wayfarer.standing[b.ally] = -1;
          log(state, R.FACTION_NAME[b.ally] + " is now Hostile to the Wayfarer after losing too many warriors for them.");
        }
      } else {
        b.itemsLost = (b.itemsLost || 0) + plan.items.length;
      }
      return;
    }
    if (plan.warriors > 0) {
      removeWarriors(state, b.cid, f, plan.warriors, by, ctx);
      log(state, fname(f) + " loses " + plan.warriors + " warrior" + plural(plan.warriors) + " in " + iname(b.cid) + ".");
      removedPieces += plan.warriors;
    }
    plan.cardboard.forEach(function (piece) {
      removeCardboard(state, b.cid, piece, by);
      removedPieces++;
      if (by === b.att) {
        b.cardboardByAtt++;
      }
    });
    if (by === "wayfarer" && state.order[state.turn] === "wayfarer" && removedPieces > 0) {
      var infamy = removedPieces;
      if (!hostileBefore) {
        infamy = removedPieces - 1;
        if (state.fac.wayfarer.standing[f] !== -1) {
          infamy = 0;
        }
      }
      if (infamy > 0) {
        score(state, "wayfarer", infamy, "Infamy");
      }
    }
  }

  function craftPieces(state, f) {
    var list = [];
    ISLE_IDS.forEach(function (cid) {
      if (f === "company") {
        state.map[cid].b.forEach(function (b, i) {
          if (b.f === "company" && b.t === "forge") {
            list.push({ cid: cid, key: cid + ":forge:" + i, suit: ISLE[cid].suit });
          }
        });
      } else if (f === "synod") {
        state.map[cid].b.forEach(function (b, i) {
          if (b.f === "synod") {
            list.push({ cid: cid, key: cid + ":spire:" + i, suit: ISLE[cid].suit });
          }
        });
      } else if (f === "covenant") {
        if (hasToken(state, cid, "lantern")) {
          list.push({ cid: cid, key: cid + ":lantern", suit: ISLE[cid].suit });
        }
      }
    });
    return list.filter(function (p) {
      return !state.tf.used[p.key];
    });
  }
  E.craftPieces = craftPieces;

  function assignCraft(pieces, cost) {
    var avail = pieces.slice();
    var chosen = [];
    var specific = cost.filter(function (s) {
      return s !== "any";
    });
    var anyCount = cost.length - specific.length;
    for (var i = 0; i < specific.length; i++) {
      var idx = -1;
      for (var j = 0; j < avail.length; j++) {
        if (avail[j].suit === specific[i]) {
          idx = j;
          break;
        }
      }
      if (idx < 0) {
        return null;
      }
      chosen.push(avail[idx]);
      avail.splice(idx, 1);
    }
    for (var k = 0; k < anyCount; k++) {
      if (avail.length === 0) {
        return null;
      }
      var counts = {};
      avail.forEach(function (p) {
        counts[p.suit] = (counts[p.suit] || 0) + 1;
      });
      var bestIdx = 0;
      for (var m = 1; m < avail.length; m++) {
        if (counts[avail[m].suit] > counts[avail[bestIdx].suit]) {
          bestIdx = m;
        }
      }
      chosen.push(avail[bestIdx]);
      avail.splice(bestIdx, 1);
    }
    return chosen;
  }
  E.assignCraft = assignCraft;

  function craftBlock(state, f, id) {
    var c = R.CARDS[id];
    if (!c || c.kind === "ambush" || c.kind === "dominance") {
      return "That card cannot be crafted.";
    }
    if (c.kind === "item" && !(state.items[c.item] > 0)) {
      return "No " + R.ITEM_NAME[c.item] + " is left in the item supply.";
    }
    if (c.kind === "effect" && hasEffect(state, f, c.effect)) {
      return "You already have " + c.name + ".";
    }
    return null;
  }
  E.craftBlock = craftBlock;

  function canCraft(state, f, id) {
    if (!inHand(state, f, id)) {
      return false;
    }
    if (craftBlock(state, f, id)) {
      return false;
    }
    if (f === "wayfarer") {
      return E.wayfarerCanCraft(state, id);
    }
    return assignCraft(craftPieces(state, f), R.CARDS[id].cost) !== null;
  }
  E.canCraft = canCraft;

  function craftable(state, f) {
    return state.fac[f].hand.filter(function (id) {
      return canCraft(state, f, id);
    });
  }
  E.craftable = craftable;

  function doCraft(state, f, id) {
    if (!inHand(state, f, id)) {
      return "That card is not in your hand.";
    }
    var block = craftBlock(state, f, id);
    if (block) {
      return block;
    }
    var c = R.CARDS[id];
    if (f === "wayfarer") {
      var err = E.wayfarerPayCraft(state, id);
      if (err) {
        return err;
      }
    } else {
      var chosen = assignCraft(craftPieces(state, f), c.cost);
      if (!chosen) {
        return "You do not have the crafting pieces for that card.";
      }
      chosen.forEach(function (p) {
        state.tf.used[p.key] = true;
      });
    }
    takeFromHand(state, f, id);
    state.tf.crafted = true;
    log(state, fname(f) + " crafts " + c.name + ".");
    if (c.kind === "item") {
      state.items[c.item]--;
      if (f === "wayfarer") {
        E.gainItem(state, c.item);
      } else {
        state.fac[f].crafted.push(c.item);
      }
      var vp = c.vp;
      if (f === "synod" && state.fac.synod.regent !== "architect") {
        vp = 1;
      }
      discardCard(state, id);
      score(state, f, vp, "crafting " + c.name);
      return null;
    }
    if (c.kind === "effect") {
      state.fac[f].play.push(id);
      return null;
    }
    if (c.kind === "favor") {
      discardCard(state, id);
      var removed = 0;
      ISLE_IDS.forEach(function (cid) {
        if (ISLE[cid].suit === c.favor) {
          removed += fullRemoval(state, cid, f);
        }
      });
      log(state, c.name + " sweeps every " + R.SUIT_NAME[c.favor] + " isle.");
      return null;
    }
    return "That card cannot be crafted.";
  }
  E.doCraft = doCraft;

  function lowestForCoalition(state) {
    var cands = state.factions.filter(function (o) {
      return o !== "wayfarer" && (state.fac[o].dom === null || state.fac[o].dom === undefined);
    });
    if (cands.length === 0) {
      return [];
    }
    var low = Math.min.apply(null, cands.map(function (o) {
      return state.fac[o].vp;
    }));
    return cands.filter(function (o) {
      return state.fac[o].vp === low;
    });
  }
  E.lowestForCoalition = lowestForCoalition;

  function freeActions(state, f) {
    var p = state.fac[f];
    var list = {};
    var doms = p.hand.filter(function (id) {
      return R.CARDS[id].kind === "dominance";
    });
    if (p.vp >= 10 && (p.dom === null || p.dom === undefined) && doms.length > 0) {
      if (f !== "wayfarer") {
        list.dominance = doms;
      } else if (state.factions.length >= 4 && !p.coalition && lowestForCoalition(state).length > 0) {
        list.dominance = doms;
        list.coalitionWith = lowestForCoalition(state);
      }
    }
    var takes = [];
    state.domAvail.forEach(function (d) {
      var s = R.CARDS[d].suit;
      var payers = p.hand.filter(function (id) {
        if (s === "moon") {
          return cardSuit(id) === "moon";
        }
        return suitMatches(cardSuit(id), s);
      });
      if (payers.length > 0) {
        takes.push({ dom: d, cards: payers });
      }
    });
    if (takes.length > 0) {
      list.take = takes;
    }
    if (hasEffect(state, f, "reeve") && !state.tf.reeve && f !== "wayfarer") {
      var spots = ISLE_IDS.filter(function (cid) {
        return warriors(state, cid, f) > 0;
      });
      if (spots.length > 0) {
        list.reeve = spots;
      }
    }
    if (hasEffect(state, f, "eavesdrop") && !state.tf.eaves) {
      list.eavesdrop = state.factions.filter(function (o) {
        return o !== f;
      });
    }
    return list;
  }
  E.freeActions = freeActions;

  function doFreeAction(state, f, a) {
    var fa = freeActions(state, f);
    var p = state.fac[f];
    if (a.type === "dominance") {
      if (!fa.dominance || fa.dominance.indexOf(a.card) < 0) {
        return "You cannot activate that Supremacy card now.";
      }
      if (f === "wayfarer") {
        if (!fa.coalitionWith || fa.coalitionWith.indexOf(a.with) < 0) {
          return "Choose the player with the fewest points.";
        }
        takeFromHand(state, f, a.card);
        p.dom = a.card;
        p.coalition = a.with;
        if (p.standing[a.with] === -1) {
          p.standing[a.with] = 0;
        }
        log(state, "The Wayfarer plays " + cname(a.card) + " and forms a coalition with " + R.FACTION_NAME[a.with] + ".");
        return null;
      }
      takeFromHand(state, f, a.card);
      p.dom = a.card;
      log(state, fname(f) + " activates " + cname(a.card) + " and gives up scoring points.");
      return null;
    }
    if (a.type === "takeDominance") {
      var entry = null;
      (fa.take || []).forEach(function (t) {
        if (t.dom === a.dom) {
          entry = t;
        }
      });
      if (!entry || entry.cards.indexOf(a.card) < 0) {
        return "You cannot take that Supremacy card with that card.";
      }
      takeFromHand(state, f, a.card);
      discardCard(state, a.card);
      state.domAvail.splice(state.domAvail.indexOf(a.dom), 1);
      p.hand.push(a.dom);
      log(state, fname(f) + " spends " + cname(a.card) + " to take " + cname(a.dom) + ".");
      return null;
    }
    if (a.type === "reeve") {
      if (!fa.reeve || fa.reeve.indexOf(a.cid) < 0) {
        return "You cannot use the Tithe Reeve there.";
      }
      state.tf.reeve = true;
      removeWarriors(state, a.cid, f, 1, f, null);
      drawCards(state, f, 1);
      log(state, fname(f) + " uses the Tithe Reeve: removes a warrior from " + iname(a.cid) + " and draws a card.");
      return null;
    }
    if (a.type === "eavesdrop") {
      if (!fa.eavesdrop || fa.eavesdrop.indexOf(a.target) < 0) {
        return "You cannot use Eavesdroppers now.";
      }
      state.tf.eaves = true;
      var names = state.fac[a.target].hand.map(cname);
      log(state, fname(f) + " uses Eavesdroppers on " + fname(a.target) + ".");
      if (names.length > 0) {
        log(state, fname(a.target) + "'s hand: " + names.join(", ") + ".", [f]);
      } else {
        log(state, fname(a.target) + "'s hand is empty.", [f]);
      }
      return null;
    }
    return "Unknown action.";
  }
  E.doFreeAction = doFreeAction;
  E.FREE_TYPES = ["dominance", "takeDominance", "reeve", "eavesdrop"];

  E.STEP.discard = function (state, fr) {
    var hand = state.fac[fr.fac].hand;
    if (hand.length <= R.HAND_LIMIT) {
      pop(state);
      return;
    }
    ask(state, fr.fac, "discard", { n: hand.length - R.HAND_LIMIT });
  };
  E.ANSWER.discard = function (state, fr, a) {
    var hand = state.fac[fr.fac].hand;
    var need = hand.length - R.HAND_LIMIT;
    var cards = a.cards || [];
    if (!Array.isArray(cards) || cards.length !== need) {
      return "Discard exactly " + need + " card" + plural(need) + ".";
    }
    var copy = hand.slice();
    for (var i = 0; i < cards.length; i++) {
      var idx = copy.indexOf(cards[i]);
      if (idx < 0) {
        return "That card is not in your hand.";
      }
      copy.splice(idx, 1);
    }
    cards.forEach(function (id) {
      takeFromHand(state, fr.fac, id);
      discardCard(state, id);
    });
    log(state, fname(fr.fac) + " discards " + need + " card" + plural(need) + " down to five.");
    pop(state);
    return null;
  };

  function eveningDraw(state, f, n) {
    drawCards(state, f, n);
    log(state, fname(f) + " draws " + n + " card" + plural(n) + ".");
    push(state, { t: "discard", fac: f });
  }
  E.eveningDraw = eveningDraw;

  function visibleState(state, seat) {
    var s = clone(state);
    delete s.rng;
    s.deckCount = s.deck.length;
    s.deck = [];
    s.factions.forEach(function (f) {
      var p = s.fac[f];
      p.handCount = p.hand.length;
      if (f !== seat) {
        p.hand = [];
      }
      if (f === "covenant") {
        p.followerCount = p.followers.length;
        if (seat !== "covenant") {
          p.followers = [];
        }
      }
    });
    Object.keys(s.map).forEach(function (cid) {
      s.map[cid].barrowCount = s.map[cid].barrow.length;
      s.map[cid].barrow = [];
    });
    s.errands.deckCount = s.errands.deck.length;
    s.errands.deck = [];
    s.log = s.log.filter(function (e) {
      return !e.to || e.to.indexOf(seat) >= 0;
    });
    if (s.pending && s.pending.fac !== seat) {
      s.pending = { kind: s.pending.kind, fac: s.pending.fac, id: s.pending.id, hidden: true };
    }
    s.stack = [];
    return s;
  }
  E.visibleState = visibleState;

  function vpTable(state) {
    return state.factions.map(function (f) {
      return { f: f, vp: state.fac[f].vp, dom: state.fac[f].dom };
    });
  }
  E.vpTable = vpTable;

  return E;
})();
if (typeof module !== "undefined") {
  module.exports = E;
}
