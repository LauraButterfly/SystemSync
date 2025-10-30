import React from 'react';
import Card from './Card';

type CardType = { id: string; suit: string; rank: string };

export default function JokerModal({ enemySequences, onCancel, onUseForSequence, onDeleteSequence }: {
  enemySequences: CardType[][];
  onCancel: () => void;
  onUseForSequence: () => void;
  onDeleteSequence: (seqIndex: number) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Joker played</h3>
        <p className="muted">You may use the Joker as a wildcard in a sequence (keep it in your hand), or discard it now to delete one of the opponent's laid sequences.</p>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h4>Keep Joker (use as wildcard)</h4>
            <p className="muted">This will leave the Joker in your hand so you can include it when laying a sequence.</p>
            <div style={{ marginTop: 8 }}>
              <button onClick={onUseForSequence}>Keep for sequence</button>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h4>Discard to delete enemy sequence</h4>
            <p className="muted">Select which sequence to remove from the enemy, if any.</p>
            <div style={{ marginTop: 8 }}>
              {enemySequences.length === 0 ? (
                <div className="muted">Opponent has no sequences</div>
              ) : (
                <div className="sequence-list">
                  {enemySequences.map((seq, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {seq.map(c => <Card key={c.id} card={c} showFace={false} />)}
                      </div>
                      <button onClick={() => onDeleteSequence(idx)}>Delete this sequence</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
