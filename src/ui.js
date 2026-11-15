var UI = (function () {
  var R = RULES;
  var ISLE = E.ISLE;
  var FCOL = MAPVIEW.FCOL;
  var view = null;
  var ctx = {};
  var D = null;
  var acts = {};
  var actSeq = 0;
  var handlers = {};
  var lastBattleShown = 0;
  var battleTimer = null;
  var errText = "";

  function el(id) {
    return document.getElementById(id);
  }
  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fname(f) {
    return R.FACTION_SHORT[f];
  }
  function fullName(f) {
    return R.FACTION_NAME[f];
  }
  function iname(cid) {
    return E.iname(cid);
  }
  function plural(n, word) {
    if (n === 1) {
      return n + " " + word;
    }
    return n + " " + word + "s";
  }
  function when(cond, text) {
    if (cond) {
      return text;
    }
    return "";
  }
  function sfx(n) {
    if (n === 1) {
      return "";
    }
    return "s";
  }
  function winVerb(n) {
    if (n === 1) {
      return "wins";
    }
    return "win";
  }
  function fdot(f) {
    return '<span class="fdot bg-' + f + '"></span>';
  }

  var ITEM_ICON = {
    waders: '<path d="M7 3h4v10l6 3v3H7z" fill="currentColor"/>',
    blade: '<path d="M17 3l-9 9 2 2 9-9V3zM6 12l-2 2 2 2 2-2M5 15l-2 4 4-2" fill="currentColor"/>',
    sling: '<path d="M6 4c0 6 3 9 6 9s6-3 6-9M12 13v8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="2" fill="currentColor"/>',
    mallet: '<path d="M5 5h10v5H5zM9 10h2v10H9z" fill="currentColor"/>',
    tonic: '<path d="M9 3h6v4l3 5v8H6v-8l3-5z" fill="currentColor"/>',
    purse: '<path d="M6 9c0-3 12-3 12 0l1 10H5zM9 6l3-3 3 3" fill="currentColor"/>',
    pack: '<path d="M6 8h12v12H6zM9 8V5h6v3" fill="currentColor"/>',
    lamp: '<path d="M9 4h6l1 3H8zM8 7h8v10H8zM10 17h4v3h-4z" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="#ffe28a"/>'
  };
  function itemIcon(t) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' + ITEM_ICON[t] + "</svg>";
  }
  function suitIcon(s, size) {
    var g = MAPVIEW.GLYPH[s];
    if (!g) {
      return "";
    }
    return '<svg viewBox="-12 -12 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" style="color:#fff" aria-hidden="true">' + g + "</svg>";
  }

  function btn(label, fn, opts) {
    actSeq++;
    var id = "a" + actSeq;
    acts[id] = fn;
    var cls = "btn";
    var dis = "";
    var title = "";
    if (opts) {
      if (opts.primary) {
        cls += " primary";
      }
      if (opts.small) {
        cls += " small";
      }
      if (opts.danger) {
        cls += " danger";
      }
      if (opts.on) {
        cls += " on";
      }
      if (opts.disabled) {
        dis = " disabled";
      }
      if (opts.title) {
        title = ' title="' + esc(opts.title) + '"';
      }
    }
    return '<button class="' + cls + '" data-act="' + id + '"' + dis + title + ">" + label + "</button>";
  }

  function cardHTML(id, opts) {
    opts = opts || {};
    var c = R.CARDS[id];
    if (!c) {
      return "";
    }
    var cls = "card";
    if (opts.sel) {
      cls += " sel";
    }
    if (opts.dim) {
      cls += " dim";
    }
    var kindLabel = { item: "Item", effect: "Lasting", favor: "Sweep", ambush: "Ambush", dominance: "Supremacy" }[c.kind];
    var art = "";
    if (c.kind === "item") {
      art = '<svg viewBox="0 0 24 24" style="color:#5a4630">' + ITEM_ICON[c.item] + "</svg>";
    } else if (c.kind === "ambush") {
      art = '<svg viewBox="0 0 24 24"><path d="M4 20c2-8 4-12 8-16 4 4 6 8 8 16M8 20c1-5 2-7 4-10 2 3 3 5 4 10" fill="none" stroke="#5a4630" stroke-width="2"/></svg>';
    } else if (c.kind === "dominance") {
      art = '<svg viewBox="0 0 24 24"><path d="M4 18h16l-2-10-4 4-2-7-2 7-4-4z" fill="#b08a2a" stroke="#5a4630"/></svg>';
    } else if (c.kind === "favor") {
      art = '<svg viewBox="0 0 24 24"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#c25a2a"/></svg>';
    } else {
      art = '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" fill="none" stroke="#5a4630" stroke-width="2"/></svg>';
    }
    var cost = "";
    c.cost.forEach(function (s) {
      cost += '<span class="pip s-' + s + '" title="' + R.SUIT_NAME[s] + '"></span>';
    });
    var vp = "";
    if (c.kind === "item") {
      vp = ' <b style="margin-left:auto">+' + c.vp + "</b>";
    }
    var inner = '<div class="band s-' + c.suit + '">' + suitIcon(c.suit, 16) + "<span>" + esc(c.name) + '</span></div><div class="art">' + art + '</div><div class="txt">' + esc(c.text) + '</div><div class="cost">' + cost + vp + '</div><div class="kind">' + kindLabel + "</div>";
    if (opts.fn) {
      actSeq++;
      var aid = "a" + actSeq;
      acts[aid] = opts.fn;
      return '<button class="' + cls + '" data-act="' + aid + '"' + when(opts.disabled, " disabled") + ">" + inner + "</button>";
    }
    return '<div class="' + cls + '">' + inner + "</div>";
  }

  function edictCardHTML(id, done) {
    var s = E.cardSuit(id);
    var name = E.cname(id);
    var cls = "ecard s-" + s;
    if (done) {
      cls += " done";
    }
    return '<div class="' + cls + '" title="' + esc(name) + '">' + esc(name) + "</div>";
  }

  function itemChip(it, opts) {
    var cls = "item";
    if (it.ex) {
      cls += " ex";
    }
    if (it.dmg) {
      cls += " dmg";
    }
    if (opts && opts.sel) {
      cls += " sel";
    }
    var label = itemIcon(it.t) + R.ITEM_NAME[it.t];
    if (it.dmg) {
      label += " (damaged)";
    } else if (it.ex) {
      label += " (exhausted)";
    }
    if (opts && opts.fn) {
      actSeq++;
      var id = "a" + actSeq;
      acts[id] = opts.fn;
      return '<button class="' + cls + '" data-act="' + id + '">' + label + "</button>";
    }
    return '<span class="' + cls + '">' + label + "</span>";
  }

  function init(h) {
    handlers = h;
    document.addEventListener("click", function (ev) {
      var node = ev.target;
      while (node && node !== document) {
        if (node.getAttribute && node.getAttribute("data-act")) {
          var key = node.getAttribute("data-act");
          if (acts[key]) {
            ev.preventDefault();
            acts[key]();
            return;
          }
          if (handlers.onAct) {
            handlers.onAct(key, node);
          }
          return;
        }
        node = node.parentNode;
      }
    });
    MAPVIEW.bind(el("board"), function (cid) {
      if (D && D.onIsle && D.pick && D.pick.indexOf(cid) >= 0) {
        D.onIsle(cid);
        redraw();
      }
    });
  }

  function newDraft(p) {
    D = { pid: p.id, kind: p.kind, step: "menu", data: {}, pick: [], onIsle: null, sel: [] };
    errText = "";
  }

  function submit(action) {
    if (!view || !view.pending) {
      return;
    }
    action.pid = view.pending.id;
    var res = handlers.submit(action);
    if (res && res.ok === false) {
      errText = res.error;
      redraw();
    }
  }

  function showError(text) {
    errText = text;
    redraw();
  }

  function back() {
    D.step = "menu";
    D.data = {};
    D.pick = [];
    D.onIsle = null;
    D.sel = [];
    errText = "";
    redraw();
  }

  function render(v, c) {
    view = v;
    ctx = c;
    if (view.pending && (!D || D.pid !== view.pending.id)) {
      newDraft(view.pending);
    }
    if (!view.pending) {
      D = null;
    }
    redraw();
  }

  function redraw() {
    if (!view) {
      return;
    }
    acts = {};
    actSeq = 0;
    renderStatus();
    renderScores();
    var promptInfo = renderPrompt();
    var pick = [];
    var picked = [];
    if (promptInfo && D) {
      pick = D.pick || [];
      picked = D.picked || [];
    }
    MAPVIEW.render(el("board"), view, { pick: pick, picked: picked, flash: true });
    renderBattle();
    renderHand();
    renderMine();
    renderOthers();
    renderLog();
  }

  function phaseName(p) {
    if (p === "birdsong") {
      return "Birdsong";
    }
    if (p === "daylight") {
      return "Daylight";
    }
    if (p === "evening") {
      return "Evening";
    }
    if (p === "setup") {
      return "Setup";
    }
    return "Game Over";
  }

  function renderStatus() {
    var s = el("status");
    if (view.winner) {
      s.innerHTML = "<b>" + view.winner.facs.map(fullName).join(" and ") + "</b> " + winVerb(view.winner.facs.length) + ": " + esc(view.winner.how) + ".";
      return;
    }
    var cur = view.order[view.turn];
    var text = "Round <b>" + view.round + "</b> · " + phaseName(view.phase);
    if (view.phase !== "setup") {
      text += " · " + fdot(cur) + " <b>" + fullName(cur) + "</b>";
    }
    if (view.pending && !ctx.canAct) {
      text += ' · waiting for <b class="f-' + view.pending.fac + '">' + fname(view.pending.fac) + "</b>";
      if (ctx.seatKind && ctx.seatKind[view.pending.fac] === "bot") {
        text += " (bot)";
      }
      if (ctx.seatKind && ctx.seatKind[view.pending.fac] === "remote" && ctx.connected && !ctx.connected[view.pending.fac]) {
        text += " (not connected yet)";
      }
    }
    if (ctx.roomCode) {
      text += ' · Room <span class="code" style="font-size:15px">' + ctx.roomCode + "</span>";
    }
    s.innerHTML = text;
  }

  function renderScores() {
    var out = "";
    var cur = view.order[view.turn];
    view.order.forEach(function (f) {
      var p = view.fac[f];
      var cls = "score";
      if (f === cur && view.phase !== "setup" && !view.winner) {
        cls += " turn";
      }
      var vpText = String(p.vp);
      var sub = plural(p.handCount, "card");
      if (p.dom !== null && p.dom !== undefined) {
        vpText = "&#9733;";
        sub = R.CARDS[p.dom].name;
      }
      if (f === "wayfarer" && p.coalition) {
        vpText = "&#9741;";
        sub = "Coalition with " + fname(p.coalition);
      }
      var pct = Math.min(100, Math.round((p.vp / 30) * 100));
      var who = "";
      if (ctx.seatKind && ctx.seatKind[f]) {
        who = { me: "You", local: "Same device", remote: "Friend", bot: "Bot" }[ctx.seatKind[f]] || "";
      }
      out += '<div class="' + cls + '"><div class="nm">' + fdot(f) + fname(f) + '</div><div class="vp f-' + f + '">' + vpText + '</div><div class="sub">' + esc(sub) + when(who, " · " + who) + '</div><div class="vpbar"><i class="bg-' + f + '" style="width:' + pct + '%"></i></div></div>';
    });
    el("scores").innerHTML = out;
  }

  function renderBattle() {
    var box = el("battle");
    var b = view.battle;
    var lb = view.lastBattle;
    if (lb && lb.n !== lastBattleShown && !b) {
      lastBattleShown = lb.n;
      clearTimeout(battleTimer);
      box.hidden = false;
      var dice = "";
      if (lb.dice) {
        dice = '<span class="die">' + lb.dice[0] + '</span><span class="die">' + lb.dice[1] + "</span>";
      }
      var amb = "";
      if (lb.ambush !== null && lb.ambush !== undefined) {
        if (lb.foiled) {
          amb = " · ambush foiled";
        } else {
          amb = " · ambushed!";
        }
      }
      box.innerHTML = '<span class="f-' + lb.att + '">' + fname(lb.att) + "</span> attacked <span class=\"f-" + lb.def + '">' + fname(lb.def) + "</span> in " + iname(lb.cid) + " " + dice + "<span>Hits: " + lb.toDef + " dealt, " + lb.toAtt + " taken" + amb + "</span>";
      battleTimer = setTimeout(function () {
        box.hidden = true;
      }, 4500);
      return;
    }
    if (b) {
      clearTimeout(battleTimer);
      box.hidden = false;
      var d = "";
      if (b.dice) {
        d = '<span class="die">' + b.dice[0] + '</span><span class="die">' + b.dice[1] + "</span>";
      }
      box.innerHTML = '<span class="f-' + b.att + '">' + fname(b.att) + '</span> attacks <span class="f-' + b.def + '">' + fname(b.def) + "</span> in " + iname(b.cid) + " " + d;
    }
  }

  function renderHand() {
    var panel = el("hand-panel");
    var f = ctx.viewer;
    if (!f || !view.fac[f]) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var hand = view.fac[f].hand;
    el("hand-count").textContent = "(" + hand.length + ")";
    var out = "";
    var cp = D && D.cardPick;
    hand.forEach(function (id) {
      if (cp && ctx.canAct) {
        var allowed = cp.from.indexOf(id) >= 0;
        var sel = cp.sel.indexOf(id) >= 0;
        out += cardHTML(id, { sel: sel, dim: !allowed, disabled: !allowed, fn: function () {
          toggleCard(id);
        } });
      } else {
        out += cardHTML(id, {});
      }
    });
    if (hand.length === 0) {
      out = '<p class="note">No cards.</p>';
    }
    el("hand").innerHTML = out;
  }

  function toggleCard(id) {
    var cp = D.cardPick;
    var i = cp.sel.indexOf(id);
    if (i >= 0) {
      cp.sel.splice(i, 1);
    } else {
      if (cp.n === 1) {
        cp.sel = [id];
      } else if (cp.sel.length < cp.n) {
        cp.sel.push(id);
      }
    }
    if (cp.auto && cp.sel.length === cp.n) {
      var picked = cp.sel.slice();
      D.cardPick = null;
      cp.done(picked);
      return;
    }
    redraw();
  }

  function startCardPick(from, n, done, auto, title) {
    D.cardPick = { from: from, n: n, sel: [], done: done, auto: auto, title: title };
  }

  function track(label, values, filled, extra) {
    var out = '<div class="track"><span class="lbl">' + label + "</span>";
    values.forEach(function (v, i) {
      var cls = "sp";
      if (i < filled) {
        cls += " full";
      }
      if (i === filled) {
        cls += " cur";
      }
      var sub = "";
      if (extra && extra[i]) {
        sub = "<span>" + extra[i] + "</span>";
      }
      out += '<span class="' + cls + '">' + v + sub + "</span>";
    });
    return out + "</div>";
  }

  function factionBoard(f, mine) {
    var p = view.fac[f];
    var out = '<div class="fboard">';
    if (f === "company") {
      ["claypit", "forge", "barracks"].forEach(function (b) {
        var extra = [];
        R.BUILD_COST.forEach(function (c, i) {
          var s = c + "c";
          if (b === "barracks" && (i === 2 || i === 4)) {
            s += "+";
          }
          extra.push(s);
        });
        out += track(R.BUILDING_NAME[b], R.BUILD_VP[b], p.built[b], extra);
      });
      var citadelText = "destroyed";
      if (p.citadel) {
        citadelText = iname(p.citadel);
      }
      out += '<div class="note">Spaces show points scored and clay cost. "+" marks an extra card. Clay in supply: ' + p.clay + " · Warriors in supply: " + p.supply + " · Citadel: " + citadelText + "</div>";
    } else if (f === "synod") {
      if (p.regent) {
        out += "<div><b>" + R.REGENTS[p.regent].name + "</b>: " + esc(R.REGENTS[p.regent].text) + "</div>";
      }
      var nowCol = null;
      var doneIdx = [];
      if (mine && view.pending && view.pending.kind === "synodEdict") {
        nowCol = view.pending.col;
      }
      out += '<div class="edict">';
      R.EDICT_COLUMNS.forEach(function (col) {
        var cls = "col";
        if (col === nowCol) {
          cls += " now";
        }
        out += '<div class="' + cls + '"><h5>' + E.colName(col) + "</h5>";
        p.edict[col].forEach(function (id, i) {
          var done = false;
          if (col === nowCol && view.pending.cards) {
            done = !view.pending.cards.some(function (c) {
              return c.index === i;
            });
          }
          out += edictCardHTML(id, done);
        });
        out += "</div>";
      });
      out += "</div>";
      var on = 7 - p.spires;
      out += track("Spires", R.SPIRE_VP.slice(1), on, ["", "", "+", "", "", "+", ""]);
      out += '<div class="note">Warriors in supply: ' + p.supply + when(p.deposed.length > 0, " · Deposed: " + p.deposed.map(function (r) {
        return R.REGENTS[r].name;
      }).join(", ")) + "</div>";
    } else if (f === "covenant") {
      var placed = 10 - p.lanterns;
      out += track("Lanterns", R.LANTERN_VP, placed, R.LANTERN_COST.map(function (c) {
        return c + "f";
      }));
      var hs = R.SUITS.map(function (s) {
        var where = "unbuilt";
        if (p.hideout[s]) {
          where = iname(p.hideout[s]);
        }
        return '<span class="mini">' + suitIcon(s, 12) + R.SUIT_NAME[s] + ": " + where + "</span>";
      }).join("");
      out += "<div>Hideouts: " + hs + "</div>";
      out += "<div>Wardens: <b>" + p.wardens + "</b> · Warriors in supply: " + p.supply + " · Followers: <b>" + p.followerCount + "</b>" + when(E.hideoutsOnMap(view) === 0, " (limit 5)") + "</div>";
      if (mine && p.followers.length > 0) {
        out += '<div class="note">Your followers:</div><div class="cards">' + p.followers.map(function (id) {
          return cardHTML(id, {});
        }).join("") + "</div>";
      }
    } else if (f === "wayfarer") {
      var where = "hiding";
      if (p.loc) {
        where = iname(p.loc);
      }
      if (p.arch) {
        out += "<div><b>" + R.ARCHETYPES[p.arch].name + "</b> in " + where + ". Special: " + esc(R.ARCHETYPES[p.arch].special) + ".</div>";
      }
      out += '<div class="items">' + p.items.map(function (it) {
        return itemChip(it);
      }).join("") + "</div>";
      if (p.loc) {
        out += '<div class="note">Refresh ' + E.refreshCount(view) + " · Draw " + (1 + E.trackCount(view, "purse")) + " · Carrying " + E.carried(view) + " of " + E.capacity(view) + "</div>";
      }
      out += '<div class="standing">';
      Object.keys(p.standing).forEach(function (o) {
        var st = p.standing[o];
        var label = "Hostile";
        if (st >= 0) {
          label = R.STANDING_NAME[st];
          if (st < 3 && p.aids[o]) {
            label += " (" + p.aids[o] + " aid this turn)";
          }
        }
        out += "<span>" + fdot(o) + " " + fname(o) + "</span><span>" + label + "</span>";
      });
      out += "</div>";
      var up = view.errands.up.map(function (q) {
        var er = R.ERRANDS[q];
        return '<span class="mini">' + suitIcon(er.suit, 12) + esc(er.name) + ": " + er.items.map(function (t) {
          return R.ITEM_NAME[t];
        }).join(" + ") + "</span>";
      }).join("");
      out += "<div>Errands: " + up + "</div>";
      if (p.errands.length > 0) {
        var bySuit = {};
        p.errands.forEach(function (q) {
          var s = R.ERRANDS[q].suit;
          bySuit[s] = (bySuit[s] || 0) + 1;
        });
        out += '<div class="note">Completed: ' + Object.keys(bySuit).map(function (s) {
          return R.SUIT_NAME[s] + " " + bySuit[s];
        }).join(", ") + "</div>";
      }
    }
    if (p.crafted && p.crafted.length > 0) {
      out += "<div>Crafted items: " + p.crafted.map(function (t) {
        return '<span class="mini">' + itemIcon(t) + R.ITEM_NAME[t] + "</span>";
      }).join("") + "</div>";
    }
    if (p.play && p.play.length > 0) {
      out += "<div>Lasting effects: " + p.play.map(function (id) {
        return '<span class="mini" title="' + esc(R.CARDS[id].text) + '">' + esc(R.CARDS[id].name) + "</span>";
      }).join("") + "</div>";
    }
    out += "</div>";
    return out;
  }

  function renderMine() {
    var panel = el("mine");
    var f = ctx.viewer;
    if (!f || !view.fac[f]) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    panel.innerHTML = '<h3><span>' + fdot(f) + " " + fullName(f) + "</span></h3>" + factionBoard(f, true);
  }

  function renderOthers() {
    var out = "<h3>The Other Factions</h3>";
    var shown = 0;
    view.order.forEach(function (f) {
      if (f === ctx.viewer) {
        return;
      }
      shown++;
      out += '<details open><summary class="f-' + f + '"><b>' + fullName(f) + "</b> · " + view.fac[f].vp + " points · " + plural(view.fac[f].handCount, "card") + "</summary>" + factionBoard(f, false) + "</details>";
    });
    if (view.domAvail && view.domAvail.length > 0) {
      out += '<div class="note" style="margin-top:6px">Supremacy cards available to take: ' + view.domAvail.map(function (id) {
        return R.CARDS[id].name;
      }).join(", ") + "</div>";
    }
    out += '<div class="note" style="margin-top:6px">Deck: ' + view.deckCount + " · Discard pile: " + view.discard.length + " · Item supply: " + Object.keys(view.items).filter(function (t) {
      return view.items[t] > 0;
    }).map(function (t) {
      return R.ITEM_NAME[t] + " " + view.items[t];
    }).join(", ") + "</div>";
    el("others").innerHTML = out;
    el("others").hidden = shown === 0 && !view.domAvail.length;
  }

  function renderLog() {
    var box = el("log");
    var entries = view.log.slice(-120);
    var out = "";
    entries.forEach(function (e) {
      var cls = "";
      if (e.to) {
        cls = "priv";
      } else if (e.text.indexOf("Round ") === 0) {
        cls = "round";
      }
      out += '<div class="' + cls + '">' + esc(e.text) + "</div>";
    });
    var atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.innerHTML = out;
    if (atBottom || !box.dataset.init) {
      box.scrollTop = box.scrollHeight;
      box.dataset.init = "1";
    }
  }

  function learnBox(kind) {
    if (!ctx.learning || !NOTES[kind]) {
      return "";
    }
    return '<div class="learn">' + NOTES[kind] + "</div>";
  }

  function renderPrompt() {
    var box = el("prompt");
    if (view.winner) {
      box.className = "panel";
      var w = view.winner;
      var rows = view.order.map(function (f) {
        return "<div>" + fdot(f) + " " + fullName(f) + ": <b>" + view.fac[f].vp + "</b></div>";
      }).join("");
      box.innerHTML = '<div class="p-title">' + w.facs.map(fullName).join(" and ") + " " + winVerb(w.facs.length) + "!</div><div class=\"p-text\">" + esc(w.how) + ".</div>" + rows + '<div class="choices">' + btn("New Game", function () {
        handlers.newGame();
      }, { primary: true }) + "</div>";
      return null;
    }
    if (!view.pending || !ctx.canAct) {
      box.className = "panel idle";
      var who = "";
      if (view.pending) {
        who = "Waiting for " + fullName(view.pending.fac) + ".";
      }
      box.innerHTML = '<div class="p-title">Please Wait</div><div class="p-text">' + who + "</div>";
      if (D) {
        D.pick = [];
      }
      return null;
    }
    box.className = "panel";
    var p = view.pending;
    var fn = PROMPTS[p.kind];
    var out;
    if (!fn) {
      out = { title: p.kind, html: "<p>Unknown decision.</p>" };
    } else {
      out = fn(p);
    }
    var html = '<div class="p-title">' + out.title + "</div>";
    if (out.text) {
      html += '<div class="p-text">' + out.text + "</div>";
    }
    html += out.html || "";
    if (D && D.cardPick && D.cardPick.title) {
      html += '<div class="draft">' + D.cardPick.title + " (" + D.cardPick.sel.length + "/" + D.cardPick.n + ")</div>";
    }
    var tools = "";
    if (handlers.suggest && out.suggest !== false) {
      tools += btn("Suggest", function () {
        var a = handlers.suggest();
        if (a) {
          errText = "Suggestion: " + describe(a);
          redraw();
        }
      }, { small: true });
    }
    if (D && D.step !== "menu" && out.back !== false) {
      tools += btn("Back", back, { small: true });
    }
    if (tools) {
      html += '<div class="choices" style="margin-top:8px">' + tools + "</div>";
    }
    html += '<div class="err">' + esc(errText) + "</div>";
    html += learnBox(p.kind);
    box.innerHTML = html;
    return out;
  }

  function describe(a) {
    var parts = [];
    Object.keys(a).forEach(function (k) {
      if (k === "pid") {
        return;
      }
      var v = a[k];
      if (k === "card" || k === "dom") {
        v = E.cname(v);
      } else if (k === "cards") {
        v = v.map(E.cname).join(", ");
      } else if (k === "cid" || k === "from" || k === "to" || k === "corner" || k === "reed") {
        v = iname(v);
      } else if (Array.isArray(v) || typeof v === "object") {
        v = JSON.stringify(v);
      }
      parts.push(k + " " + v);
    });
    return parts.join(", ");
  }

  function pickIsle(list, label, cb) {
    D.pick = list.slice();
    D.onIsle = function (cid) {
      D.pick = [];
      D.onIsle = null;
      cb(cid);
    };
    D.prompt = label;
  }

  function isleButtons(list, cb) {
    return '<div class="choices">' + list.map(function (cid) {
      return btn(esc(iname(cid)), function () {
        D.pick = [];
        D.onIsle = null;
        cb(cid);
        redraw();
      }, { small: true });
    }).join("") + "</div>";
  }

  function factionButtons(list, cb, labelFn) {
    return '<div class="choices">' + list.map(function (f) {
      var label = fdot(f) + " " + fname(f);
      if (labelFn) {
        label = labelFn(f);
      }
      return btn(label, function () {
        cb(f);
      });
    }).join("") + "</div>";
  }

  function stepper(min, max, value, onChange) {
    return '<span class="stepper">' + btn("&minus;", function () {
      onChange(Math.max(min, value - 1));
      redraw();
    }, { small: true, disabled: value <= min }) + "<b>" + value + "</b>" + btn("+", function () {
      onChange(Math.min(max, value + 1));
      redraw();
    }, { small: true, disabled: value >= max }) + "</span>";
  }

  function freeButtons(free, f) {
    if (!free) {
      return "";
    }
    var out = "";
    if (free.dominance) {
      out += btn("Activate Supremacy", function () {
        D.step = "dominance";
        redraw();
      }, { small: true });
    }
    if (free.take) {
      out += btn("Take Supremacy", function () {
        D.step = "takeDom";
        redraw();
      }, { small: true });
    }
    if (free.reeve) {
      out += btn("Tithe Reeve", function () {
        D.step = "reeve";
        pickIsle(free.reeve, "", function (cid) {
          submit({ type: "reeve", cid: cid });
        });
        redraw();
      }, { small: true });
    }
    if (free.eavesdrop) {
      out += btn("Eavesdrop", function () {
        D.step = "eaves";
        redraw();
      }, { small: true });
    }
    if (out) {
      return '<div class="choices">' + out + "</div>";
    }
    return "";
  }

  function freeSteps(free) {
    if (D.step === "dominance") {
      var html = '<div class="p-text">Choose a Supremacy card to activate. You will stop scoring points.</div><div class="cards">' + free.dominance.map(function (id) {
        return cardHTML(id, { fn: function () {
          if (free.coalitionWith) {
            D.data.dom = id;
            D.step = "coalition";
            redraw();
          } else {
            submit({ type: "dominance", card: id });
          }
        } });
      }).join("") + "</div>";
      return { title: "Activate Supremacy", html: html };
    }
    if (D.step === "coalition") {
      return { title: "Form A Coalition", text: "Join the player with the fewest points. You win if they win.", html: factionButtons(free.coalitionWith, function (o) {
        submit({ type: "dominance", card: D.data.dom, with: o });
      }) };
    }
    if (D.step === "takeDom") {
      var h2 = "";
      free.take.forEach(function (t) {
        h2 += '<div class="p-text">' + esc(R.CARDS[t.dom].name) + ": spend one of these cards.</div><div class=\"cards\">" + t.cards.map(function (id) {
          return cardHTML(id, { fn: function () {
            submit({ type: "takeDominance", dom: t.dom, card: id });
          } });
        }).join("") + "</div>";
      });
      return { title: "Take A Supremacy Card", html: h2 };
    }
    if (D.step === "reeve") {
      return { title: "Tithe Reeve", text: "Choose an isle with your warrior to remove it and draw a card.", html: isleButtons(free.reeve, function (cid) {
        submit({ type: "reeve", cid: cid });
      }) };
    }
    if (D.step === "eaves") {
      return { title: "Eavesdroppers", text: "Choose a player whose hand you will see. It appears privately in the chronicle.", html: factionButtons(free.eavesdrop, function (o) {
        submit({ type: "eavesdrop", target: o });
      }) };
    }
    return null;
  }

  function battlePicker(battles, extra, done) {
    if (!D.data.bcid) {
      pickIsle(battles.map(function (b) {
        return b.cid;
      }), "", function (cid) {
        D.data.bcid = cid;
        var opt = battles.filter(function (b) {
          return b.cid === cid;
        })[0];
        if (opt.targets.length === 1) {
          done(cid, opt.targets[0]);
        }
      });
      return { title: "Battle", text: "Choose an isle on the map (or below) where you will attack.", html: isleButtons(battles.map(function (b) {
        return b.cid;
      }), function (cid) {
        D.onIsle = null;
        D.data.bcid = cid;
        var opt = battles.filter(function (b) {
          return b.cid === cid;
        })[0];
        if (opt.targets.length === 1) {
          done(cid, opt.targets[0]);
        }
      }) };
    }
    var o = battles.filter(function (b) {
      return b.cid === D.data.bcid;
    })[0];
    D.pick = [];
    return { title: "Battle In " + iname(D.data.bcid), text: "Choose whom to attack.", html: factionButtons(o.targets, function (t) {
      done(D.data.bcid, t);
    }) };
  }

  function moveOptionsFor(f, state, suitFilter) {
    var list = E.moveOptions(state, f);
    if (suitFilter) {
      list = list.filter(function (m) {
        return E.suitMatches(suitFilter, ISLE[m.from].suit);
      });
    }
    return list;
  }

  function movePicker(f, state, list, done, title) {
    var froms = [];
    list.forEach(function (m) {
      if (froms.indexOf(m.from) < 0) {
        froms.push(m.from);
      }
    });
    if (!D.data.mfrom) {
      pickIsle(froms, "", function (cid) {
        D.data.mfrom = cid;
      });
      return { title: title || "Move", text: "Choose the isle to move from.", html: isleButtons(froms, function (cid) {
        D.data.mfrom = cid;
      }) };
    }
    var tos = list.filter(function (m) {
      return m.from === D.data.mfrom;
    });
    if (!D.data.mto) {
      D.picked = [D.data.mfrom];
      pickIsle(tos.map(function (m) {
        return m.to;
      }), "", function (cid) {
        D.data.mto = cid;
        D.data.mn = tos[0].max;
      });
      return { title: (title || "Move") + " From " + iname(D.data.mfrom), text: "Choose the destination.", html: isleButtons(tos.map(function (m) {
        return m.to;
      }), function (cid) {
        D.data.mto = cid;
        D.data.mn = tos[0].max;
      }) };
    }
    D.pick = [];
    D.picked = [D.data.mfrom, D.data.mto];
    var max = tos[0].max;
    var html = '<div class="p-text">How many warriors move from ' + iname(D.data.mfrom) + " to " + iname(D.data.mto) + "?</div>" + stepper(1, max, D.data.mn, function (v) {
      D.data.mn = v;
    }) + '<div class="choices">' + btn("Confirm Move", function () {
      var m = { from: D.data.mfrom, to: D.data.mto, n: D.data.mn };
      D.picked = [];
      done(m);
    }, { primary: true }) + "</div>";
    return { title: title || "Move", html: html };
  }

  var PROMPTS = {};

  PROMPTS.setupCitadel = function (p) {
    pickIsle(p.corners, "", function (cid) {
      submit({ cid: cid });
    });
    return { title: "Raise The Citadel", text: "Choose a corner isle for the Company's Citadel. You will garrison every isle except the opposite corner.", html: isleButtons(p.corners, function (cid) {
      submit({ cid: cid });
    }), suggest: true };
  };

  PROMPTS.setupBuildings = function (p) {
    var order = ["claypit", "forge", "barracks"];
    D.data.place = D.data.place || {};
    var next = null;
    order.forEach(function (b) {
      if (!D.data.place[b] && next === null) {
        next = b;
      }
    });
    var used = {};
    Object.keys(D.data.place).forEach(function (b) {
      var cid = D.data.place[b];
      used[cid] = (used[cid] || 0) + 1;
    });
    var free = p.isles.filter(function (cid) {
      return E.freeSlots(view, cid) - (used[cid] || 0) > 0;
    });
    var draft = order.filter(function (b) {
      return D.data.place[b];
    }).map(function (b) {
      return R.BUILDING_NAME[b] + " at " + iname(D.data.place[b]);
    }).join(", ");
    var html = "";
    if (draft) {
      html += '<div class="draft">' + draft + "</div>";
    }
    if (next) {
      pickIsle(free, "", function (cid) {
        D.data.place[next] = cid;
      });
      html += '<div class="p-text">Place the <b>' + R.BUILDING_NAME[next] + "</b>: choose the Citadel's isle or an adjacent one.</div>" + isleButtons(free, function (cid) {
        D.data.place[next] = cid;
      });
    } else {
      D.pick = [];
      html += '<div class="choices">' + btn("Confirm Buildings", function () {
        submit(D.data.place);
      }, { primary: true }) + btn("Start Over", function () {
        D.data.place = {};
        redraw();
      }) + "</div>";
    }
    return { title: "Starting Buildings", html: html };
  };

  PROMPTS.setupSynod = function (p) {
    if (!D.data.regent) {
      var html = '<div class="choices" style="flex-direction:column;align-items:stretch">' + p.regents.map(function (r) {
        var g = R.REGENTS[r];
        return btn("<b>" + g.name + "</b><br><span class=\"note\">Envoys in " + g.envoys.map(E.colName).join(" and ") + ". " + esc(g.text) + "</span>", function () {
          D.data.regent = r;
          if (p.corners.length === 1) {
            submit({ regent: r, corner: p.corners[0] });
            return;
          }
          redraw();
        });
      }).join("") + "</div>";
      return { title: "Choose A Regent", text: "Your regent sets where your two Sworn Envoys start in the Edict.", html: html };
    }
    pickIsle(p.corners, "", function (cid) {
      submit({ regent: D.data.regent, corner: cid });
    });
    return { title: "Choose Your Corner", text: "The Synod raises its first spire with six warriors in a corner.", html: isleButtons(p.corners, function (cid) {
      submit({ regent: D.data.regent, corner: cid });
    }) };
  };

  PROMPTS.setupWayfarer = function (p) {
    if (!D.data.arch) {
      var html = '<div class="choices" style="flex-direction:column;align-items:stretch">' + p.archetypes.map(function (a) {
        var g = R.ARCHETYPES[a];
        return btn("<b>" + g.name + "</b><br><span class=\"note\">Starts with " + g.items.map(function (t) {
          return R.ITEM_NAME[t];
        }).join(", ") + ". " + esc(g.special) + ": " + esc(g.text) + "</span>", function () {
          D.data.arch = a;
          redraw();
        });
      }).join("") + "</div>";
      return { title: "Choose A Character", html: html };
    }
    pickIsle(p.reedbeds, "", function (r) {
      submit({ arch: D.data.arch, reed: r });
    });
    return { title: "Choose A Reedbed", text: "Pick the reedbed (the reed patches between causeways) where the Wayfarer starts.", html: isleButtons(p.reedbeds, function (r) {
      submit({ arch: D.data.arch, reed: r });
    }) };
  };

  PROMPTS.granary = function (p) {
    return { title: "Common Granary", text: "You and another player each draw a card. Choose the other player.", html: factionButtons(p.others, function (o) {
      submit({ target: o });
    }) };
  };

  PROMPTS.bcards = function (p) {
    var html = '<div class="choices">';
    if (p.crown) {
      html += btn("Discard Crown Of Reeds (+" + p.crownValue + ")", function () {
        submit({ type: "crown" });
      });
    }
    if (p.toll) {
      p.tollTargets.forEach(function (o) {
        html += btn("Toll Gate: take from " + fname(o), function () {
          submit({ type: "toll", target: o });
        });
      });
    }
    html += btn("Continue", function () {
      submit({ type: "done" });
    }, { primary: true }) + "</div>";
    return { title: "Birdsong Cards", text: "Your lasting effects can be used now.", html: html };
  };

  PROMPTS.warhorn = function (p) {
    if (D.step === "battle") {
      return battlePicker(p.battles, null, function (cid, t) {
        submit({ type: "battle", cid: cid, target: t });
      });
    }
    return { title: "War Horn", text: "You may start a battle now.", html: '<div class="choices">' + btn("Battle", function () {
      D.step = "battle";
      redraw();
    }, { primary: true }) + btn("Skip", function () {
      submit({ type: "skip" });
    }) + "</div>" };
  };

  PROMPTS.punt = function (p) {
    var f = p.fac;
    if (D.step === "move") {
      if (f === "wayfarer") {
        pickIsle(p.moves.map(function (m) {
          return m.to;
        }), "", function (cid) {
          submit({ type: "move", to: cid });
        });
        return { title: "Punt Builder", text: "Choose where the Wayfarer moves.", html: isleButtons(p.moves.map(function (m) {
          return m.to;
        }), function (cid) {
          submit({ type: "move", to: cid });
        }) };
      }
      return movePicker(f, view, p.moves, function (m) {
        submit({ type: "move", from: m.from, to: m.to, n: m.n });
      }, "Punt Builder");
    }
    return { title: "Punt Builder", text: "You may take a move at the start of Evening.", html: '<div class="choices">' + btn("Move", function () {
      D.step = "move";
      redraw();
    }, { primary: true }) + btn("Skip", function () {
      submit({ type: "skip" });
    }) + "</div>" };
  };

  PROMPTS.ambush = function (p) {
    var html = '<div class="cards">' + p.cards.map(function (id) {
      return cardHTML(id, { fn: function () {
        submit({ card: id });
      } });
    }).join("") + '</div><div class="choices">' + btn("Do Not Ambush", function () {
      submit({ type: "skip" });
    }) + "</div>";
    return { title: "Ambush?", text: fullName(p.att) + " attacks you in " + iname(p.cid) + ". Play an ambush card (click it) to deal two hits before the dice are rolled.", html: html };
  };

  PROMPTS.foil = function (p) {
    var html = '<div class="cards">' + p.cards.map(function (id) {
      return cardHTML(id, { fn: function () {
        submit({ card: id });
      } });
    }).join("") + '</div><div class="choices">' + btn("Do Not Foil", function () {
      submit({ type: "skip" });
    }) + "</div>";
    return { title: "Foil The Ambush?", text: fullName(p.def) + " springs an ambush. Play a matching ambush card to cancel it.", html: html };
  };

  var EFFECT_LABEL = { ruthless: "Ruthless Charge (+1 hit, defender scores 1)", sappers: "Silt Sappers (+1 hit, discard)", bulwark: "Bulwark Smiths (ignore rolled hits, discard)" };

  PROMPTS.battleEffects = function (p) {
    D.data.use = D.data.use || [];
    var b = p.battle;
    var html = '<div class="p-text">Dice: ' + b.dice[0] + " and " + b.dice[1] + ". " + fname(b.att) + " deals " + b.attRolled + " rolled + " + b.attExtra + " extra; " + fname(b.def) + " deals " + b.defRolled + " rolled + " + b.defExtra + " extra.</div>";
    html += '<div class="choices">' + p.options.map(function (k) {
      var on = D.data.use.indexOf(k) >= 0;
      return btn(when(on, "&#10003; ") + EFFECT_LABEL[k], function () {
        var i = D.data.use.indexOf(k);
        if (i >= 0) {
          D.data.use.splice(i, 1);
        } else {
          D.data.use.push(k);
        }
        redraw();
      }, { on: on });
    }).join("") + "</div>";
    html += '<div class="choices">' + btn("Confirm", function () {
      submit({ use: D.data.use });
    }, { primary: true }) + "</div>";
    return { title: "Battle Effects", html: html };
  };

  PROMPTS.hits = function (p) {
    if (p.wayfarer) {
      D.data.items = D.data.items || [];
      D.data.ally = D.data.ally || 0;
      var need = Math.min(p.n, p.items.length + (p.allyN || 0));
      var html = '<div class="p-text">Assign ' + plural(need, "hit") + ". Choose undamaged items to damage" + when(p.allyN, ", or let allied " + fname(p.ally) + " warriors fall (more warriors than items makes them Hostile)") + ".</div>";
      html += '<div class="items">' + p.items.map(function (it, i) {
        var on = D.data.items.indexOf(i) >= 0;
        return itemChip(it, { sel: on, fn: function () {
          var k = D.data.items.indexOf(i);
          if (k >= 0) {
            D.data.items.splice(k, 1);
          } else if (D.data.items.length + D.data.ally < need) {
            D.data.items.push(i);
          }
          redraw();
        } });
      }).join("") + "</div>";
      if (p.allyN) {
        html += '<div class="p-text">Allied warriors lost: ' + stepper(0, Math.min(p.allyN, need), D.data.ally, function (v) {
          D.data.ally = Math.min(v, need - D.data.items.length);
        }) + "</div>";
      }
      html += '<div class="choices">' + btn("Confirm", function () {
        submit({ items: D.data.items.map(function (i) {
          return { t: p.items[i].t, ex: p.items[i].ex };
        }), ally: D.data.ally });
      }, { primary: true, disabled: D.data.items.length + D.data.ally !== need }) + "</div>";
      return { title: "Take Hits", html: html };
    }
    D.data.pieces = D.data.pieces || [];
    var counts = {};
    p.pieces.forEach(function (k) {
      counts[k] = (counts[k] || 0) + 1;
    });
    var chosen = {};
    D.data.pieces.forEach(function (k) {
      chosen[k] = (chosen[k] || 0) + 1;
    });
    var html2 = '<div class="p-text">You lose ' + plural(p.warriors, "warrior") + " in " + iname(p.cid) + ". Choose " + p.rest + " more piece" + sfx(p.rest) + " to remove.</div><div class=\"choices\">";
    Object.keys(counts).forEach(function (k) {
      var label = R.BUILDING_NAME[k] || E.tokenLabel(k);
      html2 += btn(label + " (" + (chosen[k] || 0) + "/" + counts[k] + ")", function () {
        if ((chosen[k] || 0) < counts[k] && D.data.pieces.length < p.rest) {
          D.data.pieces.push(k);
        }
        redraw();
      });
    });
    html2 += btn("Clear", function () {
      D.data.pieces = [];
      redraw();
    }, { small: true }) + "</div>";
    html2 += '<div class="choices">' + btn("Confirm", function () {
      submit({ pieces: D.data.pieces });
    }, { primary: true, disabled: D.data.pieces.length !== p.rest }) + "</div>";
    return { title: "Take Hits", html: html2 };
  };

  PROMPTS.surgeons = function (p) {
    var html = '<div class="cards">' + p.cards.map(function (id) {
      return cardHTML(id, { fn: function () {
        submit({ card: id });
      } });
    }).join("") + '</div><div class="choices">' + btn("Let Them Fall", function () {
      submit({ type: "skip" });
    }) + "</div>";
    return { title: "Field Surgeons", text: plural(p.n, "Company warrior") + " fell in " + iname(p.cid) + ". Spend a matching card (click it) to return them to the Citadel.", html: html };
  };

  PROMPTS.unrest = function (p) {
    var html = '<div class="cards">' + p.cards.map(function (id) {
      return cardHTML(id, { fn: function () {
        submit({ card: id });
      } });
    }).join("") + "</div>";
    return { title: "Unrest", text: "You stirred Unrest in " + iname(p.cid) + ". Give the Covenant a matching card (click it).", html: html };
  };

  PROMPTS.discard = function (p) {
    var hand = view.fac[p.fac].hand;
    if (!D.cardPick) {
      startCardPick(hand, p.n, function (cards) {
        submit({ cards: cards });
      }, false, "Select cards to discard");
    }
    return { title: "Discard Down To Five", text: "Click " + plural(p.n, "card") + " in your hand to discard.", html: '<div class="choices">' + btn("Discard Selected", function () {
      submit({ cards: D.cardPick.sel.slice() });
    }, { primary: true, disabled: D.cardPick.sel.length !== p.n }) + "</div>" };
  };

  function followerPicker(cards, n, sel, onToggle) {
    return '<div class="cards">' + cards.map(function (id) {
      return cardHTML(id, { sel: sel.indexOf(id) >= 0, fn: function () {
        onToggle(id);
      } });
    }).join("") + "</div>";
  }

  PROMPTS.covenantTrim = function (p) {
    D.sel = D.sel || [];
    var fol = view.fac.covenant.followers;
    var html = followerPicker(fol, p.n, D.sel, function (id) {
      var i = D.sel.indexOf(id);
      if (i >= 0) {
        D.sel.splice(i, 1);
      } else if (D.sel.length < p.n) {
        D.sel.push(id);
      }
      redraw();
    }) + '<div class="choices">' + btn("Discard Selected", function () {
      submit({ cards: D.sel.slice() });
    }, { primary: true, disabled: D.sel.length !== p.n }) + "</div>";
    return { title: "Too Many Followers", text: "With no hideout you may keep only five followers. Choose " + p.n + " to discard.", html: html };
  };

  PROMPTS.companyDaylight = function (p) {
    var fs = freeSteps(p.free);
    if (fs) {
      return fs;
    }
    if (D.step === "craft") {
      if (!D.cardPick) {
        startCardPick(p.craftable, 1, function (c) {
          submit({ type: "craft", card: c[0] });
        }, true, "Click a card to craft");
      }
      return { title: "Craft", text: "Click a highlighted card in your hand. Forges in matching isles pay its cost.", html: "" };
    }
    if (D.step === "battle") {
      return battlePicker(p.battles, null, function (cid, t) {
        submit({ type: "battle", cid: cid, target: t });
      });
    }
    if (D.step === "march") {
      D.data.moves = D.data.moves || [];
      var test = E.clone(view);
      D.data.moves.forEach(function (m) {
        test.map[m.from].w.company -= m.n;
        test.map[m.to].w.company = (test.map[m.to].w.company || 0) + m.n;
      });
      var draft = "";
      if (D.data.moves.length > 0) {
        draft = '<div class="draft">' + D.data.moves.map(function (m, i) {
          return "Move " + (i + 1) + ": " + m.n + " from " + iname(m.from) + " to " + iname(m.to);
        }).join("<br>") + "</div>";
      }
      if (D.data.moves.length === 2 || D.data.marchReady) {
        D.pick = [];
        return { title: "March", html: draft + '<div class="choices">' + btn("March Now", function () {
          submit({ type: "march", moves: D.data.moves });
        }, { primary: true }) + "</div>" };
      }
      var sub = movePicker("company", test, E.moveOptions(test, "company"), function (m) {
        D.data.moves.push(m);
        D.data.mfrom = null;
        D.data.mto = null;
        redraw();
      }, "March, Move " + (D.data.moves.length + 1));
      if (D.data.moves.length === 1) {
        sub.html = draft + sub.html + '<div class="choices">' + btn("March With One Move", function () {
          D.data.marchReady = true;
          redraw();
        }, { primary: true }) + "</div>";
      }
      return sub;
    }
    if (D.step === "build") {
      if (!D.data.bcid) {
        var isles = [];
        p.builds.forEach(function (b) {
          if (isles.indexOf(b.cid) < 0) {
            isles.push(b.cid);
          }
        });
        pickIsle(isles, "", function (cid) {
          D.data.bcid = cid;
        });
        return { title: "Build", text: "Choose an isle you rule with an open slot.", html: isleButtons(isles, function (cid) {
          D.data.bcid = cid;
        }) };
      }
      var opts = p.builds.filter(function (b) {
        return b.cid === D.data.bcid;
      });
      return { title: "Build In " + iname(D.data.bcid), html: '<div class="choices">' + opts.map(function (b) {
        return btn(R.BUILDING_NAME[b.b] + " (" + b.cost + " clay, +" + b.vp + ")", function () {
          submit({ type: "build", cid: b.cid, b: b.b });
        });
      }).join("") + "</div>" };
    }
    if (D.step === "overwork") {
      if (!D.data.ocid) {
        var oi = p.overwork.map(function (o) {
          return o.cid;
        });
        pickIsle(oi, "", function (cid) {
          D.data.ocid = cid;
        });
        return { title: "Overwork", text: "Choose a claypit isle.", html: isleButtons(oi, function (cid) {
          D.data.ocid = cid;
        }) };
      }
      var o = p.overwork.filter(function (x) {
        return x.cid === D.data.ocid;
      })[0];
      if (!D.cardPick) {
        startCardPick(o.cards, 1, function (c) {
          submit({ type: "overwork", cid: o.cid, card: c[0] });
        }, true, "Click a matching card to spend");
      }
      return { title: "Overwork At " + iname(o.cid), text: "Spend a card matching this isle.", html: "" };
    }
    if (D.step === "hawk") {
      if (!D.cardPick) {
        startCardPick(p.moons, 1, function (c) {
          submit({ type: "hawk", card: c[0] });
        }, true, "Click a Moon card to spend");
      }
      return { title: "Extra Action", text: "Spend a Moon card from your hand for one more action.", html: "" };
    }
    var a = p.actions > 0;
    var html = '<div class="p-text">Actions left: <b>' + p.actions + "</b>" + when(p.canCraft, " · You may craft first.") + '</div><div class="choices">';
    html += btn("Craft", function () {
      D.step = "craft";
      redraw();
    }, { disabled: !p.canCraft || p.craftable.length === 0 });
    html += btn("Battle", function () {
      D.step = "battle";
      redraw();
    }, { disabled: !a || !p.battles || p.battles.length === 0 });
    html += btn("March", function () {
      D.step = "march";
      redraw();
    }, { disabled: !a || !p.moves || p.moves.length === 0 });
    html += btn("Recruit", function () {
      submit({ type: "recruit" });
    }, { disabled: !a || !p.canRecruit });
    html += btn("Build", function () {
      D.step = "build";
      redraw();
    }, { disabled: !a || !p.builds || p.builds.length === 0 });
    html += btn("Overwork", function () {
      D.step = "overwork";
      redraw();
    }, { disabled: !a || !p.overwork || p.overwork.length === 0 });
    html += btn("Spend Moon Card (+1 Action)", function () {
      D.step = "hawk";
      redraw();
    }, { disabled: p.moons.length === 0 });
    html += "</div>" + freeButtons(p.free) + '<div class="choices">' + btn("End Daylight", function () {
      submit({ type: "end" });
    }, { primary: !a }) + "</div>";
    return { title: "Company Daylight", html: html };
  };

  PROMPTS.synodEdictAdd = function (p) {
    D.data.adds = D.data.adds || [];
    var hand = view.fac.synod.hand;
    var html = "";
    if (D.data.adds.length > 0) {
      html += '<div class="draft">' + D.data.adds.map(function (x) {
        return esc(E.cname(x.card)) + " to " + E.colName(x.col);
      }).join("<br>") + "</div>";
    }
    var hasPending = D.data.pending !== undefined && D.data.pending !== null;
    if (hasPending) {
      html += '<div class="p-text">Which column for <b>' + esc(E.cname(D.data.pending)) + "</b>?</div><div class=\"choices\">" + R.EDICT_COLUMNS.map(function (col) {
        return btn(E.colName(col), function () {
          D.data.adds.push({ card: D.data.pending, col: col });
          D.data.pending = null;
          redraw();
        });
      }).join("") + "</div>";
      D.cardPick = null;
    } else if (D.data.adds.length < 2) {
      var used = D.data.adds.map(function (x) {
        return x.card;
      });
      var moonUsed = D.data.adds.some(function (x) {
        return E.cardSuit(x.card) === "moon";
      });
      var allowed = hand.filter(function (id) {
        return used.indexOf(id) < 0 && !(moonUsed && E.cardSuit(id) === "moon");
      });
      startCardPick(allowed, 1, function (c) {
        D.data.pending = c[0];
        redraw();
      }, true, "Click a card to add to the Edict");
    } else {
      D.cardPick = null;
    }
    html += '<div class="choices">' + btn("Confirm Edict", function () {
      submit({ adds: D.data.adds });
    }, { primary: true, disabled: D.data.adds.length < 1 || hasPending }) + btn("Start Over", function () {
      D.data = {};
      D.cardPick = null;
      redraw();
    }, { small: true }) + "</div>";
    return { title: "Add To The Edict", text: "Add one or two cards from your hand (at most one Moon card). Each card's suit says where that action must happen.", html: html };
  };

  PROMPTS.synodNewSpire = function (p) {
    pickIsle(p.isles, "", function (cid) {
      submit({ cid: cid });
    });
    return { title: "A New Spire", text: "Choose where the new spire rises (an isle with the fewest warriors).", html: isleButtons(p.isles, function (cid) {
      submit({ cid: cid });
    }) };
  };

  PROMPTS.synodCraft = function (p) {
    var fs = freeSteps(p.free);
    if (fs) {
      return fs;
    }
    if (D.step === "craft") {
      if (!D.cardPick) {
        startCardPick(p.craftable, 1, function (c) {
          submit({ type: "craft", card: c[0] });
        }, true, "Click a card to craft");
      }
      return { title: "Craft", text: "Click a highlighted card. Spires in matching isles pay its cost.", html: "" };
    }
    var html = '<div class="choices">' + btn("Craft", function () {
      D.step = "craft";
      redraw();
    }, { disabled: p.craftable.length === 0 }) + btn("Resolve The Edict", function () {
      submit({ type: "done" });
    }, { primary: true }) + "</div>" + freeButtons(p.free);
    return { title: "Synod Daylight", text: "Craft with your spires, then carry out the Edict from left to right.", html: html };
  };

  PROMPTS.synodEdict = function (p) {
    var fs = freeSteps(p.free);
    if (fs) {
      return fs;
    }
    if (D.data.card !== undefined && D.data.card !== null) {
      var entry = p.cards.filter(function (c) {
        return c.index === D.data.card;
      })[0];
      var col = p.col;
      var opts = E.synodCardOptions(view, col, entry.card);
      var label = esc(E.cname(entry.card)) + " (" + R.SUIT_NAME[entry.suit] + ")";
      if (col === "recruit") {
        pickIsle(opts, "", function (cid) {
          submit({ index: entry.index, cid: cid });
        });
        return { title: "Recruit: " + label, text: "Choose a matching isle with a spire.", html: isleButtons(opts, function (cid) {
          submit({ index: entry.index, cid: cid });
        }) };
      }
      if (col === "build") {
        pickIsle(opts, "", function (cid) {
          submit({ index: entry.index, cid: cid });
        });
        return { title: "Build: " + label, text: "Choose a matching isle you rule with no spire.", html: isleButtons(opts, function (cid) {
          submit({ index: entry.index, cid: cid });
        }) };
      }
      if (col === "battle") {
        return battlePicker(opts, null, function (cid, t) {
          submit({ index: entry.index, cid: cid, target: t });
        });
      }
      return movePicker("synod", view, opts, function (m) {
        submit({ index: entry.index, from: m.from, to: m.to, n: m.n });
      }, "Move: " + label);
    }
    var html = '<div class="p-text">Column: <b>' + E.colName(p.col) + "</b>. Choose the next card to carry out.</div><div class=\"choices\">";
    var anyBad = false;
    p.cards.forEach(function (c) {
      if (!c.ok) {
        anyBad = true;
      }
      html += btn(esc(E.cname(c.card)) + " (" + R.SUIT_NAME[c.suit] + ")" + when(!c.ok, " &#10007;"), function () {
        D.data.card = c.index;
        D.step = "card";
        redraw();
      }, { disabled: !c.ok, title: when(!c.ok, "This card cannot be carried out now") });
    });
    html += "</div>";
    if (anyBad) {
      html += '<div class="choices">' + btn("Fall Into Collapse", function () {
        submit({ type: "collapse" });
      }, { danger: true }) + "</div>";
    }
    html += freeButtons(p.free);
    return { title: "Resolve The Edict", html: html };
  };

  PROMPTS.synodRegent = function (p) {
    var html = '<div class="choices" style="flex-direction:column;align-items:stretch">' + p.regents.map(function (r) {
      var g = R.REGENTS[r];
      return btn("<b>" + g.name + "</b><br><span class=\"note\">Envoys in " + g.envoys.map(E.colName).join(" and ") + ". " + esc(g.text) + "</span>", function () {
        submit({ regent: r });
      });
    }).join("") + "</div>";
    return { title: "Choose A New Regent", html: html };
  };

  function spendPicker(cards, need, done, title) {
    D.sel = D.sel || [];
    return '<div class="p-text">' + title + "</div>" + followerPicker(cards, need, D.sel, function (id) {
      var i = D.sel.indexOf(id);
      if (i >= 0) {
        D.sel.splice(i, 1);
      } else if (D.sel.length < need) {
        D.sel.push(id);
      }
      redraw();
    }) + '<div class="choices">' + btn("Confirm", function () {
      done(D.sel.slice());
    }, { primary: true, disabled: D.sel.length !== need }) + "</div>";
  }

  PROMPTS.covenantBirdsong = function (p) {
    if (D.step === "revolt" || D.step === "spread") {
      var list = p.revolts;
      if (D.step === "spread") {
        list = p.spreads;
      }
      if (!D.data.cid) {
        var isles = list.map(function (o) {
          return o.cid;
        });
        pickIsle(isles, "", function (cid) {
          D.data.cid = cid;
        });
        var t1 = "Light A Lantern";
        if (D.step === "revolt") {
          t1 = "Uprising";
        }
        return { title: t1, text: "Choose an isle.", html: isleButtons(isles, function (cid) {
          D.data.cid = cid;
        }) };
      }
      var suit = ISLE[D.data.cid].suit;
      var cards = view.fac.covenant.followers.filter(function (id) {
        return E.suitMatches(E.cardSuit(id), suit);
      });
      var need = 2;
      if (D.step === "spread") {
        need = list.filter(function (o) {
          return o.cid === D.data.cid;
        })[0].cost;
      }
      var type = D.step;
      var t2 = "Light A Lantern In ";
      if (type === "revolt") {
        t2 = "Uprising In ";
      }
      return { title: t2 + iname(D.data.cid), html: spendPicker(cards, need, function (sel) {
        submit({ type: type, cid: D.data.cid, cards: sel });
      }, "Spend " + plural(need, "follower") + " matching " + R.SUIT_NAME[suit] + ".") };
    }
    var html = '<div class="choices">' + btn("Uprising", function () {
      D.step = "revolt";
      redraw();
    }, { disabled: p.revolts.length === 0 }) + btn("Light A Lantern", function () {
      D.step = "spread";
      redraw();
    }, { disabled: p.spreads.length === 0 }) + btn("Done", function () {
      submit({ type: "done" });
    }, { primary: true }) + "</div>";
    return { title: "Covenant Birdsong", text: "Spend followers to start uprisings and light lanterns, as often as you can afford.", html: html };
  };

  PROMPTS.covenantDaylight = function (p) {
    var fs = freeSteps(p.free);
    if (fs) {
      return fs;
    }
    var map = { craft: [p.craftable, "craft", "Click a card to craft"], mobilize: [p.mobilize, "mobilize", "Click a card to add to your followers"], train: [p.train, "train", "Click a card matching a hideout's isle"] };
    if (map[D.step]) {
      var m = map[D.step];
      if (!D.cardPick) {
        startCardPick(m[0], 1, function (c) {
          submit({ type: m[1], card: c[0] });
        }, true, m[2]);
      }
      return { title: { craft: "Craft", mobilize: "Rally", train: "Appoint A Warden" }[D.step], text: m[2] + ".", html: "" };
    }
    var html = '<div class="choices">' + btn("Craft", function () {
      D.step = "craft";
      redraw();
    }, { disabled: p.craftable.length === 0 }) + btn("Rally (Card To Followers)", function () {
      D.step = "mobilize";
      redraw();
    }, { disabled: p.mobilize.length === 0 }) + btn("Appoint Warden", function () {
      D.step = "train";
      redraw();
    }, { disabled: p.train.length === 0 }) + "</div>" + freeButtons(p.free) + '<div class="choices">' + btn("End Daylight", function () {
      submit({ type: "end" });
    }, { primary: true }) + "</div>";
    var note = "";
    if (p.full) {
      note = " Your followers are full until you build a hideout; rallied cards would be discarded.";
    }
    return { title: "Covenant Daylight", text: "Craft with lanterns, rally followers and appoint wardens." + note, html: html };
  };

  PROMPTS.covenantOps = function (p) {
    if (D.step === "move") {
      return movePicker("covenant", view, p.moves, function (m) {
        submit({ type: "move", from: m.from, to: m.to, n: m.n });
      });
    }
    if (D.step === "battle") {
      return battlePicker(p.battles, null, function (cid, t) {
        submit({ type: "battle", cid: cid, target: t });
      });
    }
    if (D.step === "recruit" || D.step === "organize") {
      var list = p.recruits;
      if (D.step === "organize") {
        list = p.organize;
      }
      var type = D.step;
      pickIsle(list, "", function (cid) {
        submit({ type: type, cid: cid });
      });
      var t3 = "Kindle";
      if (type === "recruit") {
        t3 = "Recruit";
      }
      return { title: t3, text: "Choose an isle.", html: isleButtons(list, function (cid) {
        submit({ type: type, cid: cid });
      }) };
    }
    var html = '<div class="p-text">Operations left: <b>' + p.left + '</b></div><div class="choices">' + btn("Move", function () {
      D.step = "move";
      redraw();
    }, { disabled: p.moves.length === 0 }) + btn("Battle", function () {
      D.step = "battle";
      redraw();
    }, { disabled: p.battles.length === 0 }) + btn("Recruit", function () {
      D.step = "recruit";
      redraw();
    }, { disabled: p.recruits.length === 0 }) + btn("Kindle", function () {
      D.step = "organize";
      redraw();
    }, { disabled: p.organize.length === 0 }) + btn("Done", function () {
      submit({ type: "done" });
    }, { primary: true }) + "</div>";
    return { title: "Night Work", text: "Each warden gives one operation this Evening.", html: html };
  };

  function itemSelector(items, n, keyFn, done, title) {
    D.data.isel = D.data.isel || [];
    var html = '<div class="p-text">' + title + " (" + D.data.isel.length + "/" + n + ")</div><div class=\"items\">" + items.map(function (it, i) {
      var on = D.data.isel.indexOf(i) >= 0;
      return itemChip(it, { sel: on, fn: function () {
        var k = D.data.isel.indexOf(i);
        if (k >= 0) {
          D.data.isel.splice(k, 1);
        } else if (D.data.isel.length < n) {
          D.data.isel.push(i);
        }
        redraw();
      } });
    }).join("") + '</div><div class="choices">' + btn("Confirm", function () {
      done(D.data.isel.map(function (i) {
        return keyFn(items[i]);
      }));
    }, { primary: true, disabled: D.data.isel.length !== n }) + "</div>";
    return html;
  }

  PROMPTS.wayfarerRefresh = function (p) {
    return { title: "Refresh", html: itemSelector(p.items.map(function (it) {
      return { t: it.t, ex: true, dmg: it.dmg };
    }), p.n, function (it) {
      return { t: it.t, dmg: it.dmg };
    }, function (sel) {
      submit({ items: sel });
    }, "Choose " + p.n + " exhausted items to refresh") };
  };

  PROMPTS.wayfarerDamage = function (p) {
    return { title: "Damage Items", text: "Reason: " + esc(p.why) + ".", html: itemSelector(p.items, p.n, function (it) {
      return { t: it.t, ex: it.ex };
    }, function (sel) {
      submit({ items: sel });
    }, "Choose " + p.n + " items to damage") };
  };

  PROMPTS.wayfarerCapacity = function (p) {
    return { title: "Too Much To Carry", html: itemSelector(p.items, p.n, function (it) {
      return { t: it.t, ex: it.ex, dmg: it.dmg };
    }, function (sel) {
      submit({ items: sel });
    }, "Choose " + p.n + " items to leave behind for good") };
  };

  function wayMove(targets, type, title, freeText) {
    if (!D.data.to) {
      var list = targets.map(function (t) {
        return t.to;
      });
      pickIsle(list, "", function (cid) {
        var t = targets.filter(function (x) {
          return x.to === cid;
        })[0];
        if (!t.allies || t.allies.length === 0) {
          submit({ type: "move", to: cid });
        } else {
          D.data.to = cid;
        }
      });
      var html = '<div class="choices">' + targets.map(function (t) {
        var cost = "";
        if (!freeText && t.cost > 1) {
          cost = " (2 Waders)";
        }
        return btn(esc(iname(t.to)) + cost, function () {
          if (!t.allies || t.allies.length === 0) {
            submit({ type: "move", to: t.to });
          } else {
            D.data.to = t.to;
            redraw();
          }
        }, { small: true });
      }).join("") + "</div>";
      if (type === "slip") {
        html += '<div class="choices">' + btn("Stay Here", function () {
          submit({ type: "stay" });
        }, { primary: true }) + "</div>";
      }
      return { title: title, text: freeText || "Choose where to move.", html: html };
    }
    var t = targets.filter(function (x) {
      return x.to === D.data.to;
    })[0];
    D.data.ally = D.data.ally || null;
    D.data.allyN = D.data.allyN || 1;
    var html2 = '<div class="p-text">Allied warriors can come with you to ' + iname(D.data.to) + ".</div><div class=\"choices\">" + btn("Go Alone", function () {
      submit({ type: "move", to: D.data.to });
    }) + t.allies.map(function (a) {
      return btn("Bring " + fname(a.f) + " warriors", function () {
        D.data.ally = a.f;
        D.data.allyMax = a.max;
        redraw();
      }, { on: D.data.ally === a.f });
    }).join("") + "</div>";
    if (D.data.ally) {
      html2 += stepper(1, D.data.allyMax, D.data.allyN, function (v) {
        D.data.allyN = v;
      }) + '<div class="choices">' + btn("Move Together", function () {
        submit({ type: "move", to: D.data.to, ally: D.data.ally, allyN: D.data.allyN });
      }, { primary: true }) + "</div>";
    }
    return { title: title, html: html2 };
  }

  PROMPTS.wayfarerSlip = function (p) {
    return wayMove(p.targets, "slip", "Slip", "Move for free to an adjacent isle or reedbed, or stay.");
  };

  PROMPTS.wayfarerDaylight = function (p) {
    var w = view.fac.wayfarer;
    var fs = freeSteps(p.free);
    if (fs) {
      return fs;
    }
    var cid = E.wayfarerIsle(view);
    if (D.step === "move") {
      return wayMove(p.moves, "move", "Move");
    }
    if (D.step === "battle") {
      if (!D.data.target) {
        return { title: "Battle", text: "Choose whom to attack in " + iname(cid) + ".", html: factionButtons(p.battles, function (t) {
          var allies = (p.allies || []).filter(function (a) {
            return a !== t;
          });
          if (allies.length === 0) {
            submit({ type: "battle", target: t });
          } else {
            D.data.target = t;
            D.data.allies = allies;
            redraw();
          }
        }) };
      }
      return { title: "Battle " + fname(D.data.target), text: "Fight alongside allied warriors?", html: '<div class="choices">' + btn("Fight Alone", function () {
        submit({ type: "battle", target: D.data.target });
      }) + D.data.allies.map(function (a) {
        return btn("With " + fname(a), function () {
          submit({ type: "battle", target: D.data.target, ally: a });
        });
      }).join("") + "</div>" };
    }
    if (D.step === "aid") {
      if (!D.data.target) {
        return { title: "Aid", text: "Choose a player with pieces here.", html: factionButtons(p.aid.map(function (a) {
          return a.f;
        }), function (t) {
          D.data.target = t;
          redraw();
        }) };
      }
      if (D.data.card === undefined) {
        var cards = E.matchingCards(view, "wayfarer", ISLE[cid].suit);
        if (!D.cardPick) {
          startCardPick(cards, 1, function (c) {
            D.data.card = c[0];
            redraw();
          }, true, "Click a card matching " + R.SUIT_NAME[ISLE[cid].suit] + " to give");
        }
        return { title: "Aid " + fname(D.data.target), text: "Choose the card to give.", html: "" };
      }
      if (!D.data.item) {
        var ready = [];
        w.items.forEach(function (it) {
          if (!it.ex && !it.dmg && ready.indexOf(it.t) < 0) {
            ready.push(it.t);
          }
        });
        return { title: "Aid " + fname(D.data.target), text: "Choose an item to exhaust.", html: '<div class="choices">' + ready.map(function (t) {
          return btn(itemIcon(t) + R.ITEM_NAME[t], function () {
            D.data.item = t;
            redraw();
          }, { small: true });
        }).join("") + "</div>" };
      }
      var tgt = p.aid.filter(function (a) {
        return a.f === D.data.target;
      })[0];
      var base = { type: "aid", target: D.data.target, card: D.data.card, item: D.data.item };
      var html = '<div class="p-text">Take one of their crafted items?</div><div class="choices">' + btn("Take Nothing", function () {
        submit(base);
      });
      var seen = {};
      tgt.items.forEach(function (t) {
        if (seen[t]) {
          return;
        }
        seen[t] = true;
        html += btn("Take " + itemIcon(t) + R.ITEM_NAME[t], function () {
          var a = Object.assign({}, base);
          a.take = t;
          submit(a);
        });
      });
      return { title: "Aid " + fname(D.data.target), html: html + "</div>" };
    }
    if (D.step === "errand") {
      if (D.data.slot === undefined) {
        return { title: "Errand", text: "Choose an errand matching this isle.", html: '<div class="choices">' + p.errands.map(function (e) {
          var er = R.ERRANDS[e.q];
          return btn(esc(er.name) + " (" + er.items.map(function (t) {
            return R.ITEM_NAME[t];
          }).join(" + ") + ")", function () {
            D.data.slot = e.slot;
            redraw();
          });
        }).join("") + "</div>" };
      }
      return { title: "Errand Reward", html: '<div class="choices">' + btn("Score Points", function () {
        submit({ type: "errand", slot: D.data.slot, reward: "vp" });
      }) + btn("Draw Two Cards", function () {
        submit({ type: "errand", slot: D.data.slot, reward: "draw" });
      }) + "</div>" };
    }
    if (D.step === "strike") {
      if (!D.data.target) {
        return { title: "Snipe", text: "Choose a target.", html: factionButtons(p.strike.map(function (s) {
          return s.f;
        }), function (t) {
          var s = p.strike.filter(function (x) {
            return x.f === t;
          })[0];
          if (s.warrior) {
            submit({ type: "strike", target: t });
          } else {
            D.data.target = t;
            redraw();
          }
        }) };
      }
      var st = p.strike.filter(function (x) {
        return x.f === D.data.target;
      })[0];
      var uniq = [];
      st.pieces.forEach(function (k) {
        if (uniq.indexOf(k) < 0) {
          uniq.push(k);
        }
      });
      return { title: "Snipe " + fname(D.data.target), text: "They have no warriors here. Choose a building or token.", html: '<div class="choices">' + uniq.map(function (k) {
        return btn(R.BUILDING_NAME[k] || E.tokenLabel(k), function () {
          submit({ type: "strike", target: D.data.target, piece: k });
        });
      }).join("") + "</div>" };
    }
    if (D.step === "repair") {
      var dmg = E.damagedItems(view);
      return { title: "Repair", text: "Choose a damaged item.", html: '<div class="items">' + dmg.map(function (it) {
        return itemChip(it, { fn: function () {
          submit({ type: "repair", item: { t: it.t, ex: it.ex } });
        } });
      }).join("") + "</div>" };
    }
    if (D.step === "craft") {
      if (!D.cardPick) {
        startCardPick(p.craftable, 1, function (c) {
          submit({ type: "craft", card: c[0] });
        }, true, "Click a card to craft");
      }
      return { title: "Craft", text: "Mallets pay the cost; every cost icon must match your isle.", html: "" };
    }
    if (D.step === "special") {
      var sp = p.special;
      if (sp.kind === "pilfer") {
        return { title: "Pilfer", text: "Take a random card from a player in your isle.", html: factionButtons(sp.targets, function (t) {
          submit({ type: "special", target: t });
        }) };
      }
      if (sp.kind === "oddjobs") {
        return { title: "Odd Jobs", text: "Take a matching card from the discard pile.", html: '<div class="cards">' + sp.cards.map(function (id) {
          return cardHTML(id, { fn: function () {
            submit({ type: "special", card: id });
          } });
        }).join("") + "</div>" };
      }
      var dam = E.damagedItems(view);
      var need = Math.min(3, dam.length);
      return { title: "Go To Ground", text: "Repair " + need + " items, then Daylight ends.", html: itemSelector(dam, need, function (it) {
        return { t: it.t, ex: it.ex };
      }, function (sel) {
        submit({ type: "special", items: sel });
      }, "Choose items to repair") };
    }
    var where = "in " + iname(w.loc);
    var html2 = '<div class="p-text">You are ' + where + ". Exhaust ready items to act.</div><div class=\"choices\">";
    html2 += btn("Move (Waders)", function () {
      D.step = "move";
      redraw();
    }, { disabled: p.moves.length === 0 });
    html2 += btn("Battle (Blade)", function () {
      D.step = "battle";
      redraw();
    }, { disabled: p.battles.length === 0 });
    html2 += btn("Explore (Lamp)", function () {
      submit({ type: "explore" });
    }, { disabled: !p.explore });
    html2 += btn("Aid", function () {
      D.step = "aid";
      redraw();
    }, { disabled: p.aid.length === 0 });
    html2 += btn("Errand", function () {
      D.step = "errand";
      redraw();
    }, { disabled: p.errands.length === 0 });
    html2 += btn("Snipe (Sling)", function () {
      D.step = "strike";
      redraw();
    }, { disabled: p.strike.length === 0 });
    html2 += btn("Repair (Mallet)", function () {
      D.step = "repair";
      redraw();
    }, { disabled: !p.repair });
    html2 += btn("Craft (Mallets)", function () {
      D.step = "craft";
      redraw();
    }, { disabled: p.craftable.length === 0 });
    var spLabel = R.ARCHETYPES[w.arch].special + " (Lamp)";
    html2 += btn(spLabel, function () {
      D.step = "special";
      redraw();
    }, { disabled: !p.special });
    html2 += "</div>" + freeButtons(p.free) + '<div class="choices">' + btn("End Daylight", function () {
      submit({ type: "end" });
    }, { primary: true }) + "</div>";
    return { title: "Wayfarer Daylight", html: html2 };
  };

  var NOTES = {
    setupCitadel: "<b>Root:</b> this is the Marquise placing the Keep. Every clearing except the opposite corner gets one warrior, so the Company starts everywhere but thin.",
    setupBuildings: "<b>Root:</b> the Marquise's starting sawmill, workshop and recruiter go in the Keep's clearing or next to it.",
    setupSynod: "<b>Root:</b> the Eyrie choose a leader. The two Loyal Viziers (Sworn Envoys) are Moon cards that stay in the Decree for good, so pick a regent whose columns you can always fulfil.",
    setupWayfarer: "<b>Root:</b> the Vagabond picks a character and starts in a forest. Barrows hold one item each; exploring scores a point.",
    granary: "<b>Root:</b> Better Burrow Bank. Choose the player who benefits least from an extra card.",
    bcards: "<b>Root:</b> Royal Claim and Stand and Deliver! are used in Birdsong.",
    warhorn: "<b>Root:</b> Command Warren gives a free battle at the start of Daylight.",
    punt: "<b>Root:</b> Cobbler gives a free move at the start of Evening.",
    ambush: "<b>Root:</b> an ambush deals two hits before the roll. If it removes every attacking warrior, the battle ends. The attacker can foil it with a matching ambush.",
    foil: "<b>Root:</b> playing a matching ambush cancels the defender's ambush; both cards are discarded.",
    battleEffects: "<b>Root:</b> Armorers (Bulwark Smiths) ignores rolled hits only, not extra hits. Brutal Tactics (Ruthless Charge) gives the defender a point. Sappers (Silt Sappers) is for defenders.",
    hits: "<b>Root:</b> warriors are always removed first. Each enemy building or token removed scores the attacker a point, so choose carefully which cardboard to lose.",
    surgeons: "<b>Root:</b> Field Hospitals. Spending one matching card saves every warrior lost in that clearing at once.",
    unrest: "<b>Root:</b> Outrage. The card goes face down into the Alliance's supporters, fuelling more sympathy and revolts.",
    discard: "<b>Root:</b> the hand limit of five is checked at the end of Evening.",
    covenantTrim: "<b>Root:</b> without a base, the Alliance can hold only five supporters.",
    companyDaylight: "<b>Root:</b> the Marquise crafts first, then takes three actions plus one per bird card spent. Build scores the space you uncover; the third and fifth recruiters add a card in Evening. Wood (clay) must be connected through clearings you rule.",
    synodEdictAdd: "<b>Root:</b> add one or two cards to the Decree, only one of them a bird. Every card stays until the Eyrie fall into turmoil, so every turn the Decree grows. Only add actions you are sure you can complete.",
    synodNewSpire: "<b>Root:</b> A New Roost. With no roosts on the map, the Eyrie return in the clearing with the fewest warriors.",
    synodCraft: "<b>Root:</b> the Eyrie craft with roosts before resolving the Decree. Disdain for Trade means items score only one point unless the Builder rules.",
    synodEdict: "<b>Root:</b> resolve the Decree left to right; within a column, any order. If any card cannot be done, the Eyrie fall into turmoil: lose a point per bird card (Viziers included), discard all but the Viziers, change leader and skip to Evening.",
    synodRegent: "<b>Root:</b> after turmoil the Eyrie choose a leader who has not ruled since the last time all four were used.",
    covenantBirdsong: "<b>Root:</b> Revolt costs two matching supporters and wipes out every enemy piece in a sympathetic clearing. Spread Sympathy costs more as the track fills, plus one under Martial Law.",
    covenantDaylight: "<b>Root:</b> Mobilize (Rally) moves cards to supporters; Train (Appoint) creates officers (wardens), who power the Evening operations.",
    covenantOps: "<b>Root:</b> Military Operations, one per officer. Organize (Kindle) turns a warrior into sympathy and scores the track.",
    wayfarerRefresh: "<b>Root:</b> refresh three items plus two per tea on the track. Ready Waders and Blades are usually most valuable.",
    wayfarerSlip: "<b>Root:</b> Slip is a free move, even into a forest or a clearing with Hostile warriors. End your turn in a forest to repair everything in Evening.",
    wayfarerDaylight: "<b>Root:</b> every Vagabond action costs an item. Aiding the same faction several times in one turn raises your relationship; once Allied, every aid scores two points. Removing a warrior makes that faction Hostile.",
    wayfarerDamage: "<b>Root:</b> effects that remove all enemy pieces damage three of the Vagabond's items instead.",
    wayfarerCapacity: "<b>Root:</b> items beyond six plus two per bag are lost for good. Items on the tracks do not count."
  };

  return { init: init, render: render, showError: showError, cardHTML: cardHTML, describe: describe };
})();
