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
      atlasOffsets: [] as number[]
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
        return chunk[lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z];
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
      return neighborChunk[nlx + nlz * CHUNK_SIZE_X + nly * CHUNK_SIZE_X * CHUNK_SIZE_Z];
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
            const blockTypeRaw = chunk[x[0] + x[2] * CHUNK_SIZE_X + x[1] * CHUNK_SIZE_X * CHUNK_SIZE_Z];
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
                  
                  const baseHash = renderType * 1000 + atlasIndex;
                  if (rotateUV) {
                    hash = baseHash + 100000 + x[0] * 10000 + x[1] * 100 + x[2];
                  } else {
                    hash = baseHash;
                  }
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
              let w = 1;
              while (i + w < dims[d1] && mask[n + w] === c) w++;
              
              let h = 1;
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

              const renderType = Math.floor((c % 100000) / 1000);
              const atlasIndex = c % 1000;
              const rotateUV = c >= 100000;

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
              
              targetData.positions.push(
                worldStartX + v0[0], worldStartY + v0[1], worldStartZ + v0[2],
                worldStartX + v1[0], worldStartY + v1[1], worldStartZ + v1[2],
                worldStartX + v2[0], worldStartY + v2[1], worldStartZ + v2[2],
                worldStartX + v0[0], worldStartY + v0[1], worldStartZ + v0[2],
                worldStartX + v2[0], worldStartY + v2[1], worldStartZ + v2[2],
                worldStartX + v3[0], worldStartY + v3[1], worldStartZ + v3[2]
              );

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
                      
              targetData.uvs.push(
                ...finalUVs[0], ...finalUVs[1], ...finalUVs[2],
                ...finalUVs[0], ...finalUVs[2], ...finalUVs[3]
              );

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
          const rBase = chunk[index];
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
              isTransparent: ChunkMeshBuilder.isTransparent
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
    }): ChunkGeometryData | null => {
      if (data.positions.length === 0) return null;
      return {
        positions: new Float32Array(data.positions),
        normals: new Float32Array(data.normals),
        uvs: new Float32Array(data.uvs),
        atlasOffsets: new Float32Array(data.atlasOffsets)
      };
    };

    return {
      solid: packageGeometry(solidData),
      transparent: packageGeometry(transData),
      cutout: packageGeometry(cutoutData)
    };
  }
}
