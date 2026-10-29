// ─── Базовые типы карт и игры «КотоДурак» ────────────────────────────────

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

// 6..10, J(11), Q(12), K(13), A(14)
export type Rank = 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const RANKS: Rank[] = [6, 7, 8, 9, 10, 11, 12, 13, 14];

export interface Card {
  id: string; // уникальный в колоде: `${suit}-${rank}`
  suit: Suit;
  rank: Rank;
}

export type PlayerId = number;

export interface Player {
  id: PlayerId;
  name: string;
  isHuman: boolean;
  /** персонаж (индекс в реестре котов); у человека — -1 */
  character: number;
  hand: Card[];
  /** выбыл из партии (закончил карты при пустой колоде) */
  out: boolean;
}

/** Одна пара на столе: атакующая карта и, возможно, карта отбоя */
export interface TablePair {
  attack: Card;
  defense?: Card;
}

export type Difficulty = 'kitten' | 'alley' | 'master';

export type GamePhase =
  | 'attack'      // главный атакующий делает первый заход
  | 'defend'      // защищающийся отбивает карты (или берёт)
  | 'add'         // все карты отбиты: участники по очереди подкидывают или пасуют
  | 'tail'        // защищающийся взял: подкидывание вдогонку, затем он заберёт стол
  | 'over';

export type GameResult =
  | { kind: 'durak'; playerId: PlayerId }
  | { kind: 'draw' }
  | { kind: 'aborted' };

export interface LogEntry {
  /** ход партии (номер захода) */
  bout: number;
  text: string;
}

/** Информация, видимая конкретному игроку (для честного ИИ) */
export interface PlayerView {
  you: PlayerId;
  hand: Card[];
  trump: Suit;
  table: TablePair[];
  deckCount: number;
  /** карты, уже ушедшие в отбой (публичная история) */
  discard: Card[];
  /** сколько карт у каждого игрока (включая вас) */
  handCounts: Record<PlayerId, number>;
  activePlayers: PlayerId[];
  attacker: PlayerId;
  defender: PlayerId;
  phase: GamePhase;
  boutNumber: number;
  limit: number;          // максимум атакующих карт в текущем заходе
  /** сколько ещё карт можно подкинуть в этом заходе */
  slotsLeft: number;
}

export interface GameConfig {
  humanCount: number;      // всегда 1 человек
  aiCount: number;         // 1..3
  difficulty: Difficulty;
  /** seed для воспроизводимости (тесты) */
  seed?: number;
}
