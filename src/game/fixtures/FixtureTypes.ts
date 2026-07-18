import type { ItemStack, SoundType } from '@type';

export interface FixtureCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type FixtureOrientation = 0 | 1 | 2 | 3;

export type FixtureComponentDefinition =
  | { readonly type: 'container'; readonly slots: number }
  | { readonly type: 'crafting'; readonly capabilities: readonly string[] }
  | { readonly type: 'fuel'; readonly slots: number }
  | { readonly type: 'processor'; readonly capabilities: readonly string[] };

export interface FixtureDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly footprint: readonly FixtureCoordinate[];
  readonly components: readonly FixtureComponentDefinition[];
  /**
   * 挖掘硬度（秒）。
   * 与体素 hardness 语义一致：-1 不可破坏，0 即时破坏，正数需按住挖掘。
   * 未声明时默认 2.5（与木箱同级）。
   */
  readonly hardness?: number;
  /** 破坏/挖掘音效类型，未声明时默认 wood */
  readonly soundType?: SoundType;
  readonly view?: {
    readonly color: number;
    readonly width?: number;
    readonly height?: number;
    readonly depth?: number;
    /** 渲染模型类型，默认 box；chest 为木箱复合体 */
    readonly model?: 'box' | 'chest';
  };
}

export type FixtureComponentState =
  | { readonly type: 'container'; slots: Array<ItemStack | null> }
  | { readonly type: 'crafting'; readonly capabilities: readonly string[] }
  | { readonly type: 'fuel'; slots: Array<ItemStack | null> }
  | { readonly type: 'processor'; readonly capabilities: readonly string[]; progress: number };

export interface PlacedFixture {
  readonly id: string;
  readonly definitionId: string;
  readonly anchor: FixtureCoordinate;
  readonly orientation: FixtureOrientation;
  readonly components: FixtureComponentState[];
}

export type FixtureComponentSnapshot =
  | { readonly type: 'container'; readonly slots: readonly (ItemStack | null)[] }
  | { readonly type: 'crafting' }
  | { readonly type: 'fuel'; readonly slots: readonly (ItemStack | null)[] }
  | { readonly type: 'processor'; readonly progress: number };

export interface FixtureSnapshotEntry {
  readonly id: string;
  readonly definitionId: string;
  readonly anchor: FixtureCoordinate;
  readonly orientation: FixtureOrientation;
  readonly components: readonly FixtureComponentSnapshot[];
}

export interface FixtureWorldPort {
  canOccupy(coordinate: FixtureCoordinate): boolean;
}

export interface FixturePlacementPort {
  place(
    definitionId: string,
    anchor: FixtureCoordinate,
    orientation: FixtureOrientation,
  ): FixturePlacementResult;
}

export interface FixtureViewPort {
  attach(fixture: PlacedFixture, definition: FixtureDefinition): void;
  detach(fixtureId: string): void;
  dispose(): void;
}

export interface FixtureRaycastHit {
  readonly fixtureId: string;
  readonly distance: number;
  readonly point: import('three').Vector3;
  readonly object: import('three').Object3D;
}

export type FixturePlacementResult =
  | { readonly ok: true; readonly fixtureId: string }
  | {
    readonly ok: false;
    readonly reason: 'unknown_definition' | 'invalid_placement' | 'blocked' | 'occupied';
  };

export interface FixtureSnapshot {
  readonly schemaVersion: 1;
  readonly fixtures: readonly FixtureSnapshotEntry[];
}
