var BOT = (function () {
  var R = E.R;
  var ISLE = E.ISLE;
  var ISLE_IDS = E.ISLE_IDS;

  function bit(x) {
    if (x) {
      return 1;
    }
    return 0;
  }

  function pick(rnd, arr) {
    return arr[Math.floor(rnd() * arr.length)];
  }

  function best(list, scoreFn) {
    var top = null;
    var topScore = -Infinity;
    list.forEach(function (x) {
      var s = scoreFn(x);
      if (s > topScore) {
        topScore = s;
        top = x;
      }
    });
    return { item: top, score: topScore };
  }

  var DICE = [];
  for (var a = 0; a < 4; a++) {
    for (var b = 0; b < 4; b++) {
      DICE.push([Math.max(a, b), Math.min(a, b)]);
    }
  }

  function cardboardWeight(state, cid, f) {
    var n = 0;
    E.cardboardOf(state, cid, f).forEach(function (p) {
      var k = E.pieceKey(p);
      if (k === "citadel" || k === "hideout" || k === "spire") {
        n += 2.5;
      } else if (k === "clay") {
        n += 1.1;
      } else if (k === "lantern") {
        n += 1.6 + Math.max(0, 10 - state.fac.covenant.lanterns - 4) * 0.35;
      } else {
        n += 1.6;
      }
    });
    return n;
  }

  function battleValue(state, f, cid, target, ally) {
    var myW = E.warriors(state, cid, f);
    if (f === "wayfarer") {
      myW = E.undamagedCount(state, "blade");
      if (ally) {
        myW += E.warriors(state, cid, ally);
      }
    }
    var theirW = E.warriors(state, cid, target);
    if (target === "wayfarer") {
      theirW = E.undamagedCount(state, "blade");
    }
    var cb = E.cardboardOf(state, cid, target).length;
    var cbW = cardboardWeight(state, cid, target);
    var myCb = 0;
    if (f !== "wayfarer") {
      myCb = E.cardboardOf(state, cid, f).length;
    }
    var extra = 0;
    if (theirW === 0) {
      extra++;
    }
    if (f === "synod" && state.fac.synod.regent === "marshal") {
      extra++;
    }
    var gain = 0;
    var loss = 0;
    DICE.forEach(function (d) {
      var attRoll = d[0];
      var defRoll = d[1];
      if (target === "covenant") {
        attRoll = d[1];
        defRoll = d[0];
      }
      var hitsOut = Math.min(attRoll, myW) + extra;
      var hitsIn = Math.min(defRoll, theirW);
      var killW = Math.min(hitsOut, theirW);
      var killCb = Math.min(Math.max(0, hitsOut - theirW), cb);
      var g = killW * 0.6;
      if (cb > 0) {
        g += killCb * (cbW / cb);
      }
      if (target === "wayfarer") {
        g = Math.min(hitsOut, E.undamagedItems(state).length) * 0.7;
      }
      var lostW = Math.min(hitsIn, myW);
      var lostCb = Math.min(Math.max(0, hitsIn - myW), myCb);
      var l = lostW * 0.6 + lostCb * 1.8;
      if (f === "wayfarer") {
        l = hitsIn * 0.6;
      }
      gain += g;
      loss += l;
    });
    gain = gain / DICE.length;
    loss = loss / DICE.length;
    var v = gain - loss;
    if (f === "wayfarer" && target !== "wayfarer" && E.isHostile(state, target)) {
      v += 0.3;
    }
    if (f === "wayfarer" && !E.isHostile(state, target) && theirW > 0 && state.fac.wayfarer.standing[target] > 0) {
      v -= 1.5;
    }
    var leader = leaderOf(state, f);
    if (leader === target) {
      var gap = projected(state, target) - projected(state, f);
      v += 0.3 + Math.max(0, Math.min(1.2, gap / 8));
    }
    return v;
  }

  function projected(state, f) {
    var v = state.fac[f].vp;
    if (f === "covenant") {
      v += (10 - state.fac.covenant.lanterns) * 0.8 + E.hideoutsOnMap(state);
    }
    if (f === "synod") {
      v += R.SPIRE_VP[E.spiresOnMap(state)] * 1.2;
    }
    return v;
  }

  function leaderOf(state, f) {
    var top = null;
    var vp = -1;
    state.factions.forEach(function (o) {
      if (o !== f && projected(state, o) > vp) {
        vp = projected(state, o);
        top = o;
      }
    });
    return top;
  }

  function bestBattle(state, f, options, rnd, threshold) {
    var cands = [];
    options.forEach(function (o) {
      o.targets.forEach(function (t) {
        cands.push({ cid: o.cid, target: t, v: battleValue(state, f, o.cid, t) + rnd() * 0.25 });
      });
    });
    var r = best(cands, function (c) {
      return c.v;
    });
    if (r.item && r.score > threshold) {
      return r.item;
    }
    return null;
  }

  function cardValue(state, f, id) {
    if (id === "E1" || id === "E2") {
      return 0;
    }
    var c = R.CARDS[id];
    var v = 1;
    if (c.kind === "ambush") {
      v = 3;
    } else if (c.kind === "dominance") {
      v = 1.2;
      if (state.fac[f].vp >= 8) {
        v = 2.5;
      }
    } else if (c.kind === "item") {
      v = 1.5 + c.vp * 0.4;
      if (!(state.items[c.item] > 0)) {
        v = 0.8;
      }
    } else if (c.kind === "favor") {
      v = 2;
    } else if (c.kind === "effect") {
      v = 1.8;
      if (E.hasEffect(state, f, c.effect)) {
        v = 0.6;
      }
    }
    if (c.suit === "moon") {
      v += 0.8;
    }
    return v;
  }

  function cheapest(state, f, ids, n) {
    var sorted = ids.slice().sort(function (x, y) {
      return cardValue(state, f, x) - cardValue(state, f, y);
    });
    return sorted.slice(0, n);
  }

  function craftValue(state, f, id) {
    var c = R.CARDS[id];
    if (c.kind === "item") {
      var vp = c.vp;
      if (f === "synod" && state.fac.synod.regent !== "architect") {
        vp = 1;
      }
      return vp + 0.5;
    }
    if (c.kind === "favor") {
      var v = 0;
      ISLE_IDS.forEach(function (cid) {
        if (ISLE[cid].suit !== c.favor) {
          return;
        }
        state.factions.forEach(function (o) {
          if (o === f || !E.isEnemy(state, f, o) || o === "wayfarer") {
            return;
          }
          v += E.warriors(state, cid, o) * 0.5 + cardboardWeight(state, cid, o);
        });
      });
      return v - 2;
    }
    if (c.kind === "effect") {
      var base = { bulwark: 2, sappers: 1.6, ruthless: 1.6, crown: 2.5, tollgate: 1.8, reeve: 1.4, granary: 1.8, punt: 0.8, warhorn: 1.2, eavesdrop: 0.3, outriders: 1.0 };
      var bv = base[c.effect] || 1;
      if (f === "wayfarer" && c.effect === "reeve") {
        bv = 0;
      }
      return bv;
    }
    return 0;
  }

  function bestCraft(state, f, list) {
    var r = best(list, function (id) {
      return craftValue(state, f, id);
    });
    if (r.item !== null && r.score > 0.9) {
      return r.item;
    }
    return null;
  }

  function freeChoice(state, f, free, rnd) {
    if (!free) {
      return null;
    }
    var p = state.fac[f];
    if (free.dominance && f !== "wayfarer") {
      for (var i = 0; i < free.dominance.length; i++) {
        var id = free.dominance[i];
        var suit = R.CARDS[id].suit;
        var ruled = 0;
        if (suit === "moon") {
          ruled = E.CORNERS.filter(function (cid) {
            return E.rules(state, f, cid);
          }).length;
        } else {
          ruled = ISLE_IDS.filter(function (cid) {
            return ISLE[cid].suit === suit && E.rules(state, f, cid);
          }).length;
        }
        var need = 3;
        if (suit === "moon") {
          need = 2;
        }
        if (ruled >= need && p.vp <= 22 && rnd() < 0.6) {
          return { type: "dominance", card: id };
        }
      }
    }
    if (free.dominance && f === "wayfarer" && free.coalitionWith) {
      var lead = 0;
      state.factions.forEach(function (o) {
        if (o !== "wayfarer") {
          lead = Math.max(lead, state.fac[o].vp);
        }
      });
      if (lead >= p.vp + 8 && rnd() < 0.7) {
        return { type: "dominance", card: free.dominance[0], with: free.coalitionWith[0] };
      }
    }
    if (free.reeve && p.hand.length <= 3) {
      var spot = best(free.reeve, function (cid) {
        return E.warriors(state, cid, f);
      });
      if (spot.item && E.warriors(state, spot.item, f) >= 3) {
        return { type: "reeve", cid: spot.item };
      }
    }
    return null;
  }

  function act(state, f, rnd) {
    rnd = rnd || Math.random;
    var p = state.pending;
    if (!p || p.fac !== f) {
      return null;
    }
    var fn = HANDLERS[p.kind];
    if (!fn) {
      throw new Error("bot has no handler for " + p.kind);
    }
    var a = fn(state, f, p, rnd);
    if (a) {
      a.pid = p.id;
    }
    return a;
  }

  var HANDLERS = {};

  HANDLERS.setupCitadel = function (state, f, p, rnd) {
    return { cid: pick(rnd, p.corners) };
  };

  HANDLERS.setupBuildings = function (state, f, p, rnd) {
    var keep = state.fac.company.citadel;
    var adj = ISLE[keep].adj.filter(function (cid) {
      return E.freeSlots(state, cid) >= 1;
    });
    var slots = {};
    p.isles.forEach(function (cid) {
      slots[cid] = E.freeSlots(state, cid);
    });
    var order = ["claypit", "barracks", "forge"];
    if (rnd() < 0.5) {
      order = ["claypit", "forge", "barracks"];
    }
    var a = {};
    var spots = [keep].concat(adj.sort(function () {
      return rnd() - 0.5;
    }));
    order.forEach(function (b) {
      for (var i = 0; i < spots.length; i++) {
        if (slots[spots[i]] > 0) {
          a[b] = spots[i];
          slots[spots[i]]--;
          return;
        }
      }
    });
    return a;
  };

  HANDLERS.setupSynod = function (state, f, p, rnd) {
    var regs = ["architect", "marshal", "tyrant", "architect", "marshal", "tyrant", "orator"];
    return { corner: pick(rnd, p.corners), regent: pick(rnd, regs) };
  };

  HANDLERS.setupWayfarer = function (state, f, p, rnd) {
    return { arch: pick(rnd, p.archetypes), reed: pick(rnd, p.reedbeds) };
  };

  HANDLERS.granary = function (state, f, p, rnd) {
    var low = best(p.others, function (o) {
      return -state.fac[o].vp + rnd() * 0.5;
    });
    return { target: low.item };
  };

  HANDLERS.bcards = function (state, f, p, rnd) {
    var vp = state.fac[f].vp;
    if (p.crown && (p.crownValue >= 4 || (p.crownValue >= 1 && vp + p.crownValue >= R.WIN_VP))) {
      return { type: "crown" };
    }
    if (p.toll) {
      var t = best(p.tollTargets, function (o) {
        return -state.fac[o].vp + state.fac[o].hand.length * 0.3 + rnd() * 0.3;
      });
      if (state.fac[t.item].vp < 26) {
        return { type: "toll", target: t.item };
      }
    }
    return { type: "done" };
  };

  HANDLERS.warhorn = function (state, f, p, rnd) {
    var b = bestBattle(state, f, p.battles, rnd, 0.4);
    if (b) {
      return { type: "battle", cid: b.cid, target: b.target };
    }
    return { type: "skip" };
  };

  HANDLERS.punt = function (state, f, p, rnd) {
    return { type: "skip" };
  };

  HANDLERS.ambush = function (state, f, p, rnd) {
    var b = state.battle;
    var attW = E.warriors(state, b.cid, b.att);
    var mine = E.cardboardOf(state, b.cid, f).length;
    var play = false;
    if (b.att === "wayfarer") {
      play = rnd() < 0.5;
    } else if (attW <= 2) {
      play = true;
    } else if (mine > 0 && rnd() < 0.6) {
      play = true;
    } else if (rnd() < 0.25) {
      play = true;
    }
    if (play) {
      return { card: p.cards[0] };
    }
    return { type: "skip" };
  };

  HANDLERS.foil = function (state, f, p, rnd) {
    var b = state.battle;
    var attW = E.warriors(state, b.cid, f);
    if (f === "wayfarer" || attW <= 3 || rnd() < 0.6) {
      return { card: p.cards[0] };
    }
    return { type: "skip" };
  };

  HANDLERS.battleEffects = function (state, f, p, rnd) {
    var b = state.battle;
    var use = [];
    p.options.forEach(function (key) {
      if (key === "ruthless") {
        var defW = E.warriors(state, b.cid, b.def);
        if (b.def !== "wayfarer" && b.attRolled + b.attExtra >= defW && E.cardboardOf(state, b.cid, b.def).length > 0) {
          use.push(key);
        }
      } else if (key === "sappers") {
        var attW = E.warriors(state, b.cid, b.att);
        if (b.defRolled + b.defExtra < attW || rnd() < 0.3) {
          use.push(key);
        }
      } else if (key === "bulwark") {
        var incoming = b.defRolled;
        var myW = E.warriors(state, b.cid, f);
        if (p.side === "def") {
          incoming = b.attRolled;
        }
        if (f === "wayfarer") {
          myW = 0;
        }
        if (incoming >= 2 || incoming > myW) {
          use.push(key);
        }
      }
    });
    return { use: use };
  };

  var PIECE_ORDER = ["clay", "lantern", "claypit", "barracks", "forge", "spire", "hideout", "citadel"];
  var ITEM_ORDER = ["sling", "purse", "pack", "mallet", "tonic", "lamp", "waders", "blade"];

  function chooseItems(items, n, preferExhausted) {
    var sorted = items.slice().sort(function (x, y) {
      var ex = 0;
      if (preferExhausted) {
        ex = bit(y.ex) - bit(x.ex);
      }
      if (ex !== 0) {
        return ex;
      }
      return ITEM_ORDER.indexOf(x.t) - ITEM_ORDER.indexOf(y.t);
    });
    return sorted.slice(0, n).map(function (it) {
      return { t: it.t, ex: it.ex, dmg: it.dmg };
    });
  }

  HANDLERS.hits = function (state, f, p, rnd) {
    if (p.wayfarer) {
      var need = Math.min(p.n, p.items.length + (p.allyN || 0));
      var useItems = Math.min(need, p.items.length);
      var ally = need - useItems;
      return { items: chooseItems(p.items, useItems, true), ally: ally };
    }
    var pieces = p.pieces.slice().sort(function (x, y) {
      return PIECE_ORDER.indexOf(x) - PIECE_ORDER.indexOf(y);
    });
    return { pieces: pieces.slice(0, Math.min(p.rest, pieces.length)) };
  };

  HANDLERS.surgeons = function (state, f, p, rnd) {
    var c = cheapest(state, f, p.cards, 1)[0];
    if (p.n >= 2 || cardValue(state, f, c) < 2 || state.fac[f].hand.length >= 4) {
      return { card: c };
    }
    return { type: "skip" };
  };

  HANDLERS.unrest = function (state, f, p, rnd) {
    return { card: cheapest(state, f, p.cards, 1)[0] };
  };

  HANDLERS.discard = function (state, f, p, rnd) {
    return { cards: cheapest(state, f, state.fac[f].hand, p.n) };
  };

  HANDLERS.covenantTrim = function (state, f, p, rnd) {
    var fol = state.fac.covenant.followers.slice().sort(function (x, y) {
      var vx = 0;
      var vy = 0;
      if (E.cardSuit(x) === "moon") {
        vx = 1;
      }
      if (E.cardSuit(y) === "moon") {
        vy = 1;
      }
      return vx - vy;
    });
    return { cards: fol.slice(0, p.n) };
  };

  HANDLERS.wayfarerRefresh = function (state, f, p, rnd) {
    var order = ["waders", "blade", "lamp", "mallet", "sling", "tonic", "purse", "pack"];
    var sorted = p.items.slice().sort(function (x, y) {
      var d = bit(x.dmg) - bit(y.dmg);
      if (d !== 0) {
        return d;
      }
      return order.indexOf(x.t) - order.indexOf(y.t);
    });
    return { items: sorted.slice(0, p.n) };
  };

  HANDLERS.wayfarerDamage = function (state, f, p, rnd) {
    return { items: chooseItems(p.items, p.n, true) };
  };

  HANDLERS.wayfarerCapacity = function (state, f, p, rnd) {
    var sorted = p.items.slice().sort(function (x, y) {
      var d = bit(y.dmg) - bit(x.dmg);
      if (d !== 0) {
        return d;
      }
      return ITEM_ORDER.indexOf(x.t) - ITEM_ORDER.indexOf(y.t);
    });
    return { items: sorted.slice(0, p.n).map(function (it) {
      return { t: it.t, ex: it.ex, dmg: it.dmg };
    }) };
  };

  HANDLERS.synodRegent = function (state, f, p, rnd) {
    var r = best(p.regents, function (reg) {
      var cols = R.REGENTS[reg].envoys;
      var v = rnd();
      cols.forEach(function (col) {
        var n = 0;
        R.SUITS.forEach(function (s) {
          n += E.synodCardOptions(state, col, "E1").length;
        });
        if (n > 0) {
          v += 2;
        }
        if (col === "move" || col === "build") {
          v += 0.5;
        }
      });
      return v;
    });
    return { regent: r.item };
  };

  HANDLERS.synodNewSpire = function (state, f, p, rnd) {
    return { cid: pick(rnd, p.isles) };
  };

  function threat(state, f, cid) {
    var t = 0;
    ISLE[cid].adj.concat([cid]).forEach(function (n) {
      E.warriorFactions(state).forEach(function (o) {
        if (o !== f) {
          t += E.warriors(state, n, o);
        }
      });
    });
    return t;
  }

  function companyMarch(state, rnd) {
    var p = state.fac.company;
    var moves = [];
    var test = E.clone(state);
    for (var k = 0; k < 2; k++) {
      var opts = E.moveOptions(test, "company");
      var cands = [];
      opts.forEach(function (m) {
        var here = E.warriors(test, m.from, "company");
        var keepBack = 1;
        if (E.buildingsOf(test, m.from, "company").length > 0 || E.hasToken(test, m.from, "citadel")) {
          keepBack = 2;
        }
        var n = here - keepBack;
        if (n < 1) {
          return;
        }
        var v = 0;
        var to = m.to;
        var enemyHere = 0;
        E.warriorFactions(test).forEach(function (o) {
          if (o !== "company") {
            enemyHere = Math.max(enemyHere, E.ruleCount(test, to, o));
          }
        });
        if (!E.rules(test, "company", to)) {
          if (E.ruleCount(test, to, "company") + n > enemyHere) {
            v += 2;
            if (E.freeSlots(test, to) > 0) {
              v += 1.5;
            }
          }
        }
        var targets = E.battleTargets(test, "company", to);
        var lead = leaderOf(test, "company");
        targets.forEach(function (t) {
          var w = 0.6;
          if (t === lead && projected(test, t) > projected(test, "company")) {
            w = 1.0;
          }
          v += cardboardWeight(test, to, t) * w;
        });
        if (E.hasToken(test, to, "lantern")) {
          v -= 1;
        }
        v += rnd() * 0.6;
        cands.push({ from: m.from, to: to, n: n, v: v });
      });
      var r = best(cands, function (c) {
        return c.v;
      });
      if (!r.item || r.score < 1.2) {
        break;
      }
      moves.push({ from: r.item.from, to: r.item.to, n: r.item.n });
      test.map[r.item.from].w.company -= r.item.n;
      test.map[r.item.to].w.company = (test.map[r.item.to].w.company || 0) + r.item.n;
    }
    if (moves.length === 0) {
      return null;
    }
    return { type: "march", moves: moves };
  }

  HANDLERS.companyDaylight = function (state, f, p, rnd) {
    var pf = state.fac.company;
    var fc = freeChoice(state, f, p.free, rnd);
    if (fc) {
      return fc;
    }
    if (p.canCraft && p.craftable.length > 0) {
      var c = bestCraft(state, f, p.craftable);
      if (c !== null) {
        return { type: "craft", card: c };
      }
    }
    if (p.actions <= 0) {
      var spare = p.moons.filter(function (id) {
        return R.CARDS[id].kind !== "ambush" && R.CARDS[id].kind !== "dominance";
      });
      if (spare.length > 0 && pf.hand.length >= 3 && E.companyBuildOptions(state).length > 0) {
        return { type: "hawk", card: spare[0] };
      }
      return { type: "end" };
    }
    var builds = p.builds || [];
    if (builds.length > 0) {
      var bb = best(builds, function (o) {
        var v = o.vp * 1.2 - o.cost * 0.35 - pf.built[o.b] * 0.15;
        if (o.b === "barracks" && pf.built.barracks <= 2) {
          v += 0.8;
        }
        v -= threat(state, "company", o.cid) * 0.08;
        return v + rnd() * 0.4;
      });
      return { type: "build", cid: bb.item.cid, b: bb.item.b };
    }
    if ((p.overwork || []).length > 0 && pf.hand.length >= 2 && pf.clay > 0) {
      var blocked = false;
      E.ISLE_IDS.forEach(function (cid) {
        if (E.rules(state, "company", cid) && E.freeSlots(state, cid) > 0) {
          blocked = true;
        }
      });
      if (blocked && rnd() < 0.7) {
        var ow0 = p.overwork[0];
        return { type: "overwork", cid: ow0.cid, card: cheapest(state, f, ow0.cards, 1)[0] };
      }
    }
    if (p.canRecruit) {
      return { type: "recruit" };
    }
    var bt = bestBattle(state, f, p.battles || [], rnd, 0.35);
    if (bt) {
      return { type: "battle", cid: bt.cid, target: bt.target };
    }
    var march = companyMarch(state, rnd);
    if (march) {
      return march;
    }
    if ((p.overwork || []).length > 0 && pf.hand.length >= 3) {
      var ow = p.overwork[0];
      return { type: "overwork", cid: ow.cid, card: cheapest(state, f, ow.cards, 1)[0] };
    }
    return { type: "end" };
  };

  function synodCap(state) {
    var p = state.fac.synod;
    var cap = { recruit: {}, move: {}, battle: {}, build: {} };
    R.SUITS.forEach(function (s) {
      var spireIsles = ISLE_IDS.filter(function (cid) {
        return E.hasBuilding(state, cid, "spire") && ISLE[cid].suit === s;
      }).length;
      var per = 1;
      if (p.regent === "orator") {
        per = 2;
      }
      cap.recruit[s] = 0;
      if (spireIsles > 0) {
        cap.recruit[s] = Math.floor(p.supply / per);
      }
      var mv = 0;
      ISLE_IDS.forEach(function (cid) {
        if (ISLE[cid].suit === s && E.warriors(state, cid, "synod") > 0) {
          var legal = ISLE[cid].adj.some(function (to) {
            return E.rules(state, "synod", cid) || E.rules(state, "synod", to);
          });
          if (legal) {
            mv += Math.min(2, E.warriors(state, cid, "synod"));
          }
        }
      });
      cap.move[s] = mv;
      cap.battle[s] = E.battleOptions(state, "synod", s).length;
      var bd = 0;
      if (p.spires > 0) {
        ISLE_IDS.forEach(function (cid) {
          if (ISLE[cid].suit !== s || E.hasBuilding(state, cid, "spire") || E.freeSlots(state, cid) < 1 || !E.canPlace(state, "synod", cid)) {
            return;
          }
          if (E.rules(state, "synod", cid)) {
            bd++;
            return;
          }
          var enemy = 0;
          E.warriorFactions(state).forEach(function (o) {
            if (o !== "synod") {
              enemy = Math.max(enemy, E.ruleCount(state, cid, o));
            }
          });
          var near = ISLE[cid].adj.some(function (nb) {
            return E.warriors(state, nb, "synod") >= enemy + 2 && (E.rules(state, "synod", nb) || enemy === 0);
          });
          if (near && p.edict.move.length > 0) {
            bd++;
          }
        });
        bd = Math.min(bd, p.spires);
      }
      cap.build[s] = bd;
    });
    return cap;
  }

  function edictSlack(state, cap, extra) {
    var p = state.fac.synod;
    var slack = {};
    R.EDICT_COLUMNS.forEach(function (col) {
      var cards = p.edict[col].slice();
      extra.forEach(function (x) {
        if (x.col === col) {
          cards.push(x.card);
        }
      });
      var left = {};
      R.SUITS.forEach(function (s) {
        left[s] = cap[col][s];
      });
      var ok = true;
      cards.forEach(function (id) {
        var s = E.cardSuit(id);
        if (s !== "moon") {
          left[s]--;
          if (left[s] < 0) {
            ok = false;
          }
        }
      });
      cards.forEach(function (id) {
        if (E.cardSuit(id) === "moon") {
          var bestS = null;
          R.SUITS.forEach(function (s) {
            if (bestS === null || left[s] > left[bestS]) {
              bestS = s;
            }
          });
          left[bestS]--;
          if (left[bestS] < 0) {
            ok = false;
          }
        }
      });
      slack[col] = { ok: ok, left: left };
    });
    return slack;
  }

  HANDLERS.synodEdictAdd = function (state, f, p, rnd) {
    var hand = state.fac.synod.hand;
    var cap = synodCap(state);
    var cands = [];
    var current = edictSlack(state, cap, []);
    var broken = R.EDICT_COLUMNS.some(function (col) {
      return col !== "recruit" && col !== "move" && !current[col].ok;
    });
    var onMap = 0;
    ISLE_IDS.forEach(function (cid) {
      onMap += E.warriors(state, cid, "synod");
    });
    hand.forEach(function (id) {
      var suit = E.cardSuit(id);
      R.EDICT_COLUMNS.forEach(function (col) {
        var sl = edictSlack(state, cap, [{ card: id, col: col }]);
        if (!sl[col].ok) {
          return;
        }
        var room = 0;
        if (suit === "moon") {
          R.SUITS.forEach(function (s) {
            room = Math.max(room, sl[col].left[s]);
          });
        } else {
          room = sl[col].left[suit];
        }
        var v = Math.min(room, 3) * 0.6;
        if (col === "build") {
          v += 2.2;
        }
        if (col === "move") {
          v += 1.5;
          if (broken) {
            v += 2;
          }
        }
        if (col === "recruit") {
          v += 1.0 - Math.max(0, onMap - 10) * 0.1;
        }
        if (col === "battle") {
          v += 0.2;
        }
        if (suit === "moon") {
          v -= 0.6;
        }
        v -= cardValue(state, f, id) * 0.25;
        v += rnd() * 0.8;
        cands.push({ card: id, col: col, v: v, moon: suit === "moon" });
      });
    });
    cands.sort(function (x, y) {
      return y.v - x.v;
    });
    var adds = [];
    var moonUsed = false;
    for (var i = 0; i < cands.length && adds.length < 2; i++) {
      var c = cands[i];
      if (adds.some(function (x) {
        return x.card === c.card;
      })) {
        continue;
      }
      if (c.moon && moonUsed) {
        continue;
      }
      if (adds.length === 1) {
        var both = edictSlack(state, cap, adds.concat([{ card: c.card, col: c.col }]));
        if (!both[c.col].ok || c.v < 1.2) {
          continue;
        }
      }
      adds.push({ card: c.card, col: c.col });
      if (c.moon) {
        moonUsed = true;
      }
    }
    if (adds.length === 0) {
      var order = hand.slice().sort(function (x, y) {
        var mx = 0;
        var my = 0;
        if (E.cardSuit(x) === "moon") {
          mx = 1;
        }
        if (E.cardSuit(y) === "moon") {
          my = 1;
        }
        return mx - my;
      });
      var bestCol = "move";
      var bestRoom = -99;
      R.EDICT_COLUMNS.forEach(function (col) {
        var s = E.cardSuit(order[0]);
        var room = 0;
        R.SUITS.forEach(function (x) {
          if (s === "moon" || x === s) {
            room = Math.max(room, cap[col][x]);
          }
        });
        if (room > bestRoom) {
          bestRoom = room;
          bestCol = col;
        }
      });
      adds.push({ card: order[0], col: bestCol });
    }
    return { adds: adds };
  };

  HANDLERS.synodCraft = function (state, f, p, rnd) {
    var fc = freeChoice(state, f, p.free, rnd);
    if (fc) {
      return fc;
    }
    if (p.craftable.length > 0) {
      var c = bestCraft(state, f, p.craftable);
      if (c !== null) {
        return { type: "craft", card: c };
      }
    }
    return { type: "done" };
  };

  function futureFeasibility(state, colIndex, doneIdx, skipIndex) {
    var p = state.fac.synod;
    var score = 0;
    R.EDICT_COLUMNS.forEach(function (col, ci) {
      if (ci < colIndex) {
        return;
      }
      p.edict[col].forEach(function (id, i) {
        if (ci === colIndex && (doneIdx.indexOf(i) >= 0 || i === skipIndex)) {
          return;
        }
        if (E.synodCardOptions(state, col, id).length > 0) {
          score++;
        }
      });
    });
    return score;
  }

  HANDLERS.synodEdict = function (state, f, p, rnd) {
    var colIndex = R.EDICT_COLUMNS.indexOf(p.col);
    var doneIdx = [];
    state.fac.synod.edict[p.col].forEach(function (id, i) {
      var open = p.cards.some(function (c) {
        return c.index === i;
      });
      if (!open) {
        doneIdx.push(i);
      }
    });
    var cands = [];
    p.cards.forEach(function (card) {
      if (!card.ok) {
        return;
      }
      var opts = E.synodCardOptions(state, p.col, card.card);
      if (p.col === "battle") {
        opts.forEach(function (o) {
          o.targets.forEach(function (t) {
            cands.push({ a: { index: card.index, cid: o.cid, target: t }, v: battleValue(state, "synod", o.cid, t) + 5 + rnd() * 0.2, nopts: opts.length });
          });
        });
        return;
      }
      var sample = opts;
      if (sample.length > 18) {
        sample = sample.slice().sort(function () {
          return rnd() - 0.5;
        }).slice(0, 18);
      }
      sample.forEach(function (o) {
        var variants = [];
        if (p.col === "move") {
          var ns = [o.max];
          if (o.max > 1) {
            ns.push(o.max - 1);
            ns.push(1);
          }
          ns.forEach(function (n) {
            variants.push({ index: card.index, from: o.from, to: o.to, n: n });
          });
        } else {
          variants.push({ index: card.index, cid: o });
        }
        variants.forEach(function (a) {
          var test = E.clone(state);
          test.pending = null;
          var err = null;
          if (p.col === "move") {
            err = E.checkMove(test, "synod", a.from, a.to, a.n);
            if (!err) {
              test.map[a.from].w.synod -= a.n;
              test.map[a.to].w.synod = (test.map[a.to].w.synod || 0) + a.n;
            }
          } else if (p.col === "recruit") {
            E.placeWarriors(test, "synod", a.cid, 1);
          } else {
            test.map[a.cid].b.push({ f: "synod", t: "spire" });
            test.fac.synod.spires--;
          }
          if (err) {
            return;
          }
          var feas = futureFeasibility(test, colIndex, doneIdx.concat([card.index]), -1);
          var v = feas * 10;
          if (p.col === "move") {
            var to = a.to;
            if (!E.rules(state, "synod", to) && E.rules(test, "synod", to) && E.freeSlots(test, to) > 0 && !E.hasBuilding(test, to, "spire")) {
              v += 3;
            }
            E.battleTargets(test, "synod", to).forEach(function (t) {
              v += cardboardWeight(test, to, t) * 0.5;
            });
            if (E.hasToken(test, to, "lantern")) {
              v -= 1;
            }
            if (E.hasBuilding(state, a.from, "spire") && E.warriors(test, a.from, "synod") === 0) {
              v -= 2;
            }
          }
          if (p.col === "recruit") {
            v += threat(state, "synod", a.cid) * 0.1;
          }
          if (p.col === "build") {
            v -= threat(state, "synod", a.cid) * 0.1;
          }
          v += rnd() * 0.5;
          cands.push({ a: a, v: v });
        });
      });
    });
    var r = best(cands, function (c) {
      return c.v;
    });
    if (r.item) {
      return r.item.a;
    }
    return { type: "collapse" };
  };

  HANDLERS.covenantBirdsong = function (state, f, p, rnd) {
    var pf = state.fac.covenant;
    if (p.revolts.length > 0) {
      var rv = best(p.revolts, function (o) {
        var v = 0;
        E.warriorFactions(state).forEach(function (o2) {
          if (o2 !== "covenant") {
            v += E.warriors(state, o.cid, o2) * 0.5 + cardboardWeight(state, o.cid, o2);
          }
        });
        return v + rnd();
      });
      var suit = ISLE[rv.item.cid].suit;
      var cards = E.followersMatching(state, suit).sort(function (x, y) {
        var vx = bit(E.cardSuit(x) === "moon");
        var vy = bit(E.cardSuit(y) === "moon");
        return vx - vy;
      }).slice(0, 2);
      return { type: "revolt", cid: rv.item.cid, cards: cards };
    }
    if (p.spreads.length > 0) {
      var sp = best(p.spreads, function (o) {
        return -o.cost + rnd() * 0.8 - threat(state, "covenant", o.cid) * 0.05;
      });
      var s2 = ISLE[sp.item.cid].suit;
      var cs = E.followersMatching(state, s2).sort(function (x, y) {
        var vx = bit(E.cardSuit(x) === "moon");
        var vy = bit(E.cardSuit(y) === "moon");
        return vx - vy;
      }).slice(0, sp.item.cost);
      var keepForRevolt = pf.followers.length - cs.length;
      if (pf.followers.length >= sp.item.cost) {
        return { type: "spread", cid: sp.item.cid, cards: cs };
      }
    }
    return { type: "done" };
  };

  HANDLERS.covenantDaylight = function (state, f, p, rnd) {
    var pf = state.fac.covenant;
    var fc = freeChoice(state, f, p.free, rnd);
    if (fc) {
      return fc;
    }
    if (p.craftable.length > 0) {
      var c = bestCraft(state, f, p.craftable);
      if (c !== null) {
        return { type: "craft", card: c };
      }
    }
    if (p.train.length > 0 && pf.wardens < 4 && pf.hand.length >= 2) {
      return { type: "train", card: cheapest(state, f, p.train, 1)[0] };
    }
    if (!p.full && pf.hand.length >= 2) {
      var keep = cheapest(state, f, pf.hand, pf.hand.length);
      var give = keep.filter(function (id) {
        return R.CARDS[id].kind !== "ambush";
      });
      if (give.length > 0) {
        return { type: "mobilize", card: give[give.length - 1] };
      }
    }
    return { type: "end" };
  };

  HANDLERS.covenantOps = function (state, f, p, rnd) {
    if (p.organize.length > 0) {
      var o = best(p.organize, function (cid) {
        return E.warriors(state, cid, "covenant") + rnd();
      });
      return { type: "organize", cid: o.item };
    }
    var bt = bestBattle(state, f, p.battles, rnd, 0.5);
    if (bt) {
      return { type: "battle", cid: bt.cid, target: bt.target };
    }
    if (p.recruits.length > 0) {
      return { type: "recruit", cid: pick(rnd, p.recruits) };
    }
    var mv = p.moves.filter(function (m) {
      return m.max >= 2 && !E.hasToken(state, m.to, "lantern") && E.canPlace(state, "covenant", m.to);
    });
    if (mv.length > 0) {
      var m = pick(rnd, mv);
      return { type: "move", from: m.from, to: m.to, n: 1 };
    }
    return { type: "done" };
  };

  function bfsDist(from) {
    var dist = {};
    var queue = [];
    if (ISLE[from]) {
      dist[from] = 0;
      queue.push(from);
    } else if (E.REED[from]) {
      E.REED[from].isles.forEach(function (s) {
        dist[s] = 1;
        queue.push(s);
      });
    }
    while (queue.length > 0) {
      var c = queue.shift();
      ISLE[c].adj.forEach(function (n) {
        if (dist[n] === undefined) {
          dist[n] = dist[c] + 1;
          queue.push(n);
        }
      });
    }
    return dist;
  }

  function readyPool(state, spend) {
    var pool = {};
    E.R.ITEMS.forEach(function (t) {
      pool[t] = E.readyCount(state, t);
    });
    (spend || []).forEach(function (t) {
      pool[t] = Math.max(0, pool[t] - 1);
    });
    return pool;
  }

  function hasItems(pool, need) {
    var counts = {};
    need.forEach(function (t) {
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.keys(counts).every(function (t) {
      return pool[t] >= counts[t];
    });
  }

  function isleValueNow(state, cid, pool) {
    var w = state.fac.wayfarer;
    var v = 0;
    if (pool.lamp >= 1 && state.map[cid].barrow.length > 0) {
      v += 3;
    }
    state.errands.up.forEach(function (q) {
      var er = R.ERRANDS[q];
      if (er.suit === ISLE[cid].suit && hasItems(pool, er.items)) {
        v += 2.5;
      }
    });
    var anyReady = Object.keys(pool).some(function (t) {
      return pool[t] > 0;
    });
    var cards = E.matchingCards(state, "wayfarer", ISLE[cid].suit).length;
    E.warriorFactions(state).forEach(function (o) {
      if (!E.isEnemy(state, "wayfarer", o)) {
        return;
      }
      var st = w.standing[o];
      if (anyReady && cards > 0 && E.hasPieces(state, cid, o) && st >= 0) {
        if (st === 3) {
          v += 1.8;
        } else {
          v += 0.8;
        }
        if (state.fac[o].crafted.length > 0) {
          v += 0.8;
        }
      }
      var cb = E.cardboardOf(state, cid, o).length;
      if (cb > 0 && E.warriors(state, cid, o) === 0) {
        if (pool.blade >= 1) {
          v += Math.min(2, cb) * 1.1;
        } else if (pool.sling >= 1) {
          v += 1;
        }
      }
    });
    return v;
  }

  function isleValueLater(state, cid) {
    var v = 0;
    if (state.map[cid].barrow.length > 0) {
      v += 1.5;
    }
    state.errands.up.forEach(function (q) {
      var er = R.ERRANDS[q];
      if (er.suit === ISLE[cid].suit) {
        var all = {};
        E.R.ITEMS.forEach(function (t) {
          all[t] = E.undamagedCount(state, t);
        });
        if (hasItems(all, er.items)) {
          v += 1;
        }
      }
    });
    return v;
  }

  function wayfarerStep(state, targets, rnd, spendWaders) {
    var cands = [];
    targets.forEach(function (t) {
      var v = 0;
      if (ISLE[t.to]) {
        var spend = [];
        for (var i = 0; i < t.cost; i++) {
          spend.push("waders");
        }
        if (!spendWaders) {
          spend = [];
        }
        var pool = readyPool(state, spend);
        v = isleValueNow(state, t.to, pool);
        var d = bfsDist(t.to);
        ISLE_IDS.forEach(function (cid) {
          if (cid !== t.to) {
            v += isleValueLater(state, cid) / (2 + d[cid] * 2);
          }
        });
        if (E.hostileWarriorsAt(state, t.to)) {
          v -= 1.2;
        }
      } else {
        v = E.damagedItems(state).length * 0.9 - 1;
      }
      cands.push({ t: t, v: v + rnd() * 0.3 });
    });
    return best(cands, function (c) {
      return c.v;
    });
  }

  function hereValue(state, spendWaders) {
    var w = state.fac.wayfarer;
    if (!ISLE[w.loc]) {
      if (E.damagedItems(state).length >= 3) {
        return 2;
      }
      return -1;
    }
    var v = isleValueNow(state, w.loc, readyPool(state, []));
    var d = bfsDist(w.loc);
    ISLE_IDS.forEach(function (cid) {
      if (cid !== w.loc) {
        v += isleValueLater(state, cid) / (2 + d[cid] * 2);
      }
    });
    return v;
  }

  HANDLERS.wayfarerSlip = function (state, f, p, rnd) {
    var here = hereValue(state, false);
    var r = wayfarerStep(state, p.targets, rnd, false);
    if (r.item && r.score > here + 0.3) {
      return { type: "move", to: r.item.t.to };
    }
    return { type: "stay" };
  };

  HANDLERS.wayfarerDaylight = function (state, f, p, rnd) {
    var w = state.fac.wayfarer;
    var fc = freeChoice(state, f, p.free, rnd);
    if (fc) {
      return fc;
    }
    if (p.explore) {
      return { type: "explore" };
    }
    if (p.errands.length > 0) {
      var er = p.errands[0];
      var suit = R.ERRANDS[er.q].suit;
      var done = w.errands.filter(function (q) {
        return R.ERRANDS[q].suit === suit;
      }).length;
      var reward = "draw";
      if (done >= 1 || w.hand.length >= 4) {
        reward = "vp";
      }
      return { type: "errand", slot: er.slot, reward: reward };
    }
    if (p.craftable.length > 0) {
      var c = bestCraft(state, f, p.craftable);
      if (c !== null) {
        return { type: "craft", card: c };
      }
    }
    if (p.aid.length > 0) {
      var cid = E.wayfarerIsle(state);
      var cards = E.matchingCards(state, "wayfarer", ISLE[cid].suit);
      var readyItems = E.undamagedItems(state).filter(function (it) {
        return !it.ex;
      });
      var room = E.capacity(state) - E.carried(state);
      var ab = best(p.aid, function (t) {
        var st = w.standing[t.f];
        var v = -1;
        if (st === 3) {
          v = 3;
        } else if (st >= 0) {
          var need = R.STANDING_STEPS[st].aids - (w.aids[t.f] || 0);
          if (need <= Math.min(cards.length, readyItems.length)) {
            v = 2.5 - need * 0.3;
          }
        }
        var takeable = t.items.some(function (it) {
          return (E.R.TRACK_ITEMS.indexOf(it) >= 0 && E.readyCount(state, it) < 3) || room > 0;
        });
        if (takeable) {
          v += 1.5;
        }
        return v + rnd() * 0.3;
      });
      if (ab.item && ab.score > 0.8 && cards.length > 0 && readyItems.length > 0) {
        var target = ab.item;
        var take = null;
        target.items.forEach(function (it) {
          var tracked = E.R.TRACK_ITEMS.indexOf(it) >= 0 && E.readyCount(state, it) < 3;
          if (take === null && (tracked || room > 0)) {
            take = it;
          }
        });
        var spareItem = chooseItems(readyItems, 1, false)[0];
        var a = { type: "aid", target: target.f, card: cheapest(state, f, cards, 1)[0], item: spareItem.t };
        if (take) {
          a.take = take;
        }
        return a;
      }
    }
    if (p.battles.length > 0) {
      var here = E.wayfarerIsle(state);
      var bb = best(p.battles, function (t) {
        return battleValue(state, "wayfarer", here, t) + rnd() * 0.2;
      });
      if (bb.item && bb.score > 0.5) {
        return { type: "battle", target: bb.item };
      }
    }
    if (p.strike.length > 0) {
      var sk = null;
      p.strike.forEach(function (s) {
        if (!s.warrior && sk === null) {
          sk = { type: "strike", target: s.f, piece: s.pieces.slice().sort(function (x, y) {
            return PIECE_ORDER.indexOf(y) - PIECE_ORDER.indexOf(x);
          })[0] };
        }
      });
      if (!sk) {
        p.strike.forEach(function (s) {
          if (s.warrior && E.isHostile(state, s.f) && sk === null && rnd() < 0.5) {
            sk = { type: "strike", target: s.f };
          }
        });
      }
      if (sk) {
        return sk;
      }
    }
    if (p.repair) {
      var dmg = E.damagedItems(state).slice().sort(function (x, y) {
        return ITEM_ORDER.indexOf(y.t) - ITEM_ORDER.indexOf(x.t);
      });
      return { type: "repair", item: { t: dmg[0].t, ex: dmg[0].ex } };
    }
    if (p.special) {
      if (p.special.kind === "pilfer") {
        return { type: "special", target: pick(rnd, p.special.targets) };
      }
      if (p.special.kind === "oddjobs") {
        var bestCard = best(p.special.cards, function (id) {
          return cardValue(state, f, id);
        });
        if (bestCard.score >= 1.8) {
          return { type: "special", card: bestCard.item };
        }
      }
      if (p.special.kind === "ground" && p.special.damaged >= 2) {
        var dam = E.damagedItems(state);
        return { type: "special", items: chooseItems(dam, Math.min(3, dam.length), false).map(function (it) {
          return { t: it.t, ex: it.ex };
        }) };
      }
    }
    if (p.moves.length > 0) {
      var here2 = hereValue(state, true);
      var r = wayfarerStep(state, p.moves, rnd, true);
      if (r.item && r.score > here2 + 0.8 && r.score > 1) {
        return { type: "move", to: r.item.t.to };
      }
    }
    return { type: "end" };
  };

  var BOT = { act: act, HANDLERS: HANDLERS, battleValue: battleValue, cardValue: cardValue };
  return BOT;
})();
if (typeof module !== "undefined") {
  module.exports = BOT;
}
