const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const G = require("./load.js")();
const E = G.E, BOT = G.BOT;
let t = 5;
const rnd = () => { t = (t * 9301 + 49297) % 233280; return t / 233280; };
const s = E.createGame({ seed: 42, factions: ["company", "synod", "covenant", "wayfarer"] });
for (let i = 0; i < Number(process.argv[2] || 400) && !s.winner; i++) {
  E.applyAction(s, s.pending.fac, BOT.act(s, s.pending.fac, rnd));
}
const src = ["mapdata.js", "rules.js", "ui-map.js"].map(f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8")).join("\n");
const css = fs.readFileSync(path.join(__dirname, "..", "src", "style.css"), "utf8");
const html = "<!doctype html><html><head><meta charset=utf-8><style>body{margin:0;background:#111}" + css + "</style></head><body><svg id=m class=board style='width:1000px;height:760px'></svg><script>" + src + "\nvar S=" + JSON.stringify(s) + ";MAPVIEW.render(document.getElementById('m'),S,{pick:['fenhollow','mirelight','r3']});</script></body></html>";
fs.writeFileSync(path.join(__dirname, "mapshot.html"), html);
(async () => {
  const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1000, height: 760 });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + path.join(__dirname, "mapshot.html"));
  await p.screenshot({ path: path.join(__dirname, "shots", "map.png") });
  await b.close();
  console.log("round", s.round, "errors", errs);
})();
