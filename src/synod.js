(function () {
  var R = E.R;
  var ISLE = E.ISLE;
  var ISLE_IDS = E.ISLE_IDS;
  var log = E.log;
  var iname = E.iname;
  var cname = E.cname;
  var plural = E.plural;
  var COLS = R.EDICT_COLUMNS;

  function synodCorners(state) {
    if (E.inGame(state, "company") && state.fac.company.citadel) {
      return [E.M.opposite[state.fac.company.citadel]];
    }
    return E.CORNERS.slice();
  }

  E.STEP.setup_synod = function (state, fr) {
    if (fr.stage === 0) {
      E.ask(state, "synod", "setupSynod", { corners: synodCorners(state), regents: R.REGENT_ORDER.slice() });
      return;
    }
    E.pop(state);
  };

  function tuckEnvoys(state) {
    var p = state.fac.synod;
    var cols = R.REGENTS[p.regent].envoys;
    p.edict[cols[0]].push("E1");
    p.edict[cols[1]].push("E2");
  }

  E.ANSWER.setup_synod = function (state, fr, a) {
    var p = state.fac.synod;
    var corners = synodCorners(state);
    if (corners.indexOf(a.corner) < 0) {
      return "Choose your starting corner.";
    }
    if (R.REGENT_ORDER.indexOf(a.regent) < 0) {
      return "Choose a regent.";
    }
    state.map[a.corner].b.push({ f: "synod", t: "spire" });
    p.spires--;
    E.placeWarriors(state, "synod", a.corner, 6);
    p.regent = a.regent;
    tuckEnvoys(state);
    log(state, "The Synod raises a spire at " + iname(a.corner) + " under " + R.REGENTS[a.regent].name + ".");
    fr.stage = 1;
    return null;
  };

  function spiresOnMap(state) {
    return 7 - state.fac.synod.spires;
  }
  E.spiresOnMap = spiresOnMap;

  function newSpireIsles(state) {
    var cands = ISLE_IDS.filter(function (cid) {
      return E.freeSlots(state, cid) >= 1 && E.canPlace(state, "synod", cid);
    });
    if (cands.length === 0) {
      return [];
    }
    var low = Math.min.apply(null, cands.map(function (cid) {
      return E.totalWarriors(state, cid);
    }));
    return cands.filter(function (cid) {
      return E.totalWarriors(state, cid) === low;
    });
  }
  E.newSpireIsles = newSpireIsles;

  function placeNewSpire(state, cid) {
    state.map[cid].b.push({ f: "synod", t: "spire" });
    state.fac.synod.spires--;
    var k = E.placeWarriors(state, "synod", cid, 3);
    log(state, "With no spires left, the Synod raises a new spire at " + iname(cid) + " with " + k + " warrior" + plural(k) + ".");
  }

  E.STEP.synod_birdsong = function (state, fr) {
    var p = state.fac.synod;
    if (fr.stage === 0) {
      if (p.hand.length === 0) {
        E.drawCards(state, "synod", 1);
        log(state, "Urgent Missive: the Synod draws a card.");
      }
      fr.stage = 1;
      if (p.hand.length > 0) {
        E.ask(state, "synod", "synodEdictAdd", { edict: p.edict });
      }
      return;
    }
    if (fr.stage === 1) {
      fr.stage = 2;
      if (spiresOnMap(state) === 0 && p.spires > 0) {
        var spots = newSpireIsles(state);
        if (spots.length === 1) {
          placeNewSpire(state, spots[0]);
        } else if (spots.length > 1) {
          E.ask(state, "synod", "synodNewSpire", { isles: spots });
        }
      }
      return;
    }
    E.pop(state);
  };

  E.ANSWER.synod_birdsong = function (state, fr, a) {
    var p = state.fac.synod;
    if (fr.stage === 1 && state.pending.kind === "synodEdictAdd") {
      var adds = a.adds || [];
      if (!Array.isArray(adds) || adds.length < 1 || adds.length > 2) {
        return "Add one or two cards to the Edict.";
      }
      var moons = 0;
      var used = {};
      for (var i = 0; i < adds.length; i++) {
        var id = adds[i].card;
        if (!E.inHand(state, "synod", id) || used[id]) {
          return "Choose cards from your hand.";
        }
        used[id] = true;
        if (COLS.indexOf(adds[i].col) < 0) {
          return "Choose an Edict column.";
        }
        if (E.cardSuit(id) === "moon") {
          moons++;
        }
      }
      if (moons > 1) {
        return "Only one of the added cards may be a Moon card.";
      }
      adds.forEach(function (x) {
        E.takeFromHand(state, "synod", x.card);
        p.edict[x.col].push(x.card);
      });
      log(state, "The Synod adds " + adds.map(function (x) {
        return cname(x.card) + " to " + colName(x.col);
      }).join(" and ") + ".");
      return null;
    }
    if (state.pending.kind === "synodNewSpire") {
      if (newSpireIsles(state).indexOf(a.cid) < 0) {
        return "Choose one of the isles with the fewest warriors.";
      }
      placeNewSpire(state, a.cid);
      return null;
    }
    return "Unexpected decision.";
  };

  function colName(col) {
    return col.charAt(0).toUpperCase() + col.slice(1);
  }
  E.colName = colName;

  function recruitIsles(state, suit) {
    return ISLE_IDS.filter(function (cid) {
      return E.hasBuilding(state, cid, "spire") && E.suitMatches(suit, ISLE[cid].suit);
    });
  }

  function moveOpts(state, suit) {
    return E.moveOptions(state, "synod").filter(function (m) {
      return E.suitMatches(suit, ISLE[m.from].suit);
    });
  }

  function buildIsles(state, suit) {
    if (state.fac.synod.spires <= 0) {
      return [];
    }
    return ISLE_IDS.filter(function (cid) {
      return E.suitMatches(suit, ISLE[cid].suit) && E.rules(state, "synod", cid) && !E.hasBuilding(state, cid, "spire") && E.freeSlots(state, cid) >= 1 && E.canPlace(state, "synod", cid);
    });
  }

  function cardOptions(state, col, id) {
    var suit = E.cardSuit(id);
    if (col === "recruit") {
      if (state.fac.synod.supply <= 0) {
        return [];
      }
      return recruitIsles(state, suit).filter(function (cid) {
        return E.canPlace(state, "synod", cid);
      });
    }
    if (col === "move") {
      return moveOpts(state, suit);
    }
    if (col === "battle") {
      return E.battleOptions(state, "synod", suit);
    }
    return buildIsles(state, suit);
  }
  E.synodCardOptions = cardOptions;

  function remaining(state, fr) {
    var col = COLS[fr.col];
    var cards = state.fac.synod.edict[col];
    var list = [];
    cards.forEach(function (id, i) {
      if (fr.done.indexOf(i) < 0) {
        list.push({ index: i, card: id, suit: E.cardSuit(id), ok: cardOptions(state, col, id).length > 0 });
      }
    });
    return list;
  }
  E.synodRemaining = remaining;

  E.STEP.synod_daylight = function (state, fr) {
    var p = state.fac.synod;
    if (fr.stage === 0) {
      E.ask(state, "synod", "synodCraft", { craftable: E.craftable(state, "synod"), free: E.freeActions(state, "synod") });
      return;
    }
    if (fr.stage === 1) {
      if (fr.col >= COLS.length) {
        log(state, "The Synod fulfils the whole Edict.");
        E.pop(state);
        return;
      }
      var rem = remaining(state, fr);
      if (rem.length === 0) {
        fr.col++;
        fr.done = [];
        return;
      }
      var possible = rem.filter(function (r) {
        return r.ok;
      });
      if (possible.length === 0) {
        collapse(state, fr, rem[0]);
        return;
      }
      E.ask(state, "synod", "synodEdict", { col: COLS[fr.col], cards: rem, free: E.freeActions(state, "synod") });
      return;
    }
    if (fr.stage === 2) {
      var cands = R.REGENT_ORDER.filter(function (r) {
        return p.deposed.indexOf(r) < 0;
      });
      if (cands.length === 1) {
        setRegent(state, cands[0]);
        E.pop(state);
        return;
      }
      E.ask(state, "synod", "synodRegent", { regents: cands });
      return;
    }
    E.pop(state);
  };

  function setRegent(state, r) {
    var p = state.fac.synod;
    p.regent = r;
    tuckEnvoys(state);
    log(state, "The Synod crowns " + R.REGENTS[r].name + ".");
  }

  function collapse(state, fr, failed) {
    var p = state.fac.synod;
    if (failed) {
      log(state, "The Synod cannot carry out " + cname(failed.card) + " in " + colName(COLS[fr.col]) + ". The Synod collapses!");
    }
    var moons = 0;
    COLS.forEach(function (col) {
      p.edict[col].forEach(function (id) {
        if (E.cardSuit(id) === "moon") {
          moons++;
        }
      });
    });
    E.score(state, "synod", -moons, "Collapse, " + moons + " Moon card" + plural(moons) + " in the Edict");
    COLS.forEach(function (col) {
      p.edict[col].forEach(function (id) {
        E.discardCard(state, id);
      });
      p.edict[col] = [];
    });
    p.deposed.push(p.regent);
    log(state, R.REGENTS[p.regent].name + " is deposed.");
    p.regent = null;
    var cands = R.REGENT_ORDER.filter(function (r) {
      return p.deposed.indexOf(r) < 0;
    });
    if (cands.length === 0) {
      p.deposed = [];
      log(state, "Every regent has fallen once; all four may rule again.");
    }
    fr.stage = 2;
  }

  E.ANSWER.synod_daylight = function (state, fr, a) {
    var p = state.fac.synod;
    var kind = state.pending.kind;
    if (E.FREE_TYPES.indexOf(a.type) >= 0 && (kind === "synodCraft" || kind === "synodEdict")) {
      return E.doFreeAction(state, "synod", a);
    }
    if (kind === "synodCraft") {
      if (a.type === "craft") {
        return E.doCraft(state, "synod", a.card);
      }
      if (a.type === "done") {
        fr.stage = 1;
        fr.col = 0;
        fr.done = [];
        return null;
      }
      return "Unknown action.";
    }
    if (kind === "synodRegent") {
      var cands = R.REGENT_ORDER.filter(function (r) {
        return p.deposed.indexOf(r) < 0;
      });
      if (cands.indexOf(a.regent) < 0) {
        return "Choose an available regent.";
      }
      setRegent(state, a.regent);
      fr.stage = 3;
      return null;
    }
    if (kind !== "synodEdict") {
      return "Unexpected decision.";
    }
    var rem = remaining(state, fr);
    if (a.type === "collapse") {
      var bad = null;
      rem.forEach(function (r) {
        if (!r.ok && bad === null) {
          bad = r;
        }
      });
      if (!bad) {
        return "Every remaining card can still be carried out.";
      }
      collapse(state, fr, bad);
      return null;
    }
    var entry = null;
    rem.forEach(function (r) {
      if (r.index === a.index) {
        entry = r;
      }
    });
    if (!entry) {
      return "Choose a card in the current Edict column.";
    }
    var col = COLS[fr.col];
    var suit = entry.suit;
    var err = null;
    if (col === "recruit") {
      if (recruitIsles(state, suit).indexOf(a.cid) < 0 || !E.canPlace(state, "synod", a.cid)) {
        return "Recruit at a spire in a matching isle.";
      }
      if (p.supply <= 0) {
        return "You have no warriors left.";
      }
      var want = 1;
      if (p.regent === "orator") {
        want = 2;
      }
      var k = E.placeWarriors(state, "synod", a.cid, want);
      fr.done.push(entry.index);
      log(state, "Edict: the Synod recruits " + k + " warrior" + plural(k) + " at " + iname(a.cid) + ".");
      if (k < want) {
        collapse(state, fr, null);
        log(state, "The Synod could not place every warrior the Orator demands and collapses.");
      }
      return null;
    }
    if (col === "move") {
      if (!ISLE[a.from] || !E.suitMatches(suit, ISLE[a.from].suit)) {
        return "Move from an isle matching the card.";
      }
      err = E.doMove(state, "synod", a.from, a.to, a.n);
      if (err) {
        return err;
      }
      fr.done.push(entry.index);
      return null;
    }
    if (col === "battle") {
      if (!ISLE[a.cid] || !E.suitMatches(suit, ISLE[a.cid].suit)) {
        return "Battle in an isle matching the card.";
      }
      err = E.checkBattle(state, "synod", a.cid, a.target);
      if (err) {
        return err;
      }
      fr.done.push(entry.index);
      E.startBattle(state, "synod", a.cid, a.target);
      return null;
    }
    if (buildIsles(state, suit).indexOf(a.cid) < 0) {
      return "Build a spire in a matching isle you rule that has no spire and an open slot.";
    }
    state.map[a.cid].b.push({ f: "synod", t: "spire" });
    p.spires--;
    fr.done.push(entry.index);
    log(state, "Edict: the Synod raises a spire at " + iname(a.cid) + ".");
    return null;
  };

  E.STEP.synod_evening = function (state, fr) {
    E.pop(state);
    var n = spiresOnMap(state);
    E.score(state, "synod", R.SPIRE_VP[n], n + " spire" + plural(n));
    if (state.winner) {
      return;
    }
    var draw = 1;
    if (n >= 3) {
      draw++;
    }
    if (n >= 6) {
      draw++;
    }
    E.eveningDraw(state, "synod", draw);
  };
})();
