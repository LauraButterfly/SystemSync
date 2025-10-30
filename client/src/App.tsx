import React, { useEffect, useState } from 'react';
import socket from './socket';
import Card from './components/Card';
import ReorderModal from './components/ReorderModal';
import JokerModal from './components/JokerModal';
import ModeSelect from './components/ModeSelect';
import { SPECIAL_ORDER, SPECIAL_CARDS } from './constants/specialCards';
import MatrixRain from './components/MatrixRain';

type Card = { id: string; suit: string; rank: string };
type PlayerState = { id: string; hand: Card[]; sequences: Card[][]; blockedRounds: number };
type GameState = { players: PlayerState[]; mainDeck: Card[]; discardPile: Card[]; currentPlayer: number };

export default function App() {
  const MODE_LABELS: Record<string, string> = {
    'standard': 'Standard',
    'sudden-death': 'Sudden Death'
  };

  const modeLabel = (key?: string) => {
    if (!key) return 'Standard';
    return MODE_LABELS[key] ?? key.replace(/-/g, ' ').replace(/(^|\s)\S/g, s => s.toUpperCase());
  };
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('standard');
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [peekTopCards, setPeekTopCards] = useState<any[] | null>(null);
  const [jokerModalInfo, setJokerModalInfo] = useState<{ handIndex: number } | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [pasted, setPasted] = useState<boolean>(false);
  const [gameOverPayload, setGameOverPayload] = useState<any | null>(null);

  useEffect(() => {
    // helper to apply payloads that may contain a meta.mode key we want to humanize
    const applyPayload = (payload: any) => {
      if (payload?.meta?.mode) payload.meta.mode = modeLabel(payload.meta.mode);
      setState(payload.state);
      setMeta(payload.meta ?? null);
    };

    const showTimedNotice = (msg?: string) => {
      if (!msg) return;
      setNotice(msg);
      setTimeout(() => setNotice(null), 3000);
    };

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    const onGameStarted = (payload: any) => {
      applyPayload(payload);
      // if a new game is started (host clicked Play again), clear any game-over modal on clients
      setGameOverPayload(null);
    };
    socket.on('gameStarted', onGameStarted);
    socket.on('stateUpdate', applyPayload);

    socket.on('cardsDrawn', (payload: any) => {
      if (payload && typeof payload.count === 'number') {
        showTimedNotice(`Hacker ${payload.playerIndex !== undefined ? payload.playerIndex + 1 : payload.playerIndex} drew ${payload.count} card(s)`);
      }
    });

    socket.on('cardsStolen', (payload: any) => {
      if (payload && typeof payload.count === 'number') {
        showTimedNotice(`Hacker ${payload.playerIndex !== undefined ? payload.playerIndex + 1 : payload.playerIndex} stole ${payload.count} card(s)`);
      }
    });

    socket.on('hackNotice', (payload: any) => {
      const msg = payload && payload.message ? payload.message : `You hacked Hacker ${payload.target !== undefined ? payload.target + 1 : payload.target}`;
      showTimedNotice(msg);
    });

    socket.on('gotHacked', (payload: any) => {
      const msg = payload && payload.message ? payload.message : `You got hacked by Hacker ${payload.from !== undefined ? payload.from + 1 : payload.from}`;
      showTimedNotice(msg);
    });

    socket.on('extraTurnGranted', (payload: any) => {
      if (payload && typeof payload.playerIndex === 'number') {
        showTimedNotice(`Hacker ${payload.playerIndex + 1} gained an extra turn`);
      }
    });

    socket.on('peekTop', (payload: any) => {
      if (payload && Array.isArray(payload.top3)) setPeekTopCards(payload.top3);
    });

    socket.on('gameOver', (payload: any) => setGameOverPayload(payload));

    // cleanup: remove the listeners we added above. For anonymous handlers we remove by event name.
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
  socket.off('gameStarted', onGameStarted);
      socket.off('stateUpdate', applyPayload);
      socket.off('cardsDrawn');
      socket.off('cardsStolen');
      socket.off('hackNotice');
      socket.off('gotHacked');
      socket.off('extraTurnGranted');
      socket.off('peekTop');
      socket.off('gameOver');
    };
  }, []);

  // allow closing game over modal with Escape key
  useEffect(() => {
    if (!gameOverPayload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGameOverPayload(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameOverPayload]);

  function createRoom() {
    socket.emit('createRoom', selectedMode, (res: { roomId: string; playerIndex?: number }) => {
      setRoom(res.roomId);
      setPlayerIndex(res.playerIndex ?? 0);
      // reflect the chosen mode in the lobby immediately so the host sees it
      setMeta({ mode: modeLabel(selectedMode), sequencesToWin: selectedMode === 'sudden-death' ? 1 : 3, drawnThisTurnCount: 0, discardedThisTurnFor: null });
    });
  }

  function joinRoom(roomId: string) {
    socket.emit('joinRoom', roomId, (res: any) => {
      if (res.ok) {
        setRoom(roomId);
        setPlayerIndex(res.playerIndex ?? null);
        // reflect server-provided mode metadata if present so joiner sees correct mode immediately
        if (res.mode) {
          setMeta({ mode: modeLabel(res.mode), sequencesToWin: res.sequencesToWin ?? 3, drawnThisTurnCount: 0, discardedThisTurnFor: null });
        }
      } else {
        alert('Join failed: ' + res.reason);
      }
    });
  }

  function startGame() {
    if (!room) return;
    socket.emit('startGame', room, (res: any) => {
      if (!res.ok) alert('Start failed: ' + (res.reason ?? JSON.stringify(res)));
    });
  }

  async function copyRoomCode() {
    if (!room) return;
    try {
      if (navigator && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
        await (navigator as any).clipboard.writeText(room);
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = room;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setNotice('Room code copied to clipboard');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setNotice(null), 2200);
    } catch (err) {
      alert('Copy failed: ' + String(err));
    }
  }

  function playCard(handIndex: number) {
    if (!room || playerIndex === null || !state) return;
    const player = state.players[playerIndex];
    const card = player.hand[handIndex];
    if (!card) return;
    // prevent discarding more than once per turn (server also enforces this)
    if (meta && meta.discardedThisTurnFor === playerIndex) return alert('You already discarded this turn');
    if (card.rank === 'JOKER') {
      // open joker modal to choose action
      setJokerModalInfo({ handIndex });
      return;
    }
    socket.emit('playCard', { roomId: room, playerIndex, handIndex }, (res: any) => {
      if (!res.ok) alert('Play failed: ' + (res.reason ?? JSON.stringify(res)));
    });
  }

  function toggleSelect(i: number) {
    setSelectedIndices(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  }

  // When a card is clicked: if it's the local player's turn and they haven't discarded yet,
  // treat the click as a discard/play action. Otherwise toggle selection for sequences.
  function handleCardClick(handIndex: number) {
    if (!room || playerIndex === null || !state) return;
    // only act on clicks for the local player's hand
    // if it's the player's turn and they haven't discarded this turn, perform play (discard)
    if (state.currentPlayer === playerIndex && !(meta && meta.discardedThisTurnFor === playerIndex)) {
      playCard(handIndex);
      // clear any selected indices to avoid stale selections after a discard
      setSelectedIndices([]);
      return;
    }
    // otherwise toggle selection for laying sequences
    toggleSelect(handIndex);
  }

  function laySequence() {
    if (!room || playerIndex === null) return;
    if (selectedIndices.length !== 3) return alert('Select exactly 3 cards for a sequence');
    socket.emit('laySequence', { roomId: room, playerIndex, handIndices: selectedIndices }, (res: any) => {
      if (!res.ok) alert('Lay sequence failed: ' + (res.reason ?? JSON.stringify(res)));
      setSelectedIndices([]);
    });
  }

  return (
    <div className="app">
      {/* matrix rain only shows when no active game state (lobby / landing view) */}
      {!state && <MatrixRain animated={true} />}
      <h1>System Sync — Client</h1>
      {!room && (
        <div>
          <div className="mode-select">
            <ModeSelect
              id="mode-select"
              value={selectedMode}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'sudden-death', label: 'Sudden Death (first to 1 sequence)' },
              ]}
              onChange={(v) => setSelectedMode(v)}
            />
            <button onClick={createRoom}>Create Room</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="room-control">
              <label htmlFor="room-input" className="sr-only">Room code</label>
              <input
                id="room-input"
                className="room-input"
                placeholder="Enter room code (e.g. ABC123)"
                value={joinInput}
                onChange={e => setJoinInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(joinInput); }}
                aria-label="Room code"
              />
              <button
                type="button"
                className={`copy-btn paste-btn ${pasted ? 'pasted' : ''}`}
                title="Paste room code from clipboard"
                aria-label="Paste room code"
                onClick={async () => {
                  try {
                    let txt: string | null = null;
                    if (navigator && (navigator as any).clipboard && (navigator as any).clipboard.readText) {
                      txt = await (navigator as any).clipboard.readText();
                    } else {
                      txt = prompt('Paste room code') ?? null;
                    }
                    if (txt) {
                      const upper = String(txt).trim().toUpperCase();
                      setJoinInput(upper);
                      setPasted(true);
                      setTimeout(() => setPasted(false), 1800);
                    }
                  } catch (err) {
                    alert('Failed to read clipboard: ' + String(err));
                  }
                }}
              >
                {pasted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M16 4h-2a2 2 0 0 0-4 0H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M9 2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <button className="room-join-btn" onClick={() => joinRoom(joinInput)}>Join Room</button>
            </div>
          </div>
        </div>
      )}

      {room && (
        <div>
              <p>Room: {room} — Mode: {meta?.mode ?? 'standard'} — You are Hacker {playerIndex !== null ? playerIndex + 1 : '(not set)'} {playerIndex === 0 && (
                <button className={"copy-btn" + (copied ? ' copied' : '')} onClick={copyRoomCode} title="Copy room code" aria-label="Copy room code">
                  {!copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <rect x="9" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M16 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )}</p>
          <button onClick={() => { socket.emit('getState', room, (res: any) => { if (res.ok) setState(res.state); else alert(res.reason); }); }}>Refresh State</button>
          <button style={{ marginLeft: 8 }} onClick={() => setShowLogs(v => !v)}>{showLogs ? 'Hide Logs' : 'Show Logs'}</button>
          <button style={{ marginLeft: 8 }} onClick={() => setShowHelp(v => !v)}>{showHelp ? 'Hide Help' : 'Help'}</button>
        </div>
      )}

      {room && !state && (
        <div style={{ marginTop: 12 }}>
          <strong>Waiting for opponent to join...</strong>
              {playerIndex === 0 && (
            <div style={{ marginTop: 8 }}>
              <button onClick={startGame}>Start Game (Host)</button>
            </div>
          )}
        </div>
      )}

      {state && (
        <div className="board">
          {gameOverPayload && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setGameOverPayload(null)}>
              <div className="game-over-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Game Over</h2>
                <p>{gameOverPayload && gameOverPayload.winner !== undefined ? `Hacker ${gameOverPayload.winner !== undefined ? gameOverPayload.winner + 1 : gameOverPayload.winner} won!` : 'Game ended.'}</p>
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => { if (playerIndex === 0) { startGame(); setGameOverPayload(null); } }}
                    disabled={playerIndex !== 0}
                    title={playerIndex !== 0 ? 'Only the Host can start a new game' : 'Start a new game'}
                  >
                    {playerIndex === 0 ? 'Play again' : 'Play again (Host only)'}
                  </button>
                  <button style={{ marginLeft: 8 }} onClick={() => {
                    // leave lobby and return to main screen
                    if (room) {
                      socket.emit('leaveRoom', room, (res: any) => {
                        // regardless of server response, reset local UI
                        setRoom('');
                        setPlayerIndex(null);
                        setState(null);
                        setMeta(null);
                        setSelectedIndices([]);
                        setPeekTopCards(null);
                        setJokerModalInfo(null);
                        setGameOverPayload(null);
                      });
                    } else {
                      setRoom('');
                      setPlayerIndex(null);
                      setState(null);
                      setMeta(null);
                      setSelectedIndices([]);
                      setPeekTopCards(null);
                      setJokerModalInfo(null);
                      setGameOverPayload(null);
                    }
                  }}>Leave lobby</button>
                </div>
              </div>
            </div>
          )}
          {notice && <div className="notice">{notice}</div>}
          <h2>Current Hacker: {state.currentPlayer + 1}</h2>
          <div className="players">
            {state.players.map((p, idx) => (
              <div key={idx} className="player">
                <h3>Hacker {idx + 1} {idx===playerIndex? '(you)':''}</h3>
                <div className="hand">
                  {p.hand.map((c, i) => (
                    <Card
                      key={c.id}
                      card={c}
                      selected={selectedIndices.includes(i)}
                      onSelect={() => { if (idx === playerIndex) handleCardClick(i); }}
                      showFace={idx === playerIndex}
                    />
                  ))}
                </div>
                <div className="sequences">
                  <h4>Sequences</h4>
                  {p.sequences.map((s, si) => <div key={si} className="sequence">{s.map(c => `${c.rank}${c.suit[0]}`).join(', ')}</div>)}
                </div>
              </div>
            ))}
          </div>

          <div className="center-area">
            <div className="deck" title="Main deck">
                  <div className="deck-stack" />
              <div className="deck-count">{state.mainDeck.length}</div>
            </div>
            <div className="discard" title="Discard pile">
              {state.discardPile.length > 0 ? (
                <Card card={state.discardPile[state.discardPile.length - 1]} showFace={true} />
              ) : (
                <div className="empty-discard">Empty</div>
              )}
              <div className="discard-count">{state.discardPile.length}</div>
            </div>
          </div>

          <div className="controls">
            <button onClick={() => {
              if (!room || playerIndex === null) return;
              socket.emit('sortHand', room, (res: any) => {
                if (!res.ok) alert('Sort failed: ' + (res.reason ?? JSON.stringify(res)));
                else setSelectedIndices([]);
              });
            }} title="Sort your hand by color then number">Sort Hand</button>
            <button onClick={laySequence} disabled={!(meta && playerIndex !== null && meta.discardedThisTurnFor === playerIndex)}>Lay Sequence (selected)</button>
            {playerIndex !== null && state.currentPlayer === playerIndex && (
              <>
                <button style={{ marginLeft: 12 }} disabled={!(meta && meta.discardedThisTurnFor === playerIndex)} onClick={() => { socket.emit('endTurn', room, (res: any) => { if (!res.ok) alert('End turn failed: '+res.reason); }); }}>End Turn</button>
              </>
            )}
          </div>

          {showHelp && (
            <div className="help-panel-backdrop" onClick={() => setShowHelp(false)}>
              <div className="help-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Help - Special cards">
                <h3>Special Cards — Quick Reference</h3>
                <ul>
                  {SPECIAL_ORDER.map((rank) => {
                    const info = SPECIAL_CARDS[rank];
                    if (!info) return null;
                    return (
                      <li key={rank}><strong>{info.short}</strong>: {info.description}</li>
                    );
                  })}
                </ul>
                  <h3 style={{ marginTop: 12 }}>How a turn works</h3>
                <p style={{ margin: '6px 0 0 0', lineHeight: 1.4 }}>
                  Turn flow (server-enforced):
                </p>
                <ul style={{ marginTop: 6 }}>
                  <li><strong>Automatic draw:</strong> At the start of your turn the game automatically draws the mandatory card(s) for you.</li>
                  <li><strong>Click to discard:</strong> After the automatic draw you must discard exactly one card by clicking the card in your hand (clicking a card when it is your turn will discard it).</li>
                  <li><strong>Lay sequences:</strong> Once you've discarded, you may lay one or more valid 3-card sequences. Select cards to form sequences and use <em>Lay Sequence</em> to submit them.</li>
                </ul>
                {/* show sequences needed to win (from meta if available, otherwise derive from selectedMode) */}
                <p style={{ marginTop: 12 }}><strong>Winning condition:</strong> {meta?.sequencesToWin ?? (selectedMode === 'sudden-death' ? 1 : 3)} sequences to win ({meta?.mode ?? modeLabel(selectedMode)})</p>
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button onClick={() => setShowHelp(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* local hand is rendered inside the player panels (no bottom tray) */}

          {peekTopCards && (
            <ReorderModal
              top3={peekTopCards}
              onClose={() => setPeekTopCards(null)}
              onSubmit={(newOrderIds) => {
                socket.emit('reorderTop', { roomId: room, newOrderIds }, (res: any) => {
                  if (!res.ok) alert('Reorder failed: ' + (res.reason ?? JSON.stringify(res)));
                  else setPeekTopCards(null);
                });
              }}
            />
          )}

          {jokerModalInfo && state && playerIndex !== null && (
            <JokerModal
              enemySequences={state.players[1 - playerIndex].sequences}
              onCancel={() => setJokerModalInfo(null)}
              onUseForSequence={() => { setJokerModalInfo(null); /* keep Joker in hand; do not emit play */ }}
              onDeleteSequence={(seqIndex) => {
                // emit playCard with delete option
                const handIndex = jokerModalInfo.handIndex;
                socket.emit('playCard', { roomId: room, playerIndex, handIndex, options: { action: 'delete', seqIndex } }, (res: any) => {
                  if (!res.ok) alert('Play (delete) failed: ' + (res.reason ?? JSON.stringify(res)));
                  setJokerModalInfo(null);
                });
              }}
            />
          )}

          {showLogs && <pre className="debug">{JSON.stringify(state, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}
