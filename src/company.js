(function () {
  var R = E.R;
  var ISLE = E.ISLE;
  var ISLE_IDS = E.ISLE_IDS;
  var log = E.log;
  var fname = E.fname;
  var iname = E.iname;
  var plural = E.plural;
  var BUILDINGS = ["claypit", "forge", "barracks"];

  E.STEP.setup_company = function (state, fr) {
    if (fr.stage === 0) {
      E.ask(state, "company", "setupCitadel", { corners: E.CORNERS.slice() });
      return;
    }
    if (fr.stage === 1) {
      var keep = state.fac.company.citadel;
      E.ask(state, "company", "setupBuildings", { isles: [keep].concat(ISLE[keep].adj) });
      return;
    }
    E.pop(state);
  };

  E.ANSWER.setup_company = function (state, fr, a) {
    var p = state.fac.company;
    if (fr.stage === 0) {
      if (E.CORNERS.indexOf(a.cid) < 0) {
        return "Choose a corner isle.";
      }
      p.citadel = a.cid;
      state.map[a.cid].tok.push({ f: "company", t: "citadel" });
      var skip = E.M.opposite[a.cid];
      ISLE_IDS.forEach(function (cid) {
        if (cid !== skip) {
          E.placeWarriors(state, "company", cid, 1);
        }
      });
      log(state, "The Company raises its Citadel at " + iname(a.cid) + " and garrisons every isle except " + iname(skip) + ".");
      fr.stage = 1;
      return null;
    }
    if (fr.stage === 1) {
      var keep = p.citadel;
      var allowed = [keep].concat(ISLE[keep].adj);
      var need = {};
      for (var i = 0; i < BUILDINGS.length; i++) {
        var cid = a[BUILDINGS[i]];
        if (allowed.indexOf(cid) < 0) {
          return "Place each building at the Citadel or an adjacent isle.";
        }
        need[cid] = (need[cid] || 0) + 1;
      }
      var keys = Object.keys(need);
      for (var j = 0; j < keys.length; j++) {
        if (E.freeSlots(state, keys[j]) < need[keys[j]]) {
          return iname(keys[j]) + " does not have enough open slots.";
        }
      }
      BUILDINGS.forEach(function (b) {
        state.map[a[b]].b.push({ f: "company", t: b });
        p.built[b] = 1;
      });
      log(state, "The Company builds a Claypit at " + iname(a.claypit) + ", a Forge at " + iname(a.forge) + " and Barracks at " + iname(a.barracks) + ".");
      fr.stage = 2;
      return null;
    }
    return "Setup is complete.";
  };

  function claypitIsles(state) {
    var list = [];
    ISLE_IDS.forEach(function (cid) {
      state.map[cid].b.forEach(function (b) {
        if (b.f === "company" && b.t === "claypit") {
          list.push(cid);
        }
      });
    });
    return list;
  }
  E.claypitIsles = claypitIsles;

  E.STEP.company_birdsong = function (state, fr) {
    var p = state.fac.company;
    var spots = claypitIsles(state);
    var placed = 0;
    spots.forEach(function (cid) {
      if (p.clay > 0) {
        p.clay--;
        state.map[cid].tok.push({ f: "company", t: "clay" });
        placed++;
      }
    });
    if (placed > 0) {
      log(state, "The Company quarries " + placed + " clay.");
    }
    if (placed < spots.length) {
      log(state, "The Company has run out of clay tokens; " + (spots.length - placed) + " claypit" + plural(spots.length - placed) + " produce nothing.");
    }
    E.pop(state);
  };

  function ruledComponent(state, cid) {
    var seen = {};
    var order = [];
    var queue = [cid];
    seen[cid] = 0;
    while (queue.length > 0) {
      var c = queue.shift();
      order.push(c);
      ISLE[c].adj.forEach(function (n) {
        if (seen[n] === undefined && E.rules(state, "company", n)) {
          seen[n] = seen[c] + 1;
          queue.push(n);
        }
      });
    }
    return order;
  }

  function clayIn(state, cid) {
    return state.map[cid].tok.filter(function (t) {
      return t.t === "clay";
    }).length;
  }
  E.clayIn = clayIn;

  function clayReach(state, cid) {
    if (!E.rules(state, "company", cid)) {
      return 0;
    }
    var n = 0;
    ruledComponent(state, cid).forEach(function (c) {
      n += clayIn(state, c);
    });
    return n;
  }
  E.clayReach = clayReach;

  function buildOptions(state) {
    var p = state.fac.company;
    var list = [];
    ISLE_IDS.forEach(function (cid) {
      if (!E.rules(state, "company", cid) || E.freeSlots(state, cid) < 1) {
        return;
      }
      var reach = clayReach(state, cid);
      BUILDINGS.forEach(function (b) {
        var n = p.built[b];
        if (n >= 6) {
          return;
        }
        var cost = R.BUILD_COST[n];
        if (reach >= cost) {
          list.push({ cid: cid, b: b, cost: cost, vp: R.BUILD_VP[b][n] });
        }
      });
    });
    return list;
  }
  E.companyBuildOptions = buildOptions;

  function overworkOptions(state) {
    if (state.fac.company.clay <= 0) {
      return [];
    }
    var seen = {};
    var list = [];
    claypitIsles(state).forEach(function (cid) {
      if (seen[cid]) {
        return;
      }
      seen[cid] = true;
      var cards = E.matchingCards(state, "company", ISLE[cid].suit);
      if (cards.length > 0) {
        list.push({ cid: cid, cards: cards });
      }
    });
    return list;
  }
  E.companyOverworkOptions = overworkOptions;

  function recruitSpots(state) {
    var list = [];
    ISLE_IDS.forEach(function (cid) {
      state.map[cid].b.forEach(function (b) {
        if (b.f === "company" && b.t === "barracks") {
          list.push(cid);
        }
      });
    });
    return list;
  }
  E.companyRecruitSpots = recruitSpots;

  function daylightInfo(state) {
    var p = state.fac.company;
    var info = {
      actions: state.tf.actions,
      canCraft: !state.tf.acted,
      craftable: [],
      moons: p.hand.filter(function (id) {
        return E.cardSuit(id) === "moon";
      }),
      recruitUsed: state.tf.recruit,
      free: E.freeActions(state, "company")
    };
    if (info.canCraft) {
      info.craftable = E.craftable(state, "company");
    }
    if (state.tf.actions > 0) {
      info.battles = E.battleOptions(state, "company");
      info.moves = E.moveOptions(state, "company");
      info.builds = buildOptions(state);
      info.overwork = overworkOptions(state);
      info.canRecruit = !state.tf.recruit && recruitSpots(state).length > 0 && p.supply > 0;
    }
    return info;
  }
  E.companyDaylightInfo = daylightInfo;

  E.STEP.company_daylight = function (state, fr) {
    if (fr.stage === 0) {
      state.tf.actions = 3;
      fr.stage = 1;
    }
    E.ask(state, "company", "companyDaylight", daylightInfo(state));
  };

  function payClay(state, cid, cost) {
    var order = ruledComponent(state, cid);
    var left = cost;
    for (var i = 0; i < order.length && left > 0; i++) {
      var c = order[i];
      var toks = state.map[c].tok;
      for (var j = toks.length - 1; j >= 0 && left > 0; j--) {
        if (toks[j].t === "clay") {
          toks.splice(j, 1);
          state.fac.company.clay++;
          left--;
        }
      }
    }
  }

  E.ANSWER.company_daylight = function (state, fr, a) {
    var p = state.fac.company;
    if (E.FREE_TYPES.indexOf(a.type) >= 0) {
      return E.doFreeAction(state, "company", a);
    }
    if (a.type === "end") {
      log(state, "The Company ends Daylight.");
      E.pop(state);
      return null;
    }
    if (a.type === "craft") {
      if (state.tf.acted) {
        return "The Company crafts only before taking actions.";
      }
      return E.doCraft(state, "company", a.card);
    }
    if (a.type === "hawk") {
      if (!E.inHand(state, "company", a.card) || E.cardSuit(a.card) !== "moon") {
        return "Spend a Moon card for an extra action.";
      }
      E.takeFromHand(state, "company", a.card);
      E.discardCard(state, a.card);
      state.tf.actions++;
      log(state, "The Company spends " + E.cname(a.card) + " for an extra action.");
      return null;
    }
    if (state.tf.actions <= 0) {
      return "You have no actions left. Spend a Moon card for more, or end Daylight.";
    }
    var err = null;
    if (a.type === "battle") {
      err = E.checkBattle(state, "company", a.cid, a.target);
      if (err) {
        return err;
      }
      state.tf.actions--;
      state.tf.acted = true;
      E.startBattle(state, "company", a.cid, a.target);
      return null;
    }
    if (a.type === "march") {
      var moves = a.moves || [];
      if (!Array.isArray(moves) || moves.length < 1 || moves.length > 2) {
        return "A march is one or two moves.";
      }
      var test = E.clone(state);
      for (var i = 0; i < moves.length; i++) {
        err = E.checkMove(test, "company", moves[i].from, moves[i].to, moves[i].n);
        if (err) {
          return "Move " + (i + 1) + ": " + err;
        }
        test.map[moves[i].from].w.company -= moves[i].n;
        test.map[moves[i].to].w.company = (test.map[moves[i].to].w.company || 0) + moves[i].n;
      }
      state.tf.actions--;
      state.tf.acted = true;
      var stackSize = state.stack.length;
      moves.forEach(function (m) {
        E.moveRaw(state, "company", m.from, m.to, m.n);
      });
      reverseFrom(state, stackSize);
      return null;
    }
    if (a.type === "recruit") {
      if (state.tf.recruit) {
        return "The Company recruits only once per turn.";
      }
      var spots = recruitSpots(state);
      if (spots.length === 0 || p.supply <= 0) {
        return "You have no barracks or no warriors to recruit.";
      }
      state.tf.actions--;
      state.tf.acted = true;
      state.tf.recruit = true;
      var placed = 0;
      spots.forEach(function (cid) {
        placed += E.placeWarriors(state, "company", cid, 1);
      });
      log(state, "The Company recruits " + placed + " warrior" + plural(placed) + ".");
      return null;
    }
    if (a.type === "build") {
      if (BUILDINGS.indexOf(a.b) < 0 || !ISLE[a.cid]) {
        return "Choose a building and an isle.";
      }
      if (!E.rules(state, "company", a.cid)) {
        return "You must rule the isle to build there.";
      }
      if (E.freeSlots(state, a.cid) < 1) {
        return "That isle has no open slot.";
      }
      var n = p.built[a.b];
      if (n >= 6) {
        return "All six of those buildings are on the map.";
      }
      var cost = R.BUILD_COST[n];
      if (clayReach(state, a.cid) < cost) {
        return "You cannot reach enough clay through isles you rule.";
      }
      state.tf.actions--;
      state.tf.acted = true;
      payClay(state, a.cid, cost);
      state.map[a.cid].b.push({ f: "company", t: a.b });
      p.built[a.b] = n + 1;
      log(state, "The Company builds a " + R.BUILDING_NAME[a.b] + " in " + iname(a.cid) + " for " + cost + " clay.");
      E.score(state, "company", R.BUILD_VP[a.b][n], "building a " + R.BUILDING_NAME[a.b]);
      return null;
    }
    if (a.type === "overwork") {
      var opts = overworkOptions(state);
      var entry = null;
      opts.forEach(function (o) {
        if (o.cid === a.cid) {
          entry = o;
        }
      });
      if (!entry || entry.cards.indexOf(a.card) < 0) {
        return "Spend a card matching an isle with a claypit.";
      }
      state.tf.actions--;
      state.tf.acted = true;
      E.takeFromHand(state, "company", a.card);
      E.discardCard(state, a.card);
      p.clay--;
      state.map[a.cid].tok.push({ f: "company", t: "clay" });
      log(state, "The Company works overtime at " + iname(a.cid) + " for one clay.");
      return null;
    }
    return "Unknown action.";
  };

  function reverseFrom(state, size) {
    var added = state.stack.splice(size);
    added.reverse();
    added.forEach(function (fr) {
      state.stack.push(fr);
    });
  }
  E.reverseFrom = reverseFrom;

  E.STEP.company_evening = function (state, fr) {
    E.pop(state);
    var b = state.fac.company.built.barracks;
    var n = 1;
    if (b >= 3) {
      n++;
    }
    if (b >= 5) {
      n++;
    }
    E.eveningDraw(state, "company", n);
  };
})();
