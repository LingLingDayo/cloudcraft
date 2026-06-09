/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useGame } from '@context/GameContext';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
import { World, WORLD_HEIGHT } from '@game/world/World';
import * as THREE from 'three';
import { isMobileDevice } from '@utils/device';
import styles from './Minimap.module.scss';

// Safe block getter to avoid generating chunk data on the UI thread
const getBlockSafe = (world: World, x: number, y: number, z: number): number => {
  if (y < 0 || y >= WORLD_HEIGHT) return BLOCK_TYPES.AIR;
  const cx = Math.floor(x / 16);
  const cy = Math.floor(y / 16);
  const cz = Math.floor(z / 16);
  const key = `${cx},${cy},${cz}`;
  const chunk = world.chunks.get(key);
  if (!chunk) return BLOCK_TYPES.AIR;
  
  const lx = ((x % 16) + 16) % 16;
  const ly = ((y % 16) + 16) % 16;
  const lz = ((z % 16) + 16) % 16;
  const index = lx + lz * 16 + ly * 16 * 16;
  return chunk[index];
};

// Depth shading helper
const getShadedColor = (colorHex: number, heightDiff: number, isWater = false): string => {
  let r = (colorHex >> 16) & 255;
  let g = (colorHex >> 8) & 255;
  let b = colorHex & 255;
  
  // Height shading: +4% per block above player, -4% per block below player
  // Clamp between -40% and +40%
  const shadeFactor = Math.max(-0.4, Math.min(0.4, heightDiff * 0.04));
  
  if (shadeFactor > 0) {
    r = Math.round(r + (255 - r) * shadeFactor);
    g = Math.round(g + (255 - g) * shadeFactor);
    b = Math.round(b + (255 - b) * shadeFactor);
  } else {
    r = Math.round(r * (1 + shadeFactor));
    g = Math.round(g * (1 + shadeFactor));
    b = Math.round(b * (1 + shadeFactor));
  }
  
  if (isWater) {
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  }
  return `rgb(${r}, ${g}, ${b})`;
};

export const Minimap: React.FC = () => {
  const gameInstance = useGame();
  const showMinimap = useGameStore((state) => state.showMinimap);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const cachedBlockColorsRef = useRef<string[][]>([]);
  const lastBlockCoordsRef = useRef<{ x: number; z: number }>({ x: -9999, z: -9999 });

  useEffect(() => {
    if (!showMinimap || !gameInstance || !canvasRef.current) return;

    let animId: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mapRadius = 16;
    const mapSize = mapRadius * 2 + 1; // 33 blocks
    const pixelSize = 4; // 33 * 4 = 132px canvas size
    
    // Set explicit width/height
    canvas.width = mapSize * pixelSize;
    canvas.height = mapSize * pixelSize;

    const tick = () => {
      if (!gameInstance.player || !gameInstance.world) {
        return;
      }

      const player = gameInstance.player;
      const world = gameInstance.world;
      const px = player.position.x;
      const py = player.position.y;
      const pz = player.position.z;

      const bx = Math.floor(px);
      const by = Math.floor(py);
      const bz = Math.floor(pz);

      // Throttled block scan: only update color matrix when crossing block boundary
      const playerMovedBlock = bx !== lastBlockCoordsRef.current.x || bz !== lastBlockCoordsRef.current.z;
      if (playerMovedBlock || cachedBlockColorsRef.current.length === 0) {
        const newColors: string[][] = [];
        
        for (let dz = -mapRadius; dz <= mapRadius; dz++) {
          const rowColors: string[] = [];
          for (let dx = -mapRadius; dx <= mapRadius; dx++) {
            const wx = bx + dx;
            const wz = bz + dz;
            
            // Search down from above player to find the first block
            const startY = Math.min(WORLD_HEIGHT - 1, by + 15);
            const minSeqY = Math.max(0, by - 30);
            let topBlockId: number = BLOCK_TYPES.AIR;
            let topBlockY = 0;

            for (let y = startY; y >= minSeqY; y--) {
              const blockId = getBlockSafe(world, wx, y, wz);
              if (blockId !== BLOCK_TYPES.AIR) {
                topBlockId = blockId;
                topBlockY = y;
                break;
              }
            }

            if (topBlockId === BLOCK_TYPES.AIR) {
              rowColors.push('#000000'); // space / void
            } else {
              const props = getBlockProperties(topBlockId);
              const colorHex = props.colorHex ?? 0x787878;
              const isWater = topBlockId === BLOCK_TYPES.WATER;
              rowColors.push(getShadedColor(colorHex, topBlockY - by, isWater));
            }
          }
          newColors.push(rowColors);
        }
        
        cachedBlockColorsRef.current = newColors;
        lastBlockCoordsRef.current = { x: bx, z: bz };
      }

      // Draw map blocks from cache
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const colors = cachedBlockColorsRef.current;
      for (let r = 0; r < mapSize; r++) {
        for (let c = 0; c < mapSize; c++) {
          ctx.fillStyle = colors[r][c];
          ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
        }
      }

      // Get player forward direction and angle
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(gameInstance.camera.quaternion);
      const angle = Math.atan2(forward.x, -forward.z);

      // Draw Spawn Point / Home icon if available
      const spawnPoint = player.spawnPoint;
      if (spawnPoint) {
        const sdx = spawnPoint.x - px;
        const sdz = spawnPoint.z - pz;
        const dist = Math.hypot(sdx, sdz);
        const mapCenter = (mapSize * pixelSize) / 2;

        if (dist <= mapRadius) {
          // Inside map bounds
          const scx = mapCenter + sdx * pixelSize;
          const scy = mapCenter + sdz * pixelSize;
          
          // Draw mini house/spawn icon
          ctx.save();
          ctx.translate(scx, scy);
          
          // Red roof
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.lineTo(-4, 0);
          ctx.lineTo(4, 0);
          ctx.closePath();
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          
          // Wall
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(-2.5, 0, 5, 4);
          ctx.strokeRect(-2.5, 0, 5, 4);
          
          // Door
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-0.8, 1.5, 1.6, 2.5);
          
          ctx.restore();
        } else {
          // Outside map bounds - draw spawn pointer on the circular map boundary
          const angleToSpawn = Math.atan2(sdz, sdx);
          const borderR = mapCenter - 6; // slightly inside border
          const borderX = mapCenter + Math.cos(angleToSpawn) * borderR;
          const borderY = mapCenter + Math.sin(angleToSpawn) * borderR;
          
          ctx.beginPath();
          ctx.arc(borderX, borderY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
        }
      }

      // Draw active animals (pigs) on the minimap
      if (gameInstance.animals && (gameInstance.animals as any).animals) {
        const activeAnimals = (gameInstance.animals as any).animals;
        activeAnimals.forEach((animal: any) => {
          const adx = animal.position.x - px;
          const adz = animal.position.z - pz;
          const dist = Math.hypot(adx, adz);
          const mapCenter = (mapSize * pixelSize) / 2;

          if (dist <= mapRadius) {
            const acx = mapCenter + adx * pixelSize;
            const acy = mapCenter + adz * pixelSize;
            
            ctx.save();
            ctx.fillStyle = '#ffb6c1'; // Minecraft classic pig pink
            ctx.strokeStyle = '#d77c8e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(acx, acy, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      // Draw player arrow in the center
      const centerX = (mapSize * pixelSize) / 2;
      const centerY = (mapSize * pixelSize) / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-3.5, 4.5);
      ctx.lineTo(0, 2);
      ctx.lineTo(3.5, 4.5);
      ctx.closePath();
      
      ctx.fillStyle = '#4ade80'; // Bright player green
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    };

    const updateLoop = () => {
      tick();
      animId = requestAnimationFrame(updateLoop);
    };

    // Run first frame immediately to avoid flickering/blank canvas on mount
    tick();

    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [showMinimap, gameInstance]);

  if (!showMinimap || !gameInstance) return null;

  return (
    <div className={`${styles.minimapContainer} ${isMobileDevice() ? styles.isMobile : ''}`}>
      <div className={styles.minimapWrapper}>
        <canvas ref={canvasRef} className={styles.minimapCanvas} />
        {/* N S E W indicators overlay */}
        <div className={`${styles.compassDir} ${styles.dirN}`}>N</div>
        <div className={`${styles.compassDir} ${styles.dirS}`}>S</div>
        <div className={`${styles.compassDir} ${styles.dirE}`}>E</div>
        <div className={`${styles.compassDir} ${styles.dirW}`}>W</div>
      </div>
    </div>
  );
};
