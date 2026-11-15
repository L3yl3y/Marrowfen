var MAPVIEW = (function () {
  var M = MAPDATA;
  var R = RULES;
  var NS = "http://www.w3.org/2000/svg";
  var RAD = 50;
  var FCOL = { company: "#c8442c", synod: "#e2b23a", covenant: "#3bb8a2", wayfarer: "#a77ee0" };
  var SCOL = { peat: "#b3653a", willow: "#93b44f", tide: "#4f93c4", moon: "#bdb5e6" };
  var ISLE = {};
  M.isles.forEach(function (c) {
    ISLE[c.id] = c;
  });

  var GLYPH = {
    peat: '<path d="M-7 -4h14v9h-14z M-7 -4l3 -4h14l-3 4 M7 5l3 -4v-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    willow: '<path d="M0 8C-7 2 -6 -6 0 -9C6 -6 7 2 0 8z M0 8V-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    tide: '<path d="M-9 -1c3 -4 6 -4 9 0s6 4 9 0 M-9 5c3 -4 6 -4 9 0s6 4 9 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    moon: '<path d="M3 -8a8.5 8.5 0 1 0 5 13a7 7 0 1 1 -5 -13z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
  };
  var FGLYPH = {
    company: '<path d="M-6 3h12l-2 4h-8z M-4 3v-4h8v4 M-7 -1h14v-3h-14z" fill="currentColor"/>',
    synod: '<path d="M0 -8l3 6h-1.5v9h-3v-9h-1.5z M-6 7h12" fill="currentColor" stroke="currentColor" stroke-width="1.2"/>',
    covenant: '<path d="M-4 -6h8l1 2h-10z M-4 -4h8v9h-8z M-2 5h4v2h-4z" fill="currentColor"/><circle cx="0" cy="0.5" r="2" fill="#fff6c2"/>',
    wayfarer: '<circle cx="0" cy="-5" r="2.6" fill="currentColor"/><path d="M-3 -1h6l1 8h-8z M5 -8l-1 15" fill="currentColor" stroke="currentColor" stroke-width="1.2"/>'
  };
  var BGLYPH = {
    claypit: '<path d="M-6 4h12l-2 -7h-8z M-3 -3v-3h6v3" fill="none" stroke="#fff" stroke-width="1.6"/>',
    forge: '<path d="M-6 1h10l2 -3h-12z M-3 1v4h6v-4" fill="#fff"/>',
    barracks: '<path d="M-6 6v-8l6 -4l6 4v8z M-2 6v-4h4v4" fill="none" stroke="#fff" stroke-width="1.6"/>',
    spire: '<path d="M0 -7l3 6h-1v7h-4v-7h-1z" fill="#3a2a05"/>',
    hideout: '<path d="M-6 5l6 -10l6 10z" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="0" cy="2" r="1.6" fill="#fff6c2"/>'
  };

  function el(tag, attrs, html) {
    var parts = ["<" + tag];
    Object.keys(attrs || {}).forEach(function (k) {
      parts.push(" " + k + '="' + String(attrs[k]).replace(/"/g, "&quot;") + '"');
    });
    parts.push(">");
    if (html) {
      parts.push(html);
    }
    parts.push("</" + tag + ">");
    return parts.join("");
  }

  function reedPolygon(r) {
    var cx = 0;
    var cy = 0;
    r.isles.forEach(function (id) {
      cx += ISLE[id].x;
      cy += ISLE[id].y;
    });
    cx = cx / r.isles.length;
    cy = cy / r.isles.length;
    var pts = r.isles.map(function (id) {
      var x = ISLE[id].x;
      var y = ISLE[id].y;
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      var k = Math.max(0.2, (d - 62) / d);
      return [cx + (x - cx) * k, cy + (y - cy) * k];
    });
    var path = "";
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % pts.length];
      var mx = (a[0] + b[0]) / 2;
      var my = (a[1] + b[1]) / 2;
      var pullX = mx + (cx - mx) * 0.18;
      var pullY = my + (cy - my) * 0.18;
      if (i === 0) {
        path += "M" + ((pts[pts.length - 1][0] + a[0]) / 2 + (cx - (pts[pts.length - 1][0] + a[0]) / 2) * 0.18).toFixed(1) + " " + ((pts[pts.length - 1][1] + a[1]) / 2 + (cy - (pts[pts.length - 1][1] + a[1]) / 2) * 0.18).toFixed(1);
      }
      path += " Q" + a[0].toFixed(1) + " " + a[1].toFixed(1) + " " + pullX.toFixed(1) + " " + pullY.toFixed(1);
    }
    return { d: path + " Z", cx: cx, cy: cy };
  }

  function reeds(cx, cy, seed) {
    var out = "";
    var s = seed;
    function rnd() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    }
    for (var i = 0; i < 16; i++) {
      var x = cx + (rnd() - 0.5) * 120;
      var y = cy + (rnd() - 0.5) * 90;
      var h = 10 + rnd() * 12;
      out += '<path d="M' + x.toFixed(1) + " " + y.toFixed(1) + " q" + (rnd() * 4 - 2).toFixed(1) + " " + (-h / 2).toFixed(1) + " " + (rnd() * 6 - 3).toFixed(1) + " " + (-h).toFixed(1) + '" />';
      if (rnd() < 0.35) {
        out += '<ellipse cx="' + (x + 1).toFixed(1) + '" cy="' + (y - h + 2).toFixed(1) + '" rx="1.6" ry="4" class="cattail"/>';
      }
    }
    return out;
  }

  function causeway(a, b) {
    var A = ISLE[a];
    var B = ISLE[b];
    var dx = B.x - A.x;
    var dy = B.y - A.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / len;
    var uy = dy / len;
    var x1 = A.x + ux * (RAD - 6);
    var y1 = A.y + uy * (RAD - 6);
    var x2 = B.x - ux * (RAD - 6);
    var y2 = B.y - uy * (RAD - 6);
    var out = '<line class="cw-base" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    out += '<line class="cw-planks" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    var n = Math.floor((len - 2 * RAD) / 34);
    for (var i = 1; i <= n; i++) {
      var t = (RAD + i * ((len - 2 * RAD) / (n + 1))) / len;
      var px = A.x + dx * t;
      var py = A.y + dy * t;
      out += '<line class="cw-post" x1="' + (px - uy * 9).toFixed(1) + '" y1="' + (py + ux * 9).toFixed(1) + '" x2="' + (px - uy * 12).toFixed(1) + '" y2="' + (py + ux * 12).toFixed(1) + '"/>';
      out += '<line class="cw-post" x1="' + (px + uy * 9).toFixed(1) + '" y1="' + (py - ux * 9).toFixed(1) + '" x2="' + (px + uy * 12).toFixed(1) + '" y2="' + (py - ux * 12).toFixed(1) + '"/>';
    }
    return out;
  }

  function staticLayer() {
    var out = "";
    out += '<defs>';
    out += '<radialGradient id="mf-water" cx="50%" cy="45%" r="75%"><stop offset="0%" stop-color="#29403c"/><stop offset="100%" stop-color="#14211f"/></radialGradient>';
    out += '<radialGradient id="mf-isle" cx="45%" cy="38%" r="70%"><stop offset="0%" stop-color="#8a7350"/><stop offset="100%" stop-color="#5a4730"/></radialGradient>';
    out += '<filter id="mf-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>';
    out += '<pattern id="mf-ripple" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15 q15 -6 30 0 t30 0" fill="none" stroke="#3c5853" stroke-width="1" opacity="0.5"/></pattern>';
    out += '</defs>';
    out += '<rect x="0" y="0" width="' + M.width + '" height="' + M.height + '" fill="url(#mf-water)"/>';
    out += '<rect x="0" y="0" width="' + M.width + '" height="' + M.height + '" fill="url(#mf-ripple)"/>';
    M.reedbeds.forEach(function (r, i) {
      var poly = reedPolygon(r);
      out += '<g class="reed" data-cid="' + r.id + '">';
      out += '<path class="reed-bed" d="' + poly.d + '"/>';
      out += '<g class="reed-stalks">' + reeds(poly.cx, poly.cy, i * 97 + 13) + '</g>';
      out += '<text class="reed-name" x="' + poly.cx.toFixed(1) + '" y="' + (poly.cy + 4).toFixed(1) + '">' + r.name + '</text>';
      out += '</g>';
    });
    M.edges.forEach(function (e) {
      out += causeway(e[0], e[1]);
    });
    M.isles.forEach(function (c) {
      out += '<g class="isle-base" data-cid="' + c.id + '">';
      out += '<circle cx="' + c.x + '" cy="' + (c.y + 6) + '" r="' + (RAD + 4) + '" fill="#0b1413" opacity="0.45" filter="url(#mf-soft)"/>';
      out += '<circle class="isle-disc" cx="' + c.x + '" cy="' + c.y + '" r="' + RAD + '" fill="url(#mf-isle)" stroke="' + SCOL[c.suit] + '" stroke-width="6"/>';
      out += '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (RAD - 9) + '" fill="none" stroke="#3a2c1c" stroke-width="1" opacity="0.5"/>';
      out += '<g transform="translate(' + (c.x - RAD + 9) + "," + (c.y - RAD + 9) + ')" color="' + SCOL[c.suit] + '"><circle r="11" fill="#1d1710" stroke="' + SCOL[c.suit] + '" stroke-width="1.5"/>' + GLYPH[c.suit] + '</g>';
      out += '<text class="isle-name" x="' + c.x + '" y="' + (c.y + RAD + 19) + '">' + c.name + '</text>';
      out += '</g>';
    });
    return out;
  }

  var STATIC = null;

  function slotPos(c, i, n) {
    var w = 24;
    var gap = 4;
    var total = n * w + (n - 1) * gap;
    return { x: c.x - total / 2 + i * (w + gap), y: c.y - 24, w: w };
  }

  function dynamicLayer(state, opts) {
    var out = "";
    var pick = opts.pick || [];
    var picked = opts.picked || [];
    M.reedbeds.forEach(function (r) {
      if (pick.indexOf(r.id) >= 0) {
        var poly = reedPolygon(r);
        out += '<path class="pick-reed" data-cid="' + r.id + '" d="' + poly.d + '"/>';
      }
    });
    M.isles.forEach(function (c) {
      var m = state.map[c.id];
      var cls = "isle-top";
      if (pick.indexOf(c.id) >= 0) {
        cls += " pickable";
      }
      if (picked.indexOf(c.id) >= 0) {
        cls += " picked";
      }
      if (state.lastBattle && state.lastBattle.cid === c.id && opts.flash) {
        cls += " battled";
      }
      out += '<g class="' + cls + '" data-cid="' + c.id + '">';
      out += '<circle class="hit" cx="' + c.x + '" cy="' + c.y + '" r="' + (RAD + 8) + '"/>';
      var n = c.slots;
      var filled = [];
      if (m.ruin) {
        filled.push({ ruin: true });
      }
      m.b.forEach(function (b) {
        filled.push(b);
      });
      for (var i = 0; i < n; i++) {
        var p = slotPos(c, i, n);
        var item = filled[i];
        if (!item) {
          out += '<rect class="slot" x="' + p.x.toFixed(1) + '" y="' + p.y + '" width="' + p.w + '" height="' + p.w + '" rx="3"/>';
        } else if (item.ruin) {
          out += '<g><rect class="barrow" x="' + p.x.toFixed(1) + '" y="' + p.y + '" width="' + p.w + '" height="' + p.w + '" rx="3"/><path d="M' + (p.x + 5).toFixed(1) + " " + (p.y + 19) + " q7 -16 14 0" + '" fill="none" stroke="#d8cfb8" stroke-width="2"/><title>Barrow (unexplored ruin)</title></g>';
        } else {
          var col = FCOL[item.f];
          out += '<g transform="translate(' + (p.x + p.w / 2).toFixed(1) + "," + (p.y + p.w / 2) + ')"><rect x="-12" y="-12" width="24" height="24" rx="3" fill="' + col + '" stroke="#1a120a" stroke-width="1.5"/>' + BGLYPH[item.t] + '<title>' + R.FACTION_SHORT[item.f] + " " + R.BUILDING_NAME[item.t] + '</title></g>';
        }
      }
      var toks = m.tok;
      toks.forEach(function (t, k) {
        var tx = c.x - (toks.length - 1) * 9 + k * 18;
        var ty = c.y + 16;
        if (t.t === "clay") {
          out += '<g><circle cx="' + tx + '" cy="' + ty + '" r="8" fill="#a5643a" stroke="#2a1608" stroke-width="1.5"/><rect x="' + (tx - 4) + '" y="' + (ty - 3) + '" width="8" height="6" fill="#d39a6a"/><title>Clay</title></g>';
        } else if (t.t === "lantern") {
          out += '<g><circle cx="' + tx + '" cy="' + ty + '" r="8.5" fill="#1d4a42" stroke="' + FCOL.covenant + '" stroke-width="2"/><circle cx="' + tx + '" cy="' + ty + '" r="3.5" fill="#ffe28a"/><title>Lantern</title></g>';
        } else {
          out += '<g><circle cx="' + tx + '" cy="' + ty + '" r="9.5" fill="' + FCOL.company + '" stroke="#2a0a04" stroke-width="1.5"/><path d="M' + (tx - 5) + " " + (ty + 5) + "v-8h2v2h2v-2h2v2h2v-2h2v8z" + '" fill="#fff"/><title>The Citadel</title></g>';
        }
      });
      var facs = ["company", "synod", "covenant"].filter(function (f) {
        return m.w[f] > 0;
      });
      var spots = [[-RAD - 6, 6], [RAD + 6, 6], [0, RAD + 2]];
      if (facs.length === 1) {
        spots = [[RAD + 4, -10]];
      }
      facs.forEach(function (f, k) {
        var sp = spots[k];
        var x = c.x + sp[0];
        var y = c.y + sp[1];
        var wword = " warriors";
        if (m.w[f] === 1) {
          wword = " warrior";
        }
        out += '<g class="warband" transform="translate(' + x.toFixed(1) + "," + y.toFixed(1) + ')" color="' + FCOL[f] + '"><rect x="-19" y="-12" width="38" height="24" rx="12" fill="#14100b" stroke="' + FCOL[f] + '" stroke-width="2.5"/><g transform="translate(-8,0) scale(0.9)">' + FGLYPH[f] + '</g><text x="7" y="5" class="wb-n">' + m.w[f] + '</text><title>' + m.w[f] + " " + R.FACTION_SHORT[f] + wword + '</title></g>';
      });
      out += '</g>';
    });
    if (state.fac && state.fac.wayfarer && state.fac.wayfarer.loc) {
      var loc = state.fac.wayfarer.loc;
      var px = 0;
      var py = 0;
      if (ISLE[loc]) {
        px = ISLE[loc].x + 30;
        py = ISLE[loc].y - RAD + 2;
      } else {
        M.reedbeds.forEach(function (r) {
          if (r.id === loc) {
            var poly = reedPolygon(r);
            px = poly.cx;
            py = poly.cy - 14;
          }
        });
      }
      out += '<g class="pawn" transform="translate(' + px.toFixed(1) + "," + py.toFixed(1) + ')"><ellipse cx="0" cy="16" rx="11" ry="4" fill="#000" opacity="0.4"/><path d="M0 -14a6 6 0 1 1 0.01 0z M-8 14c0 -10 3 -16 8 -16s8 6 8 16z" fill="' + FCOL.wayfarer + '" stroke="#1d0f33" stroke-width="2"/><title>The Wayfarer</title></g>';
    }
    return out;
  }

  function render(svg, state, opts) {
    if (!STATIC) {
      STATIC = staticLayer();
    }
    svg.setAttribute("viewBox", "0 0 " + M.width + " " + M.height);
    svg.innerHTML = STATIC + '<g class="dyn">' + dynamicLayer(state, opts || {}) + "</g>";
  }

  function bind(svg, onClick) {
    svg.addEventListener("click", function (ev) {
      var node = ev.target;
      while (node && node !== svg) {
        if (node.getAttribute && node.getAttribute("data-cid")) {
          onClick(node.getAttribute("data-cid"));
          return;
        }
        node = node.parentNode;
      }
    });
  }

  return { render: render, bind: bind, FCOL: FCOL, SCOL: SCOL, GLYPH: GLYPH, FGLYPH: FGLYPH, BGLYPH: BGLYPH };
})();
