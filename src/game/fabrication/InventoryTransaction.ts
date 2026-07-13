import type { ItemStack } from '@type';
import type {
  CraftingItemCatalog,
  IngredientRequirement,
  InventoryState,
} from './CraftingTypes';

interface MutableInventoryState {
  hotbar: Array<ItemStack | null>;
  inventory: Array<ItemStack | null>;
}

interface InventorySlotReference {
  readonly zone: Array<ItemStack | null>;
  readonly index: number;
  readonly stack: ItemStack;
}

interface FlowEdge {
  readonly to: number;
  readonly reverseIndex: number;
  capacity: number;
}

function cloneInventory(inventory: InventoryState): MutableInventoryState {
  return {
    hotbar: inventory.hotbar.map(stack => stack ? { ...stack } : null),
    inventory: inventory.inventory.map(stack => stack ? { ...stack } : null),
  };
}

function matchesRequirement(
  stack: ItemStack,
  requirement: IngredientRequirement,
  catalog: CraftingItemCatalog,
): boolean {
  const { itemType, tag } = requirement.selector;
  if (itemType && stack.type !== itemType) return false;
  if (tag && !catalog.hasTag(stack.type, tag)) return false;
  return itemType !== undefined || tag !== undefined;
}

function addFlowEdge(
  graph: FlowEdge[][],
  from: number,
  to: number,
  capacity: number,
): FlowEdge {
  const forward: FlowEdge = {
    to,
    reverseIndex: graph[to].length,
    capacity,
  };
  const reverse: FlowEdge = {
    to: from,
    reverseIndex: graph[from].length,
    capacity: 0,
  };
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
}

function findAugmentingPath(
  graph: FlowEdge[][],
  source: number,
  sink: number,
): { readonly parentNodes: number[]; readonly parentEdges: number[] } | null {
  const parentNodes = Array(graph.length).fill(-1);
  const parentEdges = Array(graph.length).fill(-1);
  const queue = [source];
  parentNodes[source] = source;

  for (let cursor = 0; cursor < queue.length && parentNodes[sink] === -1; cursor++) {
    const node = queue[cursor];
    for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex++) {
      const edge = graph[node][edgeIndex];
      if (edge.capacity <= 0 || parentNodes[edge.to] !== -1) continue;
      parentNodes[edge.to] = node;
      parentEdges[edge.to] = edgeIndex;
      queue.push(edge.to);
      if (edge.to === sink) break;
    }
  }

  return parentNodes[sink] === -1 ? null : { parentNodes, parentEdges };
}

function allocateRequirements(
  state: MutableInventoryState,
  requirements: readonly IngredientRequirement[],
  catalog: CraftingItemCatalog,
): boolean {
  const slots: InventorySlotReference[] = [];
  for (const zone of [state.hotbar, state.inventory]) {
    for (let index = 0; index < zone.length; index++) {
      const stack = zone[index];
      if (stack && stack.count > 0) slots.push({ zone, index, stack });
    }
  }

  const source = 0;
  const slotOffset = 1;
  const requirementOffset = slotOffset + slots.length;
  const sink = requirementOffset + requirements.length;
  const graph: FlowEdge[][] = Array.from({ length: sink + 1 }, () => []);
  const sourceEdges = slots.map((slot, slotIndex) =>
    addFlowEdge(graph, source, slotOffset + slotIndex, slot.stack.count),
  );

  for (let requirementIndex = 0; requirementIndex < requirements.length; requirementIndex++) {
    const requirement = requirements[requirementIndex];
    const requirementNode = requirementOffset + requirementIndex;
    addFlowEdge(graph, requirementNode, sink, requirement.count);

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex];
      if (matchesRequirement(slot.stack, requirement, catalog)) {
        addFlowEdge(
          graph,
          slotOffset + slotIndex,
          requirementNode,
          Math.min(slot.stack.count, requirement.count),
        );
      }
    }
  }

  const totalRequired = requirements.reduce((total, requirement) => total + requirement.count, 0);
  let allocated = 0;

  // Edmonds-Karp is deterministic here and bounded by slots plus recipe inputs: O(V * E^2).
  while (allocated < totalRequired) {
    const path = findAugmentingPath(graph, source, sink);
    if (!path) return false;

    let pathCapacity = Number.POSITIVE_INFINITY;
    for (let node = sink; node !== source; node = path.parentNodes[node]) {
      const parentNode = path.parentNodes[node];
      const edge = graph[parentNode][path.parentEdges[node]];
      pathCapacity = Math.min(pathCapacity, edge.capacity);
    }

    for (let node = sink; node !== source; node = path.parentNodes[node]) {
      const parentNode = path.parentNodes[node];
      const edge = graph[parentNode][path.parentEdges[node]];
      edge.capacity -= pathCapacity;
      graph[node][edge.reverseIndex].capacity += pathCapacity;
    }
    allocated += pathCapacity;
  }

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    const slot = slots[slotIndex];
    const consumed = slot.stack.count - sourceEdges[slotIndex].capacity;
    if (consumed <= 0) continue;
    const nextCount = slot.stack.count - consumed;
    slot.zone[slot.index] = nextCount > 0 ? { ...slot.stack, count: nextCount } : null;
  }

  return true;
}

function insertStack(
  state: MutableInventoryState,
  output: ItemStack,
  catalog: CraftingItemCatalog,
): boolean {
  let remaining = output.count;
  const maxStackSize = catalog.getMaxStackSize(output.type);
  const zones = [state.hotbar, state.inventory];

  for (const zone of zones) {
    for (let index = 0; index < zone.length && remaining > 0; index++) {
      const stack = zone[index];
      if (!stack || stack.type !== output.type || stack.count >= maxStackSize) continue;
      const inserted = Math.min(maxStackSize - stack.count, remaining);
      zone[index] = { ...stack, count: stack.count + inserted };
      remaining -= inserted;
    }
  }

  for (const zone of zones) {
    for (let index = 0; index < zone.length && remaining > 0; index++) {
      if (zone[index] !== null) continue;
      const inserted = Math.min(maxStackSize, remaining);
      zone[index] = { type: output.type, count: inserted };
      remaining -= inserted;
    }
  }

  return remaining === 0;
}

export function executeCraftingTransaction(
  inventory: InventoryState,
  inputs: readonly IngredientRequirement[],
  outputs: readonly ItemStack[],
  catalog: CraftingItemCatalog,
): { readonly ok: true; readonly inventory: InventoryState } | { readonly ok: false; readonly reason: 'missing_ingredients' | 'inventory_full' } {
  const working = cloneInventory(inventory);
  if (!allocateRequirements(working, inputs, catalog)) {
    return { ok: false, reason: 'missing_ingredients' };
  }

  for (const output of outputs) {
    if (!insertStack(working, output, catalog)) {
      return { ok: false, reason: 'inventory_full' };
    }
  }

  return { ok: true, inventory: working };
}
