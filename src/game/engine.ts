import { createDeck, mulberry32, shuffle } from './deck';
import { AI_CHARACTERS } from './cats';
import type {
  Card, GameConfig, GamePhase, GameResult, LogEntry,
  Player, PlayerId, PlayerView, Rank, Suit, TablePair,
} from './types';

/** Может ли карта `def` побить карту `atk` при козыре `trump` */
export function canBeat(atk: Card, def: Card, trump: Suit): boolean {
  if (def.suit === atk.suit) return def.rank > atk.rank;
  if (def.suit === trump && atk.suit !== trump) return true;
  return false;
}

export function isTrump(card: Card, trump: Suit): boolean {
  return card.suit === trump;
}

const HAND_SIZE = 6;

export class GameEngine {
  players: Player[] = [];
  deck: Card[] = [];
  trump!: Suit;
  table: TablePair[] = [];
  phase: GamePhase = 'attack';
  /** номер захода в партии (1 — первый) */
  boutNumber = 0;
  attacker!: PlayerId;
  defender!: PlayerId;
  discard: Card[] = [];
  result: GameResult | null = null;
  log: LogEntry[] = [];
  /** максимум атакующих карт в текущем заходе */
  limit = 0;
  /** история позиций для детектора троекратного повторения (пат → ничья) */
  private positionCounts = new Map<string, number>();
  private addQueue: PlayerId[] = [];
  private addIndex = 0;
  private passesInRow = 0;
  private rng: () => number;
  private humanName = 'Кот';

  constructor(config: GameConfig) {
    this.rng = mulberry32(config.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.setup(config);
  }

  // ─── Подготовка партии ────────────────────────────────────────────────

  private setup(config: GameConfig) {
    this.players = [];
    this.players.push({
      id: 0, name: this.humanName, isHuman: true, character: -1, hand: [], out: false,
    });
    for (let i = 0; i < config.aiCount; i++) {
      this.players.push({
        id: i + 1, name: AI_CHARACTERS[i].name, isHuman: false, character: i, hand: [], out: false,
      });
    }

    const deck = shuffle(createDeck(), this.rng);
    this.trump = deck[0].suit; // нижняя карта — козырь, забирается последней
    this.deck = deck;

    // раздача по 6, по одной по часовой стрелке
    for (let round = 0; round < HAND_SIZE; round++) {
      for (const p of this.players) {
        p.hand.push(this.deck.pop()!);
      }
    }
    this.sortHand(this.players[0]);

    // первый атакующий — владелец младшего козыря; иначе случайно
    let starter: PlayerId | null = null;
    let minTrump: Rank | null = null;
    for (const p of this.players) {
      for (const c of p.hand) {
        if (c.suit === this.trump && (minTrump === null || c.rank < minTrump)) {
          minTrump = c.rank;
          starter = p.id;
        }
      }
    }
    this.attacker = starter ?? Math.floor(this.rng() * this.players.length);
    this.say(`Козырь — ${this.trumpName()}. Первым ходит ${this.players[this.attacker].name}.`);
    this.beginBout();
  }

  private trumpName(): string {
    const m: Record<Suit, string> = {
      spades: 'пики', hearts: 'черви', diamonds: 'бубны', clubs: 'трефы',
    };
    return m[this.trump];
  }

  private sortHand(p: Player) {
    const suitOrder: Record<Suit, number> = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    p.hand.sort((a, b) => {
      const at = a.suit === this.trump ? 1 : 0;
      const bt = b.suit === this.trump ? 1 : 0;
      if (at !== bt) return at - bt;
      if (at === 0 && a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
      return a.rank - b.rank;
    });
  }

  private say(text: string) {
    this.log.push({ bout: this.boutNumber, text });
  }

  // ─── Служебные запросы ────────────────────────────────────────────────

  activePlayers(): PlayerId[] {
    return this.players.filter((p) => !p.out).map((p) => p.id);
  }

  nextActive(from: PlayerId): PlayerId {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const id = (from + i) % n;
      if (!this.players[id].out) return id;
    }
    throw new Error('Нет активных игроков');
  }

  unbeaten(): TablePair[] {
    return this.table.filter((p) => !p.defense);
  }

  /** Достоинства, которые сейчас разрешено подкидывать */
  ranksOnTable(): Set<number> {
    const s = new Set<number>();
    for (const p of this.table) {
      s.add(p.attack.rank);
      if (p.defense) s.add(p.defense.rank);
    }
    return s;
  }

  get slotsLeft(): number {
    return this.limit - this.table.length;
  }

  /** Кто сейчас должен действовать */
  currentActor(): { player: PlayerId; action: 'attack' | 'defend' | 'add' | 'tail' } | null {
    if (this.result) return null;
    switch (this.phase) {
      case 'attack': return { player: this.attacker, action: 'attack' };
      case 'defend': return { player: this.defender, action: 'defend' };
      case 'add': return { player: this.addQueue[this.addIndex], action: 'add' };
      case 'tail': return { player: this.addQueue[this.addIndex], action: 'tail' };
      default: return null;
    }
  }

  // ─── Начало захода ────────────────────────────────────────────────────

  private beginBout() {
    this.boutNumber++;
    this.table = [];
    this.defender = this.nextActive(this.attacker);
    const base = this.boutNumber === 1 ? 5 : 6;
    this.limit = Math.min(base, this.players[this.defender].hand.length);
    this.phase = 'attack';
    // детектор повторения позиции: идентичное видимое состояние трижды — пат, ничья
    const key = JSON.stringify([
      this.attacker,
      this.players.map((p) => p.out ? 'out' : p.hand.map((c) => c.id).sort().join('.')),
      this.deck.length,
      this.discard.map((c) => c.id).sort().join('.'),
    ]);
    const seen = (this.positionCounts.get(key) ?? 0) + 1;
    this.positionCounts.set(key, seen);
    if (seen >= 3) {
      this.result = { kind: 'draw' };
      this.phase = 'over';
      this.say('Трижды повторилась та же позиция — пат. Ничья!');
      return;
    }
    this.say(`Заход ${this.boutNumber}: ${this.players[this.attacker].name} нападает на ${this.players[this.defender].name}.`);
  }

  // ─── Проверки и действия ──────────────────────────────────────────────

  /** Карты, которыми игрок вправе атаковать/подкинуть (группы по достоинству) */
  legalAttackCards(playerId: PlayerId): Map<number, Card[]> {
    const p = this.players[playerId];
    const byRank = new Map<number, Card[]>();
    const allowed = this.phase === 'attack' || this.phase === 'add' || this.phase === 'tail';
    if (!allowed || this.slotsLeft <= 0 || p.out) return byRank;
    const ranks =
      this.phase === 'attack'
        ? null // любое достоинство
        : this.ranksOnTable();
    for (const c of p.hand) {
      if (ranks && !ranks.has(c.rank)) continue;
      const arr = byRank.get(c.rank) ?? [];
      arr.push(c);
      byRank.set(c.rank, arr);
    }
    return byRank;
  }

  /** Карты, которыми защитник может отбить данную атакующую */
  legalBeats(playerId: PlayerId, attackCardId: string): Card[] {
    if (this.phase !== 'defend' || playerId !== this.defender) return [];
    const pair = this.table.find((p) => p.attack.id === attackCardId && !p.defense);
    if (!pair) return [];
    return this.players[playerId].hand.filter((c) => canBeat(pair.attack, c, this.trump));
  }

  /** Главный атакующий делает первый заход: 1..k карт одного достоинства */
  attack(playerId: PlayerId, cards: Card[]): boolean {
    if (this.result || this.phase !== 'attack' || playerId !== this.attacker) return false;
    if (cards.length === 0 || cards.length > this.slotsLeft) return false;
    const rank = cards[0].rank;
    if (!cards.every((c) => c.rank === rank)) return false;
    if (!this.removeFromHand(playerId, cards)) return false;
    for (const c of cards) this.table.push({ attack: c });
    this.phase = 'defend';
    this.say(`${this.players[playerId].name} заходит с ${cards.length > 1 ? `${cards.length} карт` : 'карты'} (${rank}).`);
    return true;
  }

  /** Подкидывание (участник в фазе add/tail): карты допустимого достоинства */
  addCards(playerId: PlayerId, cards: Card[]): boolean {
    if (this.result || (this.phase !== 'add' && this.phase !== 'tail')) return false;
    if (this.addQueue[this.addIndex] !== playerId) return false;
    if (cards.length === 0 || cards.length > this.slotsLeft) return false;
    const ranks = this.ranksOnTable();
    if (!cards.every((c) => ranks.has(c.rank))) return false;
    if (!this.removeFromHand(playerId, cards)) return false;
    for (const c of cards) this.table.push({ attack: c });
    this.passesInRow = 0;
    if (this.phase === 'tail') {
      // вдогонку: защитник не отбивает, просто продолжается очередь
      this.advanceCursor();
    } else {
      this.phase = 'defend';
    }
    this.say(`${this.players[playerId].name} подкидывает (${cards.map((c) => c.rank).join(', ')}).`);
    return true;
  }

  /** Защитник отбивает атакующую карту */
  beat(playerId: PlayerId, attackCardId: string, defenseCard: Card): boolean {
    if (this.result || this.phase !== 'defend' || playerId !== this.defender) return false;
    const pair = this.table.find((p) => p.attack.id === attackCardId && !p.defense);
    if (!pair) return false;
    if (!canBeat(pair.attack, defenseCard, this.trump)) return false;
    if (!this.removeFromHand(playerId, [defenseCard])) return false;
    pair.defense = defenseCard;
    this.say(`${this.players[playerId].name} отбивается.`);
    if (this.unbeaten().length === 0) {
      this.phase = 'add';
      this.startAddQueue();
    }
    return true;
  }

  /** Защитник берёт карты */
  take(playerId: PlayerId): boolean {
    if (this.result || this.phase !== 'defend' || playerId !== this.defender) return false;
    if (this.unbeaten().length === 0) return false; // отбито всё — это «бито», а не взятие
    this.phase = 'tail';
    this.startAddQueue();
    this.say(`${this.players[playerId].name} берёт карты!`);
    return true;
  }

  /** Участник отказывается подкидывать */
  pass(playerId: PlayerId): boolean {
    if (this.result || (this.phase !== 'add' && this.phase !== 'tail')) return false;
    if (this.addQueue[this.addIndex] !== playerId) return false;
    this.passesInRow++;
    this.say(`${this.players[playerId].name} пасует.`);
    if (this.passesInRow >= this.addQueue.length) {
      if (this.phase === 'tail') this.finishTake();
      else this.finishBeat();
    } else {
      this.advanceCursor();
    }
    return true;
  }

  // ─── Внутренние переходы ──────────────────────────────────────────────

  private startAddQueue() {
    // участники атаки: все активные, кроме защитника, по часовой от главного атакующего
    this.addQueue = [];
    let id = this.attacker;
    do {
      if (id !== this.defender && !this.players[id].out) this.addQueue.push(id);
      id = this.nextActive(id);
    } while (id !== this.attacker);
    // ход подкидывания начинается со следующего после главного атакующего
    this.addIndex = this.addQueue.length > 1 ? 1 % this.addQueue.length : 0;
    // если главный атакующий — единственный в очереди, начинаем с него
    if (this.addQueue.length === 1) this.addIndex = 0;
    this.passesInRow = 0;
  }

  private advanceCursor() {
    this.addIndex = (this.addIndex + 1) % this.addQueue.length;
  }

  private removeFromHand(playerId: PlayerId, cards: Card[]): boolean {
    const hand = this.players[playerId].hand;
    for (const c of cards) {
      const i = hand.findIndex((h) => h.id === c.id);
      if (i === -1) return false;
    }
    for (const c of cards) {
      const i = hand.findIndex((h) => h.id === c.id);
      hand.splice(i, 1);
    }
    return true;
  }

  private finishBeat() {
    for (const p of this.table) {
      this.discard.push(p.attack);
      if (p.defense) this.discard.push(p.defense);
    }
    const defender = this.defender;
    this.table = [];
    this.say(`Бито. Карты уходят в отбой.`);
    this.drawCards();
    this.updateOutPlayers();
    if (this.checkGameOver()) return;
    const d = this.players[defender];
    this.attacker = d.out ? this.nextActive(defender) : defender;
    this.beginBout();
  }

  private finishTake() {
    const taker = this.defender;
    const hand = this.players[taker].hand;
    for (const p of this.table) {
      hand.push(p.attack);
      if (p.defense) hand.push(p.defense);
    }
    this.sortHand(this.players[taker]);
    this.table = [];
    this.say(`${this.players[taker].name} забирает весь стол.`);
    this.drawCards();
    this.updateOutPlayers();
    if (this.checkGameOver()) return;
    this.attacker = this.nextActive(taker);
    this.beginBout();
  }

  /** Добор до шести: атакующий, остальные по часовой, защитник последним */
  private drawCards() {
    if (this.deck.length === 0) return;
    const order: PlayerId[] = [this.attacker];
    let id = this.nextActive(this.attacker);
    while (id !== this.attacker) {
      if (id !== this.defender) order.push(id);
      id = this.nextActive(id);
    }
    order.push(this.defender);
    for (const pid of order) {
      const p = this.players[pid];
      while (p.hand.length < HAND_SIZE && this.deck.length > 0) {
        p.hand.push(this.deck.pop()!);
      }
      if (p.isHuman) this.sortHand(p);
    }
  }

  private updateOutPlayers() {
    if (this.deck.length > 0) return;
    for (const p of this.players) {
      if (!p.out && p.hand.length === 0) {
        p.out = true;
        this.say(`${p.name} избавился от карт и выбывает!`);
      }
    }
  }

  private checkGameOver(): boolean {
    if (this.deck.length > 0) return false;
    const active = this.activePlayers();
    if (active.length === 1) {
      this.result = { kind: 'durak', playerId: active[0] };
      this.phase = 'over';
      this.say(`Партия окончена: ${this.players[active[0]].name} — ДУРАК!`);
      return true;
    }
    if (active.length === 0) {
      this.result = { kind: 'draw' };
      this.phase = 'over';
      this.say('Ничья! Все коты раздали свои карты.');
      return true;
    }
    return false;
  }

  // ─── Представление для ИИ (только публичная информация) ──────────────

  getView(playerId: PlayerId): PlayerView {
    const p = this.players[playerId];
    const handCounts: Record<PlayerId, number> = {};
    for (const pl of this.players) handCounts[pl.id] = pl.hand.length;
    return {
      you: playerId,
      hand: p.hand.slice(),
      trump: this.trump,
      table: this.table.map((pr) => ({ ...pr })),
      deckCount: this.deck.length,
      discard: this.discard.slice(),
      handCounts,
      activePlayers: this.activePlayers(),
      attacker: this.attacker,
      defender: this.defender,
      phase: this.phase,
      boutNumber: this.boutNumber,
      limit: this.limit,
      slotsLeft: this.slotsLeft,
    };
  }
}
