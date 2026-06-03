import { ImprovedNoise } from './Noise';
import { BLOCK_TYPES } from './BlockConfig';
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
        const finalHeight = Math.min(CHUNK_SIZE_Y - 2, interpolatedHeight);
        const waterLevel = WORLD_CONFIG.waterLevel;

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          
          if (y === 0) {
            // Bedrock layer
            chunk[index] = BLOCK_TYPES.STONE;
          } else if (y <= finalHeight) {
            const depth = finalHeight - y + 1;
            primaryBiome.fillColumn(chunk, x, z, y, finalHeight, waterLevel, depth, this.noise, wx, wz);
          } else if (y <= waterLevel) {
            // Water filling
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
        const isValidGround = blockType === BLOCK_TYPES.GRASS || blockType === BLOCK_TYPES.SAND || blockType === BLOCK_TYPES.STONE;
        if (isValidGround && ty > 20) {
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
