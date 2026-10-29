import { canBeat } from './engine';
import type { Card, Difficulty, PlayerId, PlayerView } from './types';

/**
 * Решения ИИ. Каждой стратегии передаётся только PlayerView —
 * собственная рука, стол, козырь, отбой и счётчики карт.
 * Никакого доступа к закрытым рукам или колоде.
 */

export type AiAction =
  | { type: 'attack'; cards: Card[] }
  | { type: 'add'; cards: Card[] }
  | { type: 'beat'; attackCardId: string; defenseCard: Card }
  | { type: 'take' }
  | { type: 'pass' };

type Rng = () => number;

function cardPower(c: Card, trump: Card['suit']): number {
  return c.rank + (c.suit === trump ? 20 : 0);
}

function rngOf(view: PlayerView): Rng {
  // локальный генератор на основе публичного состояния — без чтения колоды
  let h = view.you * 2654435761 ^ view.deckCount * 97 ^ view.discard.length * 13 ^ view.boutNumber;
  return () => {
    h |= 0; h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Все варианты отбоя: для каждой неотбитой карты — подходящие карты с руки */
function beatOptions(view: PlayerView): { attackCardId: string; cards: Card[] }[] {
  const opts: { attackCardId: string; cards: Card[] }[] = [];
  for (const pair of view.table) {
    if (pair.defense) continue;
    const cards = view.hand.filter((c) => canBeat(pair.attack, c, view.trump));
    if (cards.length > 0) opts.push({ attackCardId: pair.attack.id, cards });
  }
  return opts;
}

function cheapest(cards: Card[], trump: Card['suit']): Card {
  return cards.slice().sort((a, b) => cardPower(a, trump) - cardPower(b, trump))[0];
}

// ─── Лёгкий: «Котёнок» — случайные решения, случайные ошибки ────────────

function kittenAct(view: PlayerView, rng: Rng): AiAction {
  if (view.phase === 'attack') {
    const groups = [...view.hand.reduce((m, c) => {
      const a = m.get(c.rank) ?? []; a.push(c); m.set(c.rank, a); return m;
    }, new Map<number, Card[]>())];
    const [, cards] = pick(rng, groups);
    const k = Math.max(1, Math.min(1 + Math.floor(rng() * cards.length), view.slotsLeft));
    return { type: 'attack', cards: cards.slice(0, k) };
  }
  if (view.phase === 'defend') {
    const opts = beatOptions(view);
    if (opts.length > 0 && rng() > 0.22) {
      // иногда берёт, хотя мог бы отбиться
      const o = pick(rng, opts);
      return { type: 'beat', attackCardId: o.attackCardId, defenseCard: pick(rng, o.cards) };
    }
    return { type: 'take' };
  }
  if (view.phase === 'add' || view.phase === 'tail') {
    if (view.phase === 'tail' ? rng() > 0.45 : rng() > 0.5) {
      const legal = legalAddCards(view);
      if (legal.length > 0) {
        return { type: 'add', cards: [pick(rng, legal)] };
      }
    }
    return { type: 'pass' };
  }
  return { type: 'pass' };
}

// ─── Средний: «Дворовый кот» — бережёт старшие карты и козыри ───────────

function alleyAct(view: PlayerView): AiAction {
  if (view.phase === 'attack') {
    // ходим младшими немастевыми картами; несколько одного достоинства — если есть
    const sorted = view.hand
      .slice()
      .sort((a, b) => cardPower(a, view.trump) - cardPower(b, view.trump));
    const first = sorted[0];
    const same = sorted.filter((c) => c.rank === first.rank);
    const k = Math.min(same.length, view.slotsLeft, 2);
    return { type: 'attack', cards: same.slice(0, k) };
  }
  if (view.phase === 'defend') {
    const opts = beatOptions(view);
    if (opts.length === 0) return { type: 'take' };
    // выбираем самый дешёвый способ отбиться по суммарной силе
    let best: { attackCardId: string; defenseCard: Card } | null = null;
    let bestCost = Infinity;
    for (const o of opts) {
      const c = cheapest(o.cards, view.trump);
      const cost = cardPower(c, view.trump);
      if (cost < bestCost) { bestCost = cost; best = { attackCardId: o.attackCardId, defenseCard: c }; }
    }
    // не тратим козырь на мелкую карту, если козырей мало, а карта атаки слабая
    if (best && best.defenseCard.suit === view.trump) {
      const atk = view.table.find((p) => p.attack.id === best!.attackCardId)!.attack;
      if (atk.suit !== view.trump && atk.rank <= 9 && view.hand.filter((c) => c.suit === view.trump).length <= 2) {
        // но только если альтернативы нет — тогда берём
        const nonTrump = opts.find((o) => o.cards.some((c) => c.suit !== view.trump));
        if (!nonTrump) return { type: 'take' };
      }
    }
    return best ? { type: 'beat', attackCardId: best.attackCardId, defenseCard: best.defenseCard } : { type: 'take' };
  }
  if (view.phase === 'add' || view.phase === 'tail') {
    const legal = legalAddCards(view);
    if (legal.length === 0) return { type: 'pass' };
    // подкидываем самые слабые карты; вдогонку — охотнее
    const sorted = legal.sort((a, b) => cardPower(a, view.trump) - cardPower(b, view.trump));
    const weakest = sorted[0];
    // не жжём козырей без нужды
    if (weakest.suit === view.trump && view.phase === 'add' && sorted.some((c) => c.suit !== view.trump)) {
      return { type: 'add', cards: [sorted.find((c) => c.suit !== view.trump)!] };
    }
    if (view.phase === 'tail') return { type: 'add', cards: [weakest] };
    // в обычном подкидывании — только если карта совсем слабая или у защитника мало карт
    const defenderLow = (view.handCounts[view.defender] ?? 6) <= 2;
    if (weakest.rank <= 9 || defenderLow) return { type: 'add', cards: [weakest] };
    return { type: 'pass' };
  }
  return { type: 'pass' };
}

// ─── Сложный: «КотоМагистр» — память, вероятности, планирование ─────────

/** Вероятность, что у защитника найдётся чем отбить карту данной масти/ранга */
function defenderCoverage(view: PlayerView, attackCard: Card): number {
  // известно: отбой, нашу руку, стол. Неизвестно: колода и руки остальных.
  const seen = new Set<string>();
  for (const c of view.discard) seen.add(c.id);
  for (const c of view.hand) seen.add(c.id);
  for (const p of view.table) { seen.add(p.attack.id); if (p.defense) seen.add(p.defense.id); }

  let canBeatCount = 0;
  let unknownTotal = 0;
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    for (let rank = 6; rank <= 14; rank++) {
      const id = `${suit}-${rank}`;
      if (seen.has(id)) continue;
      unknownTotal++;
      const c: Card = { id, suit, rank: rank as Card['rank'] };
      if (canBeat(attackCard, c, view.trump)) canBeatCount++;
    }
  }
  if (unknownTotal === 0) return 0;
  // у защитника примерно handCounts[defender] неизвестных карт
  const defCards = Math.max(0, view.handCounts[view.defender] ?? 0);
  // вероятность «ни одной подходящей» ≈ C(N-k, d) / C(N, d) ≈ ((N-k)/N)^d
  const pNone = Math.pow(1 - canBeatCount / unknownTotal, defCards);
  return 1 - pNone;
}

function masterAct(view: PlayerView, rng: Rng): AiAction {
  const hand = view.hand.slice();
  const trumpCards = hand.filter((c) => c.suit === view.trump);
  const deckEmpty = view.deckCount === 0;

  if (view.phase === 'attack') {
    // оцениваем каждое достоинство: цена для нас vs шанс, что защитник не отобьёт
    const groups = new Map<number, Card[]>();
    for (const c of hand) {
      const a = groups.get(c.rank) ?? []; a.push(c); groups.set(c.rank, a);
    }
    let best: { rank: number; score: number; cards: Card[] } | null = null;
    for (const [rank, cards] of groups) {
      const k = Math.min(cards.length, view.slotsLeft);
      const chosen = cards
        .slice()
        .sort((a, b) => cardPower(a, view.trump) - cardPower(b, view.trump))
        .slice(0, k);
      const avgPower = chosen.reduce((s, c) => s + cardPower(c, view.trump), 0) / chosen.length;
      const probe: Card = { id: 'probe', suit: chosen[0].suit, rank: rank as Card['rank'] };
      const coverage = defenderCoverage(view, probe);
      // концовка: если у защитника мало карт, давим всем подряд
      const defLow = (view.handCounts[view.defender] ?? 6) <= 2;
      // базовый приём дурака: одиночная младшая немастевая карта — её чаще отбивают,
      // карты уходят в отбой, партия движется к концу; мультиход — только по делу
      const multiBonus = k > 1 ? (defLow || deckEmpty ? 1.2 : -0.8) : 0;
      const score = (1 - coverage) * 6 - avgPower / 4 + multiBonus;
      if (!best || score > best.score) best = { rank, score, cards: chosen };
    }
    return best ? { type: 'attack', cards: best.cards } : { type: 'pass' };
  }

  if (view.phase === 'defend') {
    const opts = beatOptions(view);
    if (opts.length === 0) return { type: 'take' };
    // жадно: для каждой неотбитой карты выбираем дешёвый отбой,
    // с учётом того, что одна карта может подойти к нескольким атакам — берём разные
    const unbeaten = view.table.filter((p) => !p.defense);
    const used = new Set<string>();
    const plan: { attackCardId: string; defenseCard: Card; cost: number }[] = [];
    for (const pair of unbeaten) {
      const o = opts.find((x) => x.attackCardId === pair.attack.id);
      if (!o) return { type: 'take' }; // чем-то отбиться нельзя
      const candidates = o.cards.filter((c) => !used.has(c.id));
      if (candidates.length === 0) return { type: 'take' };
      const c = cheapest(candidates, view.trump);
      used.add(c.id);
      plan.push({ attackCardId: pair.attack.id, defenseCard: c, cost: cardPower(c, view.trump) });
    }
    const attackValue = unbeaten.reduce((s, p) => s + p.attack.rank, 0);
    const spendTrump = plan.filter((p) => p.defenseCard.suit === view.trump).length;

    // Сознательное взятие — редкость: только в концовке, когда отбой сожжёт
    // последние козыри, а взятые карты мелкие и рука так или иначе короткая.
    // Бить почти всегда выгодно: отбой избавляет от своих карт.
    if (deckEmpty && spendTrump > 0 && trumpCards.length <= 2 &&
        attackValue <= 16 && view.hand.length <= 5) {
      return { type: 'take' };
    }
    // отбиваемся самым дешёвым ходом первой пары
    const first = plan[0];
    return { type: 'beat', attackCardId: first.attackCardId, defenseCard: first.defenseCard };
  }

  if (view.phase === 'add' || view.phase === 'tail') {
    const legal = legalAddCards(view);
    if (legal.length === 0) return { type: 'pass' };
    const sorted = legal.sort((a, b) => cardPower(a, view.trump) - cardPower(b, view.trump));
    // Мастер подкидывает с расчётом: слабые карты всегда, козыри — вдогонку или в концовке
    const weakest = sorted[0];
    const defLow = (view.handCounts[view.defender] ?? 6) <= 2;
    if (view.phase === 'tail') {
      // вдогонку кидаем самое мелкое, козырь — если защитник на грани
      if (weakest.suit === view.trump && !defLow && sorted.some((c) => c.suit !== view.trump)) {
        return { type: 'add', cards: [sorted.find((c) => c.suit !== view.trump)!] };
      }
      return { type: 'add', cards: [weakest] };
    }
    if (weakest.suit !== view.trump && (weakest.rank <= 10 || defLow)) {
      return { type: 'add', cards: [weakest] };
    }
    if (defLow && weakest.suit === view.trump && deckEmpty) {
      return { type: 'add', cards: [weakest] }; // добиваем в концовке
    }
    void rng;
    return { type: 'pass' };
  }

  return { type: 'pass' };
}

/** Карты, разрешённые для подкидывания сейчас (с учётом достоинств на столе) */
function legalAddCards(view: PlayerView): Card[] {
  if (view.slotsLeft <= 0) return [];
  const ranks = new Set<number>();
  for (const p of view.table) {
    ranks.add(p.attack.rank);
    if (p.defense) ranks.add(p.defense.rank);
  }
  return view.hand.filter((c) => ranks.has(c.rank));
}

// ─── Точка входа ────────────────────────────────────────────────────────

export function decide(view: PlayerView, difficulty: Difficulty, playerId: PlayerId): AiAction {
  const rng = rngOf(view);
  void playerId;
  switch (difficulty) {
    case 'kitten': return kittenAct(view, rng);
    case 'alley': return alleyAct(view);
    case 'master': return masterAct(view, rng);
  }
}
