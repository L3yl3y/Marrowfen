(function () {
  var R = E.R;
  var ISLE = E.ISLE;
  var ISLE_IDS = E.ISLE_IDS;
  var log = E.log;
  var iname = E.iname;
  var cname = E.cname;
  var plural = E.plural;

  function hideoutsOnMap(state) {
    var h = state.fac.covenant.hideout;
    return R.SUITS.filter(function (s) {
      return h[s] !== null;
    }).length;
  }
  E.hideoutsOnMap = hideoutsOnMap;

  function addFollower(state, id) {
    var p = state.fac.covenant;
    if (hideoutsOnMap(state) === 0 && p.followers.length >= 5) {
      E.discardCard(state, id);
      log(state, "The Covenant's followers are full; the card is discarded.");
      return false;
    }
    p.followers.push(id);
    return true;
  }
  E.addFollower = addFollower;

  E.hideoutLost = function (state, suit) {
    var p = state.fac.covenant;
    p.hideout[suit] = null;
    var keep = [];
    var lost = 0;
    p.followers.forEach(function (id) {
      var s = E.cardSuit(id);
      if (s === suit || s === "moon") {
        E.discardCard(state, id);
        lost++;
      } else {
        keep.push(id);
      }
    });
    p.followers = keep;
    var w = Math.ceil(p.wardens / 2);
    p.wardens -= w;
    p.supply += w;
    log(state, "Losing the " + R.SUIT_NAME[suit] + " hideout costs the Covenant " + lost + " follower" + plural(lost) + " and " + w + " warden" + plural(w) + ".");
    if (hideoutsOnMap(state) === 0 && p.followers.length > 5) {
      E.push(state, { t: "covtrim" });
    }
  };

  E.STEP.covtrim = function (state, fr) {
    var p = state.fac.covenant;
    if (hideoutsOnMap(state) > 0 || p.followers.length <= 5) {
      E.pop(state);
      return;
    }
    E.ask(state, "covenant", "covenantTrim", { n: p.followers.length - 5 });
  };
  E.ANSWER.covtrim = function (state, fr, a) {
    var p = state.fac.covenant;
    var need = p.followers.length - 5;
    var cards = a.cards || [];
    if (!Array.isArray(cards) || cards.length !== need) {
      return "Discard exactly " + need + " follower" + plural(need) + ".";
    }
    var copy = p.followers.slice();
    for (var i = 0; i < cards.length; i++) {
      var k = copy.indexOf(cards[i]);
      if (k < 0) {
        return "That card is not among your followers.";
      }
      copy.splice(k, 1);
    }
    cards.forEach(function (id) {
      E.discardCard(state, id);
    });
    p.followers = copy;
    log(state, "The Covenant discards followers down to five.");
    E.pop(state);
    return null;
  };

  E.STEP.setup_covenant = function (state, fr) {
    var p = state.fac.covenant;
    for (var i = 0; i < 3; i++) {
      var id = E.drawOne(state);
      if (id !== null) {
        p.followers.push(id);
      }
    }
    log(state, "The Lantern Covenant gathers three followers.");
    E.pop(state);
  };

  function lanternIsles(state) {
    return ISLE_IDS.filter(function (cid) {
      return E.hasToken(state, cid, "lantern");
    });
  }
  E.lanternIsles = lanternIsles;

  function followersMatching(state, suit) {
    return state.fac.covenant.followers.filter(function (id) {
      return E.suitMatches(E.cardSuit(id), suit);
    });
  }
  E.followersMatching = followersMatching;

  function curfew(state, cid) {
    var hit = false;
    E.warriorFactions(state).forEach(function (f) {
      if (f !== "covenant" && E.warriors(state, cid, f) >= 3) {
        hit = true;
      }
    });
    return hit;
  }
  E.curfew = curfew;

  function spreadCost(state, cid) {
    var placed = 10 - state.fac.covenant.lanterns;
    var c = R.LANTERN_COST[placed];
    if (curfew(state, cid)) {
      c++;
    }
    return c;
  }
  E.spreadCost = spreadCost;

  function spreadOptions(state) {
    var p = state.fac.covenant;
    if (p.lanterns <= 0) {
      return [];
    }
    var lit = lanternIsles(state);
    var list = [];
    ISLE_IDS.forEach(function (cid) {
      if (E.hasToken(state, cid, "lantern") || !E.canPlace(state, "covenant", cid)) {
        return;
      }
      if (lit.length > 0) {
        var near = ISLE[cid].adj.some(function (n) {
          return lit.indexOf(n) >= 0;
        });
        if (!near) {
          return;
        }
      }
      var cost = spreadCost(state, cid);
      if (followersMatching(state, ISLE[cid].suit).length >= cost) {
        list.push({ cid: cid, cost: cost, vp: R.LANTERN_VP[10 - p.lanterns] });
      }
    });
    return list;
  }
  E.covenantSpreadOptions = spreadOptions;

  function revoltOptions(state) {
    var p = state.fac.covenant;
    var list = [];
    lanternIsles(state).forEach(function (cid) {
      var suit = ISLE[cid].suit;
      if (p.hideout[suit] !== null) {
        return;
      }
      if (E.hasBuilding(state, cid, "hideout")) {
        return;
      }
      var slots = ISLE[cid].slots;
      if (state.map[cid].ruin) {
        slots--;
      }
      var own = E.buildingsOf(state, cid, "covenant").length;
      if (slots - own < 1) {
        return;
      }
      if (followersMatching(state, suit).length >= 2) {
        list.push({ cid: cid });
      }
    });
    return list;
  }
  E.covenantRevoltOptions = revoltOptions;

  function checkSpend(state, cards, suit, n) {
    var p = state.fac.covenant;
    if (!Array.isArray(cards) || cards.length !== n) {
      return "Spend exactly " + n + " matching follower" + plural(n) + ".";
    }
    var copy = p.followers.slice();
    for (var i = 0; i < cards.length; i++) {
      var k = copy.indexOf(cards[i]);
      if (k < 0 || !E.suitMatches(E.cardSuit(cards[i]), suit)) {
        return "Spend followers that match " + R.SUIT_NAME[suit] + ".";
      }
      copy.splice(k, 1);
    }
    return null;
  }

  function spendFollowers(state, cards) {
    var p = state.fac.covenant;
    cards.forEach(function (id) {
      p.followers.splice(p.followers.indexOf(id), 1);
      E.discardCard(state, id);
    });
  }

  E.STEP.covenant_birdsong = function (state, fr) {
    var revolts = revoltOptions(state);
    var spreads = spreadOptions(state);
    if (revolts.length === 0 && spreads.length === 0) {
      E.pop(state);
      return;
    }
    E.ask(state, "covenant", "covenantBirdsong", { revolts: revolts, spreads: spreads });
  };

  E.ANSWER.covenant_birdsong = function (state, fr, a) {
    var p = state.fac.covenant;
    if (a.type === "done") {
      E.pop(state);
      return null;
    }
    var err;
    if (a.type === "revolt") {
      var ok = revoltOptions(state).some(function (o) {
        return o.cid === a.cid;
      });
      if (!ok) {
        return "You cannot start an uprising there.";
      }
      var suit = ISLE[a.cid].suit;
      err = checkSpend(state, a.cards, suit, 2);
      if (err) {
        return err;
      }
      spendFollowers(state, a.cards);
      log(state, "Uprising in " + iname(a.cid) + "!");
      E.fullRemoval(state, a.cid, "covenant");
      state.map[a.cid].b.push({ f: "covenant", t: "hideout", s: suit });
      p.hideout[suit] = a.cid;
      var n = lanternIsles(state).filter(function (cid) {
        return ISLE[cid].suit === suit;
      }).length;
      var k = E.placeWarriors(state, "covenant", a.cid, n);
      var w = 0;
      if (p.supply > 0) {
        p.supply--;
        p.wardens++;
        w = 1;
      }
      log(state, "The Covenant builds its " + R.SUIT_NAME[suit] + " hideout with " + k + " warrior" + plural(k) + " and gains " + w + " warden" + plural(w) + ".");
      return null;
    }
    if (a.type === "spread") {
      var entry = null;
      spreadOptions(state).forEach(function (o) {
        if (o.cid === a.cid) {
          entry = o;
        }
      });
      if (!entry) {
        return "You cannot light a lantern there.";
      }
      err = checkSpend(state, a.cards, ISLE[a.cid].suit, entry.cost);
      if (err) {
        return err;
      }
      spendFollowers(state, a.cards);
      placeLantern(state, a.cid);
      return null;
    }
    return "Unknown action.";
  };

  function placeLantern(state, cid) {
    var p = state.fac.covenant;
    var placed = 10 - p.lanterns;
    var vp = R.LANTERN_VP[placed];
    p.lanterns--;
    state.map[cid].tok.push({ f: "covenant", t: "lantern" });
    log(state, "The Covenant lights a lantern in " + iname(cid) + ".");
    E.score(state, "covenant", vp, "lighting a lantern");
  }

  function trainOptions(state) {
    var p = state.fac.covenant;
    if (p.supply <= 0) {
      return [];
    }
    var suits = R.SUITS.filter(function (s) {
      return p.hideout[s] !== null;
    });
    return p.hand.filter(function (id) {
      return suits.some(function (s) {
        return E.suitMatches(E.cardSuit(id), s);
      });
    });
  }
  E.covenantTrainOptions = trainOptions;

  function daylightInfo(state) {
    var p = state.fac.covenant;
    return {
      craftable: E.craftable(state, "covenant"),
      mobilize: p.hand.slice(),
      train: trainOptions(state),
      free: E.freeActions(state, "covenant"),
      full: hideoutsOnMap(state) === 0 && p.followers.length >= 5
    };
  }
  E.covenantDaylightInfo = daylightInfo;

  E.STEP.covenant_daylight = function (state, fr) {
    E.ask(state, "covenant", "covenantDaylight", daylightInfo(state));
  };

  E.ANSWER.covenant_daylight = function (state, fr, a) {
    var p = state.fac.covenant;
    if (E.FREE_TYPES.indexOf(a.type) >= 0) {
      return E.doFreeAction(state, "covenant", a);
    }
    if (a.type === "end") {
      E.pop(state);
      return null;
    }
    if (a.type === "craft") {
      return E.doCraft(state, "covenant", a.card);
    }
    if (a.type === "mobilize") {
      if (!E.inHand(state, "covenant", a.card)) {
        return "Choose a card from your hand.";
      }
      E.takeFromHand(state, "covenant", a.card);
      if (addFollower(state, a.card)) {
        log(state, "The Covenant rallies a new follower.");
      }
      return null;
    }
    if (a.type === "train") {
      if (trainOptions(state).indexOf(a.card) < 0) {
        return "Spend a card matching the isle of one of your hideouts.";
      }
      E.takeFromHand(state, "covenant", a.card);
      E.discardCard(state, a.card);
      p.supply--;
      p.wardens++;
      log(state, "The Covenant appoints a warden with " + cname(a.card) + ".");
      return null;
    }
    return "Unknown action.";
  };

  function recruitIsles(state) {
    var p = state.fac.covenant;
    if (p.supply <= 0) {
      return [];
    }
    return R.SUITS.filter(function (s) {
      return p.hideout[s] !== null;
    }).map(function (s) {
      return p.hideout[s];
    });
  }

  function organizeIsles(state) {
    var p = state.fac.covenant;
    if (p.lanterns <= 0) {
      return [];
    }
    return ISLE_IDS.filter(function (cid) {
      return E.warriors(state, cid, "covenant") > 0 && !E.hasToken(state, cid, "lantern") && E.canPlace(state, "covenant", cid);
    });
  }

  function opsInfo(state) {
    return {
      left: state.tf.ops,
      moves: E.moveOptions(state, "covenant"),
      battles: E.battleOptions(state, "covenant"),
      recruits: recruitIsles(state),
      organize: organizeIsles(state)
    };
  }
  E.covenantOpsInfo = opsInfo;

  E.STEP.covenant_evening = function (state, fr) {
    var p = state.fac.covenant;
    if (fr.stage === 0) {
      state.tf.ops = p.wardens;
      fr.stage = 1;
    }
    if (fr.stage === 1) {
      var info = opsInfo(state);
      if (state.tf.ops > 0 && (info.moves.length + info.battles.length + info.recruits.length + info.organize.length) > 0) {
        E.ask(state, "covenant", "covenantOps", info);
        return;
      }
      fr.stage = 2;
    }
    E.pop(state);
    E.eveningDraw(state, "covenant", 1 + hideoutsOnMap(state));
  };

  E.ANSWER.covenant_evening = function (state, fr, a) {
    var p = state.fac.covenant;
    if (a.type === "done") {
      fr.stage = 2;
      return null;
    }
    if (state.tf.ops <= 0) {
      return "No operations are left.";
    }
    var err;
    if (a.type === "move") {
      err = E.doMove(state, "covenant", a.from, a.to, a.n);
      if (err) {
        return err;
      }
      state.tf.ops--;
      return null;
    }
    if (a.type === "battle") {
      err = E.checkBattle(state, "covenant", a.cid, a.target);
      if (err) {
        return err;
      }
      state.tf.ops--;
      E.startBattle(state, "covenant", a.cid, a.target);
      return null;
    }
    if (a.type === "recruit") {
      if (recruitIsles(state).indexOf(a.cid) < 0) {
        return "Recruit at one of your hideouts.";
      }
      state.tf.ops--;
      E.placeWarriors(state, "covenant", a.cid, 1);
      log(state, "The Covenant recruits a warrior at " + iname(a.cid) + ".");
      return null;
    }
    if (a.type === "organize") {
      if (organizeIsles(state).indexOf(a.cid) < 0) {
        return "Kindle in an isle with your warrior and no lantern.";
      }
      state.tf.ops--;
      E.removeWarriors(state, a.cid, "covenant", 1, "covenant", null);
      log(state, "A Covenant warrior in " + iname(a.cid) + " kindles a lantern.");
      placeLantern(state, a.cid);
      return null;
    }
    return "Unknown action.";
  };
})();
