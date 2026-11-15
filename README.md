# Marrowfen

An asymmetric war game for two to four players, set in a fen of stilt villages, causeways and reedbeds. Four very different powers fight over the isles: the Ironbound Company builds and occupies, the Gilded Synod obeys an ever-growing Edict, the Lantern Covenant spreads secret lanterns and sudden uprisings, and the lone Wayfarer explores, runs errands and plays every side. The first player to reach 30 points wins, unless someone wins first with a Supremacy card.

**Play it here:** https://l3yl3y.github.io/Marrowfen/

Marrowfen follows the rules structure of *Root* (Leder Games) closely, so it works as practice for that game. The name, map, factions, cards and art are original. The in-game How To Play reference includes a full table mapping every Marrowfen term to its *Root* equivalent.

## Features

- All four factions with their own rules: the Company's buildings and clay economy, the Synod's Edict and Collapse, the Covenant's followers, lanterns and uprisings, and the Wayfarer's items, errands, standing and coalitions.
- The full shared deck of 54 cards, with crafting, lasting effects, ambushes and Supremacy cards.
- Bots for every faction that play the whole game on their own, with a little randomness.
- Online play with a friend through a four-letter room code (peer to peer, no account needed), same-device play with a pass-the-device curtain, and solo play against bots. Any faction can be left out, so two, three or four can play.
- Learning notes on every decision, a "Suggest" button that shows what a bot would do, and a complete How To Play reference.
- Games save in the browser and can be resumed.

## Playing With A Friend

1. Open the game and set each faction to **Me**, **Friend online**, **Same device**, **Bot** or **Not playing**.
2. Start the game. A four-letter room code appears at the top of the screen.
3. Your friend opens the same page, types the code under **Join A Friend** and presses **Join**.
4. Keep your page open while you play: your browser hosts the game and runs the bots. If your friend's connection drops, they can rejoin with the same code.

## Running It Locally

The site in `docs/` is a single self-contained page; open `docs/index.html` in a browser for solo or same-device play. Online play needs the page to be served (for example `python3 -m http.server` inside `docs/`) and an internet connection for the peer-to-peer broker.

To rebuild after changing the sources:

```sh
node tools/build.js
```

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/mapdata.js` | The map: isle positions, suits, slots, barrows, causeways and reedbeds (generated). |
| `src/rules.js` | Factions, items, tracks, regents, characters, errands and the 54-card deck. |
| `src/engine.js` | The core rules engine: a deterministic state machine with a decision queue, rule, movement, battle, crafting, scoring and Supremacy. |
| `src/company.js`, `src/synod.js`, `src/covenant.js`, `src/wayfarer.js` | Each faction's setup, turn phases and actions. |
| `src/bot.js` | The bot players. |
| `src/ui-map.js`, `src/ui.js` | The board renderer and the interface for every decision. |
| `src/net.js`, `src/app.js` | Online play, the lobby, seats, saving and the game loop. |
| `src/style.css`, `src/body.html` | Styling, page layout and the How To Play reference. |
| `tools/genmap.js` | Builds the map from a planar graph, so the drawn reedbeds and the adjacency always agree. |
| `tools/build.js` | Builds `docs/index.html`. |
| `tools/rulestest.js`, `tools/simulate.js` | Targeted rule scenarios, and bot-only games with invariant checks. |
| `tools/uitest.js`, `tools/nettest.js`, `tools/driver.js` | Complete games played through the real interface in headless Chrome, including two browsers playing online. |

## Testing

```sh
cd tools
npm install
node rulestest.js              # rule scenarios
node simulate.js 500 mix       # 500 bot games with random faction mixes
node uitest.js                 # a full game through the interface (needs Google Chrome)
```

## Credits

Made by L3yl3y. Fonts: Fraunces and Work Sans (Google Fonts). Online play uses [PeerJS](https://peerjs.com/).

Marrowfen is an independent fan-made practice game. *Root* is a trademark of Leder Games; this project is not affiliated with or endorsed by Leder Games.
