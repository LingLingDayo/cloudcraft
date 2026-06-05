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

  private getRiverValue(wx: number, wz: number): { t: number; bedHeight: number; dRiver: number } {
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

  private getPondValue(
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

        const dist = Math.sqrt((wx - cellCenterX) ** 2 + (wz - cellCenterZ) ** 2);
        const pondRadius = WORLD_CONFIG.pond.minRadius + randX * (WORLD_CONFIG.pond.maxRadius - WORLD_CONFIG.pond.minRadius);
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

  private getWaterLevelAt(wx: number, wz: number): number {
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

  private isWaterArea(wx: number, wz: number): boolean {
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

        // ==================== 新增河流与水潭生成逻辑 ====================
        const { t: riverT, bedHeight: riverBedHeight, dRiver } = this.getRiverValue(wx, wz);
        
        // 河谷压平逻辑：在靠近河流时，逐渐将高于目标高度的陆地压平至 valleyTargetHeight 左右
        const valleyStart = WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth;
        const valleyEnd = valleyStart + WORLD_CONFIG.river.valleyInfluenceWidth;
        
        if (dRiver < valleyEnd && adjustedHeight > WORLD_CONFIG.river.valleyTargetHeight) {
          const tVal = 1.0 - (dRiver - valleyStart) / WORLD_CONFIG.river.valleyInfluenceWidth;
          const clampedT = Math.max(0, Math.min(1, tVal));
          const flattenWeight = clampedT * clampedT * (3 - 2 * clampedT); // 三次 smoothstep 平滑
          
          const valleyTarget = WORLD_CONFIG.river.valleyTargetHeight;
          adjustedHeight = Math.round(adjustedHeight * (1 - flattenWeight) + valleyTarget * flattenWeight);
        }
        
        if (riverT > 0) {
          // 使用三次 smoothstep 对 riverT 进行平滑，使河岸及河床的横断面呈平滑 S 型曲线
          const smoothedRiverT = riverT * riverT * (3 - 2 * riverT);
          if (adjustedHeight > riverBedHeight) {
            adjustedHeight = Math.round(adjustedHeight * (1 - smoothedRiverT) + riverBedHeight * smoothedRiverT);
          }

          if (riverT > 0.35) {
            isDryLand = false;
          } else if (isDryLand) {
            // 只有当该位置本身是陆地（非海洋）时，才需要对河流岸边进行拉高，防止悬空水墙
            const u = riverT / 0.35; // 从 0 (远离河流) 到 1 (河流分界线)
            const minShoreHeight = waterLevel; // 至少与水面齐平
            if (adjustedHeight < minShoreHeight) {
              adjustedHeight = Math.round(u * minShoreHeight + (1 - u) * adjustedHeight);
            }
          }
        }

        // ==================== 新增陆地小水潭生成逻辑 ====================
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
              isDryLand = false; // 水体中心不能是干燥陆地，防止堤岸保护逻辑将自身误填平
              pondWaterLevel = pLevel;
            }
          }
        }
        
        let localWaterLevel: number = waterLevel;
        if (isPond) {
          localWaterLevel = pondWaterLevel;
        }
        // ==========================================================

        // 陆地区域邻域水面保护：检测其水平相邻块的水域水位，如果相邻有水域且当前陆地高度低于该水域水位，
        // 则将当前陆地拉高至该水位作为堤岸，防止水体水平外露
        if (isDryLand) {
          const neighbors = [
            [wx + 1, wz],
            [wx - 1, wz],
            [wx, wz + 1],
            [wx, wz - 1]
          ];
          let maxAdjacentWaterLevel = 0;
          for (const [nx, nz] of neighbors) {
            const wLevel = this.getWaterLevelAt(nx, nz);
            if (wLevel > maxAdjacentWaterLevel) {
              maxAdjacentWaterLevel = wLevel;
            }
          }
          if (maxAdjacentWaterLevel > 0 && adjustedHeight < maxAdjacentWaterLevel) {
            adjustedHeight = maxAdjacentWaterLevel;
          }
        }

        const finalHeight = Math.max(3, Math.min(CHUNK_SIZE_Y - 2, adjustedHeight));

        // 计算当前列的矿洞最大高度限制（是否允许露天入口）
        let maxHeightOffset: number = WORLD_CONFIG.caves.maxHeightOffsetDefault;
        const entranceNoise = this.noise.noise(wx * 0.02, wz * 0.02);
        if (entranceNoise > 0.35 && finalHeight > WORLD_CONFIG.waterLevel + 5) {
          maxHeightOffset = WORLD_CONFIG.caves.maxHeightOffsetEntrance;
        }

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          
          if (y === 0) {
            // Bedrock layer
            chunk[index] = BLOCK_TYPES.STONE;
          } else if (y <= finalHeight) {
            const depth = finalHeight - y + 1;
            primaryBiome.fillColumn(chunk, x, z, y, finalHeight, localWaterLevel, depth, this.noise, wx, wz, isDryLand && !isPond);

            // 矿洞刻蚀 (Cave carving)
            // 矿洞仅在 minHeight 以上、地表下限制格以下生成
            if (y >= WORLD_CONFIG.caves.minHeight && y <= finalHeight - maxHeightOffset) {
              const warpScale = WORLD_CONFIG.caves.warpScale;
              const warpStrength = WORLD_CONFIG.caves.warpStrength;
              const wxWarped = wx + this.noise.noise3d(wx * warpScale, y * warpScale, wz * warpScale) * warpStrength;
              const yWarped = y + this.noise.noise3d(wx * warpScale + 100, y * warpScale + 100, wz * warpScale + 100) * warpStrength;
              const wzWarped = wz + this.noise.noise3d(wx * warpScale + 200, y * warpScale + 200, wz * warpScale + 200) * warpStrength;

              const baseThreshold = WORLD_CONFIG.caves.baseThreshold;
              // 使用极低频 3D 噪波控制局部的粗细变化，形成不规则的“洞室”
              const chamberNoise = this.noise.noise3d(wx * 0.01, y * 0.015, wz * 0.01);
              const currentThreshold = baseThreshold + chamberNoise * 0.08;

              const n1 = this.noise.noise3d(
                wxWarped * WORLD_CONFIG.caves.scaleXZ,
                yWarped * WORLD_CONFIG.caves.scaleY,
                wzWarped * WORLD_CONFIG.caves.scaleXZ
              );
              const n2 = this.noise.noise3d(
                wxWarped * WORLD_CONFIG.caves.scaleXZ + 100,
                yWarped * WORLD_CONFIG.caves.scaleY + 100,
                wzWarped * WORLD_CONFIG.caves.scaleXZ + 100
              );

              // 圆周判定：n1*n1 + n2*n2 < currentThreshold*currentThreshold
              if (n1 * n1 + n2 * n2 < currentThreshold * currentThreshold) {
                // 检查是否靠近 any water域（当 y <= localWaterLevel 时），防止矿洞从侧面穿透水体
                let adjacentToWater = false;
                if (y <= localWaterLevel) {
                  const neighbors = [
                    [wx + 1, wz],
                    [wx - 1, wz],
                    [wx, wz + 1],
                    [wx, wz - 1]
                  ];
                  for (const [nx, nz] of neighbors) {
                    if (this.isWaterArea(nx, nz)) {
                      adjacentToWater = true;
                      break;
                    }
                  }
                }

                if (!adjacentToWater) {
                  // 雕刻为空气 (Caves are filled with air)
                  chunk[index] = BLOCK_TYPES.AIR;
                }
              }
            }
          } else if (y <= localWaterLevel && (!isDryLand || isPond)) {
            // 只在海洋/湖泊区域（或陆地小水潭）填充水，陆地区域低于海平面也保持空气
            chunk[index] = BLOCK_TYPES.WATER;
          } else {
            // 陆地表面及上方的植被生成
            if (y === finalHeight + 1 && localWaterLevel <= finalHeight) {
              const groundType = chunk[x + z * CHUNK_SIZE_X + finalHeight * CHUNK_SIZE_X * CHUNK_SIZE_Z];
              const groundProps = getBlockProperties(groundType);
              if (groundProps.allowVegetationBase) {
                chunk[index] = primaryBiome.getVegetationType(wx, wz, this.noise);
              } else {
                chunk[index] = BLOCK_TYPES.AIR;
              }
            } else if (y === finalHeight + 2) {
              const belowType = chunk[x + z * CHUNK_SIZE_X + (finalHeight + 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z];
              if (belowType === BLOCK_TYPES.SUNFLOWER_BOTTOM) {
                chunk[index] = BLOCK_TYPES.SUNFLOWER_TOP;
              } else if (belowType === BLOCK_TYPES.ROSE_BUSH_BOTTOM) {
                chunk[index] = BLOCK_TYPES.ROSE_BUSH_TOP;
              } else if (belowType === BLOCK_TYPES.PEONY_BOTTOM) {
                chunk[index] = BLOCK_TYPES.PEONY_TOP;
              } else if (belowType === BLOCK_TYPES.LILAC_BOTTOM) {
                chunk[index] = BLOCK_TYPES.LILAC_TOP;
              } else if (belowType === BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM) {
                chunk[index] = BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP;
              } else {
                chunk[index] = BLOCK_TYPES.AIR;
              }
            } else {
              chunk[index] = BLOCK_TYPES.AIR;
            }
          }
        }
      }
    }

    // Procedural decoration: grow trees/decorations in this chunk
    // Seeded random based on chunk coordinates and world seed
    const chunkRandom = this.noise.pseudoRandom2d(cx, cz);
    const numTrees = Math.floor(chunkRandom * 12) % 3 + 1; // 1 to 3 decoration attempts
    for (let t = 0; t < numTrees; t++) {
      const tx = 2 + Math.floor(this.noise.pseudoRandom2d(cx * 10 + t, cz * 10 + t) * (CHUNK_SIZE_X - 4));
      const tz = 2 + Math.floor(this.noise.pseudoRandom2d(cx * 20 + t, cz * 20 + t) * (CHUNK_SIZE_Z - 4));
      
      const wx = worldStartX + tx;
      const wz = worldStartZ + tz;
      const biome = getBiomeAt(wx, wz, this.noise);

      // 以该生态的特定概率决定是否生成装饰物
      const prob = biome.getTreeProbability(chunkRandom);
      const spawnRand = this.noise.pseudoRandom2d(wx * 7 + t, wz * 13 + t);
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
              const leafRand = this.noise.pseudoRandom2d(wlx * 17 + tx, wlz * 23 + tz + wly);
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
              const leafRand = this.noise.pseudoRandom2d(wlx * 17 + tx, wlz * 23 + tz + wly);
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
              const leafRand = this.noise.pseudoRandom2d(wlx * 17 + tx, wlz * 23 + tz + wly);
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
