import * as THREE from 'three';
import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { generateTextureAtlas } from './TextureAtlas';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, WORLD_HEIGHT } from './World';
import type { World } from './World';

export class ChunkRenderer {
  private world: World;
  private textureAtlas: THREE.Texture;
  public materials: { solid: THREE.Material; transparent: THREE.Material; cutout: THREE.Material };
  private chunkMeshes: Map<string, { solid: THREE.Mesh; transparent: THREE.Mesh; cutout: THREE.Mesh }>;

  constructor(world: World) {
    this.world = world;
    this.chunkMeshes = new Map();

    this.textureAtlas = generateTextureAtlas();
    
    this.materials = {
      solid: new THREE.MeshStandardMaterial({
        map: this.textureAtlas,
        roughness: 0.8,
        metalness: 0.1,
        transparent: false,
        side: THREE.FrontSide,
        shadowSide: THREE.FrontSide,
      }),
      transparent: new THREE.MeshStandardMaterial({
        map: this.textureAtlas,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      cutout: new THREE.MeshStandardMaterial({
        map: this.textureAtlas,
        roughness: 0.8,
        metalness: 0.1,
        transparent: false,
        alphaTest: 0.5,
        depthWrite: true,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide,
      }),
    };

    interface CustomShader {
      vertexShader: string;
      fragmentShader: string;
    }

    // Extension Point: Inject Custom Shader for Greedy Meshing Tiling
    const injectShader = (shader: CustomShader) => {
      shader.vertexShader = `
        attribute vec2 aAtlasOffset;
        varying vec2 vAtlasOffset;
        varying vec2 vLocalUv;
        ${shader.vertexShader}
      `.replace(
        `#include <uv_vertex>`,
        `#include <uv_vertex>\n vAtlasOffset = aAtlasOffset;\n vLocalUv = uv;`
      );

      shader.fragmentShader = `
        varying vec2 vAtlasOffset;
        varying vec2 vLocalUv;
        ${shader.fragmentShader}
      `.replace(
        `#include <map_fragment>`,
        `#ifdef USE_MAP
           vec2 tiledUv = fract(vLocalUv);
           vec2 finalUv = vAtlasOffset + tiledUv * 0.125;
           vec4 sampledDiffuseColor = texture2D( map, finalUv );
           #ifdef DECODE_VIDEO_TEXTURE
             sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
           #endif
           diffuseColor *= sampledDiffuseColor;
         #endif`
      );
    };

    this.materials.solid.onBeforeCompile = injectShader;
    this.materials.transparent.onBeforeCompile = injectShader;
    this.materials.cutout.onBeforeCompile = injectShader;
  }

  public getChunkLOD(_key: string): number | undefined {
    return 1;
  }

  public getLODStep(_cx: number, _cy: number, _cz: number): number {
    return 1;
  }

  public updateChunkMesh(cx: number, cy: number, cz: number, chunks: Map<string, Uint8Array>): void {
    const key = `${cx},${cy},${cz}`;
    const chunk = chunks.get(key);
    if (!chunk) return;

    this.removeChunkMesh(key);

    const solidGeom = new THREE.BufferGeometry();
    const transGeom = new THREE.BufferGeometry();
    const cutoutGeom = new THREE.BufferGeometry();

    const createData = () => ({
      positions: [] as number[], normals: [] as number[], uvs: [] as number[], atlasOffsets: [] as number[]
    });

    const solidData = createData();
    const transData = createData();
    const cutoutData = createData();

    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartY = cy * CHUNK_SIZE_Y;
    const worldStartZ = cz * CHUNK_SIZE_Z;

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

      let ncx = cx, ncy = cy, ncz = cz;
      let nlx = lx, nly = ly, nlz = lz;

      if (lx < 0) { ncx = cx - 1; nlx = CHUNK_SIZE_X - 1; } 
      else if (lx >= CHUNK_SIZE_X) { ncx = cx + 1; nlx = 0; }

      if (ly < 0) { ncy = cy - 1; nly = CHUNK_SIZE_Y - 1; } 
      else if (ly >= CHUNK_SIZE_Y) { ncy = cy + 1; nly = 0; }

      if (lz < 0) { ncz = cz - 1; nlz = CHUNK_SIZE_Z - 1; } 
      else if (lz >= CHUNK_SIZE_Z) { ncz = cz + 1; nlz = 0; }

      const neighborChunk = chunks.get(`${ncx},${ncy},${ncz}`);
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
              if (!props.isCrossModel) {
                const nx = x[0] + q[0];
                const ny = x[1] + q[1];
                const nz = x[2] + q[2];
                const neighbor = getNeighbor(nx, ny, nz);
                
                let drawFace = false;
                if (this.world.isTransparent(neighbor)) {
                  if (blockType === neighbor && !props.renderAdjacentSameType) {
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

    // Cross Models Pass
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          const rBase = chunk[index];
          const blockType = rBase & 0x3F;
          if (blockType === BLOCK_TYPES.AIR) continue;
          const props = getBlockProperties(blockType);
          
          if (props.renderInternalCross || props.isCrossModel) {
            const atlasIndex = props.textureFaces?.side ?? 3;
            const tx = atlasIndex % 8;
            const ty = 7 - Math.floor(atlasIndex / 8);
            const uMin = tx * 0.125;
            const vMin = ty * 0.125;

            const uv0 = [0, 0];
            const uv1 = [0, 1];
            const uv2 = [1, 1];
            const uv3 = [1, 0];

            let dx = 0, dz = 0, hw = 0.5, h = 1.0;
            const wx = worldStartX + x;
            const wz = worldStartZ + z;

            if (props.isCrossModel) {
              if (props.enableCrossOffset) {
                const sinX = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453123;
                const sinZ = Math.sin(wx * 26.543 + wz * 19.854) * 43758.5453123;
                dx = (sinX - Math.floor(sinX)) * 0.3 - 0.15;
                dz = (sinZ - Math.floor(sinZ)) * 0.3 - 0.15;
              }
              hw = 0.5 * (props.crossScaleW ?? 1.0);
              h = props.crossScaleH ?? 1.0;
            }

            const cx = wx + 0.5;
            const cz = wz + 0.5;

            const p1_0 = [cx - hw + dx, worldStartY + y, cz - hw + dz];
            const p1_1 = [cx - hw + dx, worldStartY + y + h, cz - hw + dz];
            const p1_2 = [cx + hw + dx, worldStartY + y + h, cz + hw + dz];
            const p1_3 = [cx + hw + dx, worldStartY + y, cz + hw + dz];

            cutoutData.positions.push(...p1_0, ...p1_1, ...p1_2, ...p1_0, ...p1_2, ...p1_3);
            cutoutData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);
            for (let i = 0; i < 6; i++) {
              cutoutData.normals.push(-Math.SQRT1_2, 0, Math.SQRT1_2);
              cutoutData.atlasOffsets.push(uMin, vMin);
            }

            const p2_0 = [cx + hw + dx, worldStartY + y, cz - hw + dz];
            const p2_1 = [cx + hw + dx, worldStartY + y + h, cz - hw + dz];
            const p2_2 = [cx - hw + dx, worldStartY + y + h, cz + hw + dz];
            const p2_3 = [cx - hw + dx, worldStartY + y, cz + hw + dz];

            cutoutData.positions.push(...p2_0, ...p2_1, ...p2_2, ...p2_0, ...p2_2, ...p2_3);
            cutoutData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);
            for (let i = 0; i < 6; i++) {
              cutoutData.normals.push(Math.SQRT1_2, 0, Math.SQRT1_2);
              cutoutData.atlasOffsets.push(uMin, vMin);
            }
          }
        }
      }
    }

    interface ChunkGeometryData {
      positions: number[];
      normals: number[];
      uvs: number[];
      atlasOffsets: number[];
    }

    const buildGeometry = (data: ChunkGeometryData, geom: THREE.BufferGeometry) => {
      if (data.positions.length > 0) {
        geom.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        geom.setAttribute('aAtlasOffset', new THREE.Float32BufferAttribute(data.atlasOffsets, 2));
        geom.computeBoundingSphere();
        return true;
      }
      return false;
    };

    buildGeometry(solidData, solidGeom);
    buildGeometry(transData, transGeom);
    buildGeometry(cutoutData, cutoutGeom);

    const solidMesh = new THREE.Mesh(solidGeom, this.materials.solid);
    const transMesh = new THREE.Mesh(transGeom, this.materials.transparent);
    const cutoutMesh = new THREE.Mesh(cutoutGeom, this.materials.cutout);

    solidMesh.castShadow = true;
    solidMesh.receiveShadow = true;
    cutoutMesh.castShadow = true;
    cutoutMesh.receiveShadow = true;

    this.world.group.add(solidMesh);
    this.world.group.add(transMesh);
    this.world.group.add(cutoutMesh);

    this.chunkMeshes.set(key, { solid: solidMesh, transparent: transMesh, cutout: cutoutMesh });
  }

  public removeChunkMesh(key: string): void {
    const oldMeshes = this.chunkMeshes.get(key);
    if (oldMeshes) {
      this.world.group.remove(oldMeshes.solid);
      this.world.group.remove(oldMeshes.transparent);
      if (oldMeshes.cutout) {
        this.world.group.remove(oldMeshes.cutout);
        oldMeshes.cutout.geometry.dispose();
      }
      oldMeshes.solid.geometry.dispose();
      oldMeshes.transparent.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
  }

  public getChunkMeshes(): Map<string, { solid: THREE.Mesh; transparent: THREE.Mesh; cutout: THREE.Mesh }> {
    return this.chunkMeshes;
  }

  public hasChunkMesh(key: string): boolean {
    return this.chunkMeshes.has(key);
  }

  public dispose(): void {
    for (const meshes of this.chunkMeshes.values()) {
      meshes.solid.geometry.dispose();
      meshes.transparent.geometry.dispose();
      if (meshes.cutout) {
        meshes.cutout.geometry.dispose();
      }
    }
    this.chunkMeshes.clear();
    this.materials.solid.dispose();
    this.materials.transparent.dispose();
    if (this.materials.cutout) {
      this.materials.cutout.dispose();
    }
    this.textureAtlas.dispose();
  }
}
