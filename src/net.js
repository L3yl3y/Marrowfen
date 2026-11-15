var NET = (function () {
  var LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";

  function makeCode() {
    var code = "";
    for (var i = 0; i < 4; i++) {
      code += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
    }
    return code;
  }

  function cleanCode(text) {
    return String(text || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  }

  function available() {
    return typeof Peer !== "undefined";
  }

  function roomId(code) {
    return "marrowfen-room-" + code.toLowerCase();
  }

  var CHUNK = 12000;
  var sendSeq = 0;

  function sendState(conn, state) {
    var text = JSON.stringify(state);
    sendSeq++;
    var parts = Math.max(1, Math.ceil(text.length / CHUNK));
    for (var i = 0; i < parts; i++) {
      conn.send({ type: "chunk", id: sendSeq, i: i, n: parts, data: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
  }

  function makeAssembler(onComplete) {
    var buffers = {};
    var lastId = 0;
    return function (msg) {
      if (msg.id <= lastId) {
        return;
      }
      if (!buffers[msg.id]) {
        buffers[msg.id] = { n: msg.n, parts: [], got: 0 };
      }
      var buf = buffers[msg.id];
      if (buf.parts[msg.i] === undefined) {
        buf.parts[msg.i] = msg.data;
        buf.got++;
      }
      if (buf.got === buf.n) {
        lastId = msg.id;
        Object.keys(buffers).forEach(function (k) {
          if (Number(k) <= lastId) {
            delete buffers[k];
          }
        });
        var state = null;
        try {
          state = JSON.parse(buf.parts.join(""));
        } catch (e) {
          state = null;
        }
        if (state) {
          onComplete(state);
        }
      }
    };
  }

  function peerHost(code, handlers) {
    var peer = new Peer(roomId(code), { debug: 0 });
    var conns = {};
    var closed = false;
    peer.on("open", function () {
      handlers.onStatus("open");
    });
    peer.on("error", function (err) {
      handlers.onStatus("error", err && err.type);
    });
    peer.on("disconnected", function () {
      if (!closed) {
        try {
          peer.reconnect();
        } catch (e) {
          handlers.onStatus("error", "disconnected");
        }
      }
    });
    peer.on("connection", function (conn) {
      var client = null;
      conn.on("data", function (msg) {
        if (!msg || typeof msg !== "object") {
          return;
        }
        if (msg.type === "hello") {
          client = String(msg.client || "").slice(0, 40);
          var house = handlers.onJoin(client, msg.want);
          conns[client] = { conn: conn, house: house };
          if (house) {
            conn.send({ type: "welcome", house: house });
            handlers.onChange();
          } else {
            conn.send({ type: "full" });
          }
        } else if (msg.type === "ping") {
          var known = conns[client];
          if (known && known.house && handlers.currentVersion() !== msg.v) {
            sendState(conn, handlers.stateFor(known.house));
          }
        } else if (msg.type === "action") {
          var info = conns[client];
          if (!info || !info.house || info.house !== msg.house) {
            conn.send({ type: "error", message: "That seat is not yours." });
            return;
          }
          var result = handlers.onAction(info.house, msg.action, client);
          if (result && !result.ok) {
            conn.send({ type: "error", message: result.error });
          }
        }
      });
      conn.on("close", function () {
        if (client && conns[client] && conns[client].conn === conn) {
          delete conns[client];
          handlers.onLeave(client);
        }
      });
    });
    return {
      kind: "peer",
      code: code,
      broadcast: function (stateFor) {
        Object.keys(conns).forEach(function (c) {
          var info = conns[c];
          if (info.conn.open && info.house) {
            try {
              sendState(info.conn, stateFor(info.house));
            } catch (e) {
              handlers.onStatus("error", "send");
            }
          }
        });
      },
      connected: function () {
        var list = {};
        Object.keys(conns).forEach(function (c) {
          if (conns[c].conn.open && conns[c].house) {
            list[conns[c].house] = true;
          }
        });
        return list;
      },
      close: function () {
        closed = true;
        peer.destroy();
      }
    };
  }

  function peerGuest(code, client, want, handlers) {
    var peer = new Peer({ debug: 0 });
    var conn = null;
    var closed = false;
    var version = -1;
    var assemble = makeAssembler(function (state) {
      version = state.v;
      handlers.onState(state);
    });
    var pinger = setInterval(function () {
      if (conn && conn.open) {
        conn.send({ type: "ping", v: version });
      }
    }, 3000);
    peer.on("open", function () {
      conn = peer.connect(roomId(code), { reliable: true, serialization: "json" });
      conn.on("open", function () {
        handlers.onStatus("connected");
        conn.send({ type: "hello", client: client, want: want });
      });
      conn.on("data", function (msg) {
        if (!msg || typeof msg !== "object") {
          return;
        }
        if (msg.type === "welcome") {
          handlers.onWelcome(msg.house);
        } else if (msg.type === "chunk") {
          assemble(msg);
        } else if (msg.type === "error") {
          handlers.onError(msg.message);
        } else if (msg.type === "full") {
          handlers.onError("Every seat in that game is already taken.");
        }
      });
      conn.on("close", function () {
        if (!closed) {
          handlers.onStatus("closed");
        }
      });
    });
    peer.on("error", function (err) {
      var type = err && err.type;
      if (type === "peer-unavailable") {
        handlers.onError("No game was found with code " + code + ". Check the code, and check that the host still has the game open.");
      } else {
        handlers.onError("Connection problem (" + type + "). Try joining again.");
      }
    });
    return {
      kind: "peer",
      send: function (house, action) {
        if (conn && conn.open) {
          conn.send({ type: "action", client: client, house: house, action: action });
          return true;
        }
        handlers.onError("Not connected to the host.");
        return false;
      },
      close: function () {
        closed = true;
        clearInterval(pinger);
        peer.destroy();
      }
    };
  }


  return {
    makeCode: makeCode,
    cleanCode: cleanCode,
    available: available,
    peerHost: peerHost,
    peerGuest: peerGuest
  };
})();
