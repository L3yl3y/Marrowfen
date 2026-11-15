const puppeteer = require("puppeteer-core");
const path = require("path");
const url = process.argv[2] || "http://localhost:8765/";
const hostSeats = process.env.SEATS || "company:me,synod:remote,covenant:bot,wayfarer:bot";
const tag = process.env.TAG || "net";

async function pageState(page, who) {
  return page.evaluate((who) => {
    const d = APP.debug();
    if (!document.getElementById("curtain").hidden) { return { curtain: true }; }
    if (who === "host") {
      const g = d.game;
      if (!g) { return { none: true }; }
      if (g.winner) { return { over: true, winner: g.winner.facs.join("+"), how: g.winner.how, vp: g.factions.map(f => f + ":" + g.fac[f].vp).join(" ") }; }
      const p = g.pending;
      return { pid: p && p.id, kind: p && p.kind, mine: p && (d.seats[p.fac] === "me" || d.seats[p.fac] === "local") };
    }
    const v = d.view;
    if (!v) { return { none: true }; }
    if (v.winner) { return { over: true, winner: v.winner.facs.join("+"), how: v.winner.how, vp: v.factions.map(f => f + ":" + v.fac[f].vp).join(" ") }; }
    const p = v.pending;
    return { pid: p && p.id, kind: p && p.kind, mine: p && !p.hidden && p.fac === d.myFaction };
  }, who);
}

async function driveOne(page, who) {
  return page.evaluate((who) => {
    const d = APP.debug();
    let src;
    let pend;
    if (who === "host") {
      src = E.clone(d.game);
      pend = d.game.pending;
    } else {
      src = E.clone(d.view);
      pend = d.view.pending;
      Object.keys(src.map).forEach(cid => {
        const n = src.map[cid].barrowCount || 0;
        src.map[cid].barrow = [];
        for (let i = 0; i < n; i++) { src.map[cid].barrow.push("waders"); }
      });
    }
    const a = BOT.act(src, pend.fac, Math.random);
    try {
      window.__drive(a, pend.kind, pend.fac);
      return { ok: true };
    } catch (e) {
      return { ok: false, err: pend.kind + ": " + e.message + " " + JSON.stringify(a).slice(0, 160) };
    }
  }, who);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const host = await (await browser.createBrowserContext()).newPage();
  const guest = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  for (const [name, p] of [["host", host], ["guest", guest]]) {
    await p.setViewport({ width: 1300, height: 860 });
    p.on("pageerror", e => errors.push(name + " pageerror: " + e.message));
    p.on("console", m => { if (m.type() === "error") { errors.push(name + " console: " + m.text()); } });
  }
  let sep = "?";
  if (url.indexOf("?") >= 0) { sep = "&"; }
  await host.goto(url + sep + "speed=fast", { waitUntil: "networkidle2" });
  await host.addScriptTag({ path: path.join(__dirname, "driver.js") });
  await host.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await host.waitForFunction(() => typeof Peer !== "undefined", { timeout: 20000 });
  for (const pair of hostSeats.split(",")) {
    const [f, k] = pair.split(":");
    await host.select("#seat-" + f, k);
  }
  await host.select("#opt-speed", "fast");
  await host.click('[data-act="start"]');
  await host.waitForFunction(() => APP.debug().roomCode && APP.debug().roomCode.length === 4, { timeout: 20000 });
  const code = await host.evaluate(() => APP.debug().roomCode);
  console.log("room code", code);
  await new Promise(r => setTimeout(r, 2500));
  await guest.goto(url, { waitUntil: "networkidle2" });
  await guest.addScriptTag({ path: path.join(__dirname, "driver.js") });
  await guest.type("#join-code", code);
  await guest.click('[data-act="join"]');
  await guest.waitForFunction(() => !document.getElementById("table").hidden && APP.debug().myFaction, { timeout: 40000 });
  console.log("guest seat", await guest.evaluate(() => APP.debug().myFaction));
  const counts = { host: 0, guest: 0, hostFail: 0, guestFail: 0 };
  const fails = [];
  const lastDriven = { host: null, guest: null };
  const t0 = Date.now();
  let over = null;
  let shot = false;
  while (!over) {
    if (Date.now() - t0 > 1200000) { errors.push("timeout"); break; }
    let acted = false;
    for (const [who, page] of [["host", host], ["guest", guest]]) {
      const st = await pageState(page, who);
      if (st.over) { over = over || {}; over[who] = st; continue; }
      if (st.curtain) { await page.click("#curtain-btn"); acted = true; continue; }
      if (!st.mine || lastDriven[who] === st.pid) { continue; }
      lastDriven[who] = st.pid;
      const r = await driveOne(page, who);
      acted = true;
      if (r.ok) { counts[who]++; } else { counts[who + "Fail"]++; if (fails.length < 10) { fails.push(who + " " + r.err); } }
      if (!shot && who === "guest" && counts.guest === 4) { shot = true; await guest.screenshot({ path: path.join(__dirname, "shots", tag + "-guest.png") }); }
    }
    if (over && (!over.host || !over.guest)) {
      await new Promise(r => setTimeout(r, 400));
      const a = await pageState(host, "host");
      const b = await pageState(guest, "guest");
      if (a.over) { over.host = a; }
      if (b.over) { over.guest = b; }
    }
    if (!acted) { await new Promise(r => setTimeout(r, 60)); }
  }
  await host.screenshot({ path: path.join(__dirname, "shots", tag + "-host-end.png") });
  await guest.screenshot({ path: path.join(__dirname, "shots", tag + "-guest-end.png") });
  console.log("host end", JSON.stringify(over.host));
  console.log("guest end", JSON.stringify(over.guest));
  console.log("same result", JSON.stringify(over.host) === JSON.stringify(over.guest));
  console.log("driven", JSON.stringify(counts), "secs", Math.round((Date.now() - t0) / 1000));
  fails.forEach(f => console.log("  FAIL", f));
  console.log("errors", errors.length);
  errors.slice(0, 10).forEach(e => console.log("  ", e));
  await browser.close();
})();
