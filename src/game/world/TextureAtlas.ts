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

  try {
    cachedDataURL = canvas.toDataURL();
  } catch (e) {
    cachedDataURL = '';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
