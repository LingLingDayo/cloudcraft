import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { CubeBlockModel } from './block/BlockModel';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 16;
export const CHUNK_SIZE_Z = 16;
export const WORLD_HEIGHT = 512;

export interface ChunkNeighbors {
  px?: Uint8Array; // +X (cx + 1)
  nx?: Uint8Array; // -X (cx - 1)
  py?: Uint8Array; // +Y (cy + 1)
  ny?: Uint8Array; // -Y (cy - 1)
  pz?: Uint8Array; // +Z (cz + 1)
  nz?: Uint8Array; // -Z (cz - 1)
}

export interface ChunkGeometryData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  atlasOffsets: Float32Array;
  valLights: Float32Array;
  aos: Float32Array;
}

export interface ChunkMeshResult {
  solid: ChunkGeometryData | null;
  transparent: ChunkGeometryData | null;
  cutout: ChunkGeometryData | null;
}

export class ChunkMeshBuilder {
  private static isTransparent(blockType: number): boolean {
    return getBlockProperties(blockType).isTransparent;
  }

  public static buildMesh(
    cx: number,
    cy: number,
    cz: number,
    chunk: Uint8Array,
    neighbors: ChunkNeighbors
  ): ChunkMeshResult {
    const createData = () => ({
      positions: [] as number[],
      normals: [] as number[],
      uvs: [] as number[],
      atlasOffsets: [] as number[],
      valLights: [] as number[],
      aos: [] as number[]
    });

    const solidData = createData();
    const transData = createData();
    const cutoutData = createData();

    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartY = cy * CHUNK_SIZE_Y;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    // Fast neighbor block retriever using cached direct references (eliminates Map hash lookups)
    const getNeighbor = (lx: number, ly: number, lz: number): number => {
      const globalY = worldStartY + ly;
      if (globalY < 0 || globalY >= WORLD_HEIGHT) return BLOCK_TYPES.AIR;

      if (
        lx >= 0 && lx < CHUNK_SIZE_X &&
        ly >= 0 && ly < CHUNK_SIZE_Y &&
        lz >= 0 && lz < CHUNK_SIZE_Z
      ) {
        return chunk[(lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z) * 2];
      }

      let neighborChunk: Uint8Array | undefined;
      let nlx = lx, nly = ly, nlz = lz;

      if (lx < 0) {
        neighborChunk = neighbors.nx;
        nlx = CHUNK_SIZE_X - 1;
      } else if (lx >= CHUNK_SIZE_X) {
        neighborChunk = neighbors.px;
        nlx = 0;
      } else if (ly < 0) {
        neighborChunk = neighbors.ny;
        nly = CHUNK_SIZE_Y - 1;
      } else if (ly >= CHUNK_SIZE_Y) {
        neighborChunk = neighbors.py;
        nly = 0;
      } else if (lz < 0) {
        neighborChunk = neighbors.nz;
        nlz = CHUNK_SIZE_Z - 1;
      } else if (lz >= CHUNK_SIZE_Z) {
        neighborChunk = neighbors.pz;
        nlz = 0;
      }

      if (!neighborChunk) return BLOCK_TYPES.AIR;
      return neighborChunk[(nlx + nlz * CHUNK_SIZE_X + nly * CHUNK_SIZE_X * CHUNK_SIZE_Z) * 2];
    };

    // Fast neighbor light retriever
    const getLightAt = (lx: number, ly: number, lz: number): number => {
      const globalY = worldStartY + ly;
      if (globalY < 0 || globalY >= WORLD_HEIGHT) return 15; // default to maximum light

      if (
        lx >= 0 && lx < CHUNK_SIZE_X &&
        ly >= 0 && ly < CHUNK_SIZE_Y &&
        lz >= 0 && lz < CHUNK_SIZE_Z
      ) {
        return chunk[(lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z) * 2 + 1];
      }

      let neighborChunk: Uint8Array | undefined;
      let nlx = lx, nly = ly, nlz = lz;

      if (lx < 0) {
        neighborChunk = neighbors.nx;
        nlx = CHUNK_SIZE_X - 1;
      } else if (lx >= CHUNK_SIZE_X) {
        neighborChunk = neighbors.px;
        nlx = 0;
      } else if (ly < 0) {
        neighborChunk = neighbors.ny;
        nly = CHUNK_SIZE_Y - 1;
      } else if (ly >= CHUNK_SIZE_Y) {
        neighborChunk = neighbors.py;
        nly = 0;
      } else if (lz < 0) {
        neighborChunk = neighbors.nz;
        nlz = CHUNK_SIZE_Z - 1;
      } else if (lz >= CHUNK_SIZE_Z) {
        neighborChunk = neighbors.pz;
        nlz = 0;
      }

      if (!neighborChunk) return 15;
      return neighborChunk[(nlx + nlz * CHUNK_SIZE_X + nly * CHUNK_SIZE_X * CHUNK_SIZE_Z) * 2 + 1];
    };

    const isOpaque = (lx: number, ly: number, lz: number): boolean => {
      const block = getNeighbor(lx, ly, lz);
      return block !== BLOCK_TYPES.AIR && !ChunkMeshBuilder.isTransparent(block);
    };

    const getVertexAO = (
      vx: number, vy: number, vz: number,
      axis: number, dir: number,
      d1: number, d2: number,
      step_d1: number, step_d2: number
    ): number => {
      const v = [vx, vy, vz];
      const targetAxisVal = v[axis] + (dir < 0 ? -1 : 0);
      
      const in_d1 = step_d1 < 0 ? 0 : -1;
      const in_d2 = step_d2 < 0 ? 0 : -1;
      
      const out_d1 = step_d1 < 0 ? -1 : 0;
      const out_d2 = step_d2 < 0 ? -1 : 0;
      
      const p1 = [...v];
      p1[axis] = targetAxisVal;
      p1[d1] += out_d1;
      p1[d2] += in_d2;
      const s1 = isOpaque(p1[0], p1[1], p1[2]) ? 1 : 0;
      
      const p2 = [...v];
      p2[axis] = targetAxisVal;
      p2[d1] += in_d1;
      p2[d2] += out_d2;
      const s2 = isOpaque(p2[0], p2[1], p2[2]) ? 1 : 0;
      
      const p3 = [...v];
      p3[axis] = targetAxisVal;
      p3[d1] += out_d1;
      p3[d2] += out_d2;
      const c = isOpaque(p3[0], p3[1], p3[2]) ? 1 : 0;
      
      if (s1 === 1 && s2 === 1) {
        return 0;
      }
      return 3 - (s1 + s2 + c);
    };

    const getVertexLight = (
      vx: number, vy: number, vz: number,
      axis: number, dir: number,
      d1: number, d2: number,
      step_d1: number, step_d2: number
    ): { sky: number; block: number } => {
      const v = [vx, vy, vz];
      const targetAxisVal = v[axis] + (dir < 0 ? -1 : 0);
      
      const in_d1 = step_d1 < 0 ? 0 : -1;
      const in_d2 = step_d2 < 0 ? 0 : -1;
      const out_d1 = step_d1 < 0 ? -1 : 0;
      const out_d2 = step_d2 < 0 ? -1 : 0;
      
      // Average light from the same 3 positions AO samples, to match light with occlusion
      let totalSky = 0, totalBlock = 0, count = 0;

      const sample = (lx: number, ly: number, lz: number) => {
        // Only sample from non-opaque blocks (same rule as light propagation)
        if (!isOpaque(lx, ly, lz)) {
          const lightVal = getLightAt(lx, ly, lz);
          totalSky += (lightVal >> 4) & 0x0F;
          totalBlock += lightVal & 0x0F;
          count++;
        }
      };

      const base = [0, 0, 0];
      base[axis] = targetAxisVal;

      // Sample the direct corner block (same as before)
      base[d1] = v[d1] + in_d1;
      base[d2] = v[d2] + in_d2;
      sample(base[0], base[1], base[2]);

      // Sample the block offset in d1 direction
      base[d1] = v[d1] + out_d1;
      base[d2] = v[d2] + in_d2;
      sample(base[0], base[1], base[2]);

      // Sample the block offset in d2 direction
      base[d1] = v[d1] + in_d1;
      base[d2] = v[d2] + out_d2;
      sample(base[0], base[1], base[2]);

      if (count === 0) {
        return { sky: 0, block: 0 };
      }
      return { sky: Math.round(totalSky / count), block: Math.round(totalBlock / count) };
    };

    const dims = [CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z];

    const GreedyFaces = [
      { axis: 0, dir: 1,  c: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]], d1: 1, d2: 2, uvFace: 'side' },
      { axis: 0, dir: -1, c: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]], d1: 1, d2: 2, uvFace: 'side' },
      { axis: 1, dir: 1,  c: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]], d1: 2, d2: 0, uvFace: 'top' },
      { axis: 1, dir: -1, c: [[0,0,1], [0,0,0], [1,0,0], [1,0,1]], d1: 2, d2: 0, uvFace: 'bottom' },
      { axis: 2, dir: 1,  c: [[1,0,1], [1,1,1], [0,1,1], [0,0,1]], d1: 1, d2: 0, uvFace: 'side' },
      { axis: 2, dir: -1, c: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]], d1: 1, d2: 0, uvFace: 'side' },
    ];

    for (const face of GreedyFaces) {
      const { axis, dir, d1, d2, uvFace } = face;
      const d0 = axis;

      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[axis] = dir;

      for (x[d0] = 0; x[d0] < dims[d0]; x[d0]++) {
        const mask = new Int32Array(dims[d1] * dims[d2]);
        let n = 0;

        for (x[d2] = 0; x[d2] < dims[d2]; x[d2]++) {
          for (x[d1] = 0; x[d1] < dims[d1]; x[d1]++) {
            const blockTypeRaw = chunk[(x[0] + x[2] * CHUNK_SIZE_X + x[1] * CHUNK_SIZE_X * CHUNK_SIZE_Z) * 2];
            const blockType = blockTypeRaw & 0x3F;
            const orientation = blockTypeRaw >> 6;
            let hash = 0;

            if (blockType !== BLOCK_TYPES.AIR) {
              const props = getBlockProperties(blockType);
              const model = props.model;
              if (model && model.useGreedyMesh) {
                const nx = x[0] + q[0];
                const ny = x[1] + q[1];
                const nz = x[2] + q[2];
                const neighbor = getNeighbor(nx, ny, nz);
                
                let drawFace = false;
                if (this.isTransparent(neighbor)) {
                  const renderAdjacentSameType = model instanceof CubeBlockModel ? (model as CubeBlockModel).renderAdjacentSameType : false;
                  if (blockType === neighbor && !renderAdjacentSameType) {
                    drawFace = false;
                  } else {
                    drawFace = true;
                  }
                }

                if (drawFace) {
                  let rotateUV = false;
                  let finalUvFace = uvFace;
                  const isLog = blockType === BLOCK_TYPES.WOOD || blockType === BLOCK_TYPES.BIRCH_WOOD || blockType === BLOCK_TYPES.SPRUCE_WOOD;
                  
                  if (isLog) {
                    if (orientation === 1) {
                      if (axis === 0) finalUvFace = 'top';
                      else { finalUvFace = 'side'; rotateUV = true; }
                    } else if (orientation === 2) {
                      if (axis === 2) finalUvFace = 'top';
                      else { finalUvFace = 'side'; if (axis === 0) rotateUV = true; }
                    }
                  }

                  const atlasIndex = props.textureFaces?.[finalUvFace as 'top'|'bottom'|'side'] ?? 3;
                  const isTrans = props.opacity < 1.0 || props.isTransparent;
                  const renderType = isTrans ? 2 : 1;
                  
                  // Calculate AO for the 4 corners of the face
                  const ao0 = getVertexAO(x[0] + face.c[0][0], x[1] + face.c[0][1], x[2] + face.c[0][2], axis, dir, d1, d2, -1, -1);
                  const ao1 = getVertexAO(x[0] + face.c[1][0], x[1] + face.c[1][1], x[2] + face.c[1][2], axis, dir, d1, d2, 1, -1);
                  const ao2 = getVertexAO(x[0] + face.c[2][0], x[1] + face.c[2][1], x[2] + face.c[2][2], axis, dir, d1, d2, 1, 1);
                  const ao3 = getVertexAO(x[0] + face.c[3][0], x[1] + face.c[3][1], x[2] + face.c[3][2], axis, dir, d1, d2, -1, 1);
                  const aoHash = ao0 | (ao1 << 2) | (ao2 << 4) | (ao3 << 6);

                  // Calculate the light level of the adjacent air space
                  const faceLight = getLightAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]);

                  // Pack into a 27-bit integer: [aoHash:8][faceLight:8][rotateUV:1][renderType:2][atlasIndex:8]
                  hash = (aoHash << 19) | (faceLight << 11) | ((rotateUV ? 1 : 0) << 10) | (renderType << 8) | atlasIndex;
                }
              }
            }
            mask[n++] = hash;
          }
        }

        n = 0;
        for (let j = 0; j < dims[d2]; j++) {
          for (let i = 0; i < dims[d1]; ) {
            const c = mask[n];
            if (c !== 0) {
              const rotateUV = ((c >> 10) & 0x01) === 1;

              let w = 1;
              if (!rotateUV) {
                while (i + w < dims[d1] && mask[n + w] === c) w++;
              }

              let h = 1;
              if (!rotateUV) {
                let done = false;
                while (j + h < dims[d2]) {
                  for (let k = 0; k < w; k++) {
                    if (mask[n + k + h * dims[d1]] !== c) {
                      done = true;
                      break;
                    }
                  }
                  if (done) break;
                  h++;
                }
              }

              const atlasIndex = c & 0xFF;
              const renderType = (c >> 8) & 0x03;

              const pos = [0, 0, 0];
              pos[d0] = x[d0];
              pos[d1] = i;
              pos[d2] = j;

              const c0 = face.c[0];
              const d1Vec = [ face.c[1][0] - c0[0], face.c[1][1] - c0[1], face.c[1][2] - c0[2] ];
              const d2Vec = [ face.c[3][0] - c0[0], face.c[3][1] - c0[1], face.c[3][2] - c0[2] ];

              const basePos = [...pos];
              if (d1Vec[d1] < 0) basePos[d1] += (w - 1);
              if (d2Vec[d2] < 0) basePos[d2] += (h - 1);

              const v0 = [ basePos[0] + c0[0], basePos[1] + c0[1], basePos[2] + c0[2] ];
              
              const v1 = [ v0[0] + d1Vec[0]*w, v0[1] + d1Vec[1]*w, v0[2] + d1Vec[2]*w ];
              const v2 = [ v0[0] + d1Vec[0]*w + d2Vec[0]*h, v0[1] + d1Vec[1]*w + d2Vec[1]*h, v0[2] + d1Vec[2]*w + d2Vec[2]*h ];
              const v3 = [ v0[0] + d2Vec[0]*h, v0[1] + d2Vec[1]*h, v0[2] + d2Vec[2]*h ];

              const targetData = renderType === 1 ? solidData : transData;

              const normalVec = [0, 0, 0];
              normalVec[axis] = face.dir;
              for(let m = 0; m < 6; m++) {
                targetData.normals.push(...normalVec);
              }

              const tx = atlasIndex % 8;
              const ty = 7 - Math.floor(atlasIndex / 8);
              const uMin = tx * 0.125;
              const vMin = ty * 0.125;
              
              for(let m = 0; m < 6; m++) {
                targetData.atlasOffsets.push(uMin, vMin);
              }

              const uv0 = [0, 0];
              const uv1 = [0, w];
              const uv2 = [h, w];
              const uv3 = [h, 0];
              
              const finalUVs = rotateUV ? [uv3, uv0, uv1, uv2] : [uv0, uv1, uv2, uv3];

              // Calculate final AO and Light values for the corners of the greedy mesh
              const ao0 = getVertexAO(v0[0], v0[1], v0[2], axis, dir, d1, d2, -1, -1);
              const ao1 = getVertexAO(v1[0], v1[1], v1[2], axis, dir, d1, d2, 1, -1);
              const ao2 = getVertexAO(v2[0], v2[1], v2[2], axis, dir, d1, d2, 1, 1);
              const ao3 = getVertexAO(v3[0], v3[1], v3[2], axis, dir, d1, d2, -1, 1);

              const light0 = getVertexLight(v0[0], v0[1], v0[2], axis, dir, d1, d2, -1, -1);
              const light1 = getVertexLight(v1[0], v1[1], v1[2], axis, dir, d1, d2, 1, -1);
              const light2 = getVertexLight(v2[0], v2[1], v2[2], axis, dir, d1, d2, 1, 1);
              const light3 = getVertexLight(v3[0], v3[1], v3[2], axis, dir, d1, d2, -1, 1);

              // To avoid ugly diagonal interpolation artifacts (AO flop), we dynamically choose the triangulation.
              // Flip the diagonal when the (v0,v2) pair has a higher total AO than (v1,v3), because that
              // means the shaded corners are on opposite ends of the same triangle edge, causing a harsh crease.
              if (ao0 + ao2 > ao1 + ao3) {
                // Triangulate using v0-v1-v3 and v1-v2-v3
                targetData.positions.push(
                  worldStartX + v0[0], worldStartY + v0[1], worldStartZ + v0[2],
                  worldStartX + v1[0], worldStartY + v1[1], worldStartZ + v1[2],
                  worldStartX + v3[0], worldStartY + v3[1], worldStartZ + v3[2],
                  worldStartX + v1[0], worldStartY + v1[1], worldStartZ + v1[2],
                  worldStartX + v2[0], worldStartY + v2[1], worldStartZ + v2[2],
                  worldStartX + v3[0], worldStartY + v3[1], worldStartZ + v3[2]
                );

                targetData.uvs.push(
                  ...finalUVs[0], ...finalUVs[1], ...finalUVs[3],
                  ...finalUVs[1], ...finalUVs[2], ...finalUVs[3]
                );

                targetData.valLights.push(
                  light0.sky, light0.block,
                  light1.sky, light1.block,
                  light3.sky, light3.block,
                  light1.sky, light1.block,
                  light2.sky, light2.block,
                  light3.sky, light3.block
                );

                targetData.aos.push(
                  ao0, ao1, ao3,
                  ao1, ao2, ao3
                );
              } else {
                // Triangulate using v0-v1-v2 and v0-v2-v3 (default)
                targetData.positions.push(
                  worldStartX + v0[0], worldStartY + v0[1], worldStartZ + v0[2],
                  worldStartX + v1[0], worldStartY + v1[1], worldStartZ + v1[2],
                  worldStartX + v2[0], worldStartY + v2[1], worldStartZ + v2[2],
                  worldStartX + v0[0], worldStartY + v0[1], worldStartZ + v0[2],
                  worldStartX + v2[0], worldStartY + v2[1], worldStartZ + v2[2],
                  worldStartX + v3[0], worldStartY + v3[1], worldStartZ + v3[2]
                );

                targetData.uvs.push(
                  ...finalUVs[0], ...finalUVs[1], ...finalUVs[2],
                  ...finalUVs[0], ...finalUVs[2], ...finalUVs[3]
                );

                targetData.valLights.push(
                  light0.sky, light0.block,
                  light1.sky, light1.block,
                  light2.sky, light2.block,
                  light0.sky, light0.block,
                  light2.sky, light2.block,
                  light3.sky, light3.block
                );

                targetData.aos.push(
                  ao0, ao1, ao2,
                  ao0, ao2, ao3
                );
              }

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[n + k + l * dims[d1]] = 0;
                }
              }

              i += w;
              n += w;
            } else {
              i++;
              n++;
            }
          }
        }
      }
    }


    // Custom Models Pass
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          const rBase = chunk[index * 2];
          const blockType = rBase & 0x3F;
          if (blockType === BLOCK_TYPES.AIR) continue;
          const props = getBlockProperties(blockType);
          const model = props.model;
          if (model && !model.useGreedyMesh && model.renderCustom) {
            const orientation = rBase >> 6;
            model.renderCustom({
              x, y, z,
              wx: worldStartX + x,
              wy: worldStartY + y,
              wz: worldStartZ + z,
              orientation,
              solid: solidData,
              trans: transData,
              cutout: cutoutData,
              getNeighbor,
              isTransparent: ChunkMeshBuilder.isTransparent,
              getLightAt
            }, props);
          }
        }
      }
    }



    const packageGeometry = (data: {
      positions: number[];
      normals: number[];
      uvs: number[];
      atlasOffsets: number[];
      valLights: number[];
      aos: number[];
    }): ChunkGeometryData | null => {
      if (data.positions.length === 0) return null;
      return {
        positions: new Float32Array(data.positions),
        normals: new Float32Array(data.normals),
        uvs: new Float32Array(data.uvs),
        atlasOffsets: new Float32Array(data.atlasOffsets),
        valLights: new Float32Array(data.valLights),
        aos: new Float32Array(data.aos)
      };
    };

    return {
      solid: packageGeometry(solidData),
      transparent: packageGeometry(transData),
      cutout: packageGeometry(cutoutData)
    };
  }
}
