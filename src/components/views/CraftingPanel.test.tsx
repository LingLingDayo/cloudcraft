import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { GameMode, ItemType } from '@type';
import { useGameStore } from '@store/useGameStore';
import { coreCraftingService } from '@game/fabrication/CraftingRuntime';
import { CraftingPanel } from './CraftingPanel';
import { Inventory } from './Inventory';

vi.mock('@i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'fabrication.title': '工序合成',
      'fabrication.craft': '制作',
      'items.sandstone': '砂岩',
      'items.glass': '玻璃',
    }[key] ?? key),
  }),
}));

vi.mock('./ItemIcon', () => ({
  BlockIcon: ({ itemId }: { itemId: string }) => <span data-testid={`icon-${itemId}`} />,
}));

vi.mock('@context/GameContext', () => ({
  useGame: () => null,
}));

vi.mock('@components/common/Dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('CraftingPanel', () => {
  test('shows recipes supported by the current capabilities and dispatches craft commands', () => {
    const onCraft = vi.fn();
    render(
      <CraftingPanel
        hotbar={[{ type: ItemType.SAND, count: 4 }, null]}
        inventory={[null]}
        capabilities={['cloudcraft:hand_assembly']}
        onCraft={onCraft}
      />,
    );

    const craftButton = screen.getByRole('button', { name: '制作 砂岩' });
    expect(craftButton).toBeEnabled();
    expect(screen.queryByRole('button', { name: '制作 items.glass' })).not.toBeInTheDocument();
    fireEvent.click(craftButton);
    expect(onCraft).toHaveBeenCalledWith('cloudcraft:sandstone');
  });

  test('shows every output produced by a recipe', () => {
    vi.spyOn(coreCraftingService, 'getRecipes').mockReturnValue([{
      id: 'cloudcraft:test_multi_output',
      inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 2 }],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [
        { type: ItemType.SANDSTONE, count: 1 },
        { type: ItemType.GLASS, count: 2 },
      ],
    }]);
    vi.spyOn(coreCraftingService, 'canCraft').mockReturnValue(true);

    render(
      <CraftingPanel
        hotbar={[{ type: ItemType.SAND, count: 2 }, null]}
        inventory={[null]}
        capabilities={['cloudcraft:hand_assembly']}
        onCraft={vi.fn()}
      />,
    );

    expect(screen.getByText('砂岩')).toBeInTheDocument();
    expect(screen.getByText('玻璃')).toBeInTheDocument();
    expect(screen.getByText('x2')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});

describe('Inventory crafting tab', () => {
  test('keeps fixture crafting visible when the creative tab is selected', () => {
    useGameStore.setState({
      gameMode: GameMode.CREATIVE,
      isInventoryOpen: true,
      activeFixtureId: 'fixture-fabricator',
      craftingCapabilities: ['cloudcraft:shape'],
    });
    render(<Inventory />);

    fireEvent.click(screen.getByRole('button', { name: 'inventory.tabAllItems' }));

    expect(screen.getByText('inventory.labelInventory')).toBeInTheDocument();
    expect(screen.queryByText('inventory.hintCreative')).not.toBeInTheDocument();
  });

  test('does not grant hand crafting to an active fixture with no capabilities', () => {
    useGameStore.setState({
      gameMode: GameMode.CREATIVE,
      isInventoryOpen: true,
      activeFixtureId: 'fixture-empty',
      craftingCapabilities: [],
    });
    render(<Inventory />);

    expect(screen.queryByRole('button', { name: '制作 砂岩' })).not.toBeInTheDocument();
  });
});
