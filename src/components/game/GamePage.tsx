import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameController, type Phrase } from '@/game/controller';
import { DIFFICULTY_NAMES, AI_CHARACTERS } from '@/game/cats';
import { sfx, setMuted, isMuted } from '@/game/sound';
import type { Card, GameConfig } from '@/game/types';
import { canBeat } from '@/game/engine';
import { CardFace } from './CardView';
import { CatAvatar } from './CatSvg';

interface Bubble extends Phrase { id: number }

let bubbleId = 0;

export function GamePage({ config, onExit, onRematch }: { config: GameConfig; onExit: () => void; onRematch: () => void }) {
  const [, setTick] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selHand, setSelHand] = useState<string | null>(null);
  const [selTarget, setSelTarget] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [drag, setDrag] = useState<{ cardId: string; x: number; y: number; targetId: string | null } | null>(null);
  const dragRef = useRef<{ cardId: string; startX: number; startY: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef<{ id: string; until: number } | null>(null);
  const controllerRef = useRef<GameController | null>(null);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  const controller = useMemo(() => {
    const c = new GameController(config, {
      aiDelay: 750,
      onChange: rerender,
      onEvent: (e) => {
        switch (e.type) {
          case 'attack': sfx.attack(); break;
          case 'add': sfx.add(); break;
          case 'beat': sfx.beat(); break;
          case 'take': sfx.take(); break;
          case 'pass': sfx.pass(); break;
          case 'gameOver': {
            const r = c.engine.result;
            if (r?.kind === 'durak' && r.playerId === 0) sfx.lose(); else sfx.win();
            break;
          }
        }
        setSelected([]); setSelHand(null); setSelTarget(null);
      },
      onPhrase: (p) => {
        sfx.meow();
        const b: Bubble = { ...p, id: ++bubbleId };
        setBubbles((bs) => [...bs.slice(-3), b]);
        setTimeout(() => setBubbles((bs) => bs.filter((x) => x.id !== b.id)), 2800);
      },
    });
    controllerRef.current = c;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => controller.destroy(), [controller]);
  useEffect(() => { controller.pump(); }, [controller]);

  const eng = controller.engine;
  const actor = eng.currentActor();
  const humanActor = actor && eng.players[actor.player].isHuman ? actor : null;
  const result = eng.result;

  // ─── подсветка доступных карт ──────────────────────────────────────────
  const attackGroups = useMemo(() => {
    if (!humanActor || (humanActor.action !== 'attack' && humanActor.action !== 'add' && humanActor.action !== 'tail')) return null;
    return eng.legalAttackCards(0);
  }, [eng, humanActor]);

  const legalIds = useMemo(() => {
    if (!humanActor) return new Set<string>();
    if (humanActor.action === 'attack') {
      // доступны карты выбранного достоинства, либо любые, если ничего не выбрано
      if (selected.length === 0) return new Set(eng.players[0].hand.map((c) => c.id));
      const rank = eng.players[0].hand.find((c) => c.id === selected[0])?.rank;
      return new Set(eng.players[0].hand.filter((c) => c.rank === rank).map((c) => c.id));
    }
    if (humanActor.action === 'add' || humanActor.action === 'tail') {
      return new Set([...attackGroups!.values()].flat().map((c) => c.id));
    }
    if (humanActor.action === 'defend') {
      if (selTarget) return new Set(eng.legalBeats(0, selTarget).map((c) => c.id));
      if (selHand) {
        const card = eng.players[0].hand.find((c) => c.id === selHand);
        if (card) {
          return new Set(
            eng.unbeaten().filter((p) => canBeat(p.attack, card, eng.trump)).map((p) => p.attack.id),
          );
        }
      }
      return new Set(eng.players[0].hand.map((c) => c.id));
    }
    return new Set<string>();
  }, [eng, humanActor, selected, selHand, selTarget, attackGroups]);

  // ─── перетаскивание карт (тач и мышь) ─────────────────────────────────
  const onCardPointerDown = (e: React.PointerEvent, card: Card) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!humanActor) return;
    dragRef.current = { cardId: card.id, startX: e.clientX, startY: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const attackTargetAt = (x: number, y: number): string | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el instanceof HTMLElement && el.dataset.attackId) return el.dataset.attackId;
    }
    return null;
  };

  const overTableArea = (x: number, y: number): boolean =>
    document.elementsFromPoint(x, y).some(
      (el) => el instanceof HTMLElement && (el.classList.contains('pairs-area') || el.classList.contains('table-center')),
    );

  const onCardPointerMove = (e: React.PointerEvent, card: Card) => {
    const d = dragRef.current;
    if (!d || d.cardId !== card.id) return;
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 12) return;
      d.dragging = true;
    }
    setDrag({ cardId: card.id, x: e.clientX, y: e.clientY, targetId: attackTargetAt(e.clientX, e.clientY) });
  };

  const onCardPointerUp = (e: React.PointerEvent, card: Card) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.cardId !== card.id || !d.dragging) return; // обычный тап — обработает onClick
    setDrag(null);
    suppressClickRef.current = { id: card.id, until: Date.now() + 400 };
    const x = e.clientX, y = e.clientY;
    if (!humanActor) return;
    if (humanActor.action === 'defend') {
      const targetId = attackTargetAt(x, y);
      if (targetId && eng.legalBeats(0, targetId).some((c) => c.id === card.id)) {
        sfx.flip();
        controller.humanBeat(targetId, card);
        setSelHand(null); setSelTarget(null);
      }
    } else if (humanActor.action === 'attack') {
      if (overTableArea(x, y)) { sfx.flip(); controller.humanAttack([card]); setSelected([]); }
    } else if (humanActor.action === 'add' || humanActor.action === 'tail') {
      if (overTableArea(x, y) && legalIds.has(card.id)) { sfx.flip(); controller.humanAdd([card]); setSelected([]); }
    }
  };

  const onCardPointerCancel = (card: Card) => {
    if (dragRef.current?.cardId === card.id) { dragRef.current = null; setDrag(null); }
  };

  // ─── действия человека ─────────────────────────────────────────────────
  const onHandCard = (card: Card) => {
    if (!humanActor) return;
    const sup = suppressClickRef.current;
    if (sup && sup.id === card.id && Date.now() < sup.until) return;
    sfx.click();
    if (humanActor.action === 'attack') {
      const rank = eng.players[0].hand.find((c) => c.id === selected[0])?.rank;
      if (selected.includes(card.id)) {
        setSelected(selected.filter((id) => id !== card.id));
      } else if (selected.length === 0 || rank === card.rank) {
        const group = eng.players[0].hand.filter((c) => c.rank === card.rank).map((c) => c.id);
        const max = Math.min(group.length, eng.slotsLeft);
        setSelected([...selected, card.id].slice(0, max));
      }
    } else if (humanActor.action === 'defend') {
      if (selTarget && eng.legalBeats(0, selTarget).some((c) => c.id === card.id)) {
        controller.humanBeat(selTarget, card);
        setSelHand(null); setSelTarget(null);
      } else {
        setSelHand(selHand === card.id ? null : card.id);
      }
    } else if (humanActor.action === 'add' || humanActor.action === 'tail') {
      if (legalIds.has(card.id)) {
        controller.humanAdd([card]);
        setSelected([]);
      }
    }
  };

  const onTableCard = (attackCardId: string) => {
    if (!humanActor || humanActor.action !== 'defend') return;
    sfx.click();
    if (selHand) {
      const card = eng.players[0].hand.find((c) => c.id === selHand);
      if (card && canBeat(eng.table.find((p) => p.attack.id === attackCardId)!.attack, card, eng.trump)) {
        controller.humanBeat(attackCardId, card);
        setSelHand(null); setSelTarget(null);
        return;
      }
    }
    setSelTarget(selTarget === attackCardId ? null : attackCardId);
  };

  const doAttack = () => {
    const cards = eng.players[0].hand.filter((c) => selected.includes(c.id));
    if (cards.length) { sfx.flip(); controller.humanAttack(cards); setSelected([]); }
  };

  const statusText = (() => {
    if (result) {
      if (result.kind === 'draw') return 'Ничья! Коты разделили honor.';
      return result.kind === 'durak' && result.playerId === 0
        ? 'Вы — дурак… но почётный! Мяу.'
        : result.kind === 'durak'
          ? `${eng.players[result.playerId].name} остался с картами. Поздравляем, вы не дурак!`
          : 'Партия окончена.';
    }
    if (!actor) return '';
    const nm = eng.players[actor.player].name;
    switch (actor.action) {
      case 'attack': return actor.player === 0 ? 'Ваш заход: выберите карты и нажмите «Ходить»' : `${nm} размышляет над заходом…`;
      case 'defend': return actor.player === 0 ? 'Отбивайтесь или берите карты' : `${nm} защищается…`;
      case 'add': return actor.player === 0 ? 'Можете подкинуть карту или пасовать' : `${nm} решает, подкидывать ли…`;
      case 'tail': return actor.player === 0 ? 'Подкиньте карту вдогонку или пасуйте' : `${nm} думает, подкинуть ли вдогонку…`;
    }
  })();

  const trumpCard: Card | null = eng.deck.length > 0 ? eng.deck[0] : null;
  const opponents = eng.players.filter((p) => !p.isHuman);

  return (
    <div className="game-root">
      <header className="game-topbar">
        <button className="btn ghost" onClick={() => setConfirmNew(true)}>Новая партия</button>
        <div className="status-line">{statusText}</div>
        <div className="topbar-right">
          <span className="diff-badge">{DIFFICULTY_NAMES[config.difficulty]}</span>
          <button className="btn ghost" onClick={() => { setMuted(!isMuted()); rerender(); }}>
            {isMuted() ? '🔇' : '🔊'}
          </button>
          <button className="btn ghost" onClick={onExit}>В меню</button>
        </div>
      </header>

      <div className={`table-grid opponents-${opponents.length}`}>
        {opponents.map((p) => {
          const ch = AI_CHARACTERS[p.character];
          const isActorNow = actor?.player === p.id;
          const role = p.id === eng.attacker ? 'attacker' : p.id === eng.defender ? 'defender' : null;
          const bubble = bubbles.filter((b) => b.player === p.id).pop();
          return (
            <div key={p.id} className={`opponent ${isActorNow ? 'acting' : ''} ${p.out ? 'out' : ''}`}>
              {bubble && <div className="bubble">{bubble.text}</div>}
              <div className="avatar-wrap">
                <CatAvatar fur={ch.fur} furDark={ch.furDark} accent={ch.accent} eyes={ch.eyes}
                  accessory={p.character === 0 ? 'monocle' : p.character === 2 ? 'tiara' : p.character === 3 ? 'scarf' : 'cap'} size={56} />
                {role && <span className={`role-badge ${role}`}>{role === 'attacker' ? 'атака' : 'защита'}</span>}
              </div>
              <div className="opponent-name">{p.name}</div>
              <div className="opponent-cards">
                {p.out ? <span className="out-label">выбыл</span> :
                  Array.from({ length: Math.min(p.hand.length, 10) }, (_, i) => (
                    <span key={i} className="mini-back" style={{ marginLeft: i ? -14 : 0 }} />
                  ))}
                {!p.out && <span className="count-badge">{p.hand.length}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="table-center">
        <div className="deck-area">
          <div className="deck-pile">
            {eng.deck.length > 0 && <CardFace faceDown />}
            <span className="count-badge deck-count">{eng.deck.length}</span>
          </div>
          {trumpCard && (
            <div className="trump-card" title={`Козырь: ${trumpCard.suit}`}>
              <CardFace card={trumpCard} />
            </div>
          )}
          <div className="trump-label">Козырь</div>
        </div>

        <div className="pairs-area">
          {eng.table.length === 0 && <div className="table-hint">Стол пуст — ждём захода…</div>}
          {eng.table.map((pair, i) => (
            <div key={pair.attack.id} className="pair" style={{ transform: `rotate(${(i % 3 - 1) * 4}deg)` }}>
              <div className={`pair-card attack ${selTarget === pair.attack.id || drag?.targetId === pair.attack.id ? 'selected' : ''} ${!pair.defense && humanActor?.action === 'defend' ? 'beatable-target' : ''}`}
                data-attack-id={pair.attack.id}
                onClick={() => onTableCard(pair.attack.id)}>
                <CardFace card={pair.attack} />
              </div>
              {pair.defense && (
                <div className="pair-card defense">
                  <CardFace card={pair.defense} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="discard-area">
          <div className={`discard-pile ${eng.discard.length ? '' : 'empty'}`}>
            {eng.discard.length > 0 && <CardFace faceDown />}
          </div>
          <span className="count-badge">{eng.discard.length}</span>
          <div className="trump-label">Отбой</div>
        </div>
      </div>

      <div className="hand-area">
        <div className="hand-cards">
          {eng.players[0].hand.map((card, i) => {
            const isSel = selected.includes(card.id) || selHand === card.id;
            const legal = legalIds.has(card.id);
            return (
              <div key={card.id}
                className={`hand-card ${isSel ? 'selected' : ''} ${legal && humanActor ? 'legal' : ''} ${drag?.cardId === card.id ? 'dragging' : ''}`}
                style={{ marginLeft: i ? -34 : 0, zIndex: i }}
                onClick={() => onHandCard(card)}
                onPointerDown={(e) => onCardPointerDown(e, card)}
                onPointerMove={(e) => onCardPointerMove(e, card)}
                onPointerUp={(e) => onCardPointerUp(e, card)}
                onPointerCancel={() => onCardPointerCancel(card)}>
                <CardFace card={card} />
              </div>
            );
          })}
          {eng.players[0].hand.length === 0 && (
            <div className="out-label big">{result ? '' : 'У вас нет карт — вы выбываете!'}</div>
          )}
        </div>

        <div className="action-bar">
          {humanActor?.action === 'attack' && (
            <button className="btn primary" disabled={selected.length === 0} onClick={doAttack}>
              Ходить {selected.length > 1 ? `(${selected.length})` : ''}
            </button>
          )}
          {humanActor?.action === 'defend' && (
            <>
              <button className="btn danger" onClick={() => { sfx.flip(); controller.humanTake(); }}>Беру</button>
              <span className="action-hint">кликните карту, затем цель — или перетащите её на цель</span>
            </>
          )}
          {(humanActor?.action === 'add' || humanActor?.action === 'tail') && (
            <button className="btn" onClick={() => controller.humanPass()}>Пас / больше не подкидываю</button>
          )}
          {!humanActor && !result && <span className="action-hint">ходят противники…</span>}
        </div>
      </div>

      {drag && (() => {
        const dc = eng.players[0].hand.find((c) => c.id === drag.cardId);
        return dc ? (
          <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
            <CardFace card={dc} />
          </div>
        ) : null;
      })()}

      {result && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-cat">🐈‍⬛</div>
            <h2>
              {result.kind === 'draw' ? 'Ничья!' :
                result.kind === 'durak' && result.playerId === 0 ? 'Вы — дурак!' : 'Победа!'}
            </h2>
            <p>{statusText}</p>
            <div className="overlay-actions">
              <button className="btn primary" onClick={onRematch}>Ещё партию</button>
              <button className="btn" onClick={onExit}>В меню</button>
            </div>
          </div>
        </div>
      )}

      {confirmNew && (
        <div className="overlay" onClick={() => setConfirmNew(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <h3>Начать новую партию?</h3>
            <p>Текущая партия будет сдана заново.</p>
            <div className="overlay-actions">
              <button className="btn primary" onClick={() => { setConfirmNew(false); onRematch(); }}>Да, новая партия</button>
              <button className="btn" onClick={() => setConfirmNew(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
