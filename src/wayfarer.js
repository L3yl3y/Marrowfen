(function () {
  var R = E.R;
  var ISLE = E.ISLE;
  var REED = E.REED;
  var ISLE_IDS = E.ISLE_IDS;
  var log = E.log;
  var iname = E.iname;
  var cname = E.cname;
  var fname = E.fname;
  var plural = E.plural;

  function W(state) {
    return state.fac.wayfarer;
  }

  function undamagedItems(state) {
    return W(state).items.filter(function (it) {
      return !it.dmg;
    });
  }
  E.undamagedItems = undamagedItems;

  function undamagedCount(state, t) {
    return W(state).items.filter(function (it) {
      return !it.dmg && it.t === t;
    }).length;
  }
  E.undamagedCount = undamagedCount;

  function readyCount(state, t) {
    return W(state).items.filter(function (it) {
      return !it.dmg && !it.ex && it.t === t;
    }).length;
  }
  E.readyCount = readyCount;

  function trackCount(state, t) {
    return Math.min(3, readyCount(state, t));
  }
  E.trackCount = trackCount;

  function capacity(state) {
    return 6 + 2 * trackCount(state, "pack");
  }
  E.capacity = capacity;

  function carried(state) {
    var n = W(state).items.length;
    R.TRACK_ITEMS.forEach(function (t) {
      n -= trackCount(state, t);
    });
    return n;
  }
  E.carried = carried;

  function gainItem(state, t) {
    W(state).items.push({ t: t, ex: false, dmg: false });
  }
  E.gainItem = gainItem;

  function canExhaust(state, need) {
    var counts = {};
    need.forEach(function (t) {
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.keys(counts).every(function (t) {
      return readyCount(state, t) >= counts[t];
    });
  }
  E.canExhaust = canExhaust;

  function exhaust(state, need) {
    need.forEach(function (t) {
      var items = W(state).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].t === t && !items[i].ex && !items[i].dmg) {
          items[i].ex = true;
          return;
        }
      }
    });
  }
  E.exhaust = exhaust;

  function locIsle(state) {
    var loc = W(state).loc;
    if (ISLE[loc]) {
      return loc;
    }
    return null;
  }
  E.wayfarerIsle = locIsle;

  function hostile(state, f) {
    return W(state).standing[f] === -1;
  }
  E.isHostile = hostile;

  function hostileWarriorsAt(state, cid) {
    return E.warriorFactions(state).some(function (f) {
      return hostile(state, f) && E.warriors(state, cid, f) > 0;
    });
  }
  E.hostileWarriorsAt = hostileWarriorsAt;

  function alliedFactions(state) {
    var w = W(state);
    return Object.keys(w.standing).filter(function (f) {
      return w.standing[f] === 3;
    });
  }
  E.alliedFactions = alliedFactions;

  function allyOptions(state, from, to) {
    var list = [];
    if (!ISLE[from] || !ISLE[to]) {
      return list;
    }
    alliedFactions(state).forEach(function (f) {
      var n = E.warriors(state, from, f);
      if (n > 0 && (E.rules(state, f, from) || E.rules(state, f, to))) {
        list.push({ f: f, max: n });
      }
    });
    return list;
  }

  function moveTargets(state, slip) {
    var w = W(state);
    var list = [];
    if (ISLE[w.loc]) {
      ISLE[w.loc].adj.forEach(function (to) {
        var cost = 1;
        if (hostileWarriorsAt(state, to)) {
          cost = 2;
        }
        list.push({ to: to, cost: cost, allies: allyOptions(state, w.loc, to) });
      });
      if (slip) {
        E.M.reedbeds.forEach(function (r) {
          if (r.isles.indexOf(w.loc) >= 0) {
            list.push({ to: r.id, cost: 0, allies: [] });
          }
        });
      }
    } else if (REED[w.loc]) {
      REED[w.loc].isles.forEach(function (to) {
        var cost = 1;
        if (hostileWarriorsAt(state, to)) {
          cost = 2;
        }
        list.push({ to: to, cost: cost, allies: [] });
      });
      if (slip) {
        REED[w.loc].adjReeds.forEach(function (r) {
          list.push({ to: r, cost: 0, allies: [] });
        });
      }
    }
    if (slip) {
      list.forEach(function (m) {
        m.cost = 0;
      });
    }
    return list;
  }
  E.wayfarerMoveTargets = moveTargets;

  function wayfarerMove(state, a, opts) {
    var w = W(state);
    var targets = moveTargets(state, opts.slip);
    var entry = null;
    targets.forEach(function (t) {
      if (t.to === a.to) {
        entry = t;
      }
    });
    if (!entry) {
      return "You cannot move there.";
    }
    var cost = entry.cost;
    if (opts.free) {
      cost = 0;
    }
    var need = [];
    for (var i = 0; i < cost; i++) {
      need.push("waders");
    }
    if (!canExhaust(state, need)) {
      return "You need " + cost + " ready Waders to move there.";
    }
    var ally = null;
    var allyN = 0;
    if (a.ally) {
      entry.allies.forEach(function (o) {
        if (o.f === a.ally) {
          ally = o;
        }
      });
      if (!ally) {
        return "Those allied warriors cannot move with you.";
      }
      allyN = a.allyN || 0;
      if (allyN < 1 || allyN > ally.max || Math.floor(allyN) !== allyN) {
        return "Choose how many allied warriors move with you.";
      }
    }
    var from = w.loc;
    exhaust(state, need);
    w.loc = a.to;
    log(state, "The Wayfarer moves from " + iname(from) + " to " + iname(a.to) + ".");
    if (ally) {
      E.moveRaw(state, ally.f, from, a.to, allyN);
    }
    return null;
  }
  E.wayfarerMove = wayfarerMove;

  function wayfarerCanCraft(state, id) {
    var cid = locIsle(state);
    if (!cid) {
      return false;
    }
    var c = R.CARDS[id];
    var suit = ISLE[cid].suit;
    var ok = c.cost.every(function (s) {
      return s === "any" || s === suit;
    });
    if (!ok) {
      return false;
    }
    var need = c.cost.map(function () {
      return "mallet";
    });
    return canExhaust(state, need);
  }
  E.wayfarerCanCraft = wayfarerCanCraft;

  E.wayfarerPayCraft = function (state, id) {
    if (!wayfarerCanCraft(state, id)) {
      return "You need a ready Mallet for each crafting icon, and your isle must match them all.";
    }
    exhaust(state, R.CARDS[id].cost.map(function () {
      return "mallet";
    }));
    return null;
  };

  E.STEP.setup_wayfarer = function (state, fr) {
    if (fr.stage === 0) {
      E.ask(state, "wayfarer", "setupWayfarer", { archetypes: R.ARCHETYPE_ORDER.slice(), reedbeds: E.M.reedbeds.map(function (r) {
        return r.id;
      }) });
      return;
    }
    E.pop(state);
  };

  E.ANSWER.setup_wayfarer = function (state, fr, a) {
    var w = W(state);
    if (R.ARCHETYPE_ORDER.indexOf(a.arch) < 0) {
      return "Choose a character.";
    }
    if (!REED[a.reed]) {
      return "Choose a reedbed to start in.";
    }
    w.arch = a.arch;
    w.loc = a.reed;
    R.ARCHETYPES[a.arch].items.forEach(function (t) {
      gainItem(state, t);
    });
    log(state, "The Wayfarer, " + R.ARCHETYPES[a.arch].name + ", hides in " + iname(a.reed) + ".");
    fr.stage = 1;
    return null;
  };

  function refreshCount(state) {
    return 3 + 2 * trackCount(state, "tonic");
  }
  E.refreshCount = refreshCount;

  E.STEP.wayfarer_birdsong = function (state, fr) {
    var w = W(state);
    if (fr.stage === 0) {
      fr.stage = 1;
      var n = refreshCount(state);
      var ex = w.items.filter(function (it) {
        return it.ex;
      });
      if (ex.length <= n) {
        ex.forEach(function (it) {
          it.ex = false;
        });
        if (ex.length > 0) {
          log(state, "The Wayfarer refreshes " + ex.length + " item" + plural(ex.length) + ".");
        }
        return;
      }
      var kinds = {};
      ex.forEach(function (it) {
        kinds[it.t + "|" + it.dmg] = true;
      });
      if (Object.keys(kinds).length === 1) {
        for (var i = 0; i < n; i++) {
          ex[i].ex = false;
        }
        log(state, "The Wayfarer refreshes " + n + " items.");
        return;
      }
      E.ask(state, "wayfarer", "wayfarerRefresh", { n: n, items: ex.map(function (it) {
        return { t: it.t, dmg: it.dmg };
      }) });
      return;
    }
    if (fr.stage === 1) {
      fr.stage = 2;
      E.ask(state, "wayfarer", "wayfarerSlip", { targets: moveTargets(state, true) });
      return;
    }
    E.pop(state);
  };

  function matchItems(pool, picks, keyFn) {
    var left = pool.slice();
    var chosen = [];
    for (var i = 0; i < picks.length; i++) {
      var idx = -1;
      for (var j = 0; j < left.length; j++) {
        if (keyFn(left[j]) === keyFn(picks[i])) {
          idx = j;
          break;
        }
      }
      if (idx < 0) {
        return null;
      }
      chosen.push(left[idx]);
      left.splice(idx, 1);
    }
    return chosen;
  }
  E.matchItems = matchItems;

  E.ANSWER.wayfarer_birdsong = function (state, fr, a) {
    var w = W(state);
    var kind = state.pending.kind;
    if (kind === "wayfarerRefresh") {
      var n = refreshCount(state);
      var ex = w.items.filter(function (it) {
        return it.ex;
      });
      var picks = a.items || [];
      if (!Array.isArray(picks) || picks.length !== n) {
        return "Refresh exactly " + n + " items.";
      }
      var chosen = matchItems(ex, picks, function (it) {
        return it.t + "|" + !!it.dmg;
      });
      if (!chosen) {
        return "Choose exhausted items you have.";
      }
      chosen.forEach(function (it) {
        it.ex = false;
      });
      log(state, "The Wayfarer refreshes " + n + " items.");
      return null;
    }
    if (kind === "wayfarerSlip") {
      if (a.type === "stay") {
        return null;
      }
      return wayfarerMove(state, a, { slip: true });
    }
    return "Unexpected decision.";
  };

  function aidTargets(state) {
    var cid = locIsle(state);
    if (!cid) {
      return [];
    }
    var cards = E.matchingCards(state, "wayfarer", ISLE[cid].suit);
    if (cards.length === 0 || undamagedItems(state).filter(function (it) {
      return !it.ex;
    }).length === 0) {
      return [];
    }
    return state.factions.filter(function (f) {
      return f !== "wayfarer" && E.hasPieces(state, cid, f);
    }).map(function (f) {
      return { f: f, items: state.fac[f].crafted.slice() };
    });
  }
  E.wayfarerAidTargets = aidTargets;

  function errandOptions(state) {
    var cid = locIsle(state);
    if (!cid) {
      return [];
    }
    var suit = ISLE[cid].suit;
    var list = [];
    state.errands.up.forEach(function (q, i) {
      var er = R.ERRANDS[q];
      if (er.suit === suit && canExhaust(state, er.items)) {
        list.push({ slot: i, q: q });
      }
    });
    return list;
  }
  E.wayfarerErrandOptions = errandOptions;

  function strikeTargets(state) {
    var cid = locIsle(state);
    if (!cid || readyCount(state, "sling") < 1) {
      return [];
    }
    var list = [];
    E.warriorFactions(state).forEach(function (f) {
      if (!E.isEnemy(state, "wayfarer", f)) {
        return;
      }
      if (E.warriors(state, cid, f) > 0) {
        list.push({ f: f, warrior: true });
      } else {
        var cb = E.cardboardOf(state, cid, f);
        if (cb.length > 0) {
          list.push({ f: f, warrior: false, pieces: cb.map(E.pieceKey) });
        }
      }
    });
    return list;
  }
  E.wayfarerStrikeTargets = strikeTargets;

  function damagedItems(state) {
    return W(state).items.filter(function (it) {
      return it.dmg;
    });
  }
  E.damagedItems = damagedItems;

  function specialInfo(state) {
    var w = W(state);
    if (readyCount(state, "lamp") < 1) {
      return null;
    }
    var cid = locIsle(state);
    if (w.arch === "cutpurse") {
      if (!cid) {
        return null;
      }
      var targets = state.factions.filter(function (f) {
        return f !== "wayfarer" && E.hasPieces(state, cid, f) && state.fac[f].hand.length > 0;
      });
      if (targets.length === 0) {
        return null;
      }
      return { kind: "pilfer", targets: targets };
    }
    if (w.arch === "mender") {
      if (!cid) {
        return null;
      }
      var suit = ISLE[cid].suit;
      var cards = state.discard.filter(function (id) {
        return E.suitMatches(E.cardSuit(id), suit);
      });
      if (cards.length === 0) {
        return null;
      }
      return { kind: "oddjobs", cards: cards };
    }
    return { kind: "ground", damaged: damagedItems(state).length };
  }
  E.wayfarerSpecialInfo = specialInfo;

  function daylightInfo(state) {
    var w = W(state);
    var cid = locIsle(state);
    var info = {
      loc: w.loc,
      moves: [],
      battles: [],
      explore: false,
      aid: aidTargets(state),
      errands: errandOptions(state),
      strike: strikeTargets(state),
      repair: readyCount(state, "mallet") >= 1 && damagedItems(state).length > 0,
      craftable: E.craftable(state, "wayfarer"),
      special: specialInfo(state),
      free: E.freeActions(state, "wayfarer")
    };
    if (readyCount(state, "waders") >= 1) {
      info.moves = moveTargets(state, false).filter(function (m) {
        return readyCount(state, "waders") >= m.cost;
      });
    }
    if (cid && readyCount(state, "blade") >= 1) {
      info.battles = E.battleTargets(state, "wayfarer", cid);
      info.allies = alliedFactions(state).filter(function (f) {
        return E.warriors(state, cid, f) > 0;
      });
    }
    if (cid && readyCount(state, "lamp") >= 1 && state.map[cid].barrow.length > 0) {
      info.explore = true;
    }
    return info;
  }
  E.wayfarerDaylightInfo = daylightInfo;

  E.STEP.wayfarer_daylight = function (state, fr) {
    if (fr.stage === 1) {
      E.pop(state);
      return;
    }
    E.ask(state, "wayfarer", "wayfarerDaylight", daylightInfo(state));
  };

  function standUp(state, f) {
    var w = W(state);
    var st = w.standing[f];
    if (st === -1) {
      return;
    }
    if (st === 3) {
      E.score(state, "wayfarer", 2, "aiding an ally");
      return;
    }
    w.aids[f] = (w.aids[f] || 0) + 1;
    var step = R.STANDING_STEPS[st];
    if (w.aids[f] >= step.aids) {
      w.aids[f] = 0;
      w.standing[f] = st + 1;
      log(state, R.FACTION_NAME[f] + " is now " + R.STANDING_NAME[st + 1] + " towards the Wayfarer.");
      E.score(state, "wayfarer", step.vp, "standing with " + fname(f));
    }
  }

  E.ANSWER.wayfarer_daylight = function (state, fr, a) {
    var w = W(state);
    if (E.FREE_TYPES.indexOf(a.type) >= 0) {
      return E.doFreeAction(state, "wayfarer", a);
    }
    if (a.type === "end") {
      E.pop(state);
      return null;
    }
    var cid = locIsle(state);
    var err;
    if (a.type === "move") {
      if (readyCount(state, "waders") < 1) {
        return "You need ready Waders to move.";
      }
      return wayfarerMove(state, a, { slip: false });
    }
    if (a.type === "battle") {
      if (!cid || readyCount(state, "blade") < 1) {
        return "You need a ready Blade and must be in an isle to battle.";
      }
      err = E.checkBattle(state, "wayfarer", cid, a.target);
      if (err) {
        return err;
      }
      exhaust(state, ["blade"]);
      E.startBattle(state, "wayfarer", cid, a.target, { ally: a.ally });
      return null;
    }
    if (a.type === "explore") {
      if (!cid || readyCount(state, "lamp") < 1 || state.map[cid].barrow.length === 0) {
        return "You need a ready Lamp and an unexplored barrow here.";
      }
      exhaust(state, ["lamp"]);
      var t = state.map[cid].barrow.pop();
      gainItem(state, t);
      if (state.map[cid].barrow.length === 0) {
        state.map[cid].ruin = false;
      }
      log(state, "The Wayfarer explores the barrow at " + iname(cid) + " and finds " + R.ITEM_NAME[t] + ".");
      E.score(state, "wayfarer", 1, "exploring a barrow");
      return null;
    }
    if (a.type === "aid") {
      var targets = aidTargets(state);
      var entry = null;
      targets.forEach(function (x) {
        if (x.f === a.target) {
          entry = x;
        }
      });
      if (!entry) {
        return "You cannot aid that player here.";
      }
      if (!E.inHand(state, "wayfarer", a.card) || !E.suitMatches(E.cardSuit(a.card), ISLE[cid].suit)) {
        return "Give a card that matches your isle.";
      }
      if (!canExhaust(state, [a.item])) {
        return "Exhaust one of your ready items.";
      }
      if (a.take && state.fac[a.target].crafted.indexOf(a.take) < 0) {
        return "They have no such crafted item.";
      }
      exhaust(state, [a.item]);
      E.takeFromHand(state, "wayfarer", a.card);
      state.fac[a.target].hand.push(a.card);
      log(state, "The Wayfarer aids " + fname(a.target) + " with a card.");
      log(state, "The Wayfarer gave you " + cname(a.card) + ".", [a.target]);
      if (a.take) {
        var list = state.fac[a.target].crafted;
        list.splice(list.indexOf(a.take), 1);
        gainItem(state, a.take);
        log(state, "The Wayfarer takes a " + R.ITEM_NAME[a.take] + " from " + fname(a.target) + "'s crafted items.");
      }
      standUp(state, a.target);
      return null;
    }
    if (a.type === "errand") {
      var opts = errandOptions(state);
      var pick = null;
      opts.forEach(function (o) {
        if (o.slot === a.slot) {
          pick = o;
        }
      });
      if (!pick) {
        return "You cannot do that errand here.";
      }
      if (a.reward !== "vp" && a.reward !== "draw") {
        return "Choose points or two cards.";
      }
      var er = R.ERRANDS[pick.q];
      exhaust(state, er.items);
      w.errands.push(pick.q);
      state.errands.up.splice(pick.slot, 1);
      if (state.errands.deck.length > 0) {
        state.errands.up.push(state.errands.deck.pop());
      }
      log(state, "The Wayfarer completes the errand " + er.name + ".");
      if (a.reward === "vp") {
        var n = w.errands.filter(function (q) {
          return R.ERRANDS[q].suit === er.suit;
        }).length;
        E.score(state, "wayfarer", n, R.SUIT_NAME[er.suit] + " errands");
      } else {
        E.drawCards(state, "wayfarer", 2);
        log(state, "The Wayfarer draws two cards.");
      }
      return null;
    }
    if (a.type === "strike") {
      var st = strikeTargets(state);
      var tg = null;
      st.forEach(function (x) {
        if (x.f === a.target) {
          tg = x;
        }
      });
      if (!tg) {
        return "You cannot snipe that player here.";
      }
      if (tg.warrior) {
        exhaust(state, ["sling"]);
        E.removeWarriors(state, cid, a.target, 1, "wayfarer", null);
        log(state, "The Wayfarer snipes a " + fname(a.target) + " warrior in " + iname(cid) + ".");
        return null;
      }
      var cb = E.cardboardOf(state, cid, a.target);
      var piece = null;
      cb.forEach(function (p) {
        if (E.pieceKey(p) === a.piece && piece === null) {
          piece = p;
        }
      });
      if (!piece) {
        return "Choose one of their pieces here.";
      }
      exhaust(state, ["sling"]);
      log(state, "The Wayfarer snipes at " + fname(a.target) + " in " + iname(cid) + ".");
      E.removeCardboard(state, cid, piece, "wayfarer");
      return null;
    }
    if (a.type === "repair") {
      if (readyCount(state, "mallet") < 1) {
        return "You need a ready Mallet.";
      }
      var dmg = matchItems(damagedItems(state), [a.item || {}], function (it) {
        return it.t + "|" + !!it.ex;
      });
      if (!dmg) {
        return "Choose a damaged item.";
      }
      exhaust(state, ["mallet"]);
      dmg[0].dmg = false;
      log(state, "The Wayfarer repairs a " + R.ITEM_NAME[dmg[0].t] + ".");
      return null;
    }
    if (a.type === "craft") {
      return E.doCraft(state, "wayfarer", a.card);
    }
    if (a.type === "special") {
      var sp = specialInfo(state);
      if (!sp) {
        return "You cannot use your special action now.";
      }
      if (sp.kind === "pilfer") {
        if (sp.targets.indexOf(a.target) < 0) {
          return "Choose a player with cards and pieces in your isle.";
        }
        exhaust(state, ["lamp"]);
        var hand = state.fac[a.target].hand;
        var id = hand.splice(E.randInt(state, hand.length), 1)[0];
        w.hand.push(id);
        log(state, "The Cutpurse pilfers a card from " + fname(a.target) + ".");
        log(state, "You pilfered " + cname(id) + ".", ["wayfarer"]);
        log(state, "The Cutpurse took your " + cname(id) + ".", [a.target]);
        return null;
      }
      if (sp.kind === "oddjobs") {
        if (sp.cards.indexOf(a.card) < 0) {
          return "Choose a matching card from the discard pile.";
        }
        exhaust(state, ["lamp"]);
        state.discard.splice(state.discard.indexOf(a.card), 1);
        w.hand.push(a.card);
        log(state, "The Mender takes " + cname(a.card) + " from the discard pile for odd jobs.");
        return null;
      }
      var picks = a.items || [];
      var dam = damagedItems(state);
      var need = Math.min(3, dam.length);
      if (!Array.isArray(picks) || picks.length !== need) {
        return "Choose " + need + " damaged item" + plural(need) + " to repair.";
      }
      var chosen = matchItems(dam, picks, function (it) {
        return it.t + "|" + !!it.ex;
      });
      if (!chosen) {
        return "Choose damaged items you have.";
      }
      exhaust(state, ["lamp"]);
      chosen.forEach(function (it) {
        it.dmg = false;
      });
      log(state, "The Fenwalker goes to ground, repairs " + need + " item" + plural(need) + " and ends Daylight.");
      fr.stage = 1;
      return null;
    }
    return "Unknown action.";
  };

  E.STEP.wdamage = function (state, fr) {
    var und = undamagedItems(state);
    if (und.length <= fr.n) {
      und.forEach(function (it) {
        it.dmg = true;
      });
      if (und.length > 0) {
        log(state, "The Wayfarer damages " + und.length + " item" + plural(und.length) + " (" + fr.why + ").");
      }
      E.pop(state);
      return;
    }
    var kinds = {};
    und.forEach(function (it) {
      kinds[it.t + "|" + it.ex] = true;
    });
    if (Object.keys(kinds).length === 1) {
      for (var i = 0; i < fr.n; i++) {
        und[i].dmg = true;
      }
      log(state, "The Wayfarer damages " + fr.n + " items (" + fr.why + ").");
      E.pop(state);
      return;
    }
    E.ask(state, "wayfarer", "wayfarerDamage", { n: fr.n, why: fr.why, items: und.map(function (it) {
      return { t: it.t, ex: it.ex };
    }) });
  };
  E.ANSWER.wdamage = function (state, fr, a) {
    var picks = a.items || [];
    if (!Array.isArray(picks) || picks.length !== fr.n) {
      return "Damage exactly " + fr.n + " items.";
    }
    var chosen = matchItems(undamagedItems(state), picks, function (it) {
      return it.t + "|" + !!it.ex;
    });
    if (!chosen) {
      return "Choose undamaged items you have.";
    }
    chosen.forEach(function (it) {
      it.dmg = true;
    });
    log(state, "The Wayfarer damages " + fr.n + " items (" + fr.why + ").");
    E.pop(state);
    return null;
  };

  E.STEP.wayfarer_evening = function (state, fr) {
    var w = W(state);
    E.pop(state);
    if (REED[w.loc]) {
      var d = damagedItems(state);
      w.items.forEach(function (it) {
        if (it.dmg) {
          it.dmg = false;
          it.ex = false;
        }
      });
      if (d.length > 0) {
        log(state, "The Wayfarer rests in the reeds and repairs " + d.length + " item" + plural(d.length) + ".");
      }
    }
    E.push(state, { t: "wcapacity" });
    E.eveningDraw(state, "wayfarer", 1 + trackCount(state, "purse"));
  };

  E.STEP.wcapacity = function (state, fr) {
    var over = carried(state) - capacity(state);
    if (over <= 0) {
      E.pop(state);
      return;
    }
    E.ask(state, "wayfarer", "wayfarerCapacity", { n: over, items: removableItems(state).map(function (it) {
      return { t: it.t, ex: it.ex, dmg: it.dmg };
    }) });
  };

  function removableItems(state) {
    var w = W(state);
    var onTrack = {};
    R.TRACK_ITEMS.forEach(function (t) {
      onTrack[t] = trackCount(state, t);
    });
    var list = [];
    w.items.forEach(function (it) {
      if (!it.dmg && !it.ex && onTrack[it.t] > 0) {
        onTrack[it.t]--;
        return;
      }
      list.push(it);
    });
    return list;
  }
  E.removableItems = removableItems;

  E.ANSWER.wcapacity = function (state, fr, a) {
    var w = W(state);
    var over = carried(state) - capacity(state);
    var picks = a.items || [];
    if (!Array.isArray(picks) || picks.length !== over) {
      return "Remove exactly " + over + " item" + plural(over) + ".";
    }
    var chosen = matchItems(removableItems(state), picks, function (it) {
      return it.t + "|" + !!it.ex + "|" + !!it.dmg;
    });
    if (!chosen) {
      return "Choose items from your kit or damaged box.";
    }
    chosen.forEach(function (it) {
      w.items.splice(w.items.indexOf(it), 1);
    });
    if (carried(state) > capacity(state)) {
      return null;
    }
    log(state, "The Wayfarer leaves behind " + over + " item" + plural(over) + " that they cannot carry.");
    E.pop(state);
    return null;
  };
})();
