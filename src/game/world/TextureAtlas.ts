import * as THREE from 'three';

export function generateTextureAtlas(): THREE.Texture {
  const tileSize = 16;
  const atlasCols = 8;
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * atlasCols;
  canvas.height = tileSize * atlasCols;
  const ctx = canvas.getContext('2d')!;

  // Helper to fill with noise
  const fillNoise = (x: number, y: number, r: number, g: number, b: number, noiseIntensity: number) => {
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        const n = (Math.random() - 0.5) * noiseIntensity;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, r + n))}, ${Math.min(255, Math.max(0, g + n))}, ${Math.min(255, Math.max(0, b + n))})`;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  };

  let x: number;
  let y: number;

  // 0: Grass Top
  x = (0 % 8) * tileSize;
  y = Math.floor(0 / 8) * tileSize;
  fillNoise(x, y, 90, 160, 50, 25);
  ctx.fillStyle = 'rgb(70, 140, 40)';
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 1, 1);
  }

  // 1: Grass Side
  x = (1 % 8) * tileSize;
  y = Math.floor(1 / 8) * tileSize;
  fillNoise(x, y, 130, 90, 60, 20); // Dirt base
  ctx.fillStyle = 'rgb(90, 160, 50)'; // Grass top edge
  ctx.fillRect(x, y, tileSize, 4);
  for (let px = 0; px < tileSize; px++) {
    const h = 4 + Math.floor(Math.sin(px * 1.5) * 2 + Math.random() * 2);
    ctx.fillRect(x + px, y, 1, h);
  }

  // 2: Dirt
  x = (2 % 8) * tileSize;
  y = Math.floor(2 / 8) * tileSize;
  fillNoise(x, y, 130, 90, 60, 20);
  ctx.fillStyle = 'rgb(100, 70, 45)';
  for (let i = 0; i < 15; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 2, 1);
  }

  // 3: Stone
  x = (3 % 8) * tileSize;
  y = Math.floor(3 / 8) * tileSize;
  fillNoise(x, y, 120, 120, 120, 20);
  ctx.fillStyle = 'rgb(90, 90, 90)';
  for (let i = 0; i < 15; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 2, 2);
  }

  // 4: Wood Side
  x = (4 % 8) * tileSize;
  y = Math.floor(4 / 8) * tileSize;
  fillNoise(x, y, 120, 85, 45, 15);
  ctx.fillStyle = 'rgb(80, 55, 30)'; // Bark lines
  for (let py = 0; py < tileSize; py++) {
    ctx.fillRect(x + 2 + Math.floor(Math.sin(py * 0.5) * 1), y + py, 2, 1);
    ctx.fillRect(x + 10 + Math.floor(Math.sin(py * 0.5 + 2) * 1), y + py, 2, 1);
  }

  // 5: Wood Top (concentric rings)
  x = (5 % 8) * tileSize;
  y = Math.floor(5 / 8) * tileSize;
  fillNoise(x, y, 185, 150, 100, 10);
  ctx.strokeStyle = 'rgb(120, 85, 45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2.5, y + 2.5, tileSize - 5, tileSize - 5);
  ctx.strokeRect(x + 5.5, y + 5.5, tileSize - 11, tileSize - 11);

  // 6: Leaf
  x = (6 % 8) * tileSize;
  y = Math.floor(6 / 8) * tileSize;
  fillNoise(x, y, 45, 120, 35, 30);
  ctx.fillStyle = 'rgb(25, 80, 20)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 2, 2);
  }

  // 7: Brick
  x = (7 % 8) * tileSize;
  y = Math.floor(7 / 8) * tileSize;
  fillNoise(x, y, 160, 60, 45, 15);
  ctx.fillStyle = 'rgb(180, 180, 180)'; // Mortar
  ctx.fillRect(x, y + 4, tileSize, 1);
  ctx.fillRect(x, y + 9, tileSize, 1);
  ctx.fillRect(x, y + 14, tileSize, 1);
  ctx.fillRect(x + 4, y, 1, 4);
  ctx.fillRect(x + 12, y, 1, 4);
  ctx.fillRect(x + 8, y + 5, 1, 4);
  ctx.fillRect(x + 2, y + 10, 1, 4);
  ctx.fillRect(x + 10, y + 10, 1, 4);

  // 8: Glass
  x = (8 % 8) * tileSize;
  y = Math.floor(8 / 8) * tileSize;
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.clearRect(x, y, tileSize, tileSize);
  ctx.strokeStyle = 'rgb(150, 230, 255)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 13);
  ctx.lineTo(x + 13, y + 3);
  ctx.stroke();

  // 9: Water
  x = (9 % 8) * tileSize;
  y = Math.floor(9 / 8) * tileSize;
  fillNoise(x, y, 40, 110, 220, 15);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let py = 2; py < tileSize; py += 4) {
    for (let px = 0; px < tileSize; px++) {
      if ((px + py) % 4 === 0) {
        ctx.fillRect(x + px, y + py, 2, 1);
      }
    }
  }

  // 10: Sand
  x = (10 % 8) * tileSize;
  y = Math.floor(10 / 8) * tileSize;
  fillNoise(x, y, 220, 205, 140, 15);
  ctx.fillStyle = 'rgb(195, 180, 115)';
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 1, 1);
  }

  // 11: Coal Ore
  x = (11 % 8) * tileSize;
  y = Math.floor(11 / 8) * tileSize;
  fillNoise(x, y, 120, 120, 120, 20); // Stone base
  ctx.fillStyle = 'rgb(40, 40, 40)'; // Coal spots
  ctx.fillRect(x + 3, y + 3, 2, 2);
  ctx.fillRect(x + 8, y + 10, 3, 2);
  ctx.fillRect(x + 12, y + 4, 2, 1);
  ctx.fillRect(x + 2, y + 11, 2, 2);

  // 12: Iron Ore
  x = (12 % 8) * tileSize;
  y = Math.floor(12 / 8) * tileSize;
  fillNoise(x, y, 120, 120, 120, 20); // Stone base
  ctx.fillStyle = 'rgb(190, 130, 90)'; // Iron spots
  ctx.fillRect(x + 3, y + 4, 3, 2);
  ctx.fillRect(x + 9, y + 9, 2, 2);
  ctx.fillRect(x + 11, y + 3, 2, 2);
  ctx.fillRect(x + 2, y + 12, 3, 1);

  // 13: Diamond Ore
  x = (13 % 8) * tileSize;
  y = Math.floor(13 / 8) * tileSize;
  fillNoise(x, y, 120, 120, 120, 20); // Stone base
  ctx.fillStyle = 'rgb(90, 220, 240)'; // Diamond spots
  ctx.fillRect(x + 4, y + 4, 2, 2);
  ctx.fillRect(x + 10, y + 10, 2, 2);
  ctx.fillRect(x + 2, y + 11, 2, 1);
  ctx.fillRect(x + 11, y + 3, 2, 1);

  // 16: Birch Wood Side (White/light gray bark with dark horizontal streaks)
  x = (16 % 8) * tileSize;
  y = Math.floor(16 / 8) * tileSize;
  fillNoise(x, y, 225, 225, 220, 8);
  ctx.fillStyle = 'rgb(50, 50, 50)'; // Birch markings
  ctx.fillRect(x + 2, y + 3, 4, 1);
  ctx.fillRect(x + 10, y + 6, 5, 2);
  ctx.fillRect(x + 1, y + 11, 3, 1);
  ctx.fillRect(x + 12, y + 12, 4, 1);

  // 17: Birch Wood Top (Creamy core with a light gray/white circular bark border)
  x = (17 % 8) * tileSize;
  y = Math.floor(17 / 8) * tileSize;
  fillNoise(x, y, 220, 205, 175, 5); // Cream wood
  ctx.strokeStyle = 'rgb(180, 160, 130)'; // Rings
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2.5, y + 2.5, tileSize - 5, tileSize - 5);
  ctx.strokeRect(x + 5.5, y + 5.5, tileSize - 11, tileSize - 11);
  // White bark border ring
  ctx.strokeStyle = 'rgb(240, 240, 235)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, tileSize - 1.5, tileSize - 1.5);

  // 18: Birch Leaves (Bright green/yellowish green leaves)
  x = (18 % 8) * tileSize;
  y = Math.floor(18 / 8) * tileSize;
  fillNoise(x, y, 85, 170, 50, 25);
  ctx.fillStyle = 'rgb(50, 120, 30)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 2, 2);
  }

  // 19: Spruce Wood Side (Dark brown bark with rough ridges)
  x = (19 % 8) * tileSize;
  y = Math.floor(19 / 8) * tileSize;
  fillNoise(x, y, 75, 48, 28, 15);
  ctx.fillStyle = 'rgb(45, 28, 15)'; // Bark lines
  for (let py = 0; py < tileSize; py++) {
    ctx.fillRect(x + 2 + Math.floor(Math.sin(py * 0.5) * 1), y + py, 2, 1);
    ctx.fillRect(x + 10 + Math.floor(Math.sin(py * 0.5 + 2) * 1), y + py, 2, 1);
  }

  // 20: Spruce Wood Top (Darker brown wood core with darker concentric rings)
  x = (20 % 8) * tileSize;
  y = Math.floor(20 / 8) * tileSize;
  fillNoise(x, y, 130, 95, 65, 8); // Core wood
  ctx.strokeStyle = 'rgb(75, 48, 28)'; // Rings
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2.5, y + 2.5, tileSize - 5, tileSize - 5);
  ctx.strokeRect(x + 5.5, y + 5.5, tileSize - 11, tileSize - 11);
  // Dark bark border ring
  ctx.strokeStyle = 'rgb(55, 35, 20)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, tileSize - 1.5, tileSize - 1.5);

  // 21: Spruce Leaves (Dark green/blue-green pine needles texture)
  x = (21 % 8) * tileSize;
  y = Math.floor(21 / 8) * tileSize;
  fillNoise(x, y, 30, 75, 50, 15);
  ctx.fillStyle = 'rgb(15, 45, 30)';
  // Needles representation
  for (let i = 0; i < 15; i++) {
    ctx.fillRect(x + Math.floor(Math.random() * tileSize), y + Math.floor(Math.random() * tileSize), 3, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
