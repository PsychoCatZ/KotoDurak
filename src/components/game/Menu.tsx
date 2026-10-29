import { useState } from 'react';
import { DIFFICULTY_DESCRIPTIONS, DIFFICULTY_NAMES } from '@/game/cats';
import { setMuted, isMuted } from '@/game/sound';
import type { Difficulty } from '@/game/types';
import { CatAvatar } from './CatSvg';
import { AI_CHARACTERS } from '@/game/cats';

const MODES = [
  { ai: 1, title: 'Дуэль', desc: 'Вы + 1 кот' },
  { ai: 2, title: 'Три кота', desc: 'Вы + 2 кота' },
  { ai: 3, title: 'Котобанда', desc: 'Вы + 3 кота' },
];

const DIFFS: Difficulty[] = ['kitten', 'alley', 'master'];

export function Menu({ onStart }: { onStart: (ai: number, diff: Difficulty) => void }) {
  const [ai, setAi] = useState(3);
  const [diff, setDiff] = useState<Difficulty>('master');
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="menu-root">
      <div className="menu-card">
        <div className="menu-logo">🐈‍⬛</div>
        <h1 className="menu-title">КотоДурак</h1>
        <p className="menu-sub">Подкидной дурак КотоИмперии. Без человеческих королей — только коты.</p>

        <h3 className="menu-h">Соперники</h3>
        <div className="mode-row">
          {MODES.map((m) => (
            <button key={m.ai} className={`mode-btn ${ai === m.ai ? 'active' : ''}`} onClick={() => setAi(m.ai)}>
              <strong>{m.title}</strong>
              <span>{m.desc}</span>
            </button>
          ))}
        </div>

        <h3 className="menu-h">Сложность</h3>
        <div className="mode-row">
          {DIFFS.map((d) => (
            <button key={d} className={`mode-btn ${diff === d ? 'active' : ''}`} onClick={() => setDiff(d)}
              title={DIFFICULTY_DESCRIPTIONS[d]}>
              <strong>{DIFFICULTY_NAMES[d]}</strong>
            </button>
          ))}
        </div>
        <p className="diff-desc">{DIFFICULTY_DESCRIPTIONS[diff]}</p>

        <button className="btn primary big" onClick={() => onStart(ai, diff)}>Играть!</button>

        <div className="menu-footer">
          <button className="btn ghost" onClick={() => setShowRules(true)}>Правила</button>
          <button className="btn ghost" onClick={() => { setMuted(!isMuted()); }}>
            {isMuted() ? '🔇 Звук выкл' : '🔊 Звук вкл'}
          </button>
        </div>

        <div className="menu-cats">
          {AI_CHARACTERS.slice(0, ai).map((c, i) => (
            <div key={c.name} className="menu-cat" title={c.personality}>
              <CatAvatar fur={c.fur} furDark={c.furDark} accent={c.accent} eyes={c.eyes}
                accessory={i === 0 ? 'monocle' : i === 2 ? 'tiara' : i === 3 ? 'scarf' : 'cap'} size={44} />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="overlay-card rules" onClick={(e) => e.stopPropagation()}>
            <h3>Правила подкидного дурака</h3>
            <ul>
              <li>Колода 36 карт. Каждому по 6. Открытая карта под колодой задаёт козырь.</li>
              <li>Первым ходит владелец младшего козыря.</li>
              <li>Атакующий заходит картой (или несколькими одного достоинства). Защитник должен побить каждую: старшей картой той же масти или козырем; козырь — только старшим козырем.</li>
              <li>Остальные коты могут подкидывать карты достоинств, уже лежащих на столе. Лимит: 5 карт в первом заходе, 6 далее, и не больше, чем карт у защитника.</li>
              <li>Заход заканчивается, когда всё отбито и никто не подкидывает («бито»), либо когда защитник берёт стол.</li>
              <li>После захода все добирают до шести: атакующий, остальные по часовой, защитник последним.</li>
              <li>Кто избавился от карт при пустой колоде — выбыл. Последний с картами — дурак.</li>
              <li>Переводов, союзов и обменов шестёрки нет. Каждый кот — сам за себя.</li>
            </ul>
            <div className="overlay-actions">
              <button className="btn primary" onClick={() => setShowRules(false)}>Понятно, мяу</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
