import { ImprovedNoise } from './Noise';
import { BLOCK_TYPES } from './BlockConfig';
import { getBiomeAt } from './biome/BiomeRegistry';
import { type Biome, TreeStyle } from './biome/Biome';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './World';
import { WORLD_CONFIG } from './WorldConfig';
import { ChunkPipeline } from './pipeline/ChunkPipeline';
import type { ChunkPipelineContext } from './pipeline/ChunkPipelineTypes';
import { TerrainHeightMapStage } from './pipeline/stages/TerrainHeightMapStage';
import { BaseTerrainFillerStage } from './pipeline/stages/BaseTerrainFillerStage';
import { CaveCarverStage } from './pipeline/stages/CaveCarverStage';
import { SurfaceDecorationStage } from './pipeline/stages/SurfaceDecorationStage';
import { TreeDecorationStage } from './pipeline/stages/TreeDecorationStage';

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

  public getRiverValue(wx: number, wz: number): { t: number; bedHeight: number; dRiver: number } {
    // 增加坐标扭曲 (Domain Warping)，使河流具有弯曲多变的形状
    const warpX = this.noise.noise(wx * 0.01, wz * 0.01) * 15;
    const warpZ = this.noise.noise(wx * 0.01 + 50, wz * 0.01 + 50) * 15;
    const riverNoise = this.noise.noise((wx + warpX) * WORLD_CONFIG.river.scale, (wz + warpZ) * WORLD_CONFIG.river.scale);
    const dRiver = Math.abs(riverNoise);
    
    // 动态宽度控制（宽度波动在 0.5x 到 1.5x 之间）
    const widthNoise = this.noise.noise(wx * 0.005, wz * 0.005);
    const threshold = WORLD_CONFIG.river.threshold * (1.0 + widthNoise * 0.6);
    const transitionWidth = WORLD_CONFIG.river.transitionWidth * (1.0 + widthNoise * 0.4);

    let t = 0;
    if (dRiver < threshold + transitionWidth) {
      t = dRiver < threshold
        ? 1.0
        : 1.0 - (dRiver - threshold) / transitionWidth;
    }

    // 动态深度控制（河床高度起伏更深，有时会形成浅滩或深水区）
    const depthNoise = this.noise.noise(wx * 0.015, wz * 0.015);
    const bedHeight = WORLD_CONFIG.river.bedHeight + depthNoise * 6;

    return { t, bedHeight, dRiver };
  }

  private getFlatnessFactor(wx: number, wz: number): number {
    const step = 4;
    const biomeCenter = getBiomeAt(wx, wz, this.noise);
    const hCenter = biomeCenter.getHeight(wx, wz, this.noise);

    const biomeRight = getBiomeAt(wx + step, wz, this.noise);
    const hRight = biomeRight.getHeight(wx + step, wz, this.noise);
    
    const biomeDown = getBiomeAt(wx, wz + step, this.noise);
    const hDown = biomeDown.getHeight(wx, wz + step, this.noise);

    const diffRight = Math.abs(hCenter - hRight);
    const diffDown = Math.abs(hCenter - hDown);
    const slope = Math.max(diffRight, diffDown);

    const slopeThresholdFlat = 1.0;
    const slopeThresholdSteep = 2.0;

    if (slope <= slopeThresholdFlat) {
      return 1.0;
    }
    if (slope >= slopeThresholdSteep) {
      return 0.0;
    }
    return 1.0 - (slope - slopeThresholdFlat) / (slopeThresholdSteep - slopeThresholdFlat);
  }

  private isPondArea(wx: number, wz: number): boolean {
    return this.getPondValue(wx, wz, 0).isPond;
  }

  public getPondValue(
    wx: number,
    wz: number,
    surfaceHeight: number
  ): { isPond: boolean; bedHeight: number; centerT: number; waterLevel: number } {
    const gridSize = WORLD_CONFIG.pond.gridSize;
    const cellX = Math.floor(wx / gridSize);
    const cellZ = Math.floor(wz / gridSize);

    let maxCenterT = 0;
    let pondWaterLevel: number = WORLD_CONFIG.waterLevel;
    let pondBedHeight: number = WORLD_CONFIG.waterLevel;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = cellX + dx;
        const nz = cellZ + dz;

        const pondRand = this.noise.pseudoRandom2d(nx * 13, nz * 17);
        if (pondRand >= WORLD_CONFIG.pond.probability) {
          continue;
        }

        const randX = this.noise.pseudoRandom2d(nx, nz);
        const randZ = this.noise.pseudoRandom2d(nx + 100, nz + 100);
        const cellCenterX = nx * gridSize + 8 + Math.floor(randX * 16);
        const cellCenterZ = nz * gridSize + 8 + Math.floor(randZ * 16);

        const flatness = this.getFlatnessFactor(cellCenterX, cellCenterZ);
        if (flatness <= 0) {
          continue;
        }

        const pondRadius = WORLD_CONFIG.pond.minRadius + randX * (WORLD_CONFIG.pond.maxRadius - WORLD_CONFIG.pond.minRadius);

        // 避免水潭生成在河道或河谷附近
        const { dRiver } = this.getRiverValue(cellCenterX, cellCenterZ);
        const valleyStart = WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth;
        const valleyEnd = valleyStart + WORLD_CONFIG.river.valleyInfluenceWidth;
        const safetyBuffer = valleyEnd + (pondRadius + 4) * WORLD_CONFIG.river.scale;
        if (dRiver < safetyBuffer) {
          continue;
        }

        const dist = Math.sqrt((wx - cellCenterX) ** 2 + (wz - cellCenterZ) ** 2);
        const shapeNoise = this.noise.noise(wx * 0.15, wz * 0.15) * 1.5;
        const effectiveRadius = pondRadius + shapeNoise;

        if (dist < effectiveRadius) {
          const t = dist / effectiveRadius;
          const centerT = (1.0 - t) * flatness;

          if (centerT > maxCenterT) {
            const centerBiome = getBiomeAt(cellCenterX, cellCenterZ, this.noise);
            const centerSurfaceHeight = centerBiome.getHeight(cellCenterX, cellCenterZ, this.noise);

            // 采样边缘 8 个方向的高度，防止水位溢出边缘最低点
            let minEdgeHeight = Infinity;
            const r = Math.round(pondRadius + 2); // 采样半径稍微大于水潭最大半径
            const rHalf = Math.round(r * 0.707);
            const checkPoints = [
              [cellCenterX + r, cellCenterZ],
              [cellCenterX - r, cellCenterZ],
              [cellCenterX, cellCenterZ + r],
              [cellCenterX, cellCenterZ - r],
              [cellCenterX + rHalf, cellCenterZ + rHalf],
              [cellCenterX - rHalf, cellCenterZ - rHalf],
              [cellCenterX + rHalf, cellCenterZ - rHalf],
              [cellCenterX - rHalf, cellCenterZ + rHalf]
            ];
            for (const [px, pz] of checkPoints) {
              const b = getBiomeAt(px, pz, this.noise);
              const h = b.getHeight(px, pz, this.noise);
              if (h < minEdgeHeight) {
                minEdgeHeight = h;
              }
            }

            // 如果边缘的最低陆地高度 - 1 比海平面还要低，说明四周有缺口低于海平面，水潭无法蓄水，跳过此水潭
            if (minEdgeHeight - 1 >= WORLD_CONFIG.waterLevel) {
              maxCenterT = centerT;
              pondWaterLevel = Math.min(Math.round(centerSurfaceHeight - 1), Math.round(minEdgeHeight - 1));
              
              const depthNoise = this.noise.noise(wx * 0.1, wz * 0.1);
              pondBedHeight = pondWaterLevel - 3 + depthNoise * 1.0;
            }
          }
        }
      }
    }

    if (maxCenterT > 0) {
      return {
        isPond: maxCenterT > 0.15,
        bedHeight: pondBedHeight,
        centerT: maxCenterT,
        waterLevel: pondWaterLevel
      };
    }

    return { isPond: false, bedHeight: surfaceHeight + 10, centerT: 0, waterLevel: WORLD_CONFIG.waterLevel };
  }

  public getWaterLevelAt(wx: number, wz: number): number {
    const oceanNoise = this.noise.noise(wx * WORLD_CONFIG.ocean.scale, wz * WORLD_CONFIG.ocean.scale);
    if (oceanNoise < WORLD_CONFIG.ocean.threshold) {
      return WORLD_CONFIG.waterLevel;
    }
    const { t } = this.getRiverValue(wx, wz);
    if (t > 0.35) {
      return WORLD_CONFIG.waterLevel;
    }
    const { isPond, waterLevel } = this.getPondValue(wx, wz, 0);
    if (isPond) {
      return waterLevel;
    }
    return 0;
  }

  public isWaterArea(wx: number, wz: number): boolean {
    const oceanNoise = this.noise.noise(wx * WORLD_CONFIG.ocean.scale, wz * WORLD_CONFIG.ocean.scale);
    if (oceanNoise < WORLD_CONFIG.ocean.threshold) {
      return true;
    }
    const { t } = this.getRiverValue(wx, wz);
    if (t > 0.35) {
      return true;
    }
    if (this.isPondArea(wx, wz)) {
      return true;
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


  public getGroundBlockType(
    primaryBiome: Biome,
    finalHeight: number,
    waterLevel: number,
    isDryLand: boolean,
    _wx: number,
    _wz: number
  ): number {
    if (primaryBiome.id === 'desert') {
      return BLOCK_TYPES.SAND;
    }
    if (primaryBiome.id === 'stony_peaks') {
      return BLOCK_TYPES.STONE;
    }
    if (finalHeight < waterLevel + 2 && !isDryLand) {
      return BLOCK_TYPES.SAND;
    }
    return BLOCK_TYPES.GRASS;
  }

  // Procedural chunk generation for a 3D sub-chunk
  public generateChunkData(cx: number, cy: number, cz: number): Uint8Array {
    const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartY = cy * CHUNK_SIZE_Y;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    const pipeline = new ChunkPipeline();
    pipeline.addStage(new TerrainHeightMapStage());
    pipeline.addStage(new BaseTerrainFillerStage());
    pipeline.addStage(new CaveCarverStage());
    pipeline.addStage(new SurfaceDecorationStage());
    pipeline.addStage(new TreeDecorationStage());

    const context: ChunkPipelineContext = {
      cx,
      cy,
      cz,
      worldStartX,
      worldStartY,
      worldStartZ,
      chunk,
      noise: this.noise,
      terrainMap: [],
      biomeMap: [],
      generator: this
    };

    pipeline.execute(context);
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
    const chunkHeight = Math.floor(chunk.length / (CHUNK_SIZE_X * CHUNK_SIZE_Z));

    // Change grass below trunk to dirt
    const baseIdx = tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z;
    if (baseIdx >= 0 && baseIdx < chunk.length) {
      chunk[baseIdx] = BLOCK_TYPES.DIRT;
    }

    // Grow trunk
    for (let h = 1; h <= height; h++) {
      const wly = ty + h;
      if (wly < chunkHeight) {
        const trunkIdx = tx + tz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
        if (trunkIdx >= 0 && trunkIdx < chunk.length) {
          chunk[trunkIdx] = trunkBlock;
        }
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
              const leafRand = this.noise.pseudoRandom2d(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.20) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < chunkHeight) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (leafIdx >= 0 && leafIdx < chunk.length && chunk[leafIdx] === BLOCK_TYPES.AIR) {
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
              const leafRand = this.noise.pseudoRandom2d(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.20) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < chunkHeight) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (leafIdx >= 0 && leafIdx < chunk.length && chunk[leafIdx] === BLOCK_TYPES.AIR) {
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
              const leafRand = this.noise.pseudoRandom2d(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.10) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < chunkHeight) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (leafIdx >= 0 && leafIdx < chunk.length && chunk[leafIdx] === BLOCK_TYPES.AIR) {
                chunk[leafIdx] = leafBlock;
              }
            }
          }
        }
      }
    }
  }
}

