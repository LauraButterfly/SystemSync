// Core game logic for System Sync

export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades' | 'Joker';
export type Color = 'red' | 'black' | 'none';

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'JOKER';

export interface Card {
  id: string; // unique id
  suit: Suit;
  rank: Rank;
}

export function cardColor(card: Card): Color {
  if (card.suit === 'Hearts' || card.suit === 'Diamonds') return 'red';
  if (card.suit === 'Clubs' || card.suit === 'Spades') return 'black';
  return 'none';
}

export function rankToNumber(rank: Rank): number | null {
  if (rank === 'JOKER') return null;
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank, 10);
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  const ranks: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ id: `${s}-${r}`, suit: s, rank: r });
    }
  }
  // two jokers
  deck.push({ id: 'JOKER-1', suit: 'Joker', rank: 'JOKER' });
  deck.push({ id: 'JOKER-2', suit: 'Joker', rank: 'JOKER' });
  return deck;
}

export function shuffle<T>(arr: T[], seedRandom?: () => number): T[] {
  const a = arr.slice();
  const rand = seedRandom ?? Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PlayerState {
  id: string;
  hand: Card[];
  sequences: Card[][]; // laid sequences
  blockedRounds: number; // number of rounds to skip
  extraTurns: number; // extra turns granted by special cards (e.g., King)
}

export interface GameState {
  players: PlayerState[]; // length 2
  mainDeck: Card[];
  discardPile: Card[];
  currentPlayer: number; // index 0 or 1
}

export function newGame(seedRandom?: () => number): GameState {
  const deck = shuffle(createDeck(), seedRandom);
  const players: PlayerState[] = [
    { id: 'p1', hand: [], sequences: [], blockedRounds: 0, extraTurns: 0 },
    { id: 'p2', hand: [], sequences: [], blockedRounds: 0, extraTurns: 0 }
  ];

  // deal 8 cards each
  for (let i = 0; i < 8; i++) {
    players[0].hand.push(deck.pop() as Card);
    players[1].hand.push(deck.pop() as Card);
  }

  // initialize discard with one card
  const discard: Card[] = [];
  if (deck.length > 0) discard.push(deck.pop() as Card);

  return {
    players,
    mainDeck: deck,
    discardPile: discard,
    currentPlayer: 0
  };
}

function drawFromMain(state: GameState): Card | null {
  if (state.mainDeck.length === 0) return null;
  return state.mainDeck.pop() || null;
}

export function drawToHand(state: GameState, playerIndex: number, count: number, seedRandom?: () => number) {
  const player = state.players[playerIndex];
  for (let i = 0; i < count; i++) {
    const c = drawFromMain(state);
    if (!c) break;
    player.hand.push(c);
  }
}

export function ensureHandSizeFour(state: GameState, playerIndex: number) {
  const player = state.players[playerIndex];
  while (player.hand.length < 4 && state.mainDeck.length > 0) {
    const c = drawFromMain(state);
    if (!c) break;
    player.hand.push(c);
  }
}

export type PlayResult = { ok: true; message?: string } | { ok: false; reason: string };

export function playCard(state: GameState, playerIndex: number, handIndex: number, options?: any): PlayResult {
  if (state.currentPlayer !== playerIndex) return { ok: false, reason: 'Not your turn' };
  const player = state.players[playerIndex];
  if (player.blockedRounds > 0) return { ok: false, reason: 'Player is blocked' };
  if (handIndex < 0 || handIndex >= player.hand.length) return { ok: false, reason: 'Invalid card index' };

  const card = player.hand.splice(handIndex, 1)[0];
  state.discardPile.push(card);

  // Special cards effect
  switch (card.rank) {
    case 'A':
      // player draws two extra cards
      drawToHand(state, playerIndex, 2);
      break;
    case 'K':
      // grant an extra turn to the player who played the King
      player.extraTurns = (player.extraTurns ?? 0) + 1;
      break;
      break;
    case 'Q':
      // allow viewing and reordering top 3 - actual reorder handled by reorderTopThree
      // if options.newTopOrder provided, apply it immediately
      if (options && Array.isArray(options.newTopOrder)) {
        reorderTopThree(state, options.newTopOrder);
      }
      break;
    case 'J':
      // draw two random cards from enemy
      {
        const enemy = state.players[1 - playerIndex];
        const take = Math.min(2, enemy.hand.length);
        for (let i = 0; i < take; i++) {
          const idx = Math.floor(Math.random() * enemy.hand.length);
          const stolen = enemy.hand.splice(idx, 1)[0];
          player.hand.push(stolen);
        }
      }
      break;
    case 'JOKER':
      // options.action: 'delete' (remove one enemy sequence) or 'wildcard' used when laying sequence
      if (options && options.action === 'delete') {
        const enemy = state.players[1 - playerIndex];
        if (enemy.sequences.length > 0) {
          // remove the last sequence by default or specified index
          const idx = typeof options.seqIndex === 'number' ? options.seqIndex : enemy.sequences.length - 1;
          enemy.sequences.splice(idx, 1);
        }
      }
      break;
  }

  // After discarding, optionally lay down sequence is handled separately by laySequence method.
  // Important: playing a card applies its effect but DOES NOT automatically end the turn.
  // Turn advancement and blocked-round handling is performed by an explicit end-turn action.
  return { ok: true };
}

export function canLaySequenceFromHand(player: PlayerState, indices: number[]): boolean {
  if (indices.length !== 3) return false;
  const cards = indices.map(i => player.hand[i]);
  if (cards.some(c => c === undefined)) return false;
  // All same color
  const colors = cards.map(cardColor);
  if (!(colors[0] === colors[1] && colors[1] === colors[2])) return false;
  // Obtain numeric ranks (joker wildcard allowed)
  const nums = cards.map(c => rankToNumber(c.rank));
  // If any joker present, allow wildcard behavior: treat joker as fitting spot
  const jokerCount = cards.filter(c => c.rank === 'JOKER').length;
  const nonJokers = cards.filter(c => c.rank !== 'JOKER');
  if (nonJokers.length === 0) return false;

  const numbers = nonJokers.map(c => rankToNumber(c.rank) as number).sort((a,b)=>a-b);
  // Check if numbers can form consecutive sequence with jokers filling gaps
  // Example: numbers [2,4] with jokerCount 1 -> can be 2,3,4
  // Build expected range from min to min+len-1
  const min = numbers[0];
  const neededGaps = (numbers[numbers.length-1] - numbers[0] + 1) - numbers.length;
  return neededGaps <= jokerCount;
}

export function laySequence(state: GameState, playerIndex: number, handIndices: number[]): { ok: boolean; reason?: string } {
  const player = state.players[playerIndex];
  if (!canLaySequenceFromHand(player, handIndices)) return { ok: false, reason: 'Invalid sequence' };
  // extract cards by descending indices so splice works
  const sorted = handIndices.slice().sort((a,b)=>b-a);
  const seq: Card[] = [];
  for (const idx of sorted) {
    seq.push(player.hand.splice(idx, 1)[0]);
  }
  // store sequence
  player.sequences.push(seq.reverse());
  return { ok: true };
}

export function reorderTopThree(state: GameState, newTopOrderIds: string[]): boolean {
  // take the top up to 3 cards
  const top = state.mainDeck.splice(-3).filter(Boolean);
  if (top.length === 0) return false;
  const mapping: Record<string, Card> = {};
  for (const t of top) mapping[t.id] = t;
  const reordered: Card[] = [];
  for (const id of newTopOrderIds) {
    if (mapping[id]) reordered.push(mapping[id]);
  }
  // If reordered doesn't include all available cards, fill with remaining
  for (const t of top) {
    if (!reordered.find(r => r.id === t.id)) reordered.push(t);
  }
  // push back in order so the last element is the top of the deck
  for (const c of reordered) state.mainDeck.push(c);
  return true;
}

export function checkWin(state: GameState): { winner?: number } {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].sequences.length >= 3) return { winner: i };
  }
  return {};
}

export function serializeState(state: GameState) {
  return JSON.stringify(state, null, 2);
}
