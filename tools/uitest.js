const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const url = process.env.URL || "file://" + path.join(__dirname, "..", "docs", "index.html");
const seatArg = process.env.SEATS || "company:me,synod:bot,covenant:bot,wayfarer:bot";
const width = Number(process.env.W || 1440);
const height = Number(process.env.H || 900);
const shots = path.join(__dirname, "shots");
const tag = process.env.TAG || "ui";

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") { errors.push("console: " + m.text()); } });
  let sep = "?";
  if (url.indexOf("?") >= 0) { sep = "&"; }
  await page.goto(url + sep + "speed=instant", { waitUntil: "load" });
  await page.addScriptTag({ path: path.join(__dirname, "driver.js") });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.screenshot({ path: path.join(shots, tag + "-1-lobby.png") });
  for (const pair of seatArg.split(",")) {
    const [f, k] = pair.split(":");
    await page.select("#seat-" + f, k);
  }
  await page.click('[data-act="start"]');
  let steps = 0, driven = 0, failures = 0, curtains = 0;
  const failSamples = [];
  const kinds = {};
  let shot = 0;
  const t0 = Date.now();
  for (;;) {
    const st = await page.evaluate(() => {
      const d = APP.debug();
      const g = d.game;
      if (!document.getElementById("curtain").hidden) { return { curtain: true }; }
      if (!g) { return { none: true }; }
      if (g.winner) { return { over: true, winner: g.winner, vp: g.factions.map(f => f + ":" + g.fac[f].vp).join(" "), round: g.round }; }
      const p = g.pending;
      const mine = p && (d.seats[p.fac] === "me" || d.seats[p.fac] === "local");
      return { pid: p && p.id, kind: p && p.kind, fac: p && p.fac, mine: mine, round: g.round };
    });
    if (st.over) {
      console.log("GAME OVER round", st.round, "winner", st.winner.facs.join("+"), st.winner.how, "|", st.vp);
      break;
    }
    if (st.curtain) {
      curtains++;
      await page.click("#curtain-btn");
      continue;
    }
    if (!st.mine) {
      await new Promise(r => setTimeout(r, 15));
      steps++;
      if (Date.now() - t0 > 900000) { console.log("TIMEOUT"); break; }
      continue;
    }
    kinds[st.kind] = (kinds[st.kind] || 0) + 1;
    const res = await page.evaluate((pid) => {
      const d = APP.debug();
      const g = d.game;
      const a = BOT.act(E.clone(g), g.pending.fac, Math.random);
      let err = null;
      try { window.__drive(a, g.pending.kind, g.pending.fac); } catch (e) { err = e.message; }
      const moved = !g.pending || g.pending.id !== pid || g.winner;
      if (!moved) {
        const r = d.submit(a);
        return { err: err || "driver did not complete", fallback: r.ok, a: JSON.stringify(a).slice(0, 200), shownError: document.querySelector("#prompt .err").textContent };
      }
      return { ok: true, err: err };
    }, st.pid);
    if (res.ok && !res.err) {
      driven++;
    } else {
      failures++;
      if (failSamples.length < 12) { failSamples.push(st.kind + ": " + res.err + " " + (res.a || "") + " " + (res.shownError || "")); }
    }
    if (driven === 3 && shot === 0) { shot++; await page.screenshot({ path: path.join(shots, tag + "-2-early.png") }); }
    if (st.round >= 4 && shot === 1) { shot++; await page.screenshot({ path: path.join(shots, tag + "-3-mid.png") }); }
  }
  await page.screenshot({ path: path.join(shots, tag + "-4-end.png") });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log("driven", driven, "failures", failures, "curtains", curtains, "errors", errors.length, "overflow", overflow, "secs", Math.round((Date.now() - t0) / 1000));
  console.log("kinds", JSON.stringify(kinds));
  failSamples.forEach(s => console.log("  FAIL", s));
  errors.slice(0, 10).forEach(e => console.log("  ERR", e));
  await browser.close();
})();
