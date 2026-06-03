import { ImprovedNoise } from './Noise';
import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { getBiomeAt } from './biome/BiomeRegistry';
import { type Biome, TreeStyle } from './biome/Biome';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './World';
import { WORLD_CONFIG } from './WorldConfig';

export class WorldGenerator {
  private noise: ImprovedNoise;

  constructor(seed: string) {
    this.noise = new ImprovedNoise(seed);
  }

  public setSeed(seed: string): void {
    this.noise.seed(seed);
  }

  public getNoise(): ImprovedNoise {
    return this.noise;
  }

  private isWaterArea(wx: number, wz: number): boolean {
    const oceanNoise = this.noise.noise(wx * WORLD_CONFIG.ocean.scale, wz * WORLD_CONFIG.ocean.scale);
    if (oceanNoise < WORLD_CONFIG.ocean.threshold) {
      return true;
    }
    const riverNoise = this.noise.noise(wx * WORLD_CONFIG.river.scale, wz * WORLD_CONFIG.river.scale);
    const dRiver = Math.abs(riverNoise);
    if (dRiver < WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth) {
      const t = dRiver < WORLD_CONFIG.river.threshold
        ? 1.0
        : 1.0 - (dRiver - WORLD_CONFIG.river.threshold) / WORLD_CONFIG.river.transitionWidth;
      if (t > 0.35) {
        return true;
      }
    }
    return false;
  }

  // 3x3 邻域高斯权重插值计算，并返回中心点的主生态
  public getInterpolatedHeightAndBiome(wx: number, wz: number): { height: number; primaryBiome: Biome } {
    const primaryBiome = getBiomeAt(wx, wz, this.noise);
    
    let totalHeight = 0;
    let totalWeight = 0;
    
    const step = WORLD_CONFIG.heightInterpolation.step;
    // 3x3 采样，步长设为 step
    for (let dx = -step; dx <= step; dx += step) {
      for (let dz = -step; dz <= step; dz += step) {
        const sampleX = wx + dx;
        const sampleZ = wz + dz;
        const biome = getBiomeAt(sampleX, sampleZ, this.noise);
        
        // 用该生态规律计算中心点的高度
        const height = biome.getHeight(wx, wz, this.noise);
        
        // 高斯权重：dSq = dx^2 + dz^2，W = exp(-dSq / sigmaSq)
        const dSq = dx * dx + dz * dz;
        const weight = Math.exp(-dSq / WORLD_CONFIG.heightInterpolation.sigmaSq);
        
        totalHeight += height * weight;
        totalWeight += weight;
      }
    }
    
    return {
      height: Math.round(totalHeight / totalWeight),
      primaryBiome,
    };
  }

  private pseudoRandom2D(x: number, y: number): number {
    const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return a - Math.floor(a);
  }

  // Procedural chunk generation
  public generateChunkData(cx: number, cz: number): Uint8Array {
    const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    // Generate terrain
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const wx = worldStartX + x;
        const wz = worldStartZ + z;

        // 使用 3x3 邻域插值计算平滑高度与主生态
        const { height: interpolatedHeight, primaryBiome } = this.getInterpolatedHeightAndBiome(wx, wz);
        
        // 计算海洋掩码 (Ocean/Land mask)
        const oceanNoise = this.noise.noise(wx * WORLD_CONFIG.ocean.scale, wz * WORLD_CONFIG.ocean.scale);
        const waterLevel = WORLD_CONFIG.waterLevel;
        
        let adjustedHeight = interpolatedHeight;
        let isDryLand = true;

        if (oceanNoise < WORLD_CONFIG.ocean.threshold) {
          // 海洋区域
          isDryLand = false;
          const oceanFactor = Math.min(1, (WORLD_CONFIG.ocean.threshold - oceanNoise) / WORLD_CONFIG.ocean.transitionWidth);
          // 在海洋深处，基础高度为 12 左右，并带有一些轻微的海底噪波起伏
          const oceanBaseHeight = WORLD_CONFIG.ocean.baseHeight + this.noise.noise(wx * 0.02, wz * 0.02) * 3;
          adjustedHeight = Math.round((1 - oceanFactor) * interpolatedHeight + oceanFactor * oceanBaseHeight);
        } else {
          // 陆地区域。通过海岸线平滑拉高，防止海陆分界线处出现悬空的水墙
          const distToShore = oceanNoise - WORLD_CONFIG.ocean.threshold;
          if (distToShore < WORLD_CONFIG.ocean.shoreWidth) {
            const t = distToShore / WORLD_CONFIG.ocean.shoreWidth;
            const minShoreHeight = waterLevel + 1; // 至少比海平面高出 1 格
            if (adjustedHeight < minShoreHeight) {
              adjustedHeight = Math.round(t * adjustedHeight + (1 - t) * minShoreHeight);
            }
          }
        }

        // ==================== 新增河流生成逻辑 ====================
        const riverNoise = this.noise.noise(wx * WORLD_CONFIG.river.scale, wz * WORLD_CONFIG.river.scale);
        const dRiver = Math.abs(riverNoise);
        
        if (dRiver < WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth) {
          const t = dRiver < WORLD_CONFIG.river.threshold
            ? 1.0
            : 1.0 - (dRiver - WORLD_CONFIG.river.threshold) / WORLD_CONFIG.river.transitionWidth;

          // 河床基础高度在海平面（150）以下约 8 格，带微弱起伏
          const riverBedHeight = WORLD_CONFIG.river.bedHeight + this.noise.noise(wx * 0.05, wz * 0.05) * 3;
          
          if (adjustedHeight > riverBedHeight) {
            adjustedHeight = Math.round(adjustedHeight * (1 - t) + riverBedHeight * t);
          }

          if (t > 0.35) {
            isDryLand = false;
          } else if (isDryLand) {
            // 只有当该位置本身是陆地（非海洋）时，才需要对河流岸边进行拉高，防止悬空水墙
            if (t > 0.0) {
              const u = t / 0.35; // 从 0 (远离河流) 到 1 (河流分界线)
              const minShoreHeight = waterLevel + 1; // 至少比水面高出 1 格
              if (adjustedHeight < minShoreHeight) {
                adjustedHeight = Math.round(u * minShoreHeight + (1 - u) * adjustedHeight);
              }
            }
          }
        }
        // ==========================================================

        // 陆地区域邻域水面保护：若当前块为陆地且高度低于水面+1，检测其水平相邻块是否为水域（海洋或河流）
        // 如果是，为了防止水平方向水体悬空外露，将当前陆地块拉高至至少 waterLevel + 1 作为堤岸
        if (isDryLand && adjustedHeight < waterLevel + 1) {
          const neighbors = [
            [wx + 1, wz],
            [wx - 1, wz],
            [wx, wz + 1],
            [wx, wz - 1]
          ];
          let adjacentToWater = false;
          for (const [nx, nz] of neighbors) {
            if (this.isWaterArea(nx, nz)) {
              adjacentToWater = true;
              break;
            }
          }
          if (adjacentToWater) {
            adjustedHeight = waterLevel + 1;
          }
        }

        const finalHeight = Math.max(3, Math.min(CHUNK_SIZE_Y - 2, adjustedHeight));

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          
          if (y === 0) {
            // Bedrock layer
            chunk[index] = BLOCK_TYPES.STONE;
          } else if (y <= finalHeight) {
            const depth = finalHeight - y + 1;
            primaryBiome.fillColumn(chunk, x, z, y, finalHeight, waterLevel, depth, this.noise, wx, wz, isDryLand);

            // 矿洞刻蚀 (Cave carving)
            // 矿洞仅在 minHeight 以上、地表下 3 格以下（避免破坏草地表面和露天结构）生成
            if (y >= WORLD_CONFIG.caves.minHeight && y <= finalHeight - WORLD_CONFIG.caves.maxHeightOffset) {
              const n1 = this.noise.noise3d(
                wx * WORLD_CONFIG.caves.scaleXZ,
                y * WORLD_CONFIG.caves.scaleY,
                wz * WORLD_CONFIG.caves.scaleXZ
              );
              const n2 = this.noise.noise3d(
                wx * WORLD_CONFIG.caves.scaleXZ + 100,
                y * WORLD_CONFIG.caves.scaleY + 100,
                wz * WORLD_CONFIG.caves.scaleXZ + 100
              );
              
              if (Math.abs(n1) < WORLD_CONFIG.caves.threshold && Math.abs(n2) < WORLD_CONFIG.caves.threshold) {
                // 雕刻为空气 (Caves are filled with air)
                chunk[index] = BLOCK_TYPES.AIR;
              }
            }
          } else if (y <= waterLevel && !isDryLand) {
            // 只在海洋/湖泊区域填充水，陆地区域低于海平面也保持空气
            chunk[index] = BLOCK_TYPES.WATER;
          } else {
            // Air
            chunk[index] = BLOCK_TYPES.AIR;
          }
        }
      }
    }

    // Procedural decoration: grow trees/decorations in this chunk
    // Seeded random based on chunk coordinates
    const chunkRandom = this.pseudoRandom2D(cx, cz);
    const numTrees = Math.floor(chunkRandom * 12) % 3 + 1; // 1 to 3 decoration attempts
    for (let t = 0; t < numTrees; t++) {
      const tx = 2 + Math.floor(this.pseudoRandom2D(cx * 10 + t, cz * 10 + t) * (CHUNK_SIZE_X - 4));
      const tz = 2 + Math.floor(this.pseudoRandom2D(cx * 20 + t, cz * 20 + t) * (CHUNK_SIZE_Z - 4));
      
      const wx = worldStartX + tx;
      const wz = worldStartZ + tz;
      const biome = getBiomeAt(wx, wz, this.noise);

      // 以该生态的特定概率决定是否生成装饰物
      const prob = biome.getTreeProbability(chunkRandom);
      const spawnRand = this.pseudoRandom2D(wx * 7 + t, wz * 13 + t);
      if (spawnRand < prob) {
        // 寻找地表高度
        let ty = CHUNK_SIZE_Y - 2;
        while (ty > 0 && chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] === BLOCK_TYPES.AIR) {
          ty--;
        }

        const blockType = chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z];
        // 允许的植被生长地基（如草方块、沙子等）
        const isValidGround = getBlockProperties(blockType).allowVegetationBase === true;
        if (isValidGround && ty > WORLD_CONFIG.waterLevel - 2) {
          biome.growDecorations(
            chunk,
            tx,
            ty,
            tz,
            chunkRandom,
            t,
            this.growTree.bind(this)
          );
        }
      }
    }

    return chunk;
  }

  public growTree(
    chunk: Uint8Array,
    tx: number,
    ty: number,
    tz: number,
    trunkBlock: number,
    leafBlock: number,
    height: number,
    style: TreeStyle
  ): void {
    // Change grass below trunk to dirt
    chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] = BLOCK_TYPES.DIRT;

    // Grow trunk
    for (let h = 1; h <= height; h++) {
      const wly = ty + h;
      if (wly < CHUNK_SIZE_Y) {
        const trunkIdx = tx + tz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
        chunk[trunkIdx] = trunkBlock;
      }
    }

    // Grow canopy (leaves)
    const leafCenterY = ty + height;

    if (style === TreeStyle.OAK || style === TreeStyle.BIRCH) {
      // Round canopy style
      const startY = style === TreeStyle.BIRCH ? -3 : -2;
      for (let ly = startY; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : 2;
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            // Avoid placing leaves directly where trunk is
            if (lx === 0 && lz === 0 && ly <= 0) continue;
            
            // For birch, round the corners at the bottom layers to make it look nicer
            if (style === TreeStyle.BIRCH && ly === startY && Math.abs(lx) === radius && Math.abs(lz) === radius) {
              continue;
            }

            const wlx = tx + lx;
            const wlz = tz + lz;
            const wly = leafCenterY + ly;

            // Random variation: slightly skip some outer leaves to make the shape irregular
            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = this.pseudoRandom2D(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.20) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < CHUNK_SIZE_Y) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (chunk[leafIdx] === BLOCK_TYPES.AIR) {
                chunk[leafIdx] = leafBlock;
              }
            }
          }
        }
      }
    } else if (style === TreeStyle.SPRUCE) {
      // Conical/layered canopy style for Spruce
      for (let ly = -4; ly <= 1; ly++) {
        let radius = 1;
        if (ly === 1) radius = 0;
        else if (ly === 0) radius = 1;
        else if (ly === -1) radius = 2;
        else if (ly === -2) radius = 1;
        else if (ly === -3) radius = 2;
        else if (ly === -4) radius = 2;

        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;
            
            // Round the 5x5 layers by clipping the corners
            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const wlx = tx + lx;
            const wlz = tz + lz;
            const wly = leafCenterY + ly;

            // Random variation: slightly skip some outer leaves to make the shape irregular
            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = this.pseudoRandom2D(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.20) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < CHUNK_SIZE_Y) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (chunk[leafIdx] === BLOCK_TYPES.AIR) {
                chunk[leafIdx] = leafBlock;
              }
            }
          }
        }
      }
    } else if (style === TreeStyle.JUNGLE) {
      // Jungle canopy, similar to oak but larger and denser
      for (let ly = -3; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : (ly === -3 ? 1 : 2);
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;
            
            // Round the corners
            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const wlx = tx + lx;
            const wlz = tz + lz;
            const wly = leafCenterY + ly;

            // Denser jungle leaves: only 10% chance of random skipping
            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = this.pseudoRandom2D(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.10) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < CHUNK_SIZE_Y) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (chunk[leafIdx] === BLOCK_TYPES.AIR) {
                chunk[leafIdx] = leafBlock;
              }
            }
          }
        }
      }
    }
  }
}
