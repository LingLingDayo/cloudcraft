import * as THREE from 'three';
import { generateTextureAtlas } from './TextureAtlas';
import type { World } from './World';
import { ChunkMeshBuilder } from './ChunkMeshBuilder';
import type { ChunkMeshResult, ChunkNeighbors, ChunkGeometryData } from './ChunkMeshBuilder';

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

  public applyMeshResult(
    cx: number,
    cy: number,
    cz: number,
    meshResult: ChunkMeshResult
  ): void {
    const key = `${cx},${cy},${cz}`;
    this.removeChunkMesh(key);

    const solidGeom = new THREE.BufferGeometry();
    const transGeom = new THREE.BufferGeometry();
    const cutoutGeom = new THREE.BufferGeometry();

    const buildGeometry = (data: ChunkGeometryData | null, geom: THREE.BufferGeometry) => {
      if (data && data.positions && data.positions.length > 0) {
        geom.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        geom.setAttribute('aAtlasOffset', new THREE.Float32BufferAttribute(data.atlasOffsets, 2));
        geom.computeBoundingSphere();
      }
    };

    buildGeometry(meshResult.solid, solidGeom);
    buildGeometry(meshResult.transparent, transGeom);
    buildGeometry(meshResult.cutout, cutoutGeom);

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

  public updateChunkMesh(cx: number, cy: number, cz: number, chunks: Map<string, Uint8Array>): void {
    const key = `${cx},${cy},${cz}`;
    const chunk = chunks.get(key);
    if (!chunk) return;

    const neighbors: ChunkNeighbors = {
      px: chunks.get(`${cx + 1},${cy},${cz}`),
      nx: chunks.get(`${cx - 1},${cy},${cz}`),
      py: chunks.get(`${cx},${cy + 1},${cz}`),
      ny: chunks.get(`${cx},${cy - 1},${cz}`),
      pz: chunks.get(`${cx},${cy},${cz + 1}`),
      nz: chunks.get(`${cx},${cy},${cz - 1}`),
    };

    const meshResult = ChunkMeshBuilder.buildMesh(cx, cy, cz, chunk, neighbors);
    this.applyMeshResult(cx, cy, cz, meshResult);
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
