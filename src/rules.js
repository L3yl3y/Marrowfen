var RULES = (function () {
  var SUITS = ["peat", "willow", "tide"];
  var SUIT_NAME = { peat: "Peat", willow: "Willow", tide: "Tide", moon: "Moon", any: "Any" };
  var FACTIONS = ["company", "synod", "covenant", "wayfarer"];
  var SETUP_ORDER = ["company", "synod", "wayfarer", "covenant"];
  var FACTION_NAME = { company: "Ironbound Company", synod: "Gilded Synod", covenant: "Lantern Covenant", wayfarer: "The Wayfarer" };
  var FACTION_SHORT = { company: "Company", synod: "Synod", covenant: "Covenant", wayfarer: "Wayfarer" };

  var ITEMS = ["waders", "blade", "sling", "mallet", "tonic", "purse", "pack", "lamp"];
  var ITEM_NAME = { waders: "Waders", blade: "Blade", sling: "Sling", mallet: "Mallet", tonic: "Tonic", purse: "Purse", pack: "Pack", lamp: "Lamp" };
  var TRACK_ITEMS = ["tonic", "purse", "pack"];
  var ITEM_SUPPLY = { waders: 2, pack: 2, sling: 1, mallet: 1, blade: 2, tonic: 2, purse: 2 };
  var BARROW_ITEMS = ["pack", "waders", "mallet", "blade"];

  var BUILD_COST = [0, 1, 2, 3, 3, 4];
  var BUILD_VP = { claypit: [0, 1, 2, 3, 4, 5], forge: [0, 2, 2, 3, 4, 5], barracks: [0, 1, 2, 3, 3, 4] };
  var BUILDING_NAME = { claypit: "Claypit", forge: "Forge", barracks: "Barracks", spire: "Spire", hideout: "Hideout" };
  var SPIRE_VP = [0, 0, 1, 2, 3, 4, 4, 5];
  var LANTERN_COST = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3];
  var LANTERN_VP = [0, 1, 1, 1, 2, 2, 3, 4, 4, 4];
  var STANDING_STEPS = [{ aids: 1, vp: 1 }, { aids: 2, vp: 2 }, { aids: 3, vp: 2 }];
  var STANDING_NAME = ["Indifferent", "Amiable", "Friendly", "Allied"];

  var REGENTS = {
    architect: { name: "The Architect", envoys: ["recruit", "move"], text: "Ignores Contempt For Commerce: crafted items score their full points." },
    orator: { name: "The Orator", envoys: ["recruit", "battle"], text: "Every Recruit places two warriors instead of one." },
    marshal: { name: "The Marshal", envoys: ["move", "battle"], text: "As attacker in battle, deals an extra hit." },
    tyrant: { name: "The Tyrant", envoys: ["move", "build"], text: "Scores one extra point whenever at least one enemy building or token is removed in a battle." }
  };
  var REGENT_ORDER = ["architect", "orator", "marshal", "tyrant"];
  var EDICT_COLUMNS = ["recruit", "move", "battle", "build"];

  var ARCHETYPES = {
    cutpurse: { name: "The Cutpurse", items: ["waders", "lamp", "tonic", "blade"], special: "Pilfer", text: "Exhaust the Lamp to take a random card from a player with pieces in your isle." },
    mender: { name: "The Mender", items: ["waders", "lamp", "pack", "mallet"], special: "Odd Jobs", text: "Exhaust the Lamp to take a card from the discard pile that matches your isle (a Moon card always matches)." },
    fenwalker: { name: "The Fenwalker", items: ["waders", "lamp", "sling", "blade"], special: "Go To Ground", text: "Exhaust the Lamp to repair three items, then end Daylight at once." }
  };
  var ARCHETYPE_ORDER = ["cutpurse", "mender", "fenwalker"];

  var ERRANDS = [
    { suit: "peat", name: "Raise A Levee Fund", items: ["tonic", "purse"] },
    { suit: "peat", name: "Deliver Remedies", items: ["tonic", "waders"] },
    { suit: "peat", name: "Carry Supplies", items: ["waders", "pack"] },
    { suit: "peat", name: "Mend A Sluice Gate", items: ["lamp", "mallet"] },
    { suit: "peat", name: "Rally The Village", items: ["lamp", "tonic"] },
    { suit: "willow", name: "Keep The Night Watch", items: ["lamp", "blade"] },
    { suit: "willow", name: "Deliver Remedies", items: ["tonic", "waders"] },
    { suit: "willow", name: "Rally The Village", items: ["lamp", "tonic"] },
    { suit: "willow", name: "Drive Off A Giant Pike", items: ["lamp", "sling"] },
    { suit: "willow", name: "Drive Out Poachers", items: ["blade", "blade"] },
    { suit: "tide", name: "Drive Out Poachers", items: ["blade", "blade"] },
    { suit: "tide", name: "Keep The Night Watch", items: ["lamp", "blade"] },
    { suit: "tide", name: "Drive Off A Giant Pike", items: ["lamp", "sling"] },
    { suit: "tide", name: "Ferry The Sick", items: ["waders", "waders"] },
    { suit: "tide", name: "Carry Supplies", items: ["waders", "pack"] }
  ];

  var EFFECTS = {
    bulwark: { name: "Bulwark Smiths", text: "In battle, you may discard this to ignore all rolled hits you would take." },
    sappers: { name: "Silt Sappers", text: "In battle as defender, you may discard this to deal an extra hit." },
    ruthless: { name: "Ruthless Charge", text: "In battle as attacker, you may deal an extra hit, but the defender scores one point." },
    crown: { name: "Crown Of Reeds", text: "In Birdsong, you may discard this to score one point per isle you rule." },
    tollgate: { name: "Toll Gate", text: "In Birdsong, you may take a random card from another player. That player scores one point." },
    reeve: { name: "Tithe Reeve", text: "Once in Daylight, you may remove one of your warriors from the map to draw a card." },
    granary: { name: "Common Granary", text: "At the start of Birdsong, you and another player of your choice each draw a card." },
    punt: { name: "Punt Builder", text: "At the start of Evening, you may take a move." },
    warhorn: { name: "War Horn", text: "At the start of Daylight, you may start a battle." },
    eavesdrop: { name: "Eavesdroppers", text: "Once in Daylight, you may look at another player's hand." },
    outriders: { name: "Outriders", text: "As attacker in battle, ambush cards have no effect on you." }
  };

  var CARD_LIST = [];
  function add(count, suit, kind, name, cost, extra) {
    for (var i = 0; i < count; i++) {
      var card = { id: CARD_LIST.length, suit: suit, kind: kind, name: name, cost: cost.slice() };
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          card[k] = extra[k];
        });
      }
      CARD_LIST.push(card);
    }
  }
  function item(count, suit, name, cost, it, vp) {
    add(count, suit, "item", name, cost, { item: it, vp: vp });
  }
  function effect(count, suit, key, cost) {
    add(count, suit, "effect", EFFECTS[key].name, cost, { effect: key });
  }

  effect(2, "moon", "bulwark", ["peat"]);
  effect(2, "moon", "sappers", ["tide"]);
  effect(2, "moon", "ruthless", ["peat", "peat"]);
  effect(1, "moon", "crown", ["any", "any", "any", "any"]);
  item(1, "moon", "Moonrunner Waders", ["willow"], "waders", 1);
  item(1, "moon", "Blade Pedlar", ["peat", "peat"], "blade", 2);
  item(1, "moon", "Moonlit Sling", ["peat"], "sling", 1);
  item(1, "moon", "Pilgrim's Bundle", ["tide"], "pack", 1);
  add(2, "moon", "ambush", "Moonlit Ambush", []);
  add(1, "moon", "dominance", "Moon Supremacy", []);

  add(1, "peat", "ambush", "Peat Ambush", []);
  item(1, "peat", "Patched Pack", ["tide"], "pack", 1);
  item(1, "peat", "Bog Myrtle Tonic", ["tide"], "tonic", 2);
  item(1, "peat", "Oiled Waders", ["willow"], "waders", 1);
  item(1, "peat", "Toll Money", ["willow", "willow"], "purse", 3);
  item(1, "peat", "Peatforged Blade", ["peat", "peat"], "blade", 2);
  item(1, "peat", "Smith's Mallet", ["peat"], "mallet", 2);
  effect(2, "peat", "tollgate", ["tide", "tide", "tide"]);
  effect(3, "peat", "reeve", ["peat", "willow", "tide"]);
  add(1, "peat", "favor", "Peat Fire", ["peat", "peat", "peat"], { favor: "peat" });
  add(1, "peat", "dominance", "Peat Supremacy", []);

  add(1, "willow", "ambush", "Willow Ambush", []);
  item(1, "willow", "Smuggler's Pack", ["tide"], "pack", 1);
  item(1, "willow", "Willowbark Tonic", ["tide"], "tonic", 2);
  item(1, "willow", "Borrowed Waders", ["willow"], "waders", 1);
  item(1, "willow", "Market Day", ["willow", "willow"], "purse", 3);
  effect(2, "willow", "warhorn", ["willow", "willow"]);
  effect(2, "willow", "granary", ["willow", "willow"]);
  effect(2, "willow", "punt", ["willow", "willow"]);
  add(1, "willow", "favor", "Willow Blight", ["willow", "willow", "willow"], { favor: "willow" });
  add(1, "willow", "dominance", "Willow Supremacy", []);

  add(1, "tide", "ambush", "Tide Ambush", []);
  item(1, "tide", "Fisher's Creel", ["tide"], "pack", 1);
  item(1, "tide", "Saltmarsh Tonic", ["tide"], "tonic", 2);
  item(1, "tide", "Tarred Waders", ["willow"], "waders", 1);
  item(1, "tide", "Eel Futures", ["willow", "willow"], "purse", 3);
  item(1, "tide", "Tidesteel Blade", ["peat", "peat"], "blade", 2);
  item(1, "tide", "Eelskin Sling", ["peat"], "sling", 1);
  effect(2, "tide", "outriders", ["tide", "tide"]);
  effect(2, "tide", "eavesdrop", ["tide"]);
  add(1, "tide", "favor", "Tide Surge", ["tide", "tide", "tide"], { favor: "tide" });
  add(1, "tide", "dominance", "Tide Supremacy", []);

  CARD_LIST.forEach(function (c) {
    if (c.kind === "ambush") {
      c.text = "Ambush. Play when defending in a matching isle to deal two hits at once. The attacker can foil it with a matching ambush.";
    } else if (c.kind === "dominance") {
      if (c.suit === "moon") {
        c.text = "Supremacy. With 10 or more points, activate in Daylight. You win at the start of your Birdsong if you rule two opposite corner isles.";
      } else {
        c.text = "Supremacy. With 10 or more points, activate in Daylight. You win at the start of your Birdsong if you rule three " + SUIT_NAME[c.suit] + " isles.";
      }
    } else if (c.kind === "favor") {
      c.text = "Remove all enemy pieces in " + SUIT_NAME[c.favor] + " isles.";
    } else if (c.kind === "item") {
      var plural = "s";
      if (c.vp === 1) {
        plural = "";
      }
      c.text = "Gain a " + ITEM_NAME[c.item] + " and " + c.vp + " point" + plural + ".";
    } else {
      c.text = EFFECTS[c.effect].text;
    }
  });

  var CARDS = {};
  CARD_LIST.forEach(function (c) {
    CARDS[c.id] = c;
  });

  return {
    SUITS: SUITS,
    SUIT_NAME: SUIT_NAME,
    FACTIONS: FACTIONS,
    SETUP_ORDER: SETUP_ORDER,
    FACTION_NAME: FACTION_NAME,
    FACTION_SHORT: FACTION_SHORT,
    ITEMS: ITEMS,
    ITEM_NAME: ITEM_NAME,
    TRACK_ITEMS: TRACK_ITEMS,
    ITEM_SUPPLY: ITEM_SUPPLY,
    BARROW_ITEMS: BARROW_ITEMS,
    BUILD_COST: BUILD_COST,
    BUILD_VP: BUILD_VP,
    BUILDING_NAME: BUILDING_NAME,
    SPIRE_VP: SPIRE_VP,
    LANTERN_COST: LANTERN_COST,
    LANTERN_VP: LANTERN_VP,
    STANDING_STEPS: STANDING_STEPS,
    STANDING_NAME: STANDING_NAME,
    REGENTS: REGENTS,
    REGENT_ORDER: REGENT_ORDER,
    EDICT_COLUMNS: EDICT_COLUMNS,
    ARCHETYPES: ARCHETYPES,
    ARCHETYPE_ORDER: ARCHETYPE_ORDER,
    ERRANDS: ERRANDS,
    EFFECTS: EFFECTS,
    CARD_LIST: CARD_LIST,
    CARDS: CARDS,
    WARRIORS: { company: 25, synod: 20, covenant: 10 },
    HAND_LIMIT: 5,
    WIN_VP: 30
  };
})();
