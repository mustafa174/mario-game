import React, { useEffect, useRef } from 'react';
import { GameEngine } from './game/engine';
import { SCREEN_WIDTH, SCREEN_HEIGHT, SCALE } from './constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Initialize Engine
    const engine = new GameEngine(ctx);
    engineRef.current = engine;

    // Game Loop
    let lastTime = performance.now();
    const targetFPSTime = 1000 / 60;
    let accumulator = 0;

    const loop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      accumulator += dt;

      // Fixed timestep update for deterministic physics
      while (accumulator >= targetFPSTime) {
        engine.update();
        accumulator -= targetFPSTime;
      }

      engine.draw();
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      engine.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white font-mono">
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-yellow-500 mb-2">NES Clone Engine</h1>
        <p className="text-sm text-gray-400">
          Z: Jump (A) | X: Run (B) | Arrows: Move | Enter: Start
        </p>
      </div>

      <div 
        className="relative bg-black border-4 border-gray-700 rounded-sm shadow-2xl"
        style={{
          width: `${SCREEN_WIDTH * SCALE}px`,
          height: `${SCREEN_HEIGHT * SCALE}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="mt-8 max-w-lg text-xs text-gray-500 space-y-2">
        <p>Technical Demo: World 1-1 layout, SMB Physics (Gravity 0.4, Friction 0.85).</p>
        <p>Strict tile-based AABB collision with sub-pixel resolution.</p>
      </div>
    </div>
  );
};

export default App;