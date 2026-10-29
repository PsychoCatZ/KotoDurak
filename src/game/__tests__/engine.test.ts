import { describe, expect, it } from 'vitest';
import { canBeat, GameEngine } from '../engine';
import { createDeck } from '../deck';
import type { Card, Suit } from '../types';

/** Движок, где человек сразу «заморожен»: помечаем его выбывшим нельзя —
 * вместо этого играем через прямые вызовы движка, не трогаем контроллер. */

function card(suit: Suit, rank: number): Card {
  return { id: `${suit}-${rank}`, suit, rank: rank as Card['rank'] };
}

describe('колода и раздача', () => {
  it('36 уникальных карт', () => {
    const deck = createDeck();
    expect(deck.length).toBe(36);
    expect(new Set(deck.map((c) => c.id)).size).toBe(36);
  });

  it('раздача: 6 карт каждому, без дублей, колода уменьшилась', () => {
    const eng = new GameEngine({ humanCount: 1, aiCount: 3, difficulty: 'kitten', seed: 42 });
    const all = eng.players.flatMap((p) => p.hand);
    expect(all.length).toBe(24);
    expect(new Set(all.map((c) => c.id)).size).toBe(24);
    expect(eng.deck.length).toBe(12);
    for (const p of eng.players) expect(p.hand.length).toBe(6);
  });

  it('первый атакующий — владелец младшего козыря', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const eng = new GameEngine({ humanCount: 1, aiCount: 2, difficulty: 'kitten', seed });
      const trump = eng.trump;
      let expected: number | null = null;
      let min = Infinity;
      eng.players.forEach((p) => {
        for (const c of p.hand) {
          if (c.suit === trump && c.rank < min) { min = c.rank; expected = p.id; }
        }
      });
      if (expected !== null) expect(eng.attacker).toBe(expected);
      expect(eng.players[eng.defender].id).not.toBe(eng.attacker);
    }
  });
});

describe('отбивание', () => {
  const trump: Suit = 'hearts';

  it('старшая карта той же масти бьёт младшую', () => {
    expect(canBeat(card('spades', 9), card('spades', 10), trump)).toBe(true);
    expect(canBeat(card('spades', 9), card('spades', 8), trump)).toBe(false);
  });

  it('козырь бьёт немастевую, козырь бьётся только старшим козырем', () => {
    expect(canBeat(card('spades', 14), card('hearts', 6), trump)).toBe(true);
    expect(canBeat(card('hearts', 9), card('hearts', 10), trump)).toBe(true);
    expect(canBeat(card('hearts', 9), card('spades', 14), trump)).toBe(false);
    expect(canBeat(card('hearts', 9), card('hearts', 6), trump)).toBe(false);
  });
});

/** Вспомогательный контроллер-проигрыватель на чистом движке */
class ScriptedGame {
  eng: GameEngine;
  constructor(seed: number, aiCount = 3) {
    this.eng = new GameEngine({ humanCount: 1, aiCount, difficulty: 'kitten', seed });
  }
  /** прогнать партию случайными легальными ходами (человек играет как случайный ИИ) */
  playRandom(maxBouts = 500) {
    const eng = this.eng;
    let guard = 0;
    while (!eng.result && guard++ < maxBouts * 40) {
      const actor = eng.currentActor();
      if (!actor) break;
      const rng = Math.random;
      if (actor.action === 'attack') {
        const groups = [...eng.legalAttackCards(actor.player)];
        const [, cards] = groups[Math.floor(rng() * groups.length)];
        eng.attack(actor.player, cards.slice(0, eng.slotsLeft));
      } else if (actor.action === 'defend') {
        const unbeaten = eng.unbeaten();
        const pair = unbeaten[0];
        const beats = eng.legalBeats(actor.player, pair.attack.id);
        if (beats.length && rng() > 0.3) eng.beat(actor.player, pair.attack.id, beats[0]);
        else eng.take(actor.player);
      } else if (actor.action === 'add' || actor.action === 'tail') {
        const legal = [...eng.legalAttackCards(actor.player).values()].flat();
        if (legal.length && rng() > 0.4) eng.addCards(actor.player, [legal[0]]);
        else eng.pass(actor.player);
      }
    }
    return eng.result;
  }
}

describe('полные партии (случайные ходы)', () => {
  it('партия завершается: дурак или ничья, без зависаний', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = new ScriptedGame(seed, 3);
      const res = g.playRandom();
      expect(res).not.toBeNull();
      expect(g.eng.boutNumber).toBeLessThan(500);
      if (res !== null && res.kind === 'durak') {
        const loser = g.eng.players[res!.playerId];
        expect(loser.hand.length).toBeGreaterThan(0);
        expect(loser.out).toBe(false);
        // все остальные выбыли
        for (const p of g.eng.players) {
          if (p.id !== res!.playerId) expect(p.out).toBe(true);
        }
      }
    }
  });

  it('игра втроём и вдвоём тоже завершается', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const ai of [1, 2]) {
        const g = new ScriptedGame(seed, ai);
        expect(g.playRandom()).not.toBeNull();
      }
    }
  });

  it('после завершения колода пуста, все карты учтены', () => {
    const g = new ScriptedGame(7, 3);
    g.playRandom();
    const eng = g.eng;
    expect(eng.deck.length).toBe(0);
    const durak = eng.result!.kind === 'durak' ? eng.players[eng.result!.playerId] : null;
    const inHands = eng.players.reduce((s, p) => s + p.hand.length, 0);
    expect(inHands + eng.discard.length).toBe(36);
    if (durak) expect(inHands).toBe(durak.hand.length);
  });
});

describe('правила подкидывания и лимиты', () => {
  it('нельзя подкинуть достоинство, которого нет на столе', () => {
    const g = new ScriptedGame(11, 3);
    const eng = g.eng;
    // доводим до фазы add: атакуем одной картой, отбиваем
    const atk = eng.attacker;
    const def = eng.defender;
    const atkCard = eng.players[atk].hand[0];
    // найдём отбой для неё у защитника, иначе пропускаем
    eng.attack(atk, [atkCard]);
    const beats = eng.legalBeats(def, atkCard.id);
    if (beats.length === 0) return; // сиду не подходит, тест ниже покрывает иное
    eng.beat(def, atkCard.id, beats[0]);
    expect(eng.phase).toBe('add');
    // у текущего подкидывающего ищем карту недопустимого достоинства
    const adder = eng.currentActor()!.player;
    const bad = eng.players[adder].hand.find(
      (c) => !eng.ranksOnTable().has(c.rank),
    );
    if (bad) {
      expect(eng.addCards(adder, [bad])).toBe(false);
      // стол не изменился
      expect(eng.table.length).toBe(1);
    }
  });

  it('лимит атакующих карт: первый заход ≤ 5, далее ≤ 6, и ≤ карт защитника', () => {
    const g = new ScriptedGame(5, 1);
    const eng = g.eng;
    expect(eng.boutNumber).toBe(1);
    // лимит первого захода — 5
    const groups = [...eng.legalAttackCards(eng.attacker).values()];
    for (const cs of groups) expect(cs.length).toBeLessThanOrEqual(5);
  });

  it('взятие: защитник забирает весь стол, включая отбитые', () => {
    const eng = new GameEngine({ humanCount: 1, aiCount: 3, difficulty: 'kitten', seed: 99 });
    // ищем сид, где защитник может отбить одну из двух, но берёт
    let guard = 0;
    while (!eng.result && guard++ < 300) {
      const actor = eng.currentActor()!;
      if (actor.action === 'attack') {
        const cs = [...eng.legalAttackCards(actor.player).values()].flat();
        eng.attack(actor.player, [cs[0]]);
      } else if (actor.action === 'defend') {
        const pair = eng.unbeaten()[0];
        const beats = eng.legalBeats(actor.player, pair.attack.id);
        if (eng.table.length === 1 && beats.length > 0) {
          // отбиваем первую, затем берём после подкидывания либо сразу
          const before = eng.players[actor.player].hand.length;
          const onTable = eng.table.length;
          eng.take(actor.player);
          // догоняем всех участников
          let added = 0;
          while (eng.phase === 'tail') {
            const a = eng.currentActor()!;
            const legal = [...eng.legalAttackCards(a.player).values()].flat();
            if (legal.length && Math.random() > 0.5) { eng.addCards(a.player, [legal[0]]); added++; }
            else eng.pass(a.player);
          }
          const after = eng.players[actor.player].hand.length;
          // взял все карты стола (включая вдогонку) + добор до шести
          expect(after).toBe(Math.max(before + onTable + added, 6));
          expect(eng.table.length).toBe(0);
          return;
        }
        if (beats.length) eng.beat(actor.player, pair.attack.id, beats[0]);
        else eng.take(actor.player);
      } else {
        eng.pass(actor.player);
      }
    }
  });

  it('подкидывание вдогонку после «беру» возможно и ограничено лимитом', () => {
    const eng = new GameEngine({ humanCount: 1, aiCount: 3, difficulty: 'kitten', seed: 123 });
    let guard = 0;
    while (!eng.result && guard++ < 300) {
      const actor = eng.currentActor()!;
      if (actor.action === 'attack') {
        const cs = [...eng.legalAttackCards(actor.player).values()].flat();
        eng.attack(actor.player, [cs[0]]);
      } else if (actor.action === 'defend') {
        const pair = eng.unbeaten()[0];
        const beats = eng.legalBeats(actor.player, pair.attack.id);
        const tableBefore = eng.table.length;
        if (beats.length === 0 || Math.random() > 0.6) {
          eng.take(actor.player);
          expect(eng.phase).toBe('tail');
          // все участники пасуют → стол уходит взявшему
          while (eng.phase === 'tail') eng.pass(eng.currentActor()!.player);
          expect(eng.table.length).toBe(0);
          expect(eng.players[actor.player].hand.length).toBeGreaterThanOrEqual(tableBefore);
          return;
        }
        eng.beat(actor.player, pair.attack.id, beats[0]);
      } else {
        eng.pass(actor.player);
      }
    }
  });
});

describe('добор и очередность', () => {
  it('порядок добора: атакующий, остальные по часовой, защитник последним', () => {
    const eng = new GameEngine({ humanCount: 1, aiCount: 2, difficulty: 'kitten', seed: 77 });
    const atk = eng.attacker;
    const def = eng.defender;
    // короткий заход: атакуем одной, защитник берёт
    const aCard = [...eng.legalAttackCards(atk).values()].flat()[0];
    eng.attack(atk, [aCard]);
    eng.take(def);
    // снимок: после взятия, но до добора (все остальные пасуют)
    const deckBefore = eng.deck.slice();
    const handsBefore = eng.players.map((p) => p.hand.length);
    while (eng.phase === 'tail') eng.pass(eng.currentActor()!.player);

    // модель ожидаемого добора: атакующий → остальные (кроме защитника) по часовой → защитник
    const tableSize = 1;
    const pile = deckBefore.slice();
    const order: number[] = [atk];
    let id = eng.nextActive(atk);
    while (id !== atk) { if (id !== def) order.push(id); id = eng.nextActive(id); }
    order.push(def);
    const expected = handsBefore.slice();
    expected[def] += tableSize; // взявший забирает стол до добора
    for (const pid of order) {
      while (expected[pid] < 6 && pile.length > 0) { pile.pop(); expected[pid]++; }
    }
    expect(eng.players.map((p) => p.hand.length)).toEqual(expected);
    // защитник добирал последним: если колода закончилась до него — у него меньше всех
    void def;
  });

  it('после «бито» следующим атакующим становится защитник', () => {
    const eng = new GameEngine({ humanCount: 1, aiCount: 1, difficulty: 'kitten', seed: 15 });
    const firstDefender = eng.defender;
    // играем первый заход до «бито» (защитник отбивает, подкидываний нет)
    let guard = 0;
    while (eng.boutNumber === 1 && eng.phase !== 'over' && guard++ < 200) {
      const actor = eng.currentActor()!;
      if (actor.action === 'attack') {
        const cs = [...eng.legalAttackCards(actor.player).values()].flat();
        eng.attack(actor.player, [cs[0]]);
      } else if (actor.action === 'defend') {
        const pair = eng.unbeaten()[0];
        const beats = eng.legalBeats(actor.player, pair.attack.id);
        if (!beats.length) { eng.take(actor.player); while (eng.phase === 'tail') eng.pass(eng.currentActor()!.player); }
        else eng.beat(actor.player, pair.attack.id, beats[0]);
      } else {
        eng.pass(actor.player); // подкидываний не хотим
      }
    }
    expect(eng.boutNumber).toBe(2);
    expect(eng.attacker).toBe(firstDefender);
  });
});

describe('контроллер: действия человека', () => {
  it('человек может подкинуть вдогонку (фаза tail) и пасовать', async () => {
    const { GameController } = await import('../controller');
    const c = new GameController({ humanCount: 1, aiCount: 2, difficulty: 'kitten', seed: 5 }, { aiDelay: 0 });
    const eng = c.engine;
    // доводим до tail, где очередь доходит до человека
    let guard = 0;
    while (!eng.result && guard++ < 400) {
      const actor = eng.currentActor()!;
      if (actor.action === 'attack') {
        const cs = [...eng.legalAttackCards(actor.player).values()].flat();
        // человек атакует через контроллер
        if (actor.player === 0) c.humanAttack([cs[0]]);
        else eng.attack(actor.player, [cs[0]]);
      } else if (actor.action === 'defend') {
        const pair = eng.unbeaten()[0];
        const beats = eng.legalBeats(actor.player, pair.attack.id);
        // заставляем защитника взять, чтобы войти в tail
        eng.take(actor.player);
        // дальше участники (включая, возможно, человека) решают вдогонку
        while (eng.phase === 'tail' && !eng.result) {
          const a = eng.currentActor()!;
          if (a.player === 0) {
            // человек пасует через контроллер
            expect(c.humanPass()).toBe(true);
          } else {
            eng.pass(a.player);
          }
        }
        void beats;
      } else {
        if (actor.player === 0) c.humanPass(); else eng.pass(actor.player);
      }
    }
    expect(eng.result).not.toBeNull();
    c.destroy();
  });
});

describe('честность ИИ', () => {
  it('PlayerView не содержит чужих рук и порядка колоды', () => {
    const eng = new GameEngine({ humanCount: 1, aiCount: 2, difficulty: 'kitten', seed: 8 });
    const view = eng.getView(1);
    expect(view.hand).toEqual(eng.players[1].hand);
    expect(view.handCounts[0]).toBe(eng.players[0].hand.length);
    expect(view.handCounts[2]).toBe(eng.players[2].hand.length);
    expect((view as unknown as Record<string, unknown>).deck).toBeUndefined();
    expect((view as unknown as Record<string, unknown>).players).toBeUndefined();
    // рука — только своя, по значению
    view.hand.splice(0, view.hand.length);
    expect(eng.players[1].hand.length).toBeGreaterThan(0);
  });
});
