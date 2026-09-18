# Couples Game Night 💕

A cozy collection of five browser games for two people to play together from
anywhere — one creates a room, the other joins with a 4-letter code. No
accounts, no server to run, everything stays in the browser.

## Games

| Game | What it is |
|------|------------|
| 💌 Question Cards | Warm-up, deep-dive, playful **and intimate 🔥** decks — take turns answering |
| ⭕ Tic-Tac-Toe | The classic, with a running score |
| 🔴 Connect Four | Drop discs, first to connect four wins |
| 🤔 Who's More Likely? | Both guess who fits the prompt — match answers to score "in sync" points |
| 🎨 Draw & Guess | Pictionary with live drawing sync, chat, role swapping and a 60+ word list |

## How to run

The app is plain HTML/JS/CSS — any static file server works:

```bash
# from this folder (pick one)
npx serve .
python -m http.server 8000   # if you have Python
```

Then open http://localhost:8000 in two browser windows (or send the link to
your partner) — one clicks **Create a room**, the other enters the code.

Opening `index.html` directly as a file also works in most browsers, but a
local server is more reliable for the WebRTC connection.

## How it works

- **Connection:** [PeerJS](https://peerjs.com) (WebRTC data channels) with its
  free public signaling broker. Room codes map to peer ids
  (`couplesgn-<CODE>`). Traffic between the two players is peer-to-peer; the
  broker only handles the handshake.
- **Sync:** every game is turn-based and exchanges small JSON messages
  (`js/games.js`), so play feels instant on any decent connection.
- **Round authority:** in Draw & Guess the host player's client is the single
  source of truth for round changes, which avoids double-swap races.

## Deploy it (shareable link)

It's fully static — host it anywhere:

- **GitHub Pages:** push this folder to a repo → Settings → Pages.
- **Netlify / Vercel:** drag-and-drop the folder in their dashboards.
- Because it uses HTTPS-only WebRTC, the deployed site works on phones too —
  great for a long-distance date night.

## Adding your own content

- Conversation decks (including the 🔥 Intimate deck, gated behind a consent
  prompt), "Who's more likely" prompts and drawing words live in `js/data.js`
  — edit freely.
- Each game in `js/games.js` is a self-contained module
  (`init(root, api) → { onMsg, destroy }`) — a good template for new games.

## Files

```
index.html      app shell (lobby, waiting room, menu, game screen)
css/style.css   theme
js/net.js       PeerJS room-code connection layer
js/data.js      cards / prompts / words
js/games.js     the five games
js/main.js      lobby logic, menu, message routing
```
