"use strict";
// Core game logic for System Sync
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardColor = cardColor;
exports.rankToNumber = rankToNumber;
exports.createDeck = createDeck;
exports.shuffle = shuffle;
exports.newGame = newGame;
exports.drawToHand = drawToHand;
exports.ensureHandSizeFour = ensureHandSizeFour;
exports.playCard = playCard;
exports.canLaySequenceFromHand = canLaySequenceFromHand;
exports.laySequence = laySequence;
exports.reorderTopThree = reorderTopThree;
exports.sortHand = sortHand;
exports.checkWin = checkWin;
exports.serializeState = serializeState;
function cardColor(card) {
    if (card.suit === 'Hearts' || card.suit === 'Diamonds')
        return 'red';
    if (card.suit === 'Clubs' || card.suit === 'Spades')
        return 'black';
    return 'none';
}
function rankToNumber(rank) {
    if (rank === 'JOKER')
        return null;
    if (rank === 'A')
        return 1;
    if (rank === 'J')
        return 11;
    if (rank === 'Q')
        return 12;
    if (rank === 'K')
        return 13;
    return parseInt(rank, 10);
}
function createDeck() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
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
function shuffle(arr, seedRandom) {
    const a = arr.slice();
    const rand = seedRandom ?? Math.random;
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function newGame(seedRandom, startingHandSize = 8) {
    const deck = shuffle(createDeck(), seedRandom);
    const players = [
        { id: 'p1', hand: [], sequences: [], blockedRounds: 0, extraTurns: 0 },
        { id: 'p2', hand: [], sequences: [], blockedRounds: 0, extraTurns: 0 }
    ];
    // deal startingHandSize cards each
    for (let i = 0; i < startingHandSize; i++) {
        players[0].hand.push(deck.pop());
        players[1].hand.push(deck.pop());
    }
    // initialize discard with one card
    const discard = [];
    if (deck.length > 0)
        discard.push(deck.pop());
    return {
        players,
        mainDeck: deck,
        discardPile: discard,
        currentPlayer: 0
    };
}
function drawFromMain(state) {
    if (state.mainDeck.length === 0)
        return null;
    return state.mainDeck.pop() || null;
}
function drawToHand(state, playerIndex, count, seedRandom) {
    const player = state.players[playerIndex];
    for (let i = 0; i < count; i++) {
        const c = drawFromMain(state);
        if (!c)
            break;
        player.hand.push(c);
    }
}
function ensureHandSizeFour(state, playerIndex) {
    const player = state.players[playerIndex];
    while (player.hand.length < 4 && state.mainDeck.length > 0) {
        const c = drawFromMain(state);
        if (!c)
            break;
        player.hand.push(c);
    }
}
function playCard(state, playerIndex, handIndex, options) {
    if (state.currentPlayer !== playerIndex)
        return { ok: false, reason: 'Not your turn' };
    const player = state.players[playerIndex];
    if (player.blockedRounds > 0)
        return { ok: false, reason: 'Player is blocked' };
    if (handIndex < 0 || handIndex >= player.hand.length)
        return { ok: false, reason: 'Invalid card index' };
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
                    const removed = enemy.sequences.splice(idx, 1)[0];
                    // move removed sequence cards to the discard pile
                    if (removed && Array.isArray(removed)) {
                        for (const rc of removed)
                            state.discardPile.push(rc);
                    }
                }
            }
            break;
    }
    // After discarding, optionally lay down sequence is handled separately by laySequence method.
    // Important: playing a card applies its effect but DOES NOT automatically end the turn.
    // Turn advancement and blocked-round handling is performed by an explicit end-turn action.
    return { ok: true };
}
function canLaySequenceFromHand(player, indices) {
    if (indices.length !== 3)
        return false;
    const cards = indices.map(i => player.hand[i]);
    if (cards.some(c => c === undefined))
        return false;
    // All non-joker cards must share the same color; jokers act as wildcards
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0)
        return false; // can't be all jokers
    const nonJokerColors = nonJokers.map(cardColor);
    if (!nonJokerColors.every(col => col === nonJokerColors[0]))
        return false;
    // Obtain numeric ranks (joker wildcard allowed)
    const jokerCount = cards.filter(c => c.rank === 'JOKER').length;
    const numbers = nonJokers.map(c => rankToNumber(c.rank)).sort((a, b) => a - b);
    // Check if numbers can form consecutive sequence with jokers filling gaps
    // Example: numbers [2,4] with jokerCount 1 -> can be 2,3,4
    // Build expected range from min to min+len-1
    const min = numbers[0];
    const neededGaps = (numbers[numbers.length - 1] - numbers[0] + 1) - numbers.length;
    return neededGaps <= jokerCount;
}
function laySequence(state, playerIndex, handIndices) {
    const player = state.players[playerIndex];
    if (!canLaySequenceFromHand(player, handIndices))
        return { ok: false, reason: 'Invalid sequence' };
    // extract cards by descending indices so splice works
    const sorted = handIndices.slice().sort((a, b) => b - a);
    const seq = [];
    for (const idx of sorted) {
        seq.push(player.hand.splice(idx, 1)[0]);
    }
    // store sequence
    player.sequences.push(seq.reverse());
    return { ok: true };
}
function reorderTopThree(state, newTopOrderIds) {
    // take the top up to 3 cards
    const top = state.mainDeck.splice(-3).filter(Boolean);
    if (top.length === 0)
        return false;
    const mapping = {};
    for (const t of top)
        mapping[t.id] = t;
    const reordered = [];
    for (const id of newTopOrderIds) {
        if (mapping[id])
            reordered.push(mapping[id]);
    }
    // If reordered doesn't include all available cards, fill with remaining
    for (const t of top) {
        if (!reordered.find(r => r.id === t.id))
            reordered.push(t);
    }
    // push back in order so the last element is the top of the deck
    for (const c of reordered)
        state.mainDeck.push(c);
    return true;
}
/**
 * Sort a player's hand in-place by color then rank.
 * Order: red cards (A..K), black cards (A..K), then jokers at the end.
 */
function sortHand(state, playerIndex) {
    const player = state.players[playerIndex];
    if (!player)
        return false;
    const colorOrder = (c) => c === 'red' ? 0 : c === 'black' ? 1 : 2;
    player.hand.sort((a, b) => {
        const ca = cardColor(a);
        const cb = cardColor(b);
        const cc = colorOrder(ca) - colorOrder(cb);
        if (cc !== 0)
            return cc;
        const na = rankToNumber(a.rank);
        const nb = rankToNumber(b.rank);
        // place jokers (null) at the end
        if (na === null && nb === null)
            return 0;
        if (na === null)
            return 1;
        if (nb === null)
            return -1;
        return na - nb;
    });
    return true;
}
function checkWin(state, sequencesToWin = 3) {
    for (let i = 0; i < state.players.length; i++) {
        if (state.players[i].sequences.length >= sequencesToWin)
            return { winner: i };
    }
    return {};
}
function serializeState(state) {
    return JSON.stringify(state, null, 2);
}
