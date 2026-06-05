import * as THREE from 'three';

let cachedDataURL: string | null = null;

export function getTextureAtlasDataURL(): string {
  if (!cachedDataURL) {
    generateTextureAtlas();
  }
  return cachedDataURL!;
}

export function generateTextureAtlas(): THREE.Texture {
  const tileSize = 16;
  const atlasCols = 8;
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * atlasCols;
  canvas.height = tileSize * atlasCols;
  const ctx = canvas.getContext('2d')!;

  // Helper to fill with noise in blocky pattern (block size like 2x2)
  const fillNoise = (x: number, y: number, r: number, g: number, b: number, noiseIntensity: number, blockSize: number = 2) => {
    for (let py = 0; py < tileSize; py += blockSize) {
      for (let px = 0; px < tileSize; px += blockSize) {
        const n = (Math.random() - 0.5) * noiseIntensity;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, r + n))}, ${Math.min(255, Math.max(0, g + n))}, ${Math.min(255, Math.max(0, b + n))})`;
        ctx.fillRect(x + px, y + py, blockSize, blockSize);
      }
    }
  };

  let x: number;
  let y: number;

  // 0: Grass Top
  x = (0 % 8) * tileSize;
  y = Math.floor(0 / 8) * tileSize;
  fillNoise(x, y, 110, 180, 50, 25, 2);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgb(80, 140, 30)' : 'rgb(130, 205, 60)';
    ctx.fillRect(
      x + Math.floor(Math.random() * (tileSize / 2)) * 2,
      y + Math.floor(Math.random() * (tileSize / 2)) * 2,
      2,
      2
    );
  }

  // 1: Grass Side
  x = (1 % 8) * tileSize;
  y = Math.floor(1 / 8) * tileSize;
  fillNoise(x, y, 134, 96, 67, 15, 2);
  ctx.fillStyle = 'rgb(105, 75, 52)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(
      x + Math.floor(Math.random() * (tileSize / 2)) * 2,
      y + 4 + Math.floor(Math.random() * ((tileSize - 4) / 2)) * 2,
      2,
      2
    );
  }
  const grassHeights = [4, 5, 4, 3, 4, 5, 6, 4, 3, 4, 5, 4, 3, 5, 4, 3];
  ctx.fillStyle = 'rgb(110, 180, 50)';
  for (let px = 0; px < tileSize; px++) {
    const h = grassHeights[px];
    ctx.fillRect(x + px, y, 1, h);
  }
  for (let px = 0; px < tileSize; px++) {
    const h = grassHeights[px];
    for (let py = 0; py < h; py++) {
      if (Math.random() > 0.6) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgb(80, 140, 30)' : 'rgb(130, 205, 60)';
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
  ctx.fillStyle = 'rgb(110, 180, 50)';
  ctx.fillRect(x + 2, y + 5, 1, 1);
  ctx.fillRect(x + 6, y + 7, 1, 1);
  ctx.fillRect(x + 10, y + 5, 1, 1);
  ctx.fillRect(x + 13, y + 6, 1, 1);

  // 2: Dirt
  x = (2 % 8) * tileSize;
  y = Math.floor(2 / 8) * tileSize;
  fillNoise(x, y, 134, 96, 67, 20, 2);
  ctx.fillStyle = 'rgb(105, 75, 52)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * 7) * 2, y + Math.floor(Math.random() * 7) * 2, 2, 2);
  }
  ctx.fillStyle = 'rgb(155, 115, 82)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * 7) * 2, y + Math.floor(Math.random() * 7) * 2, 2, 1);
  }

  // 3: Stone
  x = (3 % 8) * tileSize;
  y = Math.floor(3 / 8) * tileSize;
  fillNoise(x, y, 122, 122, 122, 15, 2);
  ctx.fillStyle = 'rgb(85, 85, 85)';
  ctx.fillRect(x + 2, y + 3, 3, 2);
  ctx.fillRect(x + 5, y + 4, 3, 1);
  ctx.fillRect(x + 9, y + 10, 4, 2);
  ctx.fillRect(x + 12, y + 9, 2, 1);
  ctx.fillRect(x + 1, y + 12, 2, 1);
  ctx.fillRect(x + 11, y + 2, 3, 2);
  ctx.fillStyle = 'rgb(160, 160, 160)';
  ctx.fillRect(x + 3, y + 1, 2, 2);
  ctx.fillRect(x + 8, y + 7, 3, 2);
  ctx.fillRect(x + 1, y + 9, 2, 1);

  // 4: Wood Side
  x = (4 % 8) * tileSize;
  y = Math.floor(4 / 8) * tileSize;
  fillNoise(x, y, 95, 70, 40, 10, 2);
  ctx.fillStyle = 'rgb(55, 40, 20)';
  for (let py = 0; py < tileSize; py++) {
    const offset1 = py % 4 === 0 ? 3 : 2;
    ctx.fillRect(x + offset1, y + py, 2, 1);
    const offset2 = (py + 2) % 4 === 0 ? 10 : 9;
    ctx.fillRect(x + offset2, y + py, 2, 1);
    const offset3 = py % 3 === 0 ? 14 : 15;
    ctx.fillRect(x + offset3, y + py, 1, 1);
  }
  ctx.fillStyle = 'rgb(120, 95, 60)';
  for (let py = 0; py < tileSize; py += 2) {
    ctx.fillRect(x + 5, y + py, 2, 2);
    ctx.fillRect(x + 11, y + py, 2, 2);
  }

  // 5: Wood Top
  x = (5 % 8) * tileSize;
  y = Math.floor(5 / 8) * tileSize;
  fillNoise(x, y, 195, 160, 115, 8, 2);
  ctx.strokeStyle = 'rgb(140, 105, 65)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
  ctx.strokeRect(x + 6, y + 6, tileSize - 12, tileSize - 12);
  ctx.strokeStyle = 'rgb(55, 40, 20)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, tileSize - 1.5, tileSize - 1.5);

  // 6: Leaf
  x = (6 % 8) * tileSize;
  y = Math.floor(6 / 8) * tileSize;
  ctx.clearRect(x, y, tileSize, tileSize);
  for (let py = 0; py < tileSize; py += 2) {
    for (let px = 0; px < tileSize; px += 2) {
      if (Math.random() < 0.75) {
        const gNoise = (Math.random() - 0.5) * 30;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 45 + gNoise))}, ${Math.min(255, Math.max(0, 115 + gNoise))}, ${Math.min(255, Math.max(0, 30 + gNoise))})`;
        ctx.fillRect(x + px, y + py, 2, 2);
        if (Math.random() > 0.6) {
          ctx.fillStyle = 'rgb(25, 75, 15)';
          ctx.fillRect(x + px + Math.floor(Math.random() * 2), y + py + Math.floor(Math.random() * 2), 1, 1);
        }
      }
    }
  }

  // 7: Brick
  x = (7 % 8) * tileSize;
  y = Math.floor(7 / 8) * tileSize;
  fillNoise(x, y, 145, 60, 45, 15, 1);
  ctx.fillStyle = 'rgb(185, 185, 185)';
  ctx.fillRect(x, y + 3, tileSize, 1);
  ctx.fillRect(x, y + 7, tileSize, 1);
  ctx.fillRect(x, y + 11, tileSize, 1);
  ctx.fillRect(x, y + 15, tileSize, 1);
  ctx.fillRect(x + 4, y, 1, 3);
  ctx.fillRect(x + 12, y, 1, 3);
  ctx.fillRect(x + 8, y + 4, 1, 3);
  ctx.fillRect(x + 4, y + 8, 1, 3);
  ctx.fillRect(x + 12, y + 8, 1, 3);
  ctx.fillRect(x + 8, y + 12, 1, 3);
  ctx.fillStyle = 'rgb(100, 40, 30)';
  ctx.fillRect(x, y + 2, tileSize, 1);
  ctx.fillRect(x, y + 6, tileSize, 1);
  ctx.fillRect(x, y + 10, tileSize, 1);
  ctx.fillRect(x, y + 14, tileSize, 1);

  // 8: Glass
  x = (8 % 8) * tileSize;
  y = Math.floor(8 / 8) * tileSize;
  ctx.clearRect(x, y, tileSize, tileSize);
  ctx.strokeStyle = 'rgba(180, 225, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
  ctx.fillStyle = 'rgba(120, 190, 235, 0.9)';
  ctx.fillRect(x, y, 1, 2);
  ctx.fillRect(x, y, 2, 1);
  ctx.fillRect(x + tileSize - 1, y, 1, 2);
  ctx.fillRect(x + tileSize - 2, y, 2, 1);
  ctx.fillRect(x, y + tileSize - 2, 1, 2);
  ctx.fillRect(x, y + tileSize - 1, 2, 1);
  ctx.fillRect(x + tileSize - 1, y + tileSize - 2, 1, 2);
  ctx.fillRect(x + tileSize - 2, y + tileSize - 1, 2, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillRect(x + 3, y + 11, 1, 1);
  ctx.fillRect(x + 4, y + 10, 1, 1);
  ctx.fillRect(x + 5, y + 9, 1, 1);
  ctx.fillRect(x + 9, y + 5, 1, 1);
  ctx.fillRect(x + 10, y + 4, 1, 1);
  ctx.fillRect(x + 11, y + 3, 1, 1);

  // 9: Water
  x = (9 % 8) * tileSize;
  y = Math.floor(9 / 8) * tileSize;
  fillNoise(x, y, 40, 100, 220, 10, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(x + 2, y + 3, 4, 1);
  ctx.fillRect(x + 10, y + 4, 3, 1);
  ctx.fillRect(x + 6, y + 9, 5, 1);
  ctx.fillRect(x + 1, y + 11, 3, 1);
  ctx.fillRect(x + 12, y + 13, 2, 1);
  ctx.fillStyle = 'rgba(20, 50, 150, 0.35)';
  ctx.fillRect(x, y + 6, 5, 2);
  ctx.fillRect(x + 8, y + 7, 4, 2);
  ctx.fillRect(x + 3, y + 12, 6, 1);

  // 10: Sand
  x = (10 % 8) * tileSize;
  y = Math.floor(10 / 8) * tileSize;
  fillNoise(x, y, 222, 208, 145, 12, 2);
  ctx.fillStyle = 'rgb(195, 180, 120)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(
      x + Math.floor(Math.random() * (tileSize / 2)) * 2,
      y + Math.floor(Math.random() * (tileSize / 2)) * 2,
      2,
      1
    );
  }

  // Ores helper
  const generateOre = (ox: number, oy: number, oreColor: string, shadowColor: string, highlightColor?: string) => {
    fillNoise(ox, oy, 122, 122, 122, 15, 2);
    ctx.fillStyle = 'rgb(85, 85, 85)';
    ctx.fillRect(ox + 2, oy + 3, 3, 2);
    ctx.fillRect(ox + 9, oy + 10, 4, 2);
    ctx.fillRect(ox + 11, oy + 2, 3, 2);
    
    const spots = [
      [2, 3], [3, 3], [2, 4],
      [5, 5], [6, 5], [5, 6],
      [10, 2], [11, 2],
      [12, 5], [13, 5], [13, 6],
      [8, 10], [9, 10], [9, 11],
      [3, 11], [3, 12], [4, 12]
    ];
    
    ctx.fillStyle = shadowColor;
    spots.forEach(([px, py]) => {
      ctx.fillRect(ox + px, oy + py, 1, 1);
    });

    ctx.fillStyle = oreColor;
    spots.forEach(([px, py]) => {
      if (px + 1 < tileSize && py - 1 >= 0) {
        ctx.fillRect(ox + px + 1, oy + py - 1, 1, 1);
      }
    });

    if (highlightColor) {
      ctx.fillStyle = highlightColor;
      ctx.fillRect(ox + 6, oy + 4, 1, 1);
      ctx.fillRect(ox + 13, oy + 4, 1, 1);
      ctx.fillRect(ox + 9, oy + 9, 1, 1);
    }
  };

  // 11: Coal Ore
  x = (11 % 8) * tileSize;
  y = Math.floor(11 / 8) * tileSize;
  generateOre(x, y, 'rgb(30, 30, 30)', 'rgb(50, 50, 50)');

  // 12: Iron Ore
  x = (12 % 8) * tileSize;
  y = Math.floor(12 / 8) * tileSize;
  generateOre(x, y, 'rgb(215, 160, 125)', 'rgb(150, 105, 80)');

  // 13: Diamond Ore
  x = (13 % 8) * tileSize;
  y = Math.floor(13 / 8) * tileSize;
  generateOre(x, y, 'rgb(90, 220, 240)', 'rgb(45, 140, 160)', 'rgb(215, 250, 255)');

  // 14: Chest Side
  x = (14 % 8) * tileSize;
  y = Math.floor(14 / 8) * tileSize;
  fillNoise(x, y, 125, 85, 45, 10, 2);
  ctx.fillStyle = 'rgb(60, 42, 24)';
  ctx.fillRect(x, y, tileSize, 2);
  ctx.fillRect(x, y + tileSize - 2, tileSize, 2);
  ctx.fillRect(x, y, 2, tileSize);
  ctx.fillRect(x + tileSize - 2, y, 2, tileSize);
  ctx.fillRect(x, y + 6, tileSize, 2);
  ctx.fillStyle = 'rgb(60, 60, 60)';
  ctx.fillRect(x + 7, y + 3, 2, 4);
  ctx.fillStyle = 'rgb(220, 220, 220)';
  ctx.fillRect(x + 7, y + 3, 2, 3);
  ctx.fillStyle = 'rgb(200, 170, 40)';
  ctx.fillRect(x + 7, y + 5, 2, 1);

  // 15: Chest Top
  x = (15 % 8) * tileSize;
  y = Math.floor(15 / 8) * tileSize;
  fillNoise(x, y, 125, 85, 45, 10, 2);
  ctx.fillStyle = 'rgb(60, 42, 24)';
  ctx.fillRect(x, y, tileSize, 2);
  ctx.fillRect(x, y + tileSize - 2, tileSize, 2);
  ctx.fillRect(x, y, 2, tileSize);
  ctx.fillRect(x + tileSize - 2, y, 2, tileSize);

  // 16: Birch Wood Side
  x = (16 % 8) * tileSize;
  y = Math.floor(16 / 8) * tileSize;
  fillNoise(x, y, 230, 230, 225, 5, 2);
  ctx.fillStyle = 'rgb(50, 48, 48)';
  ctx.fillRect(x + 2, y + 3, 4, 2);
  ctx.fillRect(x + 10, y + 6, 5, 2);
  ctx.fillRect(x + 1, y + 11, 3, 2);
  ctx.fillRect(x + 11, y + 12, 4, 2);
  ctx.fillStyle = 'rgb(115, 110, 110)';
  ctx.fillRect(x + 1, y + 3, 1, 2);
  ctx.fillRect(x + 6, y + 3, 1, 2);
  ctx.fillRect(x + 9, y + 6, 1, 2);
  ctx.fillRect(x + 4, y + 11, 1, 2);

  // 17: Birch Wood Top
  x = (17 % 8) * tileSize;
  y = Math.floor(17 / 8) * tileSize;
  fillNoise(x, y, 215, 202, 172, 5, 2);
  ctx.strokeStyle = 'rgb(175, 155, 125)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
  ctx.strokeRect(x + 6, y + 6, tileSize - 12, tileSize - 12);
  ctx.strokeStyle = 'rgb(240, 240, 235)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, tileSize - 1.5, tileSize - 1.5);

  // 18: Birch Leaves
  x = (18 % 8) * tileSize;
  y = Math.floor(18 / 8) * tileSize;
  ctx.clearRect(x, y, tileSize, tileSize);
  for (let py = 0; py < tileSize; py += 2) {
    for (let px = 0; px < tileSize; px += 2) {
      if (Math.random() < 0.75) {
        const gNoise = (Math.random() - 0.5) * 20;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 95 + gNoise))}, ${Math.min(255, Math.max(0, 175 + gNoise))}, ${Math.min(255, Math.max(0, 45 + gNoise))})`;
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
  }

  // 19: Spruce Wood Side
  x = (19 % 8) * tileSize;
  y = Math.floor(19 / 8) * tileSize;
  fillNoise(x, y, 68, 45, 25, 10, 2);
  ctx.fillStyle = 'rgb(42, 28, 15)';
  for (let py = 0; py < tileSize; py++) {
    const offset1 = py % 4 === 0 ? 3 : 2;
    ctx.fillRect(x + offset1, y + py, 2, 1);
    const offset2 = (py + 2) % 4 === 0 ? 11 : 10;
    ctx.fillRect(x + offset2, y + py, 2, 1);
  }

  // 20: Spruce Wood Top
  x = (20 % 8) * tileSize;
  y = Math.floor(20 / 8) * tileSize;
  fillNoise(x, y, 125, 92, 60, 6, 2);
  ctx.strokeStyle = 'rgb(75, 48, 28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
  ctx.strokeRect(x + 6, y + 6, tileSize - 12, tileSize - 12);
  ctx.strokeStyle = 'rgb(50, 32, 18)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, tileSize - 1.5, tileSize - 1.5);

  // 21: Spruce Leaves
  x = (21 % 8) * tileSize;
  y = Math.floor(21 / 8) * tileSize;
  ctx.clearRect(x, y, tileSize, tileSize);
  for (let py = 0; py < tileSize; py += 2) {
    for (let px = 0; px < tileSize; px += 2) {
      if (Math.random() < 0.8) {
        const gNoise = (Math.random() - 0.5) * 15;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 30 + gNoise))}, ${Math.min(255, Math.max(0, 72 + gNoise))}, ${Math.min(255, Math.max(0, 48 + gNoise))})`;
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
  }

  // 22: Cactus Side
  x = (22 % 8) * tileSize;
  y = Math.floor(22 / 8) * tileSize;
  fillNoise(x, y, 45, 120, 35, 10, 1);
  ctx.fillStyle = 'rgb(22, 75, 18)';
  ctx.fillRect(x + 3, y, 2, tileSize);
  ctx.fillRect(x + 11, y, 2, tileSize);
  ctx.fillStyle = 'rgb(245, 245, 235)';
  const spikeCoords = [
    [1, 3], [5, 2], [9, 4], [14, 2],
    [2, 8], [6, 9], [10, 7], [13, 10],
    [1, 13], [5, 14], [9, 13], [14, 12]
  ];
  spikeCoords.forEach(([px, py]) => {
    ctx.fillRect(x + px, y + py, 1, 1);
    ctx.fillStyle = 'rgb(180, 180, 160)';
    ctx.fillRect(x + px, y + py + 1, 1, 1);
    ctx.fillStyle = 'rgb(245, 245, 235)';
  });

  // 23: Cactus Top
  x = (23 % 8) * tileSize;
  y = Math.floor(23 / 8) * tileSize;
  fillNoise(x, y, 65, 145, 45, 10, 1);
  ctx.fillStyle = 'rgb(25, 80, 20)';
  ctx.fillRect(x + 7, y, 2, tileSize);
  ctx.fillRect(x, y + 7, tileSize, 2);
  ctx.fillStyle = 'rgb(245, 245, 235)';
  ctx.fillRect(x + 3, y + 3, 1, 1);
  ctx.fillRect(x + 12, y + 3, 1, 1);
  ctx.fillRect(x + 3, y + 12, 1, 1);
  ctx.fillRect(x + 12, y + 12, 1, 1);

  // 24: Jungle Wood Side
  x = (24 % 8) * tileSize;
  y = Math.floor(24 / 8) * tileSize;
  fillNoise(x, y, 92, 62, 42, 10, 2);
  ctx.fillStyle = 'rgb(58, 38, 25)';
  for (let py = 0; py < tileSize; py += 3) {
    ctx.fillRect(x + Math.floor(Math.random() * 4), y + py, 4, 1);
    ctx.fillRect(x + 6 + Math.floor(Math.random() * 4), y + py + 1, 4, 1);
  }

  // 25: Jungle Wood Top
  x = (25 % 8) * tileSize;
  y = Math.floor(25 / 8) * tileSize;
  fillNoise(x, y, 138, 102, 72, 8, 2);
  ctx.strokeStyle = 'rgb(92, 62, 42)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
  ctx.strokeRect(x + 6, y + 6, tileSize - 12, tileSize - 12);
  ctx.strokeStyle = 'rgb(58, 38, 25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, tileSize - 1.5, tileSize - 1.5);

  // 26: Jungle Leaves
  x = (26 % 8) * tileSize;
  y = Math.floor(26 / 8) * tileSize;
  ctx.clearRect(x, y, tileSize, tileSize);
  for (let py = 0; py < tileSize; py += 2) {
    for (let px = 0; px < tileSize; px += 2) {
      if (Math.random() < 0.85) {
        const gNoise = (Math.random() - 0.5) * 20;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 25 + gNoise))}, ${Math.min(255, Math.max(0, 92 + gNoise))}, ${Math.min(255, Math.max(0, 18 + gNoise))})`;
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
  }

  // 27: Sandstone
  x = (27 % 8) * tileSize;
  y = Math.floor(27 / 8) * tileSize;
  fillNoise(x, y, 218, 195, 138, 8, 2);
  ctx.fillStyle = 'rgb(185, 155, 100)';
  ctx.fillRect(x, y + 3, tileSize, 2);
  ctx.fillRect(x, y + 10, tileSize, 2);
  ctx.fillStyle = 'rgb(155, 125, 75)';
  ctx.fillRect(x + 2, y + 4, 6, 1);
  ctx.fillRect(x + 10, y + 11, 5, 1);

  // Helper to draw pixelated saplings (indices 28-31)
  const drawSaplingTexture = (index: number, leafColor: string, stemColor = 'rgb(100, 70, 40)') => {
    const sx = (index % 8) * tileSize;
    const sy = Math.floor(index / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);

    // Stem in the middle bottom
    ctx.fillStyle = stemColor;
    ctx.fillRect(sx + 7, sy + 8, 2, 8);

    // Leaves cluster
    ctx.fillStyle = leafColor;
    ctx.fillRect(sx + 5, sy + 3, 6, 5);
    ctx.fillRect(sx + 6, sy + 2, 4, 1);
    ctx.fillRect(sx + 4, sy + 5, 8, 2);
    // Highlights and shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(sx + 6, sy + 4, 2, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(sx + 8, sy + 3, 2, 1);
  };

  // 28: Oak Sapling
  drawSaplingTexture(28, 'rgb(76, 148, 54)');
  // 29: Birch Sapling
  drawSaplingTexture(29, 'rgb(143, 192, 78)');
  // 30: Spruce Sapling
  drawSaplingTexture(30, 'rgb(45, 90, 39)');
  // 31: Jungle Sapling
  drawSaplingTexture(31, 'rgb(26, 95, 18)');

  // 32: Raw Porkchop
  {
    const sx = (32 % 8) * tileSize;
    const sy = Math.floor(32 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);

    // Fleshy red-pink body
    ctx.fillStyle = 'rgb(224, 120, 144)';
    ctx.fillRect(sx + 3, sy + 3, 10, 10);
    ctx.fillRect(sx + 4, sy + 2, 8, 12);
    ctx.fillRect(sx + 2, sy + 4, 12, 8);
    
    // Dark meat borders
    ctx.fillStyle = 'rgb(180, 80, 100)';
    ctx.fillRect(sx + 2, sy + 4, 1, 8);
    ctx.fillRect(sx + 13, sy + 4, 1, 8);
    ctx.fillRect(sx + 4, sy + 2, 8, 1);
    ctx.fillRect(sx + 4, sy + 13, 8, 1);
    ctx.fillRect(sx + 5, sy + 5, 2, 2);
    ctx.fillRect(sx + 9, sy + 8, 2, 1);

    // Fat marbling corners
    ctx.fillStyle = 'rgb(245, 200, 210)';
    ctx.fillRect(sx + 3, sy + 3, 2, 1);
    ctx.fillRect(sx + 11, sy + 3, 2, 1);
    ctx.fillRect(sx + 3, sy + 12, 2, 1);
    ctx.fillRect(sx + 11, sy + 12, 2, 1);

    // White T-bone in the middle
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(sx + 7, sy + 6, 2, 3);
    ctx.fillRect(sx + 6, sy + 7, 4, 1);
    ctx.fillStyle = 'rgb(220, 220, 220)';
    ctx.fillRect(sx + 7, sy + 9, 2, 1);
    ctx.fillRect(sx + 8, sy + 7, 1, 2);
  }

  // 33: Apple
  {
    const sx = (33 % 8) * tileSize;
    const sy = Math.floor(33 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);

    // Apple body (Red)
    ctx.fillStyle = 'rgb(216, 30, 30)';
    ctx.fillRect(sx + 4, sy + 5, 8, 8);
    ctx.fillRect(sx + 5, sy + 4, 6, 10);
    ctx.fillRect(sx + 3, sy + 6, 10, 6);
    ctx.fillRect(sx + 6, sy + 3, 4, 1);
    ctx.fillRect(sx + 5, sy + 13, 2, 1);
    ctx.fillRect(sx + 9, sy + 13, 2, 1);

    // Dark shading on the bottom/left borders
    ctx.fillStyle = 'rgb(140, 15, 15)';
    ctx.fillRect(sx + 3, sy + 6, 1, 6);
    ctx.fillRect(sx + 4, sy + 11, 2, 2);
    ctx.fillRect(sx + 5, sy + 13, 2, 1);
    ctx.fillRect(sx + 9, sy + 13, 2, 1);
    ctx.fillRect(sx + 10, sy + 11, 2, 1);

    // Shading on the top/right borders
    ctx.fillStyle = 'rgb(255, 70, 70)';
    ctx.fillRect(sx + 5, sy + 4, 4, 1);
    ctx.fillRect(sx + 11, sy + 5, 1, 4);

    // Stem (Brown)
    ctx.fillStyle = 'rgb(115, 75, 45)';
    ctx.fillRect(sx + 7, sy + 1, 1, 3);
    ctx.fillRect(sx + 8, sy + 2, 1, 1);

    // Leaf (Green)
    ctx.fillStyle = 'rgb(45, 150, 45)';
    ctx.fillRect(sx + 8, sy + 1, 2, 1);
    ctx.fillRect(sx + 9, sy + 2, 1, 1);
  }

  // Helper to draw simple flowers
  const drawFlowerTexture = (index: number, stemColor: string, petalColor: string, centerColor?: string) => {
    const sx = (index % 8) * tileSize;
    const sy = Math.floor(index / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);

    // Stem
    ctx.fillStyle = stemColor;
    ctx.fillRect(sx + 7, sy + 6, 2, 10);
    ctx.fillRect(sx + 5, sy + 9, 2, 1);
    ctx.fillRect(sx + 9, sy + 7, 2, 1);

    // Leaves
    ctx.fillRect(sx + 4, sy + 10, 2, 1);
    ctx.fillRect(sx + 10, sy + 8, 2, 1);

    // Petals
    ctx.fillStyle = petalColor;
    ctx.fillRect(sx + 5, sy + 2, 6, 4);
    ctx.fillRect(sx + 6, sy + 1, 4, 6);

    if (centerColor) {
      ctx.fillStyle = centerColor;
      ctx.fillRect(sx + 7, sy + 3, 2, 2);
    }
  };

  // 34: Dandelion
  drawFlowerTexture(34, 'rgb(95, 150, 45)', 'rgb(245, 210, 20)', 'rgb(255, 235, 80)');

  // 35: Poppy
  drawFlowerTexture(35, 'rgb(75, 130, 35)', 'rgb(215, 25, 25)', 'rgb(25, 25, 25)');

  // 36: Blue Orchid
  {
    const sx = (36 % 8) * tileSize;
    const sy = Math.floor(36 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(85, 140, 40)';
    ctx.fillRect(sx + 7, sy + 5, 2, 11);
    ctx.fillRect(sx + 5, sy + 9, 2, 1);
    ctx.fillRect(sx + 9, sy + 11, 2, 1);

    ctx.fillStyle = 'rgb(40, 185, 245)';
    ctx.fillRect(sx + 5, sy + 3, 2, 2);
    ctx.fillRect(sx + 9, sy + 4, 2, 2);
    ctx.fillRect(sx + 7, sy + 1, 2, 3);
    ctx.fillStyle = 'rgb(220, 245, 255)';
    ctx.fillRect(sx + 7, sy + 2, 1, 1);
  }

  // 37: Allium
  {
    const sx = (37 % 8) * tileSize;
    const sy = Math.floor(37 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(90, 145, 45)';
    ctx.fillRect(sx + 7, sy + 6, 2, 10);
    ctx.fillRect(sx + 5, sy + 11, 2, 1);

    ctx.fillStyle = 'rgb(205, 95, 215)';
    ctx.fillRect(sx + 5, sy + 1, 6, 5);
    ctx.fillRect(sx + 6, sy + 0, 4, 7);
    ctx.fillStyle = 'rgb(235, 145, 245)';
    ctx.fillRect(sx + 6, sy + 2, 1, 1);
    ctx.fillRect(sx + 9, sy + 4, 1, 1);
    ctx.fillRect(sx + 8, sy + 1, 1, 1);
  }

  // 38: Oxeye Daisy
  drawFlowerTexture(38, 'rgb(85, 145, 40)', 'rgb(240, 240, 240)', 'rgb(245, 195, 20)');

  // 39: Tall Grass
  {
    const sx = (39 % 8) * tileSize;
    const sy = Math.floor(39 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(110, 180, 50)';
    // Main blades
    ctx.fillRect(sx + 4, sy + 10, 2, 6);
    ctx.fillRect(sx + 6, sy + 6, 2, 10);
    ctx.fillRect(sx + 8, sy + 3, 2, 13);
    ctx.fillRect(sx + 10, sy + 8, 2, 8);
    // Outer random blades
    ctx.fillStyle = 'rgb(130, 200, 60)';
    ctx.fillRect(sx + 2, sy + 12, 2, 4);
    ctx.fillRect(sx + 12, sy + 11, 2, 5);
    ctx.fillRect(sx + 5, sy + 8, 1, 2);
    ctx.fillRect(sx + 9, sy + 2, 1, 2);
    ctx.fillRect(sx + 11, sy + 6, 1, 2);
  }

  // 40: Fern
  {
    const sx = (40 % 8) * tileSize;
    const sy = Math.floor(40 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(30, 110, 20)';
    ctx.fillRect(sx + 7, sy + 2, 2, 14); // Stem
    // Symmetric leaflets
    ctx.fillRect(sx + 5, sy + 5, 6, 2);
    ctx.fillRect(sx + 3, sy + 8, 10, 2);
    ctx.fillRect(sx + 1, sy + 11, 14, 2);
    ctx.fillStyle = 'rgb(55, 155, 40)';
    ctx.fillRect(sx + 6, sy + 3, 4, 2);
    ctx.fillRect(sx + 4, sy + 7, 8, 2);
    ctx.fillRect(sx + 2, sy + 10, 12, 2);
    ctx.fillRect(sx + 0, sy + 13, 16, 2);
  }

  // 41: Dead Bush
  {
    const sx = (41 % 8) * tileSize;
    const sy = Math.floor(41 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(125, 95, 60)';
    // Branchy structure
    ctx.fillRect(sx + 7, sy + 10, 2, 6);
    ctx.fillRect(sx + 5, sy + 6, 2, 5);
    ctx.fillRect(sx + 9, sy + 5, 2, 7);
    ctx.fillRect(sx + 3, sy + 8, 2, 4);
    ctx.fillRect(sx + 11, sy + 4, 2, 5);
    ctx.fillStyle = 'rgb(100, 75, 45)';
    ctx.fillRect(sx + 2, sy + 12, 3, 1);
    ctx.fillRect(sx + 11, sy + 9, 3, 1);
    ctx.fillRect(sx + 4, sy + 5, 1, 2);
    ctx.fillRect(sx + 10, sy + 3, 1, 2);
  }

  // 42: Sunflower Bottom
  {
    const sx = (42 % 8) * tileSize;
    const sy = Math.floor(42 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(90, 155, 40)';
    ctx.fillRect(sx + 7, sy, 2, 16); // Stem
    // Large leaves
    ctx.fillRect(sx + 4, sy + 6, 3, 2);
    ctx.fillRect(sx + 9, sy + 9, 3, 2);
    ctx.fillRect(sx + 3, sy + 12, 4, 2);
  }

  // 43: Sunflower Top
  {
    const sx = (43 % 8) * tileSize;
    const sy = Math.floor(43 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(90, 155, 40)';
    ctx.fillRect(sx + 7, sy + 6, 2, 10); // Stem
    // Sunflower face
    ctx.fillStyle = 'rgb(245, 205, 20)';
    ctx.fillRect(sx + 3, sy + 2, 10, 10);
    ctx.fillRect(sx + 4, sy + 1, 8, 12);
    ctx.fillRect(sx + 2, sy + 3, 12, 8);
    // Center dark seeds
    ctx.fillStyle = 'rgb(75, 50, 20)';
    ctx.fillRect(sx + 6, sy + 5, 4, 4);
    ctx.fillRect(sx + 7, sy + 4, 2, 6);
    ctx.fillRect(sx + 5, sy + 6, 6, 2);
  }

  // 44: Rose Bush Bottom
  {
    const sx = (44 % 8) * tileSize;
    const sy = Math.floor(44 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(45, 110, 25)';
    ctx.fillRect(sx + 3, sy + 2, 10, 14);
    ctx.fillRect(sx + 4, sy + 0, 8, 16);
    ctx.fillRect(sx + 1, sy + 6, 14, 10);
    // Little roses
    ctx.fillStyle = 'rgb(215, 20, 20)';
    ctx.fillRect(sx + 4, sy + 8, 2, 2);
    ctx.fillRect(sx + 10, sy + 5, 2, 2);
  }

  // 45: Rose Bush Top
  {
    const sx = (45 % 8) * tileSize;
    const sy = Math.floor(45 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(45, 110, 25)';
    ctx.fillRect(sx + 2, sy + 4, 12, 12);
    ctx.fillRect(sx + 4, sy + 1, 8, 15);
    // Rose clusters
    ctx.fillStyle = 'rgb(215, 20, 20)';
    ctx.fillRect(sx + 5, sy + 3, 3, 3);
    ctx.fillRect(sx + 9, sy + 7, 3, 3);
    ctx.fillRect(sx + 3, sy + 10, 2, 2);
    ctx.fillRect(sx + 11, sy + 2, 2, 2);
  }

  // 46: Peony Bottom
  {
    const sx = (46 % 8) * tileSize;
    const sy = Math.floor(46 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(50, 120, 30)';
    ctx.fillRect(sx + 3, sy + 4, 10, 12);
    ctx.fillRect(sx + 4, sy + 1, 8, 15);
    ctx.fillRect(sx + 2, sy + 8, 12, 8);
  }

  // 47: Peony Top
  {
    const sx = (47 % 8) * tileSize;
    const sy = Math.floor(47 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(50, 120, 30)';
    ctx.fillRect(sx + 2, sy + 4, 12, 12);
    ctx.fillRect(sx + 4, sy + 1, 8, 15);
    // Large pink blooms
    ctx.fillStyle = 'rgb(245, 135, 180)';
    ctx.fillRect(sx + 5, sy + 2, 4, 4);
    ctx.fillRect(sx + 9, sy + 8, 4, 4);
    ctx.fillStyle = 'rgb(255, 200, 220)';
    ctx.fillRect(sx + 6, sy + 3, 2, 2);
    ctx.fillRect(sx + 10, sy + 9, 2, 2);
  }

  // 48: Lilac Bottom
  {
    const sx = (48 % 8) * tileSize;
    const sy = Math.floor(48 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(55, 125, 35)';
    ctx.fillRect(sx + 3, sy + 4, 10, 12);
    ctx.fillRect(sx + 4, sy + 1, 8, 15);
  }

  // 49: Lilac Top
  {
    const sx = (49 % 8) * tileSize;
    const sy = Math.floor(49 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(55, 125, 35)';
    ctx.fillRect(sx + 2, sy + 5, 12, 11);
    ctx.fillRect(sx + 4, sy + 2, 8, 14);
    // Purple plumes
    ctx.fillStyle = 'rgb(180, 120, 225)';
    ctx.fillRect(sx + 5, sy + 1, 4, 6);
    ctx.fillRect(sx + 4, sy + 3, 6, 8);
    ctx.fillRect(sx + 8, sy + 5, 4, 5);
    ctx.fillStyle = 'rgb(225, 175, 255)';
    ctx.fillRect(sx + 6, sy + 2, 2, 2);
    ctx.fillRect(sx + 5, sy + 5, 2, 2);
    ctx.fillRect(sx + 9, sy + 7, 2, 2);
  }

  // 50: Double Tall Grass Bottom
  {
    const sx = (50 % 8) * tileSize;
    const sy = Math.floor(50 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(105, 175, 45)';
    // Thick tall grass blades starting at bottom
    ctx.fillRect(sx + 5, sy + 0, 3, 16);
    ctx.fillRect(sx + 2, sy + 8, 2, 8);
    ctx.fillRect(sx + 11, sy + 6, 3, 10);
    ctx.fillStyle = 'rgb(125, 195, 55)';
    ctx.fillRect(sx + 4, sy + 4, 2, 12);
    ctx.fillRect(sx + 9, sy + 3, 2, 13);
  }

  // 51: Double Tall Grass Top
  {
    const sx = (51 % 8) * tileSize;
    const sy = Math.floor(51 / 8) * tileSize;
    ctx.clearRect(sx, sy, tileSize, tileSize);
    ctx.fillStyle = 'rgb(105, 175, 45)';
    // Blades narrowing and swaying
    ctx.fillRect(sx + 6, sy + 8, 2, 8);
    ctx.fillRect(sx + 3, sy + 11, 2, 5);
    ctx.fillRect(sx + 12, sy + 12, 2, 4);
    // Diagonal swaying tips
    ctx.fillRect(sx + 8, sy + 4, 2, 4);
    ctx.fillRect(sx + 10, sy + 2, 2, 3);
    ctx.fillRect(sx + 12, sy + 1, 2, 2);
    ctx.fillStyle = 'rgb(125, 195, 55)';
    ctx.fillRect(sx + 5, sy + 6, 2, 10);
    ctx.fillRect(sx + 3, sy + 4, 2, 3);
    ctx.fillRect(sx + 1, sy + 2, 2, 3);
  }

  try {
    cachedDataURL = canvas.toDataURL();
  } catch (_e) {
    cachedDataURL = '';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
