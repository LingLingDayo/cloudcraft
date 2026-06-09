import React, { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '@i18n';
import styles from './WorldLoadingScreen.module.scss';

// Generate procedural pixelated dirt texture for tiling background
const generateDirtBackground = (): string => {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
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
  } catch {
    return '';
  }
};

export const WorldLoadingScreen: React.FC = () => {
  const { t } = useTranslation();
  const isWorldLoading = useGameStore((state) => state.isWorldLoading);
  const progress = useGameStore((state) => state.worldLoadingProgress);
  const stage = useGameStore((state) => state.worldLoadingStage);
  const chunkStates = useGameStore((state) => state.chunkLoadingStates);
  const setWorldLoading = useGameStore((state) => state.setWorldLoading);

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

  const { loadedCount, totalCount } = useMemo(() => {
    const keys = Object.keys(chunkStates);
    const total = keys.length;
    if (total === 0) {
      return { loadedCount: 0, totalCount: 0 };
    }

    const loaded = keys.filter((k) => chunkStates[k]).length;
    // Align with the 45% target threshold used in gameSlice for worldLoadingProgress
    const targetCount = Math.ceil(total * 0.45);

    return {
      loadedCount: Math.min(targetCount, loaded),
      totalCount: targetCount,
    };
  }, [chunkStates]);

  const stageText = stage === 'engine' 
    ? t('worldLoading.engine')
    : t('worldLoading.chunks', { loaded: loadedCount, total: totalCount });

  if (!isWorldLoading) return null;

  return (
    <div 
      className={styles.loadingWrapper}
      style={{ backgroundImage: `url(${dirtDataUrl})` }}
    >
      <div className={styles.overlay} />
      
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <h1 className={`${styles.logoText} pixel-text`}>CLOUDCRAFT</h1>
        </div>

        {/* Loading status bar container */}
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarHeader}>
            <span className={`${styles.stageText} pixel-text-sm`}>{stageText}</span>
            <span className={`${styles.progressPercent} pixel-text-sm`}>{displayProgress}%</span>
          </div>
          
          <div className={styles.progressBarOuter}>
            <div 
              className={styles.progressBarInner}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
