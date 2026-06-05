import * as THREE from 'three';
import { GameManager } from './GameManager';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/World';
import { sound } from '@game/systems/Sound';
import { useGameStore } from '@store/useGameStore';
import { BlockRegistry } from '../world/block/BlockRegistry';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { FoodItem } from '@game/item/Item';



export class InteractionManager {
  private game: GameManager;

  // Interaction properties
  public selectionBox!: THREE.Mesh;
  public targetedBlockInfo: { target: THREE.Vector3; place: THREE.Vector3; face: THREE.Vector3 } | null = null;

  // Mining state properties
  public isMining = false;
  public isLeftMouseDown = false;
  private mouseDownTime = 0;
  private miningBlockPos = new THREE.Vector3();
  private miningTime = 0;
  private miningBreakTime = 0;
  private lastDigSoundTime = 0;
  private lastDigParticleTime = 0;
  private crackTextures: THREE.Texture[] = [];
  private crackMesh!: THREE.Mesh;
  private lastCreativeBreakTime = 0;
  private lastCreativeBreakPos = new THREE.Vector3();

  constructor(game: GameManager) {
    this.game = game;
    this.initSelectionBox();
    this.initCrackTextures();
    this.initCrackMesh();
  }

  private initSelectionBox() {
    const selectGeo = new THREE.BoxGeometry(1.008, 1.008, 1.008);
    const selectMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    this.selectionBox = new THREE.Mesh(selectGeo, selectMat);
    this.game.scene.add(this.selectionBox);
  }

  private initCrackTextures() {
    this.crackTextures = [];
    const segments = [
      [2, 3, 6, 8],
      [6, 8, 11, 4],
      [11, 4, 14, 11],
      [6, 8, 5, 13],
      [5, 13, 2, 12],
      [11, 4, 9, 2],
      [2, 3, 4, 1],
      [14, 11, 15, 14],
      [5, 13, 9, 13],
      [9, 13, 13, 9]
    ];

    for (let stage = 1; stage <= 10; stage++) {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 16, 16);

      // Draw pixelated cracks
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'square';

      ctx.beginPath();
      for (let i = 0; i < Math.min(stage, segments.length); i++) {
        const seg = segments[i];
        ctx.moveTo(seg[0], seg[1]);
        ctx.lineTo(seg[2], seg[3]);
      }
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      this.crackTextures.push(texture);
    }
  }

  private initCrackMesh() {
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const mat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.crackMesh = new THREE.Mesh(geo, mat);
    this.crackMesh.visible = false;
    this.game.scene.add(this.crackMesh);
  }

  public update(dt: number) {
    this.updateTargetedBlock();
    this.updateMining(dt);
  }

  public onMouseDown = (e: MouseEvent) => {
    if (!this.game.controls.isLocked && !this.game.controls.isMobile) return;

    if (e.button === 0) {
      if (this.game.animals && this.game.animals.checkAttack()) {
        return;
      }
    }

    if (e.button === 2) {
      const activeSlot = useGameStore.getState().activeSlot;
      const hotbar = useGameStore.getState().hotbar;
      const heldItem = hotbar[activeSlot];
      if (heldItem) {
        const item = ItemRegistry.get(heldItem.type);
        if (item instanceof FoodItem) {
          const effect = item.onUse(this.game.player);
          if (effect) {
            // 统一应用副作用，单一数据源
            if (effect.hungerDelta) {
              this.game.player.hunger = Math.min(20, this.game.player.hunger + effect.hungerDelta);
            }
            if (effect.healDelta) {
              this.game.player.life = Math.min(10, this.game.player.life + effect.healDelta);
            }
            sound.playPickup(); // eating sound fallback

            const isCreative = useGameStore.getState().gameMode === 'creative';
            if (!isCreative) {
              useGameStore.getState().decrementHotbarItem(activeSlot);
            }

            useGameStore.getState().setPlayerState(
              {
                x: this.game.player.position.x,
                y: this.game.player.position.y,
                z: this.game.player.position.z,
              },
              this.game.player.state.onGround,
              this.game.player.state.inWater,
              this.game.player.life,
              this.game.player.hunger
            );
          }
          return; // Intercept right click for all food items to prevent placement
        } else if (!item.isBlockItem) {
          // Intercept right click for all other pure items to prevent placement
          return;
        }
      }
    }

    this.updateTargetedBlock();

    if (!this.targetedBlockInfo) return;

    if (e.button === 0) {
      this.isLeftMouseDown = true;
      this.mouseDownTime = performance.now();

      const isCreative = useGameStore.getState().gameMode === 'creative';
      if (isCreative && this.targetedBlockInfo) {
        const { target } = this.targetedBlockInfo;
        const blockId = this.game.world.getBlock(target.x, target.y, target.z);
        const props = getBlockProperties(blockId);
        if (blockId !== BLOCK_TYPES.AIR && !props.isLiquid && props.hardness >= 0) {
          this.game.world.setBlock(target.x, target.y, target.z, BLOCK_TYPES.AIR);
          sound.playBreak(props.soundType);
          
          const color = getBlockProperties(blockId).colorHex ?? 0x787878;
          this.game.particles.spawn(
            new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
            color,
            15
          );
          this.lastCreativeBreakTime = performance.now();
          this.lastCreativeBreakPos.copy(target);
          this.updateTargetedBlock();
        }
      }
    } else if (e.button === 2) {
      // Right Click: Place Block or Interact
      const { target, place } = this.targetedBlockInfo;

      const targetId = this.game.world.getBlock(target.x, target.y, target.z);
      const block = BlockRegistry.get(targetId);
      if (block.isInteractable) {
        const handled = block.onInteract(this.game.world, target.x, target.y, target.z, this.game.player);
        if (handled) {
          return; // Intercept block placement
        }
      }
      
      const blockBox = new THREE.Box3(
        place,
        new THREE.Vector3(place.x + 1, place.y + 1, place.z + 1)
      );

      const playerBox = this.game.physics.getPlayerBox(this.game.player.position);
      const isCreative = useGameStore.getState().gameMode === 'creative';

      const selectedBlockType = this.game.player.selectedBlockType;

      if (selectedBlockType !== BLOCK_TYPES.AIR && !playerBox.intersectsBox(blockBox)) {
        let blockToPlace: number = selectedBlockType;
        const face = this.targetedBlockInfo.face;

        const isLog = blockToPlace === BLOCK_TYPES.WOOD || blockToPlace === BLOCK_TYPES.BIRCH_WOOD || blockToPlace === BLOCK_TYPES.SPRUCE_WOOD;
        if (isLog) {
          if (face.x !== 0) blockToPlace = blockToPlace | (1 << 6); // X axis
          else if (face.z !== 0) blockToPlace = blockToPlace | (2 << 6); // Z axis
        }

        const placeProps = getBlockProperties(blockToPlace);
        this.game.world.setBlock(place.x, place.y, place.z, blockToPlace);
        sound.playPlace(placeProps.soundType);

        if (!isCreative) {
          const activeSlot = useGameStore.getState().activeSlot;
          useGameStore.getState().decrementHotbarItem(activeSlot);
        }
      }
    }
  };

  public onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isLeftMouseDown = false;
      this.cancelMining();
    }
  };

  public cancelMining() {
    this.isMining = false;
    if (this.crackMesh) {
      this.crackMesh.visible = false;
    }
    useGameStore.getState().setMiningProgress(null);
  }

  private updateTargetedBlock() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
    const dir = raycaster.ray.direction;
    const origin = raycaster.ray.origin;

    const maxDist = 5.2;

    this.targetedBlockInfo = null;
    this.selectionBox.visible = false;

    const hit = this.game.physics.raycast(origin, dir, maxDist);
    if (hit) {
      this.targetedBlockInfo = {
        target: hit.target,
        place: hit.place,
        face: hit.face,
      };

      this.selectionBox.position.set(hit.target.x + 0.5, hit.target.y + 0.5, hit.target.z + 0.5);
      this.selectionBox.visible = true;
    }
  }

  private updateMining(dt: number) {
    if (!this.isLeftMouseDown) {
      this.cancelMining();
      return;
    }

    const isCreative = useGameStore.getState().gameMode === 'creative';

    if (isCreative) {
      if (this.isLeftMouseDown && this.targetedBlockInfo) {
        const now = performance.now();
        if (now - this.lastCreativeBreakTime >= 200) {
          const { target } = this.targetedBlockInfo;
          const blockId = this.game.world.getBlock(target.x, target.y, target.z);
          const props = getBlockProperties(blockId);
          if (blockId !== BLOCK_TYPES.AIR && !props.isLiquid && props.hardness >= 0) {
            this.game.world.setBlock(target.x, target.y, target.z, BLOCK_TYPES.AIR);
            sound.playBreak(props.soundType);
            
            const color = getBlockProperties(blockId).colorHex ?? 0x787878;
            this.game.particles.spawn(
              new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
              color,
              15
            );
            this.lastCreativeBreakTime = now;
            this.lastCreativeBreakPos.copy(target);
            this.updateTargetedBlock();
          }
        }
      }
      this.cancelMining();
      return;
    }

    const now = performance.now();
    const pressDuration = now - this.mouseDownTime;

    if (pressDuration < 200) {
      this.cancelMining();
      return;
    }

    if (!this.isMining) {
      if (this.targetedBlockInfo) {
        const { target } = this.targetedBlockInfo;
        const blockId = this.game.world.getBlock(target.x, target.y, target.z);
        const props = getBlockProperties(blockId);
        if (blockId !== BLOCK_TYPES.AIR && !props.isLiquid && props.hardness >= 0) {
          this.isMining = true;
          this.miningBlockPos.copy(target);
          this.miningTime = 0;
          this.miningBreakTime = props.hardness * 1.0;
          this.lastDigSoundTime = 0;
          this.lastDigParticleTime = 0;
        }
      } else {
        this.cancelMining();
        return;
      }
    }

    if (!this.targetedBlockInfo || !this.targetedBlockInfo.target.equals(this.miningBlockPos)) {
      this.cancelMining();
      return;
    }

    const target = this.miningBlockPos;
    const blockId = this.game.world.getBlock(target.x, target.y, target.z);
    const props = getBlockProperties(blockId);

    if (blockId === BLOCK_TYPES.AIR || props.isLiquid || props.hardness < 0) {
      this.cancelMining();
      return;
    }

    this.miningTime += dt;
    const progress = Math.min(1.0, this.miningTime / this.miningBreakTime);
    const currentTime = performance.now();

    if (currentTime - this.lastDigSoundTime > 250) {
      this.lastDigSoundTime = currentTime;
      sound.playDig(props.soundType);
    }

    if (currentTime - this.lastDigParticleTime > 120) {
      this.lastDigParticleTime = currentTime;
      const color = getBlockProperties(blockId).colorHex ?? 0x787878;
      this.game.particles.spawn(
        new THREE.Vector3(
          target.x + 0.2 + Math.random() * 0.6,
          target.y + 0.2 + Math.random() * 0.6,
          target.z + 0.2 + Math.random() * 0.6
        ),
        color,
        2
      );
    }

    if (props.showBreakCracks !== false) {
      this.crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      const stage = Math.min(9, Math.floor(progress * 10));
      const mat = this.crackMesh.material as THREE.MeshBasicMaterial;
      mat.map = this.crackTextures[stage];
      this.crackMesh.visible = true;
    } else {
      this.crackMesh.visible = false;
    }

    useGameStore.getState().setMiningProgress(progress);

    if (this.miningTime >= this.miningBreakTime) {
      this.game.world.setBlock(target.x, target.y, target.z, BLOCK_TYPES.AIR);
      sound.playBreak(props.soundType);

      const color = getBlockProperties(blockId).colorHex ?? 0x787878;
      this.game.particles.spawn(
        new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
        color,
        15
      );

      const blockInstance = BlockRegistry.get(blockId);
      const drops = blockInstance.getDrops();
      for (const drop of drops) {
        if (drop.count > 0) {
          this.game.droppedItems.spawnItem(
            drop.type,
            new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
            drop.count
          );
        }
      }
      this.cancelMining();
    }
  }

  public dispose() {
    if (this.crackTextures) {
      this.crackTextures.forEach((tex) => tex.dispose());
    }
    if (this.crackMesh) {
      this.game.scene.remove(this.crackMesh);
      if (this.crackMesh.geometry) this.crackMesh.geometry.dispose();
      if (Array.isArray(this.crackMesh.material)) {
        this.crackMesh.material.forEach((mat: THREE.Material) => mat.dispose());
      } else if (this.crackMesh.material) {
        (this.crackMesh.material as THREE.Material).dispose();
      }
    }
    if (this.selectionBox) {
      this.game.scene.remove(this.selectionBox);
      if (this.selectionBox.geometry) this.selectionBox.geometry.dispose();
      if (Array.isArray(this.selectionBox.material)) {
        this.selectionBox.material.forEach((mat: THREE.Material) => mat.dispose());
      } else if (this.selectionBox.material) {
        (this.selectionBox.material as THREE.Material).dispose();
      }
    }
  }
}
