import * as THREE from 'three';
import { GameManager } from './GameManager';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/World';
import { sound } from '@game/systems/Sound';
import { useGameStore } from '@store/useGameStore';
import { BlockRegistry } from '../world/block/BlockRegistry';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { BlockItem } from '@game/item/Item';
import type { BlockPlaceContext, ItemUseContext, ItemUseResult } from '@game/item/Item';
import { GameMode } from '@type';
import { LootTableHelper } from '../loot/LootTableHelper';



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

  // Eating state properties
  public isEating = false;
  public isRightMouseDown = false;
  private eatingTime = 0;
  private eatingDuration = 1600; // 1.6 seconds in ms
  private lastEatSoundTime = 0;
  private lastEatParticleTime = 0;

  // Attack state properties
  private lastAttackTime = 0;
  private attackInterval = 500; // 500ms continuous attack rate

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
    
    let attacked = false;
    if (this.isLeftMouseDown && this.hasAnimalTarget()) {
      this.cancelMining();
      const now = performance.now();
      if (now - this.lastAttackTime >= this.attackInterval) {
        if (this.game.animals && this.game.animals.checkAttack()) {
          this.lastAttackTime = now;
        }
      }
      attacked = true;
    }

    if (!attacked) {
      this.updateMining(dt);
    }
    
    this.updateEating(dt);
  }

  // ─── 右键交互：Item 多态分发 ──────────────────────────────

  /** 构建物品直接使用上下文 */
  private buildItemUseContext(): ItemUseContext {
    return {
      player: {
        life: this.game.player.life,
        hunger: this.game.player.hunger,
      },
      gameMode: useGameStore.getState().gameMode as GameMode,
    };
  }

  /** 构建方块放置上下文 */
  private buildBlockPlaceContext(): BlockPlaceContext | null {
    if (!this.targetedBlockInfo) return null;
    const { place, face } = this.targetedBlockInfo;

    return {
      world: this.game.world,
      targetPos: this.targetedBlockInfo.target,
      placePos: place,
      face,
      playerBox: this.game.physics.getPlayerBox(this.game.player.position),
      gameMode: useGameStore.getState().gameMode as GameMode,
    };
  }

  /** 应用物品使用结果（恢复饥饿/生命、播放音效、扣减物品、同步 Store） */
  private applyItemUseResult(result: ItemUseResult) {
    if (!result.consumed) return;

    if (result.hungerDelta) {
      this.game.player.hunger = Math.min(20, this.game.player.hunger + result.hungerDelta);
    }
    if (result.healDelta) {
      this.game.player.life = Math.min(10, this.game.player.life + result.healDelta);
    }

    const isFood = result.hungerDelta !== undefined || result.healDelta !== undefined;
    if (isFood) {
      sound.playBurp();
    } else {
      sound.playPickup();
    }

    const isCreative = useGameStore.getState().gameMode === 'creative';
    if (!isCreative) {
      const activeSlot = useGameStore.getState().activeSlot;
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

  /** 处理右键点击的完整流程 */
  private handleRightClick() {
    const storeState = useGameStore.getState();
    const heldSlotItem = storeState.hotbar[storeState.activeSlot];
    const item = heldSlotItem ? ItemRegistry.get(heldSlotItem.type) : null;

    // 1. 尝试与目标方块交互（箱子、拉杆等）
    if (this.targetedBlockInfo) {
      const { target } = this.targetedBlockInfo;
      const targetId = this.game.world.getBlock(target.x, target.y, target.z);
      const block = BlockRegistry.get(targetId);
      if (block.isInteractable) {
        const handled = block.onInteract(this.game.world, target.x, target.y, target.z, this.game.player);
        if (handled) return;
      }
    }

    if (!item) return;

    // 2. 尝试对方块使用物品（放置方块、种植种子等）
    if (this.targetedBlockInfo) {
      const blockCtx = this.buildBlockPlaceContext();
      if (blockCtx && item.onUseOnBlock(blockCtx)) {
        // 播放放置音效
        if (item.isBlockItem) {
          sound.playPlace((item as BlockItem).getPlaceSoundType());
        }
        // 扣减物品（非创造模式）
        const isCreative = storeState.gameMode === 'creative';
        if (!isCreative) {
          storeState.decrementHotbarItem(storeState.activeSlot);
        }
        return;
      }
    }

    // 3. 尝试直接使用物品（食用食物、饮用药水等）
    if (item.category === 'food') {
      const useCtx = this.buildItemUseContext();
      const canEat = useCtx.gameMode === 'creative' || useCtx.player.hunger < 20;
      if (canEat) {
        this.startEating();
      }
      return;
    }

    const useCtx = this.buildItemUseContext();
    const result = item.onUse(useCtx);
    if (result) {
      this.applyItemUseResult(result);
    }
  }

  // ─── 鼠标事件处理 ─────────────────────────────────────────

  public onMouseDown = (e: MouseEvent) => {
    if (!this.game.controls.isLocked && !this.game.controls.isMobile) return;

    if (e.button === 0) {
      this.isLeftMouseDown = true;
      this.mouseDownTime = performance.now();
      this.cancelEating();
      if (this.game.animals && this.game.animals.checkAttack()) {
        this.lastAttackTime = performance.now();
        return;
      }
    }

    if (e.button === 2) {
      this.isRightMouseDown = true;
      this.cancelMining();
      this.updateTargetedBlock();
      this.handleRightClick();
      return;
    }

    this.updateTargetedBlock();

    if (!this.targetedBlockInfo) return;

    if (e.button === 0) {
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
    }
  };

  public onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isLeftMouseDown = false;
      this.cancelMining();
    }
    if (e.button === 2) {
      this.isRightMouseDown = false;
      this.cancelEating();
    }
  };

  public cancelMining() {
    this.isMining = false;
    if (this.crackMesh) {
      this.crackMesh.visible = false;
    }
    useGameStore.getState().setMiningProgress(null);
  }

  private startEating() {
    this.isEating = true;
    this.eatingTime = 0;
    this.lastEatSoundTime = 0;
    this.lastEatParticleTime = 0;
  }

  public cancelEating() {
    if (this.isEating) {
      this.isEating = false;
      useGameStore.getState().setMiningProgress(null);
    }
  }

  private updateEating(dt: number) {
    if (!this.isEating) return;

    const storeState = useGameStore.getState();
    const heldSlotItem = storeState.hotbar[storeState.activeSlot];
    const item = heldSlotItem ? ItemRegistry.get(heldSlotItem.type) : null;

    // 检查取消吃东西的条件：松开右键、没有手持物品、手持不是食物
    if (!this.isRightMouseDown || !item || item.category !== 'food') {
      this.cancelEating();
      return;
    }

    this.eatingTime += dt * 1000;
    const progress = Math.min(1.0, this.eatingTime / this.eatingDuration);
    
    // 重用 miningProgress 用以在 HUD 中央绘制圈
    storeState.setMiningProgress(progress);

    const currentTime = performance.now();

    // 每 250ms 播放一次咀嚼音
    if (currentTime - this.lastEatSoundTime > 250) {
      this.lastEatSoundTime = currentTime;
      sound.playEat();
    }

    // 每 150ms 产生一些粒子
    if (currentTime - this.lastEatParticleTime > 150) {
      this.lastEatParticleTime = currentTime;
      const color = item.colorHex ?? 0xab6026;
      
      const camera = this.game.camera;
      // 在镜头前下方生成粒子 (模拟嘴部位置)
      const dir = new THREE.Vector3(0, -0.2, -0.4).applyQuaternion(camera.quaternion);
      const spawnPos = this.game.player.position.clone()
        .add(new THREE.Vector3(0, 1.5, 0)) // 假设眼睛在 1.5 高度
        .add(dir)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15
        ));
      
      this.game.particles.spawn(spawnPos, color, 1);
    }

    // 吃完了！
    if (this.eatingTime >= this.eatingDuration) {
      const useCtx = this.buildItemUseContext();
      const result = item.onUse(useCtx);
      if (result) {
        this.applyItemUseResult(result);
      }
      this.cancelEating();
    }
  }

  private hasAnimalTarget(): boolean {
    if (!this.game.animals) return false;
    const meshes = this.game.animals.getAnimalMeshes();
    if (meshes.length === 0) return false;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
    const intersects = raycaster.intersectObjects(meshes, true);
    return intersects.length > 0 && intersects[0].distance < 5.2;
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
      const spawnPos = new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5);

      const storeState = useGameStore.getState();
      const heldSlotItem = storeState.hotbar[storeState.activeSlot];
      const tool = heldSlotItem ? ItemRegistry.get(heldSlotItem.type) : undefined;

      const context = {
        world: this.game.world,
        position: spawnPos,
        tool,
        killer: this.game.player
      };

      if (blockInstance.properties.lootTableId) {
        LootTableHelper.spawnDrops(blockInstance.properties.lootTableId, context, false);
      } else {
        const drops = blockInstance.getDrops(context);
        for (const drop of drops) {
          if (drop.count > 0) {
            this.game.droppedItems.spawnItem(drop.type, spawnPos, drop.count);
          }
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
