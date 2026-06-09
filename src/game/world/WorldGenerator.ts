import { ImprovedNoise } from './Noise';
import { BLOCK_TYPES } from './BlockConfig';
import { getBiomeAt } from './biome/BiomeRegistry';
import { type Biome, TreeStyle } from './biome/Biome';
import { getLandformAt } from './landform/LandformRegistry';
import { type Landform } from './landform/Landform';
import { TerrainShaper } from './landform/TerrainShaper';
import { WaterConnectionSolver } from './WaterConnectionSolver';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './World';
import { WORLD_CONFIG } from './WorldConfig';
import { ChunkPipeline } from './pipeline/ChunkPipeline';
import type { ChunkPipelineContext, WorldTerrainProvider, ColumnTerrainData } from './pipeline/ChunkPipelineTypes';
import { TerrainHeightMapStage } from './pipeline/stages/TerrainHeightMapStage';
import { BaseTerrainFillerStage } from './pipeline/stages/BaseTerrainFillerStage';
import { OreGeneratorStage } from './pipeline/stages/OreGeneratorStage';
import { CaveCarverStage } from './pipeline/stages/CaveCarverStage';
import { SurfaceDecorationStage } from './pipeline/stages/SurfaceDecorationStage';
import { TreeDecorationStage } from './pipeline/stages/TreeDecorationStage';

export class WorldGenerator implements WorldTerrainProvider {
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

  public getRiverValue(wx: number, wz: number, rawHeight?: number): { t: number; bedHeight: number; dRiver: number; riverWeight: number } {
    // 计算大陆度 c，用于控制河流在海洋及海岸线的淡出
    const scale = WORLD_CONFIG.landform.scale;
    const c = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;

    let baseRiverWeight = 1.0;
    const oceanThreshold = WORLD_CONFIG.ocean.threshold;
    const oceanFadeWidth = WORLD_CONFIG.river.oceanFadeWidth;

    if (c < oceanThreshold - oceanFadeWidth) {
      baseRiverWeight = 0.0;
    } else if (c < oceanThreshold) {
      // 在海洋内部的淡出带，权重从 0.0 平滑过渡到 1.0
      const u = (c - (oceanThreshold - oceanFadeWidth)) / oceanFadeWidth;
      baseRiverWeight = u * u * (3 - 2 * u); // smoothstep
    }

    let riverWeight = baseRiverWeight;
    // 如果处于海洋淡出区，但该位置原始海拔高于海平面（例如有石头山阻挡），则不允许河流过早淡出，以避免产生堤坝
    if (c < oceanThreshold) {
      const h = rawHeight !== undefined ? rawHeight : this.getRawHeightAt(wx, wz);
      const waterLevel = WORLD_CONFIG.waterLevel;
      const bedHeight = WORLD_CONFIG.river.bedHeight;
      const depthThreshold = waterLevel - bedHeight; // 8

      let heightFactor = 1.0;
      if (h <= bedHeight) {
        heightFactor = 0.0;
      } else if (h < waterLevel) {
        const u = (h - bedHeight) / depthThreshold;
        heightFactor = u * u * (3 - 2 * u); // smoothstep
      }

      // 综合考虑 continentalness 和海拔高度，确保高地处刻蚀力度不受大陆度淡出的限制
      riverWeight = Math.max(baseRiverWeight, heightFactor);
    }

    if (riverWeight === 0.0) {
      // 如果完全在海洋里且没有陆地高山，河流完全不存在，跳过计算以提升性能
      return { t: 0, bedHeight: WORLD_CONFIG.river.bedHeight, dRiver: 10.0, riverWeight: 0.0 };
    }

    // 增加双频坐标扭曲 (Multi-octave Domain Warping)，使大尺度走向蜿蜒、小尺度边缘自然折皱
    const warpX = this.noise.noise(wx * 0.01, wz * 0.01) * 15 + this.noise.noise(wx * 0.04, wz * 0.04) * 4;
    const warpZ = this.noise.noise(wx * 0.01 + 50, wz * 0.01 + 50) * 15 + this.noise.noise(wx * 0.04 + 50, wz * 0.04 + 50) * 4;
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

    // 缩放 t
    t = t * riverWeight;

    // 动态深度控制（河床高度起伏更深，有时会形成浅滩或深水区）
    const depthNoise = this.noise.noise(wx * 0.015, wz * 0.015);
    const bedHeight = WORLD_CONFIG.river.bedHeight + depthNoise * 6;

    return { t, bedHeight, dRiver, riverWeight };
  }

  private getFlatnessFactor(wx: number, wz: number): number {
    const step = 4;
    const hCenter = this.getRawHeightAt(wx, wz);
    const hRight = this.getRawHeightAt(wx + step, wz);
    const hDown = this.getRawHeightAt(wx, wz + step);

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
            const centerSurfaceHeight = this.getRawHeightAt(cellCenterX, cellCenterZ);

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
              const h = this.getRawHeightAt(px, pz);
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
    const scale = WORLD_CONFIG.landform.scale;
    const c = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    if (c < WORLD_CONFIG.ocean.threshold) {
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
    const scale = WORLD_CONFIG.landform.scale;
    const c = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    if (c < WORLD_CONFIG.ocean.threshold) {
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

  public getPrimaryBiome(wx: number, wz: number): Biome {
    return getBiomeAt(wx, wz, this.noise);
  }

  public getPrimaryLandform(wx: number, wz: number): Landform {
    return getLandformAt(wx, wz, this.noise);
  }

  // 计算单个点的无插值基础高度
  public getRawHeightAt(wx: number, wz: number): number {
    const scale = WORLD_CONFIG.landform.scale;
    const c = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    const e = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetE) * scale, (wz + WORLD_CONFIG.landform.offsetE) * scale) + 1) / 2;
    return TerrainShaper.getHeight(wx, wz, this.noise, c, e);
  }

  public getColumnTerrainData(wx: number, wz: number): ColumnTerrainData {
    const primaryLandform = getLandformAt(wx, wz, this.noise);
    
    // 计算坡度
    const hNorth = this.getRawHeightAt(wx, wz - 2);
    const hSouth = this.getRawHeightAt(wx, wz + 2);
    const hWest = this.getRawHeightAt(wx - 2, wz);
    const hEast = this.getRawHeightAt(wx + 2, wz);
    const slope = Math.max(Math.abs(hNorth - hSouth), Math.abs(hWest - hEast));

    const scale = WORLD_CONFIG.landform.scale;
    const c = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    const waterLevel = WORLD_CONFIG.waterLevel;
    
    // 基础高度现在是连续的，不再需要区分海洋和海岸线插值
    let adjustedHeight = this.getRawHeightAt(wx, wz);
    let isDryLand = true;

    if (c < WORLD_CONFIG.ocean.threshold) {
      isDryLand = false;
    }

    const { bedHeight: riverBedHeight, dRiver, riverWeight } = this.getRiverValue(wx, wz, adjustedHeight);
    const valleyStart = WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth;
    const valleyEnd = valleyStart + WORLD_CONFIG.river.valleyInfluenceWidth;

    if (dRiver < valleyEnd) {
      // 1. 根据当前地貌 (primaryLandform) 动态决定地貌河岸偏移量，支持峡谷或平缓过渡
      let targetBankOffset: number = WORLD_CONFIG.river.bankOffsets.default;
      const landformId = primaryLandform.id;
      if (landformId in WORLD_CONFIG.river.bankOffsets) {
        targetBankOffset = WORLD_CONFIG.river.bankOffsets[landformId as keyof typeof WORLD_CONFIG.river.bankOffsets];
      }

      // 添加有机河岸噪声，避免整条河岸高度水平一致
      const bankNoise = this.noise.noise(wx * 0.03, wz * 0.03) * 1.0;
      const bankHeight = Math.max(waterLevel + 1.0, waterLevel + targetBankOffset + bankNoise);

      // 2. 计算水面边缘对应的 dRiver 阈值（即 riverT = 0.35 的那一刻）
      const waterEdgeDRiver = valleyStart - 0.35 * WORLD_CONFIG.river.transitionWidth;

      // 保存河流插值前的原始高度
      const heightBeforeRiver = adjustedHeight;
      let riverAdjustedHeight: number;

      // 3. 分段样条插值（一阶导数连续，完美平滑对接）
      if (dRiver > valleyStart) {
        // A 段：河谷边缘到河岸顶部 (dRiver 介于 valleyEnd 和 valleyStart 之间)
        const u = (valleyEnd - dRiver) / (valleyEnd - valleyStart);
        const w = u * u * (3 - 2 * u); // smoothstep
        riverAdjustedHeight = Math.round(adjustedHeight * (1 - w) + bankHeight * w);
      } else if (dRiver > waterEdgeDRiver) {
        // B 段：河岸顶部到水面交界线 (dRiver 介于 valleyStart 和 waterEdgeDRiver 之间)
        const u = (valleyStart - dRiver) / (valleyStart - waterEdgeDRiver);
        const w = u * u * (3 - 2 * u);
        riverAdjustedHeight = Math.round(bankHeight * (1 - w) + waterLevel * w);
      } else {
        // C 段：水面交界线到河道底中心 (dRiver 介于 waterEdgeDRiver 到 0 之间)
        const u = (waterEdgeDRiver - dRiver) / waterEdgeDRiver;
        const w = u * u * (3 - 2 * u);
        riverAdjustedHeight = Math.round(waterLevel * (1 - w) + riverBedHeight * w);
      }

      // 根据 riverWeight 插值最终的高度
      adjustedHeight = Math.round(heightBeforeRiver * (1 - riverWeight) + riverAdjustedHeight * riverWeight);

      // 更新陆地标记：处于水面边缘内侧且河流足够显著，即为水域
      if (dRiver < waterEdgeDRiver && riverWeight > 0.35) {
        isDryLand = false;
      }
    }

    let isPond = false;
    let pondWaterLevel: number = waterLevel;
    const surfaceHeightForPond = adjustedHeight;
    if (isDryLand) {
      const { isPond: pondActive, bedHeight: pondBedHeight, centerT: pondCenterT, waterLevel: pLevel } = this.getPondValue(wx, wz, surfaceHeightForPond);
      if (pondCenterT > 0) {
        if (adjustedHeight > pondBedHeight) {
          adjustedHeight = Math.round(adjustedHeight * (1 - pondCenterT) + pondBedHeight * pondCenterT);
        }
        if (pondActive) {
          isPond = true;
          isDryLand = false;
          pondWaterLevel = pLevel;
        }
      }
    }
    
    let localWaterLevel: number = waterLevel;
    if (isPond) {
      localWaterLevel = pondWaterLevel;
    }

    // 如果是低于水面的陆地，进行漫流连通性检测，判断是否应被水淹没
    if (isDryLand && adjustedHeight < waterLevel) {
      const isFlooded = WaterConnectionSolver.isConnectedToNaturalWater(
        wx,
        wz,
        {
          noise: this.noise,
          waterLevel,
          oceanThreshold: WORLD_CONFIG.ocean.threshold,
          maxDepth: 16
        },
        (x, z) => this.getRawHeightAt(x, z),
        (x, z) => this.getRiverValue(x, z).riverWeight
      );

      if (isFlooded) {
        isDryLand = false;
      }
    }

    const finalHeight = Math.max(3, Math.min(512 - 2, adjustedHeight)); // WORLD_HEIGHT is 512

    let maxHeightOffset: number = WORLD_CONFIG.caves.maxHeightOffsetDefault;
    const entranceNoise = this.noise.noise(wx * 0.02, wz * 0.02);
    if (entranceNoise > 0.35 && finalHeight > WORLD_CONFIG.waterLevel + 5) {
      maxHeightOffset = WORLD_CONFIG.caves.maxHeightOffsetEntrance;
    }

    return {
      interpolatedHeight: adjustedHeight,
      adjustedHeight,
      finalHeight,
      localWaterLevel,
      isDryLand,
      isPond,
      maxHeightOffset,
      slope
    };
  }

  public getGroundBlockType(
    primaryBiome: Biome,
    finalHeight: number,
    waterLevel: number,
    _isDryLand: boolean,
    wx: number,
    wz: number,
    slope: number
  ): number {
    if (slope > 3.0) {
      return BLOCK_TYPES.STONE; // 陡坡上直接裸露石头，不生成草/花
    }
    if (primaryBiome.id === 'desert') {
      return BLOCK_TYPES.SAND;
    }
    if (primaryBiome.id === 'stony_peaks') {
      return BLOCK_TYPES.STONE;
    }
    
    // 计算是否属于海洋及海岸沙滩带 (c < 0.28)
    const scale = WORLD_CONFIG.landform.scale;
    const c = (this.noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    const isOceanOrBeach = c < WORLD_CONFIG.ocean.threshold + WORLD_CONFIG.ocean.shoreWidth;

    if (isOceanOrBeach && finalHeight <= waterLevel + 2) {
      return BLOCK_TYPES.SAND; // 从水底到水上 2 格均为沙滩材质，形成连贯过渡
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
    pipeline.addStage(new OreGeneratorStage());
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

