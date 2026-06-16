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
  private loadedTimestamps: number[] = [];
  private meshVersions = new Map<string, number>();

  public getNextVersion(key: string): number {
    const current = this.meshVersions.get(key) ?? 0;
    const next = current + 1;
    this.meshVersions.set(key, next);
    return next;
  }

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

    // Extension Point: Inject Custom Shader for Greedy Meshing Tiling
    const textureRes = 16; // 16px textures
    const atlasCols = 8;   // 8x8 atlas grid
    const margin = 0.5 / textureRes; // 0.03125 (half-texel inset)
    const scale = 1.0 / atlasCols;   // 0.125

    const injectShader = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSkyLightColor = { value: new THREE.Color(1, 1, 1) };
      shader.uniforms.uBlockLightColor = { value: new THREE.Color(1, 0.85, 0.5) }; // warm torch light

      shader.vertexShader = `
        attribute vec2 aValLight;
        attribute float aAo;
        varying vec2 vValLight;
        varying float vAo;
        varying float vFaceLight;
        attribute vec2 aAtlasOffset;
        varying vec2 vAtlasOffset;
        varying vec2 vLocalUv;
        attribute vec2 aRoughnessMetalness;
        varying vec2 vRoughnessMetalness;
        ${shader.vertexShader}
      `.replace(
        `#include <uv_vertex>`,
        `#include <uv_vertex>
         vAtlasOffset = aAtlasOffset;
         vLocalUv = uv;
         vValLight = aValLight;
         vAo = aAo;
         vRoughnessMetalness = aRoughnessMetalness;
         
         // Calculate face light multiplier based on vertex normal (gives a strong 3D feel)
         float faceLight = 0.85;
         if (normal.y > 0.5) {
           faceLight = 1.0;
         } else if (normal.y < -0.5) {
           faceLight = 0.5;
         } else if (abs(normal.x) > 0.5) {
           faceLight = 0.75;
         } else if (abs(normal.z) > 0.5) {
           faceLight = 0.85;
         }
         vFaceLight = faceLight;
        `
      );

      shader.fragmentShader = `
        varying vec2 vValLight;
        varying float vAo;
        varying float vFaceLight;
        uniform vec3 uSkyLightColor;
        uniform vec3 uBlockLightColor;
        varying vec2 vAtlasOffset;
        varying vec2 vLocalUv;
        varying vec2 vRoughnessMetalness;
        ${shader.fragmentShader}
      `.replace(
        `#include <map_fragment>`,
        `#ifdef USE_MAP
           vec2 tiledUv = fract(vLocalUv);
           tiledUv = clamp(tiledUv, ${margin.toFixed(5)}, ${(1.0 - margin).toFixed(5)});
           vec2 finalUv = vAtlasOffset + tiledUv * ${scale.toFixed(5)};
           
           // Calculate manual derivatives based on the continuous vLocalUv (avoiding the fract() boundary jump)
           vec2 dx = dFdx(vLocalUv) * ${scale.toFixed(5)};
           vec2 dy = dFdy(vLocalUv) * ${scale.toFixed(5)};
           vec4 sampledDiffuseColor = texture2DGradEXT( map, finalUv, dx, dy );
           
           #ifdef DECODE_VIDEO_TEXTURE
             sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
           #endif
           
           // Calculate voxel lighting
           float skyFactor = vValLight.x / 15.0;
           float blockFactor = vValLight.y / 15.0;
           float aoFactor = 0.2 + 0.8 * (vAo / 3.0);
           
           // Blend sky light and block light
           vec3 mixedLight = uSkyLightColor * skyFactor + uBlockLightColor * blockFactor;
           // Add a subtle minimum ambient light for deep caves
           mixedLight = max(vec3(0.08), mixedLight);
           
           diffuseColor *= sampledDiffuseColor * vec4(mixedLight * vFaceLight * aoFactor, 1.0);
         #endif`
      ).replace(
        `#include <roughnessmap_fragment>`,
        `#include <roughnessmap_fragment>
         roughnessFactor = vRoughnessMetalness.x;`
      ).replace(
        `#include <metalnessmap_fragment>`,
        `#include <metalnessmap_fragment>
         metalnessFactor = vRoughnessMetalness.y;`
      );
    };

    this.materials.solid.onBeforeCompile = (shader) => {
      this.materials.solid.userData.shader = shader;
      injectShader(shader);
    };
    this.materials.transparent.onBeforeCompile = (shader) => {
      this.materials.transparent.userData.shader = shader;
      injectShader(shader);
    };
    this.materials.cutout.onBeforeCompile = (shader) => {
      this.materials.cutout.userData.shader = shader;
      injectShader(shader);
    };
  }

  public updateLightingColors(skyColor: THREE.Color, blockColor: THREE.Color) {
    [this.materials.solid, this.materials.transparent, this.materials.cutout].forEach(material => {
      const shader = material.userData.shader as THREE.WebGLProgramParametersWithUniforms | undefined;
      if (shader && shader.uniforms) {
        if (shader.uniforms.uSkyLightColor) {
          shader.uniforms.uSkyLightColor.value.copy(skyColor);
        }
        if (shader.uniforms.uBlockLightColor) {
          shader.uniforms.uBlockLightColor.value.copy(blockColor);
        }
      }
    });
  }

  public applyMeshResult(
    cx: number,
    cy: number,
    cz: number,
    meshResult: ChunkMeshResult,
    version?: number
  ): void {
    const key = `${cx},${cy},${cz}`;
    if (version !== undefined) {
      const currentVersion = this.meshVersions.get(key) ?? 0;
      if (version < currentVersion) {
        return;
      }
    }

    const isNewChunk = !this.chunkMeshes.has(key);
    if (isNewChunk) {
      this.loadedTimestamps.push(performance.now());
    }

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
        geom.setAttribute('aValLight', new THREE.Float32BufferAttribute(data.valLights, 2));
        geom.setAttribute('aAo', new THREE.Float32BufferAttribute(data.aos, 1));
        geom.setAttribute('aRoughnessMetalness', new THREE.Float32BufferAttribute(data.roughnessMetalness, 2));
        geom.computeBoundingSphere();
      }
    };

    buildGeometry(meshResult.solid, solidGeom);
    buildGeometry(meshResult.transparent, transGeom);
    buildGeometry(meshResult.cutout, cutoutGeom);

    const solidMesh = new THREE.Mesh(solidGeom, this.materials.solid);
    const transMesh = new THREE.Mesh(transGeom, this.materials.transparent);
    const cutoutMesh = new THREE.Mesh(cutoutGeom, this.materials.cutout);

    // Turn off real-time shadows for chunk meshes to eliminate shadow mapping moire patterns!
    solidMesh.castShadow = false;
    solidMesh.receiveShadow = false;
    cutoutMesh.castShadow = false;
    cutoutMesh.receiveShadow = false;

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

  public getChunkLoadSpeed(): number {
    const now = performance.now();
    const windowMs = 2000;
    while (this.loadedTimestamps.length > 0 && now - this.loadedTimestamps[0] > windowMs) {
      this.loadedTimestamps.shift();
    }
    return this.loadedTimestamps.length / (windowMs / 1000);
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
