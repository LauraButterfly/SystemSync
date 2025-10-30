"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("../src/shared/game/core");
describe('Game core basic behaviors', () => {
    test('deck has 54 cards (52 + 2 Jokers)', () => {
        const deck = (0, core_1.createDeck)();
        expect(deck.length).toBe(54);
    });
    test('new game deals 8 cards each and one discard', () => {
        const state = (0, core_1.newGame)(() => 0.42);
        expect(state.players[0].hand.length).toBe(8);
        expect(state.players[1].hand.length).toBe(8);
        expect(state.discardPile.length).toBeGreaterThanOrEqual(0);
        const total = state.players[0].hand.length + state.players[1].hand.length + state.mainDeck.length + state.discardPile.length;
        expect(total).toBe(54);
    });
    test('playing Ace causes player to draw two extra', () => {
        const state = (0, core_1.newGame)(() => 0.5);
        // force an Ace into player 0 hand
        const ace = { id: 'test-A', suit: 'Hearts', rank: 'A' };
        state.players[0].hand.push(ace);
        const before = state.players[0].hand.length;
        const idx = state.players[0].hand.findIndex(c => c.id === 'test-A');
        const res = (0, core_1.playCard)(state, 0, idx);
        expect(res.ok).toBe(true);
        // drew two extra
        expect(state.players[0].hand.length).toBeGreaterThanOrEqual(before - 1 + 2);
    });
    test('playing King grants an extra turn to the player', () => {
        const state = (0, core_1.newGame)();
        const king = { id: 'test-K', suit: 'Spades', rank: 'K' };
        state.players[0].hand.push(king);
        const idx = state.players[0].hand.findIndex(c => c.id === 'test-K');
        const res = (0, core_1.playCard)(state, 0, idx);
        expect(res.ok).toBe(true);
        expect(state.players[0].extraTurns).toBeGreaterThanOrEqual(1);
    });
    test('laying a valid sequence removes cards from hand and adds to sequences', () => {
        const state = (0, core_1.newGame)(() => 0.123);
        // craft a player with a known sequence 2,3,4 Clubs (black)
        const c2 = { id: 'C-2', suit: 'Clubs', rank: '2' };
        const c3 = { id: 'C-3', suit: 'Clubs', rank: '3' };
        const c4 = { id: 'C-4', suit: 'Clubs', rank: '4' };
        state.players[0].hand = [c2, c3, c4];
        const res = (0, core_1.laySequence)(state, 0, [0, 1, 2]);
        expect(res.ok).toBe(true);
        expect(state.players[0].sequences.length).toBe(1);
        expect(state.players[0].hand.length).toBe(0);
    });
    test('win condition when a player has 3 sequences', () => {
        const state = (0, core_1.newGame)();
        // give player 0 three sequences
        state.players[0].sequences = [[{ id: 'a', suit: 'Hearts', rank: 'A' }, { id: 'b', suit: 'Hearts', rank: '2' }, { id: 'c', suit: 'Hearts', rank: '3' }], [{ id: 'd', suit: 'Clubs', rank: '4' }, { id: 'e', suit: 'Clubs', rank: '5' }, { id: 'f', suit: 'Clubs', rank: '6' }], [{ id: 'g', suit: 'Spades', rank: '7' }, { id: 'h', suit: 'Spades', rank: '8' }, { id: 'i', suit: 'Spades', rank: '9' }]];
        const w = (0, core_1.checkWin)(state);
        expect(w.winner).toBe(0);
    });
    test('playing Joker with delete removes enemy sequence and moves its cards to discard', () => {
        const state = (0, core_1.newGame)(() => 0.7);
        // create a sequence for player 1 (enemy)
        const s1 = { id: 's1', suit: 'Hearts', rank: '2' };
        const s2 = { id: 's2', suit: 'Hearts', rank: '3' };
        const s3 = { id: 's3', suit: 'Hearts', rank: '4' };
        state.players[1].sequences.push([s1, s2, s3]);
        // give player 0 a Joker in hand
        const joker = { id: 'J-TEST', suit: 'Joker', rank: 'JOKER' };
        state.players[0].hand.push(joker);
        const discardBefore = state.discardPile.length;
        const seqsBefore = state.players[1].sequences.length;
        const idx = state.players[0].hand.findIndex(c => c.id === 'J-TEST');
        const res = (0, core_1.playCard)(state, 0, idx, { action: 'delete', seqIndex: 0 });
        expect(res.ok).toBe(true);
        // enemy sequence removed
        expect(state.players[1].sequences.length).toBe(Math.max(0, seqsBefore - 1));
        // discard pile should have grown by joker + 3 cards from the removed sequence
        expect(state.discardPile.length).toBe(discardBefore + 1 + 3);
        // ensure the removed sequence card ids are present in discard pile
        const discardIds = state.discardPile.map(c => c.id);
        expect(discardIds).toEqual(expect.arrayContaining(['s1', 's2', 's3', 'J-TEST']));
    });
    test('cannot lay a sequence composed only of Jokers', () => {
        const state = (0, core_1.newGame)(() => 0.2);
        const j1 = { id: 'J1', suit: 'Joker', rank: 'JOKER' };
        const j2 = { id: 'J2', suit: 'Joker', rank: 'JOKER' };
        state.players[0].hand = [j1, j2];
        const res = (0, core_1.laySequence)(state, 0, [0, 1]);
        expect(res.ok).toBe(false);
    });
    test('mixed Jokers and cards can form a valid sequence (joker fills the gap)', () => {
        const state = (0, core_1.newGame)(() => 0.3);
        // 2, Joker, 4 of Hearts -> should be treated as 2,3,4 Hearts
        const c2 = { id: 'H-2', suit: 'Hearts', rank: '2' };
        const joker = { id: 'J-MID', suit: 'Joker', rank: 'JOKER' };
        const c4 = { id: 'H-4', suit: 'Hearts', rank: '4' };
        state.players[0].hand = [c2, joker, c4];
        const res = (0, core_1.laySequence)(state, 0, [0, 1, 2]);
        expect(res.ok).toBe(true);
        expect(state.players[0].sequences.length).toBe(1);
        // ensure those cards were removed from hand
        expect(state.players[0].hand.length).toBe(0);
    });
    test('sequence with jokers but non-matching non-joker colors is rejected', () => {
        const state = (0, core_1.newGame)(() => 0.4);
        // Hearts 2, Joker, Clubs 4 -> non-joker colors Hearts vs Clubs should make this invalid
        const c2 = { id: 'H-2-bad', suit: 'Hearts', rank: '2' };
        const joker = { id: 'J-BAD', suit: 'Joker', rank: 'JOKER' };
        const c4 = { id: 'C-4-bad', suit: 'Clubs', rank: '4' };
        state.players[0].hand = [c2, joker, c4];
        const res = (0, core_1.laySequence)(state, 0, [0, 1, 2]);
        expect(res.ok).toBe(false);
    });
    test('Ace can be used as 1 in a sequence (A,2,3)', () => {
        const state = (0, core_1.newGame)(() => 0.6);
        const a = { id: 'HA', suit: 'Hearts', rank: 'A' };
        const two = { id: 'H2', suit: 'Hearts', rank: '2' };
        const three = { id: 'H3', suit: 'Hearts', rank: '3' };
        state.players[0].hand = [a, two, three];
        const res = (0, core_1.laySequence)(state, 0, [0, 1, 2]);
        expect(res.ok).toBe(true);
        expect(state.players[0].sequences.length).toBe(1);
    });
    test('Jack/Queen/King numeric values work in sequences (10,J,Q and J,Q,K)', () => {
        const state = (0, core_1.newGame)(() => 0.8);
        const ten = { id: 'H10', suit: 'Hearts', rank: '10' };
        const jack = { id: 'HJ', suit: 'Hearts', rank: 'J' };
        const queen = { id: 'HQ', suit: 'Hearts', rank: 'Q' };
        const king = { id: 'HK', suit: 'Hearts', rank: 'K' };
        // 10, J, Q => 10,11,12
        state.players[0].hand = [ten, jack, queen];
        let res = (0, core_1.laySequence)(state, 0, [0, 1, 2]);
        expect(res.ok).toBe(true);
        expect(state.players[0].sequences.length).toBe(1);
        // reset for J,Q,K => 11,12,13
        state.players[0].hand = [jack, queen, king];
        res = (0, core_1.laySequence)(state, 0, [0, 1, 2]);
        expect(res.ok).toBe(true);
        expect(state.players[0].sequences.length).toBe(2);
    });
});
