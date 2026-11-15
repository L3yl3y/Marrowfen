const fs = require("fs");
const path = require("path");

const W = 1000;
const H = 760;

const isles = [
  { id: "gallowmere", name: "Gallowmere", x: 112, y: 112, slots: 2, corner: true },
  { id: "saltings", name: "Saltings", x: 402, y: 88, slots: 2, ruin: true },
  { id: "rushford", name: "Rushford", x: 690, y: 132, slots: 2 },
  { id: "staithe", name: "Staithe", x: 902, y: 108, slots: 2, corner: true },
  { id: "tollhithe", name: "Tollhithe", x: 96, y: 398, slots: 2, ruin: true },
  { id: "fenhollow", name: "Fenhollow", x: 346, y: 332, slots: 3 },
  { id: "mirelight", name: "Mirelight", x: 622, y: 366, slots: 3 },
  { id: "brackwater", name: "Brackwater", x: 902, y: 420, slots: 2, ruin: true },
  { id: "sedgewick", name: "Sedgewick", x: 116, y: 658, slots: 2, corner: true },
  { id: "lowmarket", name: "Lowmarket", x: 372, y: 640, slots: 2 },
  { id: "oxbow", name: "Oxbow", x: 652, y: 652, slots: 2, ruin: true },
  { id: "drownmere", name: "Drownmere", x: 896, y: 664, slots: 2, corner: true }
];

const edges = [
  ["gallowmere", "saltings"], ["saltings", "rushford"], ["rushford", "staithe"], ["staithe", "brackwater"],
  ["brackwater", "drownmere"], ["drownmere", "oxbow"], ["oxbow", "lowmarket"], ["lowmarket", "sedgewick"],
  ["sedgewick", "tollhithe"], ["tollhithe", "gallowmere"],
  ["gallowmere", "fenhollow"], ["tollhithe", "fenhollow"], ["saltings", "fenhollow"], ["rushford", "mirelight"],
  ["fenhollow", "mirelight"], ["fenhollow", "lowmarket"], ["mirelight", "oxbow"], ["mirelight", "brackwater"],
  ["drownmere", "mirelight"]
];

const reedNames = ["Whisperreed", "Blackrush", "Sallow Thicket", "Cattail Marsh", "Bulrush Deep", "Hollow Reeds", "Mossbank", "Thornsedge", "Mistfen", "Lowreed"];

const byId = {};
isles.forEach(c => {
  byId[c.id] = c;
});

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

for (let i = 0; i < edges.length; i++) {
  for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i];
    const b = edges[j];
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) {
      continue;
    }
    if (segmentsCross(byId[a[0]], byId[a[1]], byId[b[0]], byId[b[1]])) {
      throw new Error("edges cross: " + a.join("-") + " and " + b.join("-"));
    }
  }
}

const adj = {};
isles.forEach(c => {
  adj[c.id] = [];
});
edges.forEach(e => {
  adj[e[0]].push(e[1]);
  adj[e[1]].push(e[0]);
});

function angle(from, to) {
  return Math.atan2(byId[to].y - byId[from].y, byId[to].x - byId[from].x);
}

const sorted = {};
isles.forEach(c => {
  sorted[c.id] = adj[c.id].slice().sort((p, q) => angle(c.id, p) - angle(c.id, q));
});

const used = {};
const faces = [];
edges.forEach(e => {
  [[e[0], e[1]], [e[1], e[0]]].forEach(start => {
    const key = start[0] + ">" + start[1];
    if (used[key]) {
      return;
    }
    const cycle = [];
    let u = start[0];
    let v = start[1];
    while (!used[u + ">" + v]) {
      used[u + ">" + v] = true;
      cycle.push(u);
      const list = sorted[v];
      const idx = list.indexOf(u);
      const next = list[(idx - 1 + list.length) % list.length];
      u = v;
      v = next;
    }
    faces.push(cycle);
  });
});

function signedArea(cycle) {
  let s = 0;
  for (let i = 0; i < cycle.length; i++) {
    const a = byId[cycle[i]];
    const b = byId[cycle[(i + 1) % cycle.length]];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

let outer = 0;
faces.forEach((f, i) => {
  if (Math.abs(signedArea(f)) > Math.abs(signedArea(faces[outer]))) {
    outer = i;
  }
});
const inner = faces.filter((f, i) => i !== outer);
if (isles.length - edges.length + faces.length !== 2) {
  throw new Error("Euler check failed");
}

const reedbeds = inner.map((cycle, i) => {
  let cx = 0;
  let cy = 0;
  cycle.forEach(id => {
    cx += byId[id].x;
    cy += byId[id].y;
  });
  cx = cx / cycle.length;
  cy = cy / cycle.length;
  return { id: "r" + (i + 1), name: reedNames[i], isles: cycle.slice(), x: Math.round(cx), y: Math.round(cy) };
});

function faceEdges(cycle) {
  const list = [];
  for (let i = 0; i < cycle.length; i++) {
    const a = cycle[i];
    const b = cycle[(i + 1) % cycle.length];
    if (a < b) {
      list.push(a + "|" + b);
    } else {
      list.push(b + "|" + a);
    }
  }
  return list;
}

reedbeds.forEach(r => {
  r.adjReeds = [];
  const mine = faceEdges(r.isles);
  reedbeds.forEach(o => {
    if (o.id === r.id) {
      return;
    }
    const theirs = faceEdges(o.isles);
    if (mine.some(e => theirs.indexOf(e) >= 0)) {
      r.adjReeds.push(o.id);
    }
  });
});

const suits = ["peat", "willow", "tide"];
let best = null;
const ids = isles.map(c => c.id);
const corners = isles.filter(c => c.corner).map(c => c.id);
const opposite = { gallowmere: "drownmere", drownmere: "gallowmere", staithe: "sedgewick", sedgewick: "staithe" };
const assign = {};
function score() {
  let mono = 0;
  edges.forEach(e => {
    if (assign[e[0]] === assign[e[1]]) {
      mono++;
    }
  });
  const cornerSuits = new Set(corners.map(c => assign[c]));
  let oppSame = 0;
  if (assign.gallowmere === assign.drownmere) {
    oppSame++;
  }
  if (assign.staithe === assign.sedgewick) {
    oppSame++;
  }
  return mono * 100 + (3 - cornerSuits.size) * 10 + oppSame;
}
function search(i, counts) {
  if (i === ids.length) {
    const s = score();
    if (best === null || s < best.s) {
      best = { s: s, a: Object.assign({}, assign) };
    }
    return;
  }
  suits.forEach((s, k) => {
    if (counts[k] < 4) {
      counts[k]++;
      assign[ids[i]] = s;
      search(i + 1, counts);
      counts[k]--;
    }
  });
}
search(0, [0, 0, 0]);
isles.forEach(c => {
  c.suit = best.a[c.id];
});

const out = {
  width: W,
  height: H,
  isles: isles.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y, suit: c.suit, slots: c.slots, ruin: !!c.ruin, corner: !!c.corner, adj: sorted[c.id] })),
  edges: edges,
  reedbeds: reedbeds,
  opposite: opposite
};

fs.writeFileSync(path.join(__dirname, "..", "src", "mapdata.js"), "var MAPDATA = " + JSON.stringify(out) + ";\n");
console.log("suit score", best.s);
isles.forEach(c => {
  let tag = "";
  if (c.ruin) {
    tag = "ruin";
  }
  console.log(c.id.padEnd(11), c.suit.padEnd(7), "slots", c.slots, tag, "adj", sorted[c.id].join(","));
});
reedbeds.forEach(r => console.log(r.id, r.name.padEnd(15), r.isles.join(","), "| reeds", r.adjReeds.join(",")));
