import React, { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '@store/useGameStore';
import styles from './WorldLoadingScreen.module.scss';

// Generate procedural pixelated dirt texture for tiling background
const generateDirtBackground = (): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  
  // Base noise
  for (let py = 0; py < 16; py += 2) {
    for (let px = 0; px < 16; px += 2) {
      const n = (Math.random() - 0.5) * 15;
      const r = Math.min(255, Math.max(0, 100 + n));
      const g = Math.min(255, Math.max(0, 72 + n));
      const b = Math.min(255, Math.max(0, 50 + n));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(px, py, 2, 2);
    }
  }
  
  // Dark spots
  ctx.fillStyle = 'rgb(75, 52, 34)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(Math.floor(Math.random() * 8) * 2, Math.floor(Math.random() * 8) * 2, 2, 2);
  }
  
  // Light highlights
  ctx.fillStyle = 'rgb(120, 88, 62)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.floor(Math.random() * 8) * 2, Math.floor(Math.random() * 8) * 2, 2, 1);
  }
  
  return canvas.toDataURL();
};

export const WorldLoadingScreen: React.FC = () => {
  const isWorldLoading = useGameStore((state) => state.isWorldLoading);
  const progress = useGameStore((state) => state.worldLoadingProgress);
  const stage = useGameStore((state) => state.worldLoadingStage);
  const chunkStates = useGameStore((state) => state.chunkLoadingStates);
  const setWorldLoading = useGameStore((state) => state.setWorldLoading);
  const language = useGameStore((state) => state.language);

  // Generate dirt pattern once
  const dirtDataUrl = useMemo(() => generateDirtBackground(), []);

  // Handle mock loading during Three.js compilation/downloading stage
  const [mockProgress, setMockProgress] = useState(0);

  useEffect(() => {
    if (stage === 'engine') {
      const timer = setInterval(() => {
        setMockProgress((prev) => {
          if (prev < 29) {
            // Random increments to make it feel natural
            return prev + Math.floor(Math.random() * 3) + 1;
          }
          return prev;
        });
      }, 150);
      return () => clearInterval(timer);
    }
  }, [stage]);

  // Handle final automatic closing with transition delay
  useEffect(() => {
    if (isWorldLoading && progress >= 100) {
      const timer = setTimeout(() => {
        setWorldLoading(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [progress, isWorldLoading, setWorldLoading]);

  // Combine mock progress and store progress
  const displayProgress = stage === 'engine' ? Math.min(29, mockProgress) : progress;

  // Localized texts
  const titleText = language === 'zh' ? '正在生成世界...' : 'Building Terrain...';
  const stageText = stage === 'engine' 
    ? (language === 'zh' ? '加载游戏引擎及资源' : 'Loading Engine & Resources')
    : (language === 'zh' ? `已加载区块: ${Object.values(chunkStates).filter(Boolean).length} / ${Object.keys(chunkStates).length}` : `Loading Chunks: ${Object.values(chunkStates).filter(Boolean).length} / ${Object.keys(chunkStates).length}`);

  // Create loading grid grid coordinates mapping
  // We assume a 5x5 grid (radius 2) based on standard spawn radius
  const gridItems = useMemo(() => {
    const keys = Object.keys(chunkStates);
    if (keys.length === 0) {
      // Return 25 empty placeholder slots for engine stage
      return Array(25).fill(false);
    }
    
    // Sort keys based on coordinates to render from top-left to bottom-right
    // keys are formatted as "cx,cz"
    return keys.map((key) => chunkStates[key]);
  }, [chunkStates]);

  if (!isWorldLoading) return null;

  return (
    <div 
      className={styles.loadingWrapper}
      style={{ backgroundImage: `url(${dirtDataUrl})` }}
    >
      <div className={styles.overlay} />
      
      <div className={styles.content}>
        <h1 className="pixel-text">{titleText}</h1>
        
        {/* Minecraft 1.14+ Chunk Loading Grid */}
        <div className={styles.gridContainer}>
          <div className={styles.gridOuterBorder}>
            <div className={styles.gridInner}>
              {gridItems.map((isLoaded, index) => (
                <div 
                  key={index} 
                  className={`${styles.gridCell} ${isLoaded ? styles.loaded : styles.pending}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar (Minecraft-like double border outline) */}
        <div className={styles.progressBarWrapper}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>

        {/* Info stats */}
        <div className={styles.metaInfo}>
          <div className={`${styles.progressPercent} pixel-text`}>{displayProgress}%</div>
          <div className={styles.stageText}>{stageText}</div>
        </div>
      </div>
    </div>
  );
};
