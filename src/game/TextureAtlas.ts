import * as THREE from 'three';

export function generateTextureAtlas(): THREE.Texture {
  const tileSize = 16;
  const atlasCols = 4;
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

  // 0: Grass Top
  fillNoise(0, 0, 90, 160, 50, 25);
  ctx.fillStyle = 'rgb(70, 140, 40)';
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(Math.floor(Math.random() * tileSize), Math.floor(Math.random() * tileSize), 1, 1);
  }

  // 1: Grass Side
  fillNoise(tileSize, 0, 130, 90, 60, 20); // Dirt base
  ctx.fillStyle = 'rgb(90, 160, 50)'; // Grass top edge
  ctx.fillRect(tileSize, 0, tileSize, 4);
  for (let px = 0; px < tileSize; px++) {
    const h = 4 + Math.floor(Math.sin(px * 1.5) * 2 + Math.random() * 2);
    ctx.fillRect(tileSize + px, 0, 1, h);
  }

  // 2: Dirt
  fillNoise(tileSize * 2, 0, 130, 90, 60, 20);
  ctx.fillStyle = 'rgb(100, 70, 45)';
  for (let i = 0; i < 15; i++) {
    ctx.fillRect(tileSize * 2 + Math.floor(Math.random() * tileSize), Math.floor(Math.random() * tileSize), 2, 1);
  }

  // 3: Stone
  fillNoise(tileSize * 3, 0, 120, 120, 120, 20);
  ctx.fillStyle = 'rgb(90, 90, 90)';
  for (let i = 0; i < 15; i++) {
    ctx.fillRect(tileSize * 3 + Math.floor(Math.random() * tileSize), Math.floor(Math.random() * tileSize), 2, 2);
  }

  // 4: Wood Side
  fillNoise(0, tileSize, 120, 85, 45, 15);
  ctx.fillStyle = 'rgb(80, 55, 30)'; // Bark lines
  for (let py = 0; py < tileSize; py++) {
    ctx.fillRect(2 + Math.floor(Math.sin(py * 0.5) * 1), tileSize + py, 2, 1);
    ctx.fillRect(10 + Math.floor(Math.sin(py * 0.5 + 2) * 1), tileSize + py, 2, 1);
  }

  // 5: Wood Top (concentric rings)
  fillNoise(tileSize, tileSize, 185, 150, 100, 10);
  ctx.strokeStyle = 'rgb(120, 85, 45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tileSize + 2.5, tileSize + 2.5, tileSize - 5, tileSize - 5);
  ctx.strokeRect(tileSize + 5.5, tileSize + 5.5, tileSize - 11, tileSize - 11);

  // 6: Leaf
  fillNoise(tileSize * 2, tileSize, 45, 120, 35, 30);
  ctx.fillStyle = 'rgb(25, 80, 20)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(tileSize * 2 + Math.floor(Math.random() * tileSize), tileSize + Math.floor(Math.random() * tileSize), 2, 2);
  }

  // 7: Brick
  fillNoise(tileSize * 3, tileSize, 160, 60, 45, 15);
  ctx.fillStyle = 'rgb(180, 180, 180)'; // Mortar
  ctx.fillRect(tileSize * 3, tileSize + 4, tileSize, 1);
  ctx.fillRect(tileSize * 3, tileSize + 9, tileSize, 1);
  ctx.fillRect(tileSize * 3, tileSize + 14, tileSize, 1);
  ctx.fillRect(tileSize * 3 + 4, tileSize, 1, 4);
  ctx.fillRect(tileSize * 3 + 12, tileSize, 1, 4);
  ctx.fillRect(tileSize * 3 + 8, tileSize + 5, 1, 4);
  ctx.fillRect(tileSize * 3 + 2, tileSize + 10, 1, 4);
  ctx.fillRect(tileSize * 3 + 10, tileSize + 10, 1, 4);

  // 8: Glass
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.clearRect(0, tileSize * 2, tileSize, tileSize);
  ctx.strokeStyle = 'rgb(150, 230, 255)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, tileSize * 2 + 0.5, tileSize - 1, tileSize - 1);
  ctx.beginPath();
  ctx.moveTo(3, tileSize * 2 + 13);
  ctx.lineTo(13, tileSize * 2 + 3);
  ctx.stroke();

  // 9: Water
  fillNoise(tileSize, tileSize * 2, 40, 110, 220, 15);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let py = 2; py < tileSize; py += 4) {
    for (let px = 0; px < tileSize; px++) {
      if ((px + py) % 4 === 0) {
        ctx.fillRect(tileSize + px, tileSize * 2 + py, 2, 1);
      }
    }
  }

  // 10: Sand
  fillNoise(tileSize * 2, tileSize * 2, 220, 205, 140, 15);
  ctx.fillStyle = 'rgb(195, 180, 115)';
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(tileSize * 2 + Math.floor(Math.random() * tileSize), tileSize * 2 + Math.floor(Math.random() * tileSize), 1, 1);
  }

  // 11: Coal Ore
  fillNoise(tileSize * 3, tileSize * 2, 120, 120, 120, 20); // Stone base
  ctx.fillStyle = 'rgb(40, 40, 40)'; // Coal spots
  ctx.fillRect(tileSize * 3 + 3, tileSize * 2 + 3, 2, 2);
  ctx.fillRect(tileSize * 3 + 8, tileSize * 2 + 10, 3, 2);
  ctx.fillRect(tileSize * 3 + 12, tileSize * 2 + 4, 2, 1);
  ctx.fillRect(tileSize * 3 + 2, tileSize * 2 + 11, 2, 2);

  // 12: Iron Ore
  fillNoise(0, tileSize * 3, 120, 120, 120, 20); // Stone base
  ctx.fillStyle = 'rgb(190, 130, 90)'; // Iron spots
  ctx.fillRect(3, tileSize * 3 + 4, 3, 2);
  ctx.fillRect(9, tileSize * 3 + 9, 2, 2);
  ctx.fillRect(11, tileSize * 3 + 3, 2, 2);
  ctx.fillRect(2, tileSize * 3 + 12, 3, 1);

  // 13: Diamond Ore
  fillNoise(tileSize, tileSize * 3, 120, 120, 120, 20); // Stone base
  ctx.fillStyle = 'rgb(90, 220, 240)'; // Diamond spots
  ctx.fillRect(tileSize + 4, tileSize * 3 + 4, 2, 2);
  ctx.fillRect(tileSize + 10, tileSize * 3 + 10, 2, 2);
  ctx.fillRect(tileSize + 2, tileSize * 3 + 11, 2, 1);
  ctx.fillRect(tileSize + 11, tileSize * 3 + 3, 2, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
