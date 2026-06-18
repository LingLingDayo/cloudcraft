import * as THREE from 'three';
import type { GameManager } from '../../core/GameManager';

export function createRenderCommands(game: GameManager) {
  return {
    setRenderDistance(n: number) {
      if (typeof n !== 'number') {
        console.error('Render distance must be a number');
        return;
      }
      const distance = Math.max(2, Math.min(16, n));
      game.renderDistance = distance;
      const px = Math.floor(game.player.position.x);
      const py = Math.floor(game.player.position.y);
      const pz = Math.floor(game.player.position.z);
      game.world.loadArea(px, py, pz, distance);
      console.log(`Set render distance to: ${distance}`);
    },
    setFov(n: number) {
      if (typeof n !== 'number') {
        console.error('FOV must be a number');
        return;
      }
      const fov = Math.max(30, Math.min(120, n));
      game.camera.fov = fov;
      game.camera.updateProjectionMatrix();
      console.log(`Set camera FOV to: ${fov}`);
    },
    setShadowQuality(quality: 'simple' | 'fancy') {
      if (quality === 'simple') {
        game.renderer.shadowMap.type = THREE.BasicShadowMap;
      } else if (quality === 'fancy') {
        game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      } else {
        console.error("Invalid shadow quality. Valid options are: 'simple' | 'fancy'");
        return;
      }
      game.renderer.shadowMap.needsUpdate = true;
      game.scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => (m.needsUpdate = true));
          } else {
            object.material.needsUpdate = true;
          }
        }
      });
      console.log(`Set shadow quality to: ${quality}`);
    },
    getStats() {
      const info = game.renderer.info;
      return {
        fps: Math.round(game.fpsCounter.getFPS()),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures
      };
    }
  };
}
