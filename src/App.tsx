import { useState } from 'react';
import { Menu } from '@/components/game/Menu';
import { GamePage } from '@/components/game/GamePage';
import type { Difficulty, GameConfig } from '@/game/types';
import './App.css';

export default function App() {
  const [game, setGame] = useState<GameConfig | null>(null);

  if (game) {
    return (
      <GamePage
        key={`${game.aiCount}-${game.difficulty}-${Date.now()}`}
        config={{ ...game, seed: Math.floor(Math.random() * 2 ** 31) }}
        onRematch={() => setGame({ ...game })}
        onExit={() => setGame(null)}
      />
    );
  }
  return <Menu onStart={(ai, diff: Difficulty) => setGame({ humanCount: 1, aiCount: ai, difficulty: diff })} />;
}
