import { ItemType } from './item';

export interface ItemStack {
  type: ItemType;
  count: number;
}

export type HotbarItem = ItemStack;
