import React from 'react';
import { getSpecialInfo } from '../constants/specialCards';

type Props = {
  card: { id: string; suit: string; rank: string };
  selected?: boolean;
  onSelect?: () => void;
  showFace?: boolean;
};

const suitSymbol = (suit: string) => {
  switch (suit) {
    case 'Hearts':
      return '♥';
    case 'Diamonds':
      return '♦';
    case 'Clubs':
      return '♣';
    case 'Spades':
      return '♠';
    default:
      return '★';
  }
};

const isRed = (suit: string) => suit === 'Hearts' || suit === 'Diamonds';
// theme colors: replace traditional red/black with neon green and cyan for hacker look
const neonGreen = '#39ff9a';
const neonCyan = '#5be7ff';

const specialTooltip = (rank: string) => {
  const info = getSpecialInfo(rank);
  if (!info) return '';
  return `${info.short}: ${info.description}`;
};

export default function Card({ card, selected, onSelect, showFace }: Props) {
  const face = (
    <>
      <div className="card-corner top-left" style={{ color: isRed(card.suit) ? neonGreen : neonCyan }}>
        <div className="rank">{card.rank}</div>
        <div className="suit">{suitSymbol(card.suit)}</div>
      </div>

      <div className="card-center" style={{ color: isRed(card.suit) ? neonGreen : neonCyan }}>
        <div className="suit-large">{suitSymbol(card.suit)}</div>
      </div>

      <div className="card-corner bottom-right" style={{ color: isRed(card.suit) ? neonGreen : neonCyan }}>
        <div className="rank">{card.rank}</div>
        <div className="suit">{suitSymbol(card.suit)}</div>
      </div>

      {/* Play button removed: click-to-discard is handled by the parent via onSelect */}
    </>
  );

  const back = (
    <div className="card-back-center" aria-hidden>
      <div className="back-pattern">♦♣♥♠</div>
    </div>
  );

  // prefer explicit prop but default to true
  const resolvedShowFace = typeof showFace === 'boolean' ? showFace : true;

  return (
    <div
      className={"card" + (selected ? ' selected' : '') + (resolvedShowFace ? '' : ' back')}
      onClick={resolvedShowFace ? onSelect : undefined}
      role="button"
      aria-label={resolvedShowFace ? `Card ${card.rank} of ${card.suit}` : 'Hidden card'}
      title={resolvedShowFace ? (specialTooltip(card.rank) || `Card ${card.rank} of ${card.suit}`) : 'Hidden card'}
    >
      {resolvedShowFace ? (
        <>
          {/* Render the face for all cards (Joker included) without SVG filters or glitch overlays */}
          <div className="card-face">
            {face}
          </div>

          {/* inline tooltip element for richer styling (also provide native title for accessibility) */}
          {specialTooltip(card.rank) ? <div className="card-tooltip">{specialTooltip(card.rank)}</div> : null}
        </>
      ) : back}
    </div>
  );
}
