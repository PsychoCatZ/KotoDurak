import { rankLabel } from '@/game/deck';
import type { Card, Suit } from '@/game/types';
import { CatFigure, ItemIcon, KittenFigure, SUIT_THEME, suitGlyph } from './CatSvg';

function Corner({ rank, suit, x, y, rotate }: { rank: number; suit: Suit; x: number; y: number; rotate?: boolean }) {
  const t = SUIT_THEME[suit];
  return (
    <g transform={`translate(${x} ${y}) ${rotate ? 'rotate(180)' : ''}`}>
      <text x="0" y="0" fontSize="30" fontWeight="800" fill={t.ink} fontFamily="'Trebuchet MS', 'Segoe UI', sans-serif">
        {rankLabel(rank)}
      </text>
      <text x="2" y="26" fontSize="24" fill={t.ink}>{suitGlyph(suit)}</text>
    </g>
  );
}

/** Центральная иллюстрация: уникальная для каждой из 36 карт */
function Illustration({ card }: { card: Card }) {
  const t = SUIT_THEME[card.suit];
  const itemsKind = { spades: 0, hearts: 3, diamonds: 1, clubs: 2 }[card.suit];

  if (card.rank <= 10) {
    const count = card.rank - 5; // 1..5 предметов
    const positions: [number, number][] = [
      [100, 52], [66, 88], [134, 88], [82, 40], [118, 40],
    ];
    return (
      <g>
        {Array.from({ length: count }, (_, i) => (
          <ItemIcon key={i} kind={itemsKind + i} x={positions[i][0]} y={positions[i][1]} color={t.accent} />
        ))}
        <KittenFigure fur={t.main} furDark={t.dark} accent={t.accent} />
      </g>
    );
  }

  switch (card.rank) {
    case 11: // Валет — дерзкий кот в кепке, подмигивает
      return (
        <g>
          <CatFigure fur={t.main} furDark={t.dark} accent={t.accent} wink accessory="cap" />
          <text x="160" y="205" fontSize="26" fill={t.ink} transform="rotate(8 160 205)">!</text>
        </g>
      );
    case 12: // Дама — элегантная кошка с диадемой
      return (
        <g>
          <CatFigure fur={t.main} furDark={t.dark} accent={t.accent} eyes="#8e24aa" accessory="tiara" />
          <path d="M 88 118 q 12 10 24 0" fill="none" stroke={t.accent} strokeWidth="3" />
          <circle cx="100" cy="126" r="4" fill="#e91e63" />
        </g>
      );
    case 13: // Король — величественный кот в короне и мантии
      return (
        <g>
          <path d="M 40 200 Q 100 130 160 200 Z" fill={t.accent} opacity="0.85" />
          <CatFigure fur={t.main} furDark={t.dark} accent="#ffd54f" accessory="crown" />
          <circle cx="100" cy="150" r="7" fill="#ffd54f" stroke="#c9a227" strokeWidth="2" />
          <text x="100" y="155" fontSize="9" textAnchor="middle" fill="#5d4037" fontWeight="800">{suitGlyph(card.suit)}</text>
        </g>
      );
    default: // Туз — кот-маг, высшая карта масти
      return (
        <g>
          <CatFigure fur={t.main} furDark={t.dark} accent={t.accent} eyes={t.accent} accessory="wand" />
          <path d="M 40 40 l 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#ffd54f" />
          <circle cx="52" cy="66" r="3" fill="#ffd54f" />
          <circle cx="36" cy="78" r="2" fill="#ffd54f" />
        </g>
      );
  }
}

export function CardFace({ card, faceDown = false }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <svg viewBox="0 0 200 280" className="card-svg" aria-hidden="true">
        <defs>
          <pattern id="pawpat" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="34" height="34" fill="#3b2f63" />
            <g fill="#5a4a8a">
              <ellipse cx="17" cy="20" rx="6" ry="5" />
              <circle cx="10" cy="13" r="2.4" />
              <circle cx="17" cy="11" r="2.4" />
              <circle cx="24" cy="13" r="2.4" />
            </g>
          </pattern>
        </defs>
        <rect x="4" y="4" width="192" height="272" rx="16" fill="url(#pawpat)" stroke="#c9a227" strokeWidth="5" />
        <rect x="16" y="16" width="168" height="248" rx="10" fill="none" stroke="#c9a227" strokeWidth="2" strokeDasharray="8 6" />
        <text x="100" y="150" fontSize="64" textAnchor="middle" fill="#c9a227" opacity="0.9">🐈‍⬛</text>
        <text x="100" y="196" fontSize="20" textAnchor="middle" fill="#e8ddc9" letterSpacing="4">КОТОИМПЕРИЯ</text>
      </svg>
    );
  }

  const t = SUIT_THEME[card.suit];
  return (
    <svg viewBox="0 0 200 280" className="card-svg" aria-hidden="true">
      <rect x="4" y="4" width="192" height="272" rx="16" fill="#fffdf6" stroke={t.dark} strokeWidth="4" />
      <rect x="12" y="12" width="176" height="256" rx="10" fill="none" stroke={t.main} strokeWidth="1.6" opacity="0.55" />
      <Corner rank={card.rank} suit={card.suit} x={26} y={40} />
      <Corner rank={card.rank} suit={card.suit} x={174} y={240} rotate />
      <g transform="translate(0 22)">
        <Illustration card={card} />
      </g>
    </svg>
  );
}
