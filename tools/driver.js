// Runs inside the page: turns a bot decision into clicks on the real interface.
window.__drive = function (action, kind, fac) {
  const R = RULES;
  const log = [];
  function q(sel) { return Array.from(document.querySelectorAll(sel)); }
  function prompt() { return document.getElementById("prompt"); }
  function clickBtn(re, root) {
    const scope = root || prompt();
    const b = Array.from(scope.querySelectorAll("button")).find(x => !x.disabled && re.test(x.textContent.replace(/\s+/g, " ").trim()));
    if (!b) {
      const names = Array.from(scope.querySelectorAll("button")).map(x => {
        let n = x.textContent.trim().slice(0, 30);
        if (x.disabled) { n += "(off)"; }
        return n;
      });
      throw new Error("no button " + re + " in [" + names.join(" | ") + "]");
    }
    b.click();
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function exact(s) { return new RegExp("^" + esc(s) + "$"); }
  function starts(s) { return new RegExp("^" + esc(s)); }
  function clickIsle(cid) {
    const g = document.querySelector('#board .dyn [data-cid="' + cid + '"]');
    if (!g) { throw new Error("no isle " + cid); }
    if (!(g.classList.contains("pickable") || g.classList.contains("pick-reed"))) { throw new Error("isle not pickable " + cid); }
    g.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  function clickCard(id, where) {
    const name = R.CARDS[id].name;
    let scope = prompt();
    if (where === "hand") { scope = document.getElementById("hand"); }
    const cards = Array.from(scope.querySelectorAll("button.card")).filter(b => !b.disabled && b.querySelector(".band").textContent.trim() === name && !b.classList.contains("sel"));
    if (cards.length === 0) { throw new Error("no card " + name + " in " + (where || "prompt")); }
    cards[0].click();
  }
  function clickItem(t, flags) {
    const name = R.ITEM_NAME[t];
    const chips = Array.from(prompt().querySelectorAll("button.item")).filter(b => !b.classList.contains("sel") && b.textContent.indexOf(name) >= 0 && (flags.dmg === undefined || b.classList.contains("dmg") === !!flags.dmg) && (flags.ex === undefined || b.classList.contains("ex") === !!flags.ex));
    if (chips.length === 0) { throw new Error("no item chip " + name + JSON.stringify(flags)); }
    chips[0].click();
  }
  function setStepper(target) {
    for (let i = 0; i < 40; i++) {
      const b = prompt().querySelector(".stepper b");
      if (!b) { throw new Error("no stepper"); }
      const v = Number(b.textContent);
      if (v === target) { return; }
      const btns = prompt().querySelectorAll(".stepper button");
      if (v < target) { btns[1].click(); } else { btns[0].click(); }
    }
    throw new Error("stepper stuck");
  }
  function moveSteps(m, confirmRe) {
    clickIsle(m.from);
    clickIsle(m.to);
    setStepper(m.n);
    clickBtn(confirmRe || /^Confirm Move$/);
  }
  function battleSteps(cid, target) {
    clickIsle(cid);
    const tb = Array.from(prompt().querySelectorAll("button")).find(x => x.textContent.trim() === R.FACTION_SHORT[target]);
    if (tb) { tb.click(); }
  }
  function free(a) {
    if (a.type === "dominance") {
      clickBtn(/^Activate Supremacy$/);
      clickCard(a.card);
      if (a.with) { clickBtn(exact(R.FACTION_SHORT[a.with])); }
      return true;
    }
    if (a.type === "reeve") {
      clickBtn(/^Tithe Reeve$/);
      clickIsle(a.cid);
      return true;
    }
    if (a.type === "takeDominance") {
      clickBtn(/^Take Supremacy$/);
      clickCard(a.card);
      return true;
    }
    if (a.type === "eavesdrop") {
      clickBtn(/^Eavesdrop$/);
      clickBtn(exact(R.FACTION_SHORT[a.target]));
      return true;
    }
    return false;
  }
  function pend() { if (APP.debug().game) { return APP.debug().game.pending; } return APP.debug().view.pending; }
  const a = action;
  const k = kind;
  if (k === "setupCitadel") { clickIsle(a.cid); return; }
  if (k === "setupBuildings") { clickIsle(a.claypit); clickIsle(a.forge); clickIsle(a.barracks); clickBtn(/^Confirm Buildings$/); return; }
  if (k === "setupSynod") { clickBtn(starts(R.REGENTS[a.regent].name)); if (document.querySelector('#board .dyn .pickable')) { clickIsle(a.corner); } return; }
  if (k === "setupWayfarer") { clickBtn(starts(R.ARCHETYPES[a.arch].name)); clickIsle(a.reed); return; }
  if (k === "granary") { clickBtn(exact(R.FACTION_SHORT[a.target])); return; }
  if (k === "bcards") {
    if (a.type === "crown") { clickBtn(/^Discard Crown/); } else if (a.type === "toll") { clickBtn(exact("Toll Gate: take from " + R.FACTION_SHORT[a.target])); } else { clickBtn(/^Continue$/); }
    return;
  }
  if (k === "warhorn") { if (a.type === "skip") { clickBtn(/^Skip$/); } else { clickBtn(/^Battle$/); battleSteps(a.cid, a.target); } return; }
  if (k === "punt") { clickBtn(/^Skip$/); return; }
  if (k === "ambush") { if (a.type === "skip") { clickBtn(/^Do Not Ambush$/); } else { clickCard(a.card); } return; }
  if (k === "foil") { if (a.type === "skip") { clickBtn(/^Do Not Foil$/); } else { clickCard(a.card); } return; }
  if (k === "battleEffects") {
    const labels = { ruthless: /Ruthless Charge/, sappers: /Silt Sappers/, bulwark: /Bulwark Smiths/ };
    a.use.forEach(u => clickBtn(labels[u]));
    clickBtn(/^Confirm$/);
    return;
  }
  if (k === "hits") {
    if (a.items) {
      a.items.forEach(it => clickItem(it.t, { ex: it.ex, dmg: false }));
      if (a.ally) { setStepper(a.ally); }
      clickBtn(/^Confirm$/);
      return;
    }
    a.pieces.forEach(p => {
      const label = R.BUILDING_NAME[p] || E.tokenLabel(p);
      clickBtn(starts(label + " ("));
    });
    clickBtn(/^Confirm$/);
    return;
  }
  if (k === "surgeons") { if (a.type === "skip") { clickBtn(/^Let Them Fall$/); } else { clickCard(a.card); } return; }
  if (k === "unrest") { clickCard(a.card); return; }
  if (k === "discard") { a.cards.forEach(c => clickCard(c, "hand")); clickBtn(/^Discard Selected$/); return; }
  if (k === "covenantTrim") { a.cards.forEach(c => clickCard(c)); clickBtn(/^Discard Selected$/); return; }
  if (k === "companyDaylight") {
    if (free(a)) { return; }
    if (a.type === "end") { clickBtn(/^End Daylight$/); return; }
    if (a.type === "craft") { clickBtn(/^Craft$/); clickCard(a.card, "hand"); return; }
    if (a.type === "battle") { clickBtn(/^Battle$/); battleSteps(a.cid, a.target); return; }
    if (a.type === "march") {
      clickBtn(/^March$/);
      a.moves.forEach(m => moveSteps(m));
      if (a.moves.length === 1) { clickBtn(/^March With One Move$/); }
      clickBtn(/^March Now$/);
      return;
    }
    if (a.type === "recruit") { clickBtn(/^Recruit$/); return; }
    if (a.type === "build") { clickBtn(/^Build$/); clickIsle(a.cid); clickBtn(starts(R.BUILDING_NAME[a.b] + " (")); return; }
    if (a.type === "overwork") { clickBtn(/^Overwork$/); clickIsle(a.cid); clickCard(a.card, "hand"); return; }
    if (a.type === "hawk") { clickBtn(/^Spend Moon Card/); clickCard(a.card, "hand"); return; }
  }
  if (k === "synodEdictAdd") {
    a.adds.forEach(x => { clickCard(x.card, "hand"); clickBtn(exact(E.colName(x.col))); });
    clickBtn(/^Confirm Edict$/);
    return;
  }
  if (k === "synodNewSpire") { clickIsle(a.cid); return; }
  if (k === "synodCraft") {
    if (free(a)) { return; }
    if (a.type === "craft") { clickBtn(/^Craft$/); clickCard(a.card, "hand"); return; }
    clickBtn(/^Resolve The Edict$/);
    return;
  }
  if (k === "synodEdict") {
    if (free(a)) { return; }
    if (a.type === "collapse") { clickBtn(/^Fall Into Collapse$/); return; }
    const p = pend();
    const order = p.cards.map(c => c.index);
    const btns = Array.from(prompt().querySelectorAll(".choices")[0].querySelectorAll("button"));
    btns[order.indexOf(a.index)].click();
    if (p.col === "recruit" || p.col === "build") { clickIsle(a.cid); return; }
    if (p.col === "battle") { battleSteps(a.cid, a.target); return; }
    moveSteps(a);
    return;
  }
  if (k === "synodRegent") { clickBtn(starts(R.REGENTS[a.regent].name)); return; }
  if (k === "covenantBirdsong") {
    if (a.type === "done") { clickBtn(/^Done$/); return; }
    if (a.type === "revolt") { clickBtn(/^Uprising$/); } else { clickBtn(/^Light A Lantern$/); }
    clickIsle(a.cid);
    a.cards.forEach(c => clickCard(c));
    clickBtn(/^Confirm$/);
    return;
  }
  if (k === "covenantDaylight") {
    if (free(a)) { return; }
    if (a.type === "end") { clickBtn(/^End Daylight$/); return; }
    const lbl = { craft: /^Craft$/, mobilize: /^Rally/, train: /^Appoint Warden$/ };
    clickBtn(lbl[a.type]);
    clickCard(a.card, "hand");
    return;
  }
  if (k === "covenantOps") {
    if (a.type === "done") { clickBtn(/^Done$/); return; }
    if (a.type === "move") { clickBtn(/^Move$/); moveSteps(a); return; }
    if (a.type === "battle") { clickBtn(/^Battle$/); battleSteps(a.cid, a.target); return; }
    if (a.type === "recruit") { clickBtn(/^Recruit$/); } else { clickBtn(/^Kindle$/); }
    clickIsle(a.cid);
    return;
  }
  if (k === "wayfarerRefresh") { a.items.forEach(it => clickItem(it.t, { dmg: it.dmg })); clickBtn(/^Confirm$/); return; }
  if (k === "wayfarerDamage") { a.items.forEach(it => clickItem(it.t, { ex: it.ex })); clickBtn(/^Confirm$/); return; }
  if (k === "wayfarerCapacity") { a.items.forEach(it => clickItem(it.t, { ex: it.ex, dmg: it.dmg })); clickBtn(/^Confirm$/); return; }
  if (k === "wayfarerSlip") {
    if (a.type === "stay") { clickBtn(/^Stay Here$/); return; }
    clickIsle(a.to);
    const alone = Array.from(prompt().querySelectorAll("button")).find(x => x.textContent.trim() === "Go Alone");
    if (alone) { alone.click(); }
    return;
  }
  if (k === "wayfarerDaylight") {
    if (free(a)) { return; }
    if (a.type === "end") { clickBtn(/^End Daylight$/); return; }
    if (a.type === "move") {
      clickBtn(/^Move \(Waders\)$/);
      clickIsle(a.to);
      const alone = Array.from(prompt().querySelectorAll("button")).find(x => x.textContent.trim() === "Go Alone");
      if (alone) { alone.click(); }
      return;
    }
    if (a.type === "battle") {
      clickBtn(/^Battle \(Blade\)$/);
      clickBtn(exact(R.FACTION_SHORT[a.target]));
      let want = "Fight Alone";
      if (a.ally) { want = "With " + R.FACTION_SHORT[a.ally]; }
      const fa = Array.from(prompt().querySelectorAll("button")).find(x => x.textContent.trim() === want);
      if (fa) { fa.click(); }
      return;
    }
    if (a.type === "explore") { clickBtn(/^Explore/); return; }
    if (a.type === "aid") {
      clickBtn(/^Aid$/);
      clickBtn(exact(R.FACTION_SHORT[a.target]));
      clickCard(a.card, "hand");
      clickBtn(exact(R.ITEM_NAME[a.item]));
      if (a.take) { clickBtn(exact("Take " + R.ITEM_NAME[a.take])); } else { clickBtn(/^Take Nothing$/); }
      return;
    }
    if (a.type === "errand") {
      clickBtn(/^Errand$/);
      const p = pend();
      const opts = p.errands.map(e => e.slot);
      const btns = Array.from(prompt().querySelectorAll(".choices")[0].querySelectorAll("button"));
      btns[opts.indexOf(a.slot)].click();
      if (a.reward === "vp") { clickBtn(/^Score Points$/); } else { clickBtn(/^Draw Two Cards$/); }
      return;
    }
    if (a.type === "strike") {
      clickBtn(/^Snipe/);
      clickBtn(exact(R.FACTION_SHORT[a.target]));
      if (a.piece) { clickBtn(exact(R.BUILDING_NAME[a.piece] || E.tokenLabel(a.piece))); }
      return;
    }
    if (a.type === "repair") { clickBtn(/^Repair/); clickItem(a.item.t, { dmg: true }); return; }
    if (a.type === "craft") { clickBtn(/^Craft/); clickCard(a.card, "hand"); return; }
    if (a.type === "special") {
      clickBtn(/\(Lamp\)$/);
      if (a.target) { clickBtn(exact(R.FACTION_SHORT[a.target])); return; }
      if (a.card !== undefined) { clickCard(a.card); return; }
      a.items.forEach(it => clickItem(it.t, { dmg: true }));
      clickBtn(/^Confirm$/);
      return;
    }
  }
  throw new Error("driver has no route for " + k + " " + JSON.stringify(a));
};
