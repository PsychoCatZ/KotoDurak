import type { Suit } from '@/game/types';

/** Палитра мастей: окрас кота, акценты, цвет пипсов */
export const SUIT_THEME: Record<Suit, { main: string; dark: string; accent: string; ink: string; name: string }> = {
  spades:   { main: '#90a4ae', dark: '#546e7a', accent: '#263238', ink: '#37474f', name: 'пики' },
  hearts:   { main: '#ffab91', dark: '#e64a19', accent: '#c62828', ink: '#b71c1c', name: 'черви' },
  diamonds: { main: '#f8bbd0', dark: '#c2185b', accent: '#8e24aa', ink: '#ad1457', name: 'бубны' },
  clubs:    { main: '#a5d6a7', dark: '#2e7d32', accent: '#00695c', ink: '#1b5e20', name: 'трефы' },
};

export function suitGlyph(suit: Suit): string {
  return { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit];
}

interface CatProps {
  fur: string;
  furDark: string;
  accent: string;
  eyes?: string;
  wink?: boolean;
  accessory?: 'none' | 'cap' | 'tiara' | 'crown' | 'wand' | 'bow' | 'monocle' | 'scarf';
}

/** Взрослый кот (фигурные карты и аватары) */
export function CatFigure({ fur, furDark, accent, eyes = '#2e7d32', wink, accessory = 'none' }: CatProps) {
  return (
    <g>
      {/* хвост */}
      <path d="M 118 168 Q 158 160 150 118 Q 147 106 138 112" fill="none" stroke={furDark} strokeWidth="13" strokeLinecap="round" />
      <path d="M 118 168 Q 158 160 150 118 Q 147 106 138 112" fill="none" stroke={fur} strokeWidth="8" strokeLinecap="round" />
      {/* тело */}
      <ellipse cx="100" cy="150" rx="52" ry="46" fill={fur} />
      <ellipse cx="100" cy="164" rx="30" ry="28" fill="#fff8ec" opacity="0.85" />
      {/* задние лапы */}
      <ellipse cx="66" cy="188" rx="18" ry="12" fill={fur} stroke={furDark} strokeWidth="2.5" />
      <ellipse cx="134" cy="188" rx="18" ry="12" fill={fur} stroke={furDark} strokeWidth="2.5" />
      {/* передние лапы */}
      <rect x="82" y="160" width="13" height="38" rx="6.5" fill={fur} stroke={furDark} strokeWidth="2.5" />
      <rect x="105" y="160" width="13" height="38" rx="6.5" fill={fur} stroke={furDark} strokeWidth="2.5" />
      {/* голова */}
      <circle cx="100" cy="86" r="46" fill={fur} />
      {/* уши */}
      <path d="M 62 62 L 52 22 L 92 44 Z" fill={fur} stroke={furDark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M 138 62 L 148 22 L 108 44 Z" fill={fur} stroke={furDark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M 66 54 L 60 32 L 84 46 Z" fill="#f8bbd0" />
      <path d="M 134 54 L 140 32 L 116 46 Z" fill="#f8bbd0" />
      {/* полоски на лбу */}
      <path d="M 92 52 q 8 -6 16 0" fill="none" stroke={furDark} strokeWidth="3" strokeLinecap="round" />
      <path d="M 94 60 q 6 -5 12 0" fill="none" stroke={furDark} strokeWidth="3" strokeLinecap="round" />
      {/* глаза */}
      {wink ? (
        <>
          <path d="M 72 84 q 10 8 20 0" fill="none" stroke="#263238" strokeWidth="4" strokeLinecap="round" />
          <circle cx="122" cy="84" r="9" fill={eyes} />
          <circle cx="122" cy="84" r="4.5" fill="#16211a" />
          <circle cx="125" cy="81" r="2" fill="#fff" />
        </>
      ) : (
        <>
          <circle cx="80" cy="84" r="9" fill={eyes} />
          <circle cx="80" cy="84" r="4.5" fill="#16211a" />
          <circle cx="83" cy="81" r="2" fill="#fff" />
          <circle cx="120" cy="84" r="9" fill={eyes} />
          <circle cx="120" cy="84" r="4.5" fill="#16211a" />
          <circle cx="123" cy="81" r="2" fill="#fff" />
        </>
      )}
      {/* нос и рот */}
      <path d="M 95 100 L 105 100 L 100 107 Z" fill="#e91e63" />
      <path d="M 100 107 q -7 8 -14 3 M 100 107 q 7 8 14 3" fill="none" stroke="#263238" strokeWidth="3" strokeLinecap="round" />
      {/* усы */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path d={`M 58 ${98 + i * 7} q -18 -2 -28 ${i - 1}`} fill="none" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
          <path d={`M 142 ${98 + i * 7} q 18 -2 28 ${i - 1}`} fill="none" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {/* аксессуары */}
      {accessory === 'cap' && (
        <g>
          <path d="M 58 58 Q 100 30 142 58 L 138 44 Q 100 22 62 44 Z" fill={accent} />
          <rect x="56" y="54" width="88" height="9" rx="4.5" fill={accent} />
          <rect x="128" y="56" width="30" height="7" rx="3.5" fill={accent} />
          <circle cx="100" cy="44" r="5" fill="#fff8ec" />
        </g>
      )}
      {accessory === 'tiara' && (
        <g>
          <path d="M 66 52 L 76 28 L 90 46 L 100 22 L 110 46 L 124 28 L 134 52 Z" fill={accent} stroke="#ffd54f" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="100" cy="34" r="4" fill="#e91e63" />
          <circle cx="76" cy="38" r="3" fill="#4fc3f7" />
          <circle cx="124" cy="38" r="3" fill="#4fc3f7" />
        </g>
      )}
      {accessory === 'crown' && (
        <g>
          <path d="M 64 56 L 60 18 L 82 38 L 100 12 L 118 38 L 140 18 L 136 56 Z" fill="#ffd54f" stroke="#c9a227" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="100" cy="30" r="5" fill="#e91e63" />
          <circle cx="72" cy="34" r="3.5" fill="#1565c0" />
          <circle cx="128" cy="34" r="3.5" fill="#1565c0" />
          <rect x="62" y="52" width="76" height="9" rx="4" fill="#ffd54f" stroke="#c9a227" strokeWidth="2" />
        </g>
      )}
      {accessory === 'wand' && (
        <g>
          <line x1="150" y1="150" x2="176" y2="104" stroke="#6d4c41" strokeWidth="5" strokeLinecap="round" />
          <path d="M 176 92 L 179.5 101.5 L 189 104 L 179.5 106.5 L 176 116 L 172.5 106.5 L 163 104 L 172.5 101.5 Z" fill="#ffd54f" stroke="#ff8f00" strokeWidth="1.5" />
          <circle cx="160" cy="88" r="2.5" fill="#ffd54f" />
          <circle cx="188" cy="122" r="2" fill="#ffd54f" />
        </g>
      )}
      {accessory === 'bow' && (
        <g>
          <path d="M 58 120 L 38 108 L 42 132 Z" fill={accent} />
          <path d="M 58 120 L 78 108 L 74 132 Z" fill={accent} />
          <circle cx="58" cy="120" r="6" fill={accent} stroke="#fff" strokeWidth="1.5" />
        </g>
      )}
      {accessory === 'monocle' && (
        <g>
          <circle cx="120" cy="84" r="15" fill="none" stroke="#c9a227" strokeWidth="3" />
          <path d="M 131 95 q 8 14 2 26" fill="none" stroke="#c9a227" strokeWidth="2" />
        </g>
      )}
      {accessory === 'scarf' && (
        <g>
          <path d="M 66 128 Q 100 146 134 128 L 134 140 Q 100 158 66 140 Z" fill={accent} />
          <path d="M 112 142 L 118 172 L 128 166 L 124 140 Z" fill={accent} />
        </g>
      )}
    </g>
  );
}

/** Котёнок для числовых карт — компактный, круглоголовый */
export function KittenFigure({ fur, furDark, accent }: { fur: string; furDark: string; accent: string }) {
  return (
    <g transform="translate(100 118) scale(0.72) translate(-100 -110)">
      <CatFigure fur={fur} furDark={furDark} accent={accent} eyes="#43a047" accessory="none" />
    </g>
  );
}

/** Предметы для числовых карт: рыбка, клубок, мышка, бабочка, лапка */
export function ItemIcon({ kind, x, y, color }: { kind: number; x: number; y: number; color: string }) {
  switch (kind % 5) {
    case 0: // рыбка
      return (
        <g transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="0" rx="12" ry="7" fill={color} />
          <path d="M 10 0 L 20 -7 L 20 7 Z" fill={color} />
          <circle cx="-5" cy="-1.5" r="1.8" fill="#fff" />
          <circle cx="-5" cy="-1.5" r="0.9" fill="#263238" />
        </g>
      );
    case 1: // клубок
      return (
        <g transform={`translate(${x} ${y})`}>
          <circle cx="0" cy="0" r="9" fill={color} />
          <path d="M -7 -3 q 7 -5 14 0 M -8 2 q 8 -4 16 0 M -5 6 q 5 -3 10 0" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.7" />
          <path d="M 7 5 q 8 4 12 -2" fill="none" stroke={color} strokeWidth="2" />
        </g>
      );
    case 2: // мышка
      return (
        <g transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="2" rx="10" ry="6" fill={color} />
          <circle cx="-7" cy="-3" r="4" fill={color} />
          <circle cx="-8" cy="-5" r="2" fill="#f8bbd0" />
          <path d="M 9 3 q 9 2 10 -4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="-8" cy="-3" r="1" fill="#263238" />
        </g>
      );
    case 3: // бабочка
      return (
        <g transform={`translate(${x} ${y})`}>
          <ellipse cx="-6" cy="-3" rx="6" ry="8" fill={color} transform="rotate(-25 -6 -3)" />
          <ellipse cx="6" cy="-3" rx="6" ry="8" fill={color} transform="rotate(25 6 -3)" />
          <ellipse cx="-5" cy="5" rx="4" ry="5" fill={color} opacity="0.75" transform="rotate(-30 -5 5)" />
          <ellipse cx="5" cy="5" rx="4" ry="5" fill={color} opacity="0.75" transform="rotate(30 5 5)" />
          <rect x="-1.5" y="-8" width="3" height="16" rx="1.5" fill="#5d4037" />
        </g>
      );
    default: // лапка
      return (
        <g transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="3" rx="8" ry="7" fill={color} />
          <circle cx="-7" cy="-5" r="3.2" fill={color} />
          <circle cx="0" cy="-7.5" r="3.2" fill={color} />
          <circle cx="7" cy="-5" r="3.2" fill={color} />
        </g>
      );
  }
}

/** Аватар: голова кота в круге (для оппонентов и человека) */
export function CatAvatar({ fur, furDark, accent, eyes = '#2e7d32', accessory = 'none', size = 56 }: CatProps & { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="#fff8ec" />
      <circle cx="100" cy="100" r="96" fill="none" stroke={furDark} strokeWidth="7" />
      <g transform="translate(0 18) scale(1) ">
        <CatFigure fur={fur} furDark={furDark} accent={accent} eyes={eyes} accessory={accessory} />
      </g>
    </svg>
  );
}
