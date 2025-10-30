import React, { useState } from 'react';
import Card from './Card';

type CardType = { id: string; suit: string; rank: string };

export default function ReorderModal({ top3, onClose, onSubmit }: { top3: CardType[]; onClose: () => void; onSubmit: (newOrderIds: string[]) => void; }) {
  const [order, setOrder] = useState<CardType[]>([...top3]);

  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.setData('text/plain', String(idx));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(from)) return;
    if (from === idx) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    setOrder(next);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Reorder Top 3 Cards</h3>
        <p className="muted">Drag to reorder. Note: top of deck is the right-most card.</p>
        <div className="modal-cards">
          {order.map((c, i) => (
            <div
              key={c.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, i)}
              className="modal-card-wrapper"
            >
              <Card card={c} showFace={true} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onSubmit(order.map(c => c.id))}>Submit Order</button>
        </div>
      </div>
    </div>
  );
}
