var APP = (function () {
  var R = RULES;
  var SAVE_KEY = "marrowfen-save-v1";
  var PREF_KEY = "marrowfen-prefs-v1";
  var CLIENT_KEY = "marrowfen-client-v1";
  var SEAT_LABEL = { off: "Not playing", me: "Me", remote: "Friend online", local: "Same device", bot: "Bot" };
  var BLURB = {
    company: "Builders and occupiers. Score by building claypits, forges and barracks, fuelled by clay.",
    synod: "Bound by a growing Edict. Score for spires each Evening, but collapse if the Edict fails.",
    covenant: "A secret movement. Light lanterns, win followers and rise up in sudden uprisings.",
    wayfarer: "A lone traveller with no army. Explore barrows, run errands and aid or betray everyone."
  };

  var game = null;
  var role = "none";
  var seats = {};
  var myFaction = null;
  var net = null;
  var roomCode = null;
  var connected = {};
  var guestView = null;
  var botTimer = null;
  var prefs = { learning: true, speed: "normal" };
  var shownViewer = null;
  var curtainFor = null;
  var lobbySeats = { company: "me", synod: "bot", covenant: "bot", wayfarer: "bot" };
  var metaSeq = 0;
  var clientId = null;

  function el(id) {
    return document.getElementById(id);
  }

  function readStore(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      return null;
    }
    return null;
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  function clearStore(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      return false;
    }
    return true;
  }

  function getClientId() {
    if (clientId) {
      return clientId;
    }
    var saved = readStore(CLIENT_KEY);
    if (saved && saved.id) {
      clientId = saved.id;
    } else {
      clientId = "c" + Math.random().toString(36).slice(2, 10);
      writeStore(CLIENT_KEY, { id: clientId });
    }
    return clientId;
  }

  function seatKinds() {
    var out = {};
    Object.keys(seats).forEach(function (f) {
      out[f] = seats[f];
    });
    return out;
  }

  function controlled() {
    if (role === "guest") {
      if (myFaction) {
        return [myFaction];
      }
      return [];
    }
    return Object.keys(seats).filter(function (f) {
      return seats[f] === "me" || seats[f] === "local";
    });
  }

  function humansHere() {
    return controlled().length;
  }

  function currentView() {
    if (role === "guest") {
      return guestView;
    }
    if (!game) {
      return null;
    }
    return E.visibleState(game, shownViewer);
  }

  function chooseViewer() {
    if (role === "guest") {
      return myFaction;
    }
    var ctl = controlled();
    var p = game.pending;
    if (p && ctl.indexOf(p.fac) >= 0) {
      return p.fac;
    }
    if (shownViewer && ctl.indexOf(shownViewer) >= 0) {
      return shownViewer;
    }
    var me = Object.keys(seats).filter(function (f) {
      return seats[f] === "me";
    });
    if (me.length > 0) {
      return me[0];
    }
    if (ctl.length > 0) {
      return ctl[0];
    }
    return null;
  }

  function refresh() {
    if (role === "none") {
      return;
    }
    if (role === "host") {
      var viewer = chooseViewer();
      if (viewer !== shownViewer && humansHere() >= 2 && viewer && !game.winner) {
        curtainFor = viewer;
        shownViewer = viewer;
        showCurtain(viewer);
        return;
      }
      shownViewer = viewer;
    }
    if (curtainFor) {
      return;
    }
    var v = currentView();
    if (!v) {
      return;
    }
    var canAct = false;
    if (v.pending && !v.pending.hidden) {
      canAct = controlled().indexOf(v.pending.fac) >= 0 && v.pending.fac === shownViewer;
      if (role === "guest") {
        canAct = v.pending.fac === myFaction;
      }
    }
    var kinds = seatKinds();
    if (role === "guest" && v.meta) {
      kinds = v.meta.seats;
    }
    var conn = connected;
    if (role === "guest" && v.meta) {
      conn = v.meta.connected;
    }
    UI.render(v, { viewer: shownViewer, canAct: canAct, learning: prefs.learning, seatKind: kinds, roomCode: roomCode, connected: conn });
  }

  function showCurtain(f) {
    el("curtain").hidden = false;
    el("curtain-title").textContent = "Pass The Device To " + R.FACTION_NAME[f];
    el("curtain-text").textContent = "Only the " + R.FACTION_SHORT[f] + " player should look at the screen now. Their hand and decisions are shown next.";
  }

  function hideCurtain() {
    el("curtain").hidden = true;
    curtainFor = null;
    refresh();
  }

  function save() {
    if (role !== "host" || !game) {
      return;
    }
    if (game.winner) {
      clearStore(SAVE_KEY);
      return;
    }
    writeStore(SAVE_KEY, { game: game, seats: seats, roomCode: roomCode, savedAt: Date.now() });
  }

  function botDelay() {
    if (prefs.speed === "instant") {
      return 5;
    }
    if (prefs.speed === "slow") {
      return 1600;
    }
    if (prefs.speed === "fast") {
      return 220;
    }
    return 750;
  }

  function scheduleBot() {
    clearTimeout(botTimer);
    if (role !== "host" || !game || game.winner || !game.pending) {
      return;
    }
    var f = game.pending.fac;
    if (seats[f] !== "bot") {
      return;
    }
    botTimer = setTimeout(function () {
      if (!game || game.winner || !game.pending || game.pending.fac !== f) {
        return;
      }
      var a = null;
      try {
        a = BOT.act(game, f, Math.random);
      } catch (e) {
        a = null;
      }
      var res = { ok: false };
      if (a) {
        res = E.applyAction(game, f, a);
      }
      if (!res.ok) {
        var fb = fallbackAction(game.pending);
        if (fb) {
          E.applyAction(game, f, fb);
        }
      }
      after();
    }, botDelay());
  }

  function fallbackAction(p) {
    var simple = { companyDaylight: { type: "end" }, synodCraft: { type: "done" }, covenantDaylight: { type: "end" }, covenantOps: { type: "done" }, covenantBirdsong: { type: "done" }, wayfarerDaylight: { type: "end" }, wayfarerSlip: { type: "stay" }, ambush: { type: "skip" }, foil: { type: "skip" }, surgeons: { type: "skip" }, warhorn: { type: "skip" }, punt: { type: "skip" }, bcards: { type: "done" }, battleEffects: { use: [] }, synodEdict: { type: "collapse" } };
    if (simple[p.kind]) {
      var a = Object.assign({}, simple[p.kind]);
      a.pid = p.id;
      return a;
    }
    return null;
  }

  function after() {
    save();
    metaSeq++;
    broadcast();
    refresh();
    scheduleBot();
  }

  function stateFor(f) {
    var v = E.visibleState(game, f);
    v.meta = { seats: seatKinds(), connected: connected, code: roomCode };
    return { v: game.v + "-" + metaSeq, view: v };
  }

  function broadcast() {
    if (net && role === "host") {
      net.broadcast(stateFor);
    }
  }

  function submit(action) {
    if (role === "guest") {
      if (!net) {
        return { ok: false, error: "Not connected." };
      }
      net.send(myFaction, action);
      return { ok: true };
    }
    if (!game || !game.pending) {
      return { ok: false, error: "Nothing to decide." };
    }
    var f = game.pending.fac;
    if (controlled().indexOf(f) < 0) {
      return { ok: false, error: "That decision belongs to someone else." };
    }
    var res = E.applyAction(game, f, action);
    if (res.ok) {
      after();
    }
    return res;
  }

  function suggest() {
    var src;
    var f;
    if (role === "host") {
      if (!game.pending) {
        return null;
      }
      src = E.clone(game);
      f = game.pending.fac;
    } else {
      if (!guestView || !guestView.pending) {
        return null;
      }
      src = E.clone(guestView);
      f = myFaction;
      Object.keys(src.map).forEach(function (cid) {
        var n = src.map[cid].barrowCount || 0;
        src.map[cid].barrow = [];
        for (var i = 0; i < n; i++) {
          src.map[cid].barrow.push("waders");
        }
      });
    }
    try {
      return BOT.act(src, f, Math.random);
    } catch (e) {
      return null;
    }
  }

  function startHost(newGame, savedSeats, code) {
    role = "host";
    game = newGame;
    seats = savedSeats;
    connected = {};
    shownViewer = null;
    curtainFor = null;
    roomCode = null;
    var needsNet = Object.keys(seats).some(function (f) {
      return seats[f] === "remote";
    });
    showTable();
    if (needsNet) {
      if (!NET.available()) {
        UI.showError("Online play needs an internet connection to load the connection library. Reload the page and try again.");
      } else {
        roomCode = code || NET.makeCode();
        openRoom(roomCode);
      }
    }
    after();
  }

  function openRoom(code) {
    net = NET.peerHost(code, {
      onStatus: function (s, detail) {
        if (s === "error" && detail === "unavailable-id") {
          UI.showError("That room code is busy. Leave and start again for a new code.");
        }
        refresh();
      },
      onJoin: function (client, want) {
        var remote = Object.keys(seats).filter(function (f) {
          return seats[f] === "remote";
        });
        var claims = (game.claims = game.claims || {});
        var mine = null;
        remote.forEach(function (f) {
          if (claims[f] === client) {
            mine = f;
          }
        });
        if (!mine && want && remote.indexOf(want) >= 0 && (!claims[want] || !connected[want])) {
          mine = want;
        }
        if (!mine) {
          remote.forEach(function (f) {
            if (!mine && (!claims[f] || !connected[f])) {
              mine = f;
            }
          });
        }
        if (mine) {
          claims[mine] = client;
          connected[mine] = true;
        }
        return mine;
      },
      onChange: function () {
        after();
      },
      onLeave: function (client) {
        Object.keys(game.claims || {}).forEach(function (f) {
          if (game.claims[f] === client) {
            connected[f] = false;
          }
        });
        after();
      },
      currentVersion: function () {
        return game.v + "-" + metaSeq;
      },
      stateFor: stateFor,
      onAction: function (f, action) {
        if (!game.pending || game.pending.fac !== f) {
          return { ok: false, error: "It is not your decision right now." };
        }
        var res = E.applyAction(game, f, action);
        if (res.ok) {
          after();
        }
        return res;
      }
    });
  }

  function joinGame(code) {
    if (!NET.available()) {
      el("join-status").textContent = "Online play needs an internet connection to load the connection library.";
      return;
    }
    role = "guest";
    roomCode = code;
    el("join-status").textContent = "Connecting to " + code + "...";
    net = NET.peerGuest(code, getClientId(), null, {
      onStatus: function (s) {
        if (s === "connected") {
          el("join-status").textContent = "Connected. Waiting for the host...";
        } else if (s === "closed") {
          UI.showError("The connection to the host closed. It will keep trying while this page is open; you can also rejoin with the same code.");
        }
      },
      onWelcome: function (f) {
        myFaction = f;
        shownViewer = f;
      },
      onState: function (obj) {
        guestView = obj.view;
        if (el("table").hidden) {
          showTable();
        }
        refresh();
      },
      onError: function (msg) {
        if (el("table").hidden) {
          el("join-status").textContent = msg;
          role = "none";
        } else {
          UI.showError(msg);
        }
      }
    });
  }

  function showTable() {
    el("lobby").hidden = true;
    el("table").hidden = false;
    el("menu-btn").hidden = false;
  }

  function leave() {
    clearTimeout(botTimer);
    if (net) {
      net.close();
      net = null;
    }
    role = "none";
    game = null;
    guestView = null;
    myFaction = null;
    roomCode = null;
    curtainFor = null;
    el("curtain").hidden = true;
    el("table").hidden = true;
    el("lobby").hidden = false;
    el("menu-btn").hidden = true;
    el("status").textContent = "Choose your factions to begin.";
    renderLobby();
  }

  function renderSeats() {
    var out = "";
    R.FACTIONS.forEach(function (f) {
      var opts = "";
      Object.keys(SEAT_LABEL).forEach(function (k) {
        var sel = "";
        if (lobbySeats[f] === k) {
          sel = " selected";
        }
        opts += '<option value="' + k + '"' + sel + ">" + SEAT_LABEL[k] + "</option>";
      });
      out += '<div class="seat"><h4><span class="fdot bg-' + f + '"></span><span class="f-' + f + '">' + R.FACTION_NAME[f] + "</span></h4><p>" + BLURB[f] + '</p><select id="seat-' + f + '" data-seat="' + f + '">' + opts + "</select></div>";
    });
    el("seats").innerHTML = out;
    R.FACTIONS.forEach(function (f) {
      el("seat-" + f).addEventListener("change", function (ev) {
        var v = ev.target.value;
        if (v === "me") {
          R.FACTIONS.forEach(function (o) {
            if (o !== f && lobbySeats[o] === "me") {
              lobbySeats[o] = "local";
            }
          });
        }
        lobbySeats[f] = v;
        renderSeats();
        validateSeats();
      });
    });
  }

  function validateSeats() {
    var playing = R.FACTIONS.filter(function (f) {
      return lobbySeats[f] !== "off";
    });
    var msg = "";
    if (playing.length < 2) {
      msg = "Choose at least two factions.";
    }
    el("seat-warn").textContent = msg;
    var reachNote = "";
    if (playing.length >= 2) {
      var reach = 0;
      playing.forEach(function (f) {
        reach += R.REACH[f];
      });
      var need = R.REACH_NEEDED[playing.length];
      reachNote = "Reach " + reach + " (" + playing.length + " players need " + need + " or more for an even game).";
      if (reach < need) {
        reachNote += " This line-up is likely to be lopsided; see How To Play.";
      }
    }
    el("reach-note").textContent = reachNote;
    return msg === "";
  }

  function renderLobby() {
    renderSeats();
    validateSeats();
    var empty = { map: {}, fac: {} };
    E.ISLE_IDS.forEach(function (cid) {
      empty.map[cid] = { w: {}, b: [], tok: [], ruin: E.ISLE[cid].ruin, barrow: [] };
    });
    MAPVIEW.render(el("lobby-map"), empty, {});
    var saved = readStore(SAVE_KEY);
    if (saved && saved.game && !saved.game.winner) {
      el("resume-panel").hidden = false;
      var facs = saved.game.order.map(function (f) {
        return R.FACTION_SHORT[f] + " (" + SEAT_LABEL[saved.seats[f]] + ")";
      }).join(", ");
      el("resume-text").textContent = "Round " + saved.game.round + ": " + facs + ". Saved " + new Date(saved.savedAt).toLocaleString() + ".";
    } else {
      el("resume-panel").hidden = true;
    }
  }

  function startFromLobby() {
    if (!validateSeats()) {
      return;
    }
    var facs = R.FACTIONS.filter(function (f) {
      return lobbySeats[f] !== "off";
    });
    var s = {};
    facs.forEach(function (f) {
      s[f] = lobbySeats[f];
    });
    prefs.speed = el("opt-speed").value;
    prefs.learning = el("opt-learn").value === "on";
    writeStore(PREF_KEY, { prefs: prefs, seats: lobbySeats });
    updateLearnButton();
    var seed = Math.floor(Math.random() * 2147483647);
    var g = E.createGame({ seed: seed, factions: facs });
    startHost(g, s, null);
  }

  function setLearnSelect() {
    var lv = "off";
    if (prefs.learning) {
      lv = "on";
    }
    el("opt-learn").value = lv;
  }

  function updateLearnButton() {
    var label = "Off";
    if (prefs.learning) {
      label = "On";
    }
    el("learn-toggle").textContent = "Learning Notes: " + label;
  }

  function onAct(key) {
    if (key === "help") {
      el("help").hidden = false;
    } else if (key === "closeHelp") {
      el("help").hidden = true;
    } else if (key === "learn") {
      prefs.learning = !prefs.learning;
      setLearnSelect();
      writeStore(PREF_KEY, { prefs: prefs, seats: lobbySeats });
      updateLearnButton();
      refresh();
    } else if (key === "menu") {
      var b = el("menu-btn");
      if (b.dataset.armed === "1") {
        b.dataset.armed = "";
        b.textContent = "Leave Game";
        leave();
      } else {
        b.dataset.armed = "1";
        b.textContent = "Click Again To Leave";
        setTimeout(function () {
          b.dataset.armed = "";
          b.textContent = "Leave Game";
        }, 3000);
      }
    } else if (key === "start") {
      startFromLobby();
    } else if (key === "join") {
      var code = NET.cleanCode(el("join-code").value);
      if (code.length !== 4) {
        el("join-status").textContent = "Room codes have four letters.";
        return;
      }
      joinGame(code);
    } else if (key === "resume") {
      var saved = readStore(SAVE_KEY);
      if (saved && saved.game) {
        prefs.speed = el("opt-speed").value;
        startHost(saved.game, saved.seats, saved.roomCode);
      }
    } else if (key === "discardSave") {
      clearStore(SAVE_KEY);
      renderLobby();
    }
  }

  function boot() {
    var stored = readStore(PREF_KEY);
    if (stored && stored.prefs) {
      prefs = Object.assign(prefs, stored.prefs);
      if (stored.seats) {
        lobbySeats = Object.assign(lobbySeats, stored.seats);
      }
    }
    el("opt-speed").value = prefs.speed;
    setLearnSelect();
    updateLearnButton();
    UI.init({ submit: submit, suggest: suggest, onAct: onAct, newGame: leave });
    el("curtain-btn").addEventListener("click", hideCurtain);
    el("opt-speed").addEventListener("change", function () {
      prefs.speed = el("opt-speed").value;
    });
    renderLobby();
    var params = new URLSearchParams(window.location.search);
    if (params.get("speed") === "instant") {
      prefs.speed = "instant";
      var o = document.createElement("option");
      o.value = "instant";
      o.textContent = "Instant";
      el("opt-speed").appendChild(o);
      el("opt-speed").value = "instant";
    }
    var join = params.get("join");
    if (join) {
      el("join-code").value = NET.cleanCode(join);
    }
  }

  return { boot: boot, debug: function () {
    return { game: game, seats: seats, role: role, myFaction: myFaction, roomCode: roomCode, view: guestView, viewer: shownViewer, submit: submit };
  } };
})();
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", APP.boot);
  } else {
    APP.boot();
  }
}
