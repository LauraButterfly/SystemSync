System Sync
===========

Two-player card game implemented in TypeScript + React. This README explains how to install and run the project. It also exlains how to play the game after the Installation process.

Prerequisites
-------------
- Node.js 18+ (LTS recommended)
- npm (bundled with Node.js)
- Git
- Optional: a code editor such as VS Code

Clone the repository
--------------------
On the target computer, open PowerShell and run:

```powershell
# clone the repository
git clone https://github.com/LauraButterfly/SystemSync.git system-sync
cd system-sync
```

Install dependencies
--------------------
Install root and client dependencies:

```powershell
# from repo root
npm ci

# install client deps
cd client
npm ci
cd ..
```

Running in development (two terminals)
-------------------------------------
Open two PowerShell windows/tabs.

Terminal A — start the server:

```powershell
cd src/server
npm run dev
```

Terminal B — start the client (Vite dev server):

```powershell
cd client
npm run dev
```

Open the browser to the URL printed by the client dev server (commonly `http://localhost:5173`).


How to play
-----------

## Players & Theme

- Players: 2
- Theme: Each player is a hacker trying to synchronize a digital system by uploading data sequences.

## Objective

- Be the first to upload the required number of complete sequences. In Standard mode the requirement is 3 sequences. In Sudden Death mode it is only one sequence but the starting hand is reduced to three cards.

## Setup

- Shuffle the deck.
- Standard: each player is dealt 8 cards. Sudden Death: each player is dealt 3 cards.
- The remaining cards become the Main Server (draw pile). One card may be placed to start the discard (Data Stream).

## Turn flow (what happens on your turn)

1. Scan new data packets (automatic draw)
	- At the start of your turn the server draws the mandatory card(s) for you. After the mandatory draw the server will top up your hand to four cards automatically if possible.
	- If the draw pile becomes empty, the discard pile (Data Stream) is shuffled and turned into the new draw pile so play continues.

2. Remove or execute data packets (play / discard)
	- Click a card in your hand to place it face-up on the Data Stream (this is the discard action). If the card is a Command (face card), its effect triggers immediately.

3. Upload (lay sequences — optional)
	- After discarding you may upload any valid sequences from your hand. A valid sequence is at least 3 cards of the same colour in ascending numeric order (e.g., Blue 7, 8, 9). Jokers act as wildcards and may substitute missing cards when forming sequences.

4. End turn
	- After discarding (and any optional uploads), the turn passes to the other player. Some special cards (King) can grant an extra turn; blocked or skipped turns are handled automatically by the server.

## Commands (face cards) — short reference

- Ace (Boot): draw two additional cards immediately when played.
- King (Firewall): grants an extra turn or blocks opponent rounds depending on the build; the server notifies players.
- Queen (Decrypt): peek and reorder the top three cards of the Main Server.
- Jack (Hack): steal up to two random card(s) from the opponent's hand. Important note:
  - If the opponent has fewer than two cards the Jack will steal whatever is available (1 or 0 cards). If zero cards are available the steal has no effect.
- Joker (Glitch): acts as a wildcard in sequences. When used with the special "delete" action it removes an opponent's uploaded sequence — the removed sequence's cards are placed into the discard pile (Data Stream).

## Draw / Discard recycling

- When the Main Server (draw pile) is empty, the Data Stream (discard pile) is shuffled and becomes the new draw pile so the game can continue.

## Winning

- The first player to upload the configured number of sequences (shown in the lobby/help) wins. Standard mode defaults to 3. Sudden Death mode uses smaller starting hands and a player only needs one sequence to win. 
