import { decide } from './ai';
import { GameEngine } from './engine';
import type { AiAction } from './ai';
import type { Card, Difficulty, GameConfig, PlayerId } from './types';

/** События для анимаций и звука в UI */
export type GameEvent =
  | { type: 'attack'; player: PlayerId; cards: Card[] }
  | { type: 'beat'; player: PlayerId; attackCardId: string; card: Card }
  | { type: 'take'; player: PlayerId }
  | { type: 'add'; player: PlayerId; cards: Card[] }
  | { type: 'pass'; player: PlayerId }
  | { type: 'boutEnd'; taken: boolean; player: PlayerId }
  | { type: 'draw' }
  | { type: 'gameOver' };

export type PhraseKind = 'attack' | 'beat' | 'take' | 'add' | 'pass' | 'win' | 'lose' | 'think';

export interface Phrase {
  player: PlayerId;
  kind: PhraseKind;
  text: string;
}

interface ControllerOptions {
  /** задержка хода ИИ, мс (0 — синхронный режим, для тестов) */
  aiDelay?: number;
  onEvent?: (e: GameEvent) => void;
  onPhrase?: (p: Phrase) => void;
  onChange?: () => void;
}

const PHRASES: Record<PhraseKind, string[]> = {
  attack: ['Получай под хвост!', 'Мяу! Лови!', 'Это тебе, кожаный!', 'Хвостом по глазам!'],
  beat: ['Бито, кожаный!', 'Не проведёшь!', 'Мимо! Как моя миска.', 'Отбито, усатик!'],
  take: ['Мяу, беру!', 'Придётся потерпеть…', 'Забираю, но это ничего не значит!', 'Уф. Лапы коротки.'],
  add: ['И это тоже!', 'Держи ещё!', 'Не расслабляйся!', 'В догонку!'],
  pass: ['Пасую, хвостом кверху.', 'Не буду.', 'Твоё счастье.', 'Пропускаю.'],
  win: ['Я — КотоМагистр!', 'Победа! Где мои валерьянки?', 'Ещё одна партия за мной.'],
  lose: ['Это было тактически задумано!', 'Я просто тренировался!', 'Мяу… реванш!'],
  think: ['Хм-мяу…', 'Шевелю усами…', 'Думаю, думаю…'],
};

export class GameController {
  engine: GameEngine;
  difficulty: Difficulty;
  private opts: ControllerOptions;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;
  private phraseCounter = 0;

  constructor(config: GameConfig, opts: ControllerOptions = {}) {
    this.engine = new GameEngine(config);
    this.difficulty = config.difficulty;
    this.opts = opts;
  }

  get state() {
    return this.engine;
  }

  destroy() {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private emit(e: GameEvent) {
    this.opts.onEvent?.(e);
    this.opts.onChange?.();
  }

  private phrase(player: PlayerId, kind: PhraseKind) {
    // не каждый раз — чтобы реплики не мешали игре
    if ((this.phraseCounter++ % 3) !== 0 && kind !== 'win' && kind !== 'lose') return;
    const lines = PHRASES[kind];
    const text = lines[Math.floor(Math.random() * lines.length)];
    this.opts.onPhrase?.({ player, kind, text });
  }

  /** Запустить обработку очереди ходов (после старта или действия человека) */
  pump() {
    if (this.engine.result) {
      this.emit({ type: 'gameOver' });
      const loser = this.engine.result.kind === 'durak' ? this.engine.result.playerId : null;
      for (const p of this.engine.players) {
        if (!p.isHuman) this.phrase(p.id, loser === p.id ? 'lose' : 'win');
      }
      this.opts.onChange?.();
      return;
    }
    const actor = this.engine.currentActor();
    if (!actor) return;
    if (this.engine.players[actor.player].isHuman) {
      this.opts.onChange?.();
      return; // ждём действия человека
    }
    this.running = true;
    if (this.opts.aiDelay === 0) {
      // синхронный режим (тесты): итеративно, без рекурсии
      while (this.running && !this.engine.result) {
        const a = this.engine.currentActor();
        if (!a) return;
        if (this.engine.players[a.player].isHuman) { this.opts.onChange?.(); return; }
        const view = this.engine.getView(a.player);
        const action = decide(view, this.difficulty, a.player);
        if (Math.random() < 0.25) this.phrase(a.player, 'think');
        this.applyAiAction(a.player, action);
      }
      if (this.engine.result) this.pump();
      return;
    }
    const run = () => {
      if (!this.running || this.engine.result) return;
      const a = this.engine.currentActor();
      if (!a) return;
      if (this.engine.players[a.player].isHuman) { this.opts.onChange?.(); return; }
      const view = this.engine.getView(a.player);
      const action = decide(view, this.difficulty, a.player);
      if (Math.random() < 0.25) this.phrase(a.player, 'think');
      this.applyAiAction(a.player, action);
      this.timers.push(setTimeout(run, this.opts.aiDelay ?? 600));
    };
    this.timers.push(setTimeout(run, this.opts.aiDelay ?? 600));
  }

  private applyAiAction(player: PlayerId, action: AiAction) {
    const eng = this.engine;
    const actor = eng.currentActor();
    const safeFallback = () => {
      // защита от зацикливания: любая ошибка ИИ разрешается легальным ходом
      const a = eng.currentActor();
      if (!a) return;
      if (a.action === 'attack') {
        const cs = [...eng.legalAttackCards(a.player).values()].flat();
        if (cs.length) eng.attack(a.player, [cs[0]]);
      } else if (a.action === 'defend') {
        eng.take(a.player);
      } else {
        eng.pass(a.player);
      }
    };
    if (!actor || actor.player !== player) return;
    let applied = false;
    switch (action.type) {
      case 'attack':
        applied = eng.attack(player, action.cards);
        if (applied) {
          this.phrase(player, 'attack');
          this.emit({ type: 'attack', player, cards: action.cards });
        }
        break;
      case 'add':
        applied = eng.addCards(player, action.cards);
        if (applied) {
          this.phrase(player, 'add');
          this.emit({ type: 'add', player, cards: action.cards });
        }
        break;
      case 'beat':
        applied = eng.beat(player, action.attackCardId, action.defenseCard);
        if (applied) {
          this.phrase(player, 'beat');
          this.emit({ type: 'beat', player, attackCardId: action.attackCardId, card: action.defenseCard });
        }
        break;
      case 'take':
        applied = eng.take(player);
        if (applied) {
          this.phrase(player, 'take');
          this.emit({ type: 'take', player });
        }
        break;
      case 'pass':
        applied = eng.pass(player);
        if (applied) {
          this.phrase(player, 'pass');
          this.emit({ type: 'pass', player });
        }
        break;
    }
    if (!applied) {
      safeFallback();
      this.opts.onChange?.();
    }
  }

  // ─── Действия человека ────────────────────────────────────────────────

  humanAttack(cards: Card[]): boolean {
    const actor = this.engine.currentActor();
    if (!actor || actor.action !== 'attack') return false;
    const ok = this.engine.attack(actor.player, cards);
    if (ok) {
      this.emit({ type: 'attack', player: actor.player, cards });
      this.pump();
    }
    return ok;
  }

  humanAdd(cards: Card[]): boolean {
    const actor = this.engine.currentActor();
    if (!actor || (actor.action !== 'add' && actor.action !== 'tail')) return false;
    const ok = this.engine.addCards(actor.player, cards);
    if (ok) {
      this.emit({ type: 'add', player: actor.player, cards });
      this.pump();
    }
    return ok;
  }

  humanBeat(attackCardId: string, defenseCard: Card): boolean {
    const actor = this.engine.currentActor();
    if (!actor || actor.action !== 'defend') return false;
    const ok = this.engine.beat(actor.player, attackCardId, defenseCard);
    if (ok) {
      this.emit({ type: 'beat', player: actor.player, attackCardId, card: defenseCard });
      this.pump();
    }
    return ok;
  }

  humanTake(): boolean {
    const actor = this.engine.currentActor();
    if (!actor || actor.action !== 'defend') return false;
    const ok = this.engine.take(actor.player);
    if (ok) {
      this.emit({ type: 'take', player: actor.player });
      this.pump();
    }
    return ok;
  }

  humanPass(): boolean {
    const actor = this.engine.currentActor();
    if (!actor || (actor.action !== 'add' && actor.action !== 'tail')) return false;
    const ok = this.engine.pass(actor.player);
    if (ok) {
      this.emit({ type: 'pass', player: actor.player });
      this.pump();
    }
    return ok;
  }
}
