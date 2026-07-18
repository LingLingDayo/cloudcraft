import { useState, type FC } from 'react';
import type { ItemStack } from '@type';
import { useTranslation } from '@i18n';
import { coreCraftingService } from '@game/fabrication/CraftingRuntime';
import { BlockIcon } from './ItemIcon';
import styles from './CraftingPanel.module.scss';

interface CraftingPanelProps {
  readonly hotbar: readonly (ItemStack | null)[];
  readonly inventory: readonly (ItemStack | null)[];
  readonly capabilities: readonly string[];
  readonly onCraft: (recipeId: string) => void;
}

function getRecipeDetailId(recipeId: string): string {
  return `crafting-recipe-${recipeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export const CraftingPanel: FC<CraftingPanelProps> = ({
  hotbar,
  inventory,
  capabilities,
  onCraft,
}) => {
  const { t } = useTranslation();
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const capabilitySet = new Set(capabilities);
  const recipes = coreCraftingService.getRecipes().filter(recipe =>
    recipe.steps.every(step => capabilitySet.has(step.capability)),
  );
  const recipeViews = recipes.map(recipe => ({
    recipe,
    outputNames: recipe.outputs.map(output => t(`items.${output.type}`)),
    craftable: coreCraftingService.canCraft(
      recipe.id,
      { hotbar, inventory },
      capabilitySet,
    ),
  }));
  const activeRecipeView = recipeViews.find(({ recipe }) => recipe.id === activeRecipeId);

  return (
    <section className={styles.panel} aria-labelledby="crafting-panel-title">
      <div className={styles.header}>
        <h3 id="crafting-panel-title" className={styles.title}>{t('fabrication.title')}</h3>
        <span className={styles.hint}>{t('fabrication.hoverHint')}</span>
      </div>
      <div className={styles.recipeGrid}>
        {recipeViews.map(({ recipe, outputNames, craftable }) => {
          const isDetailVisible = activeRecipeId === recipe.id;
          const primaryOutput = recipe.outputs[0];
          const detailId = getRecipeDetailId(recipe.id);

          return (
            <div
              className={styles.recipeEntry}
              key={recipe.id}
              onMouseEnter={() => setActiveRecipeId(recipe.id)}
              onMouseLeave={() => setActiveRecipeId(null)}
            >
              <button
                type="button"
                className={`${styles.recipeSlot} ${craftable ? '' : styles.unavailable}`}
                aria-label={`${t('fabrication.craft')} ${outputNames[0]}`}
                aria-describedby={isDetailVisible ? detailId : undefined}
                aria-disabled={!craftable}
                aria-expanded={isDetailVisible}
                onBlur={() => setActiveRecipeId(null)}
                onClick={() => craftable && onCraft(recipe.id)}
                onFocus={() => setActiveRecipeId(recipe.id)}
              >
                <BlockIcon itemId={primaryOutput.type} size={26} className={styles.outputIcon} />
                {primaryOutput.count > 1 && (
                  <span className={styles.outputCount}>×{primaryOutput.count}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {activeRecipeView && (
        <div
          id={getRecipeDetailId(activeRecipeView.recipe.id)}
          className={styles.recipeDetail}
          role="tooltip"
        >
          <div className={styles.outputs}>
            {activeRecipeView.recipe.outputs.map((output, index) => (
              <div className={styles.output} key={`${output.type}-${index}`}>
                <BlockIcon itemId={output.type} size={24} className={styles.detailIcon} />
                <span className={styles.outputName}>{activeRecipeView.outputNames[index]}</span>
                {output.count > 1 && (
                  <span className={styles.detailCount}>×{output.count}</span>
                )}
              </div>
            ))}
          </div>
          <div className={styles.ingredientTitle}>{t('fabrication.ingredients')}</div>
          <ul className={styles.ingredients}>
            {activeRecipeView.recipe.inputs.map((input, index) => (
              <li className={styles.ingredient} key={`${activeRecipeView.recipe.id}-${index}`}>
                <span>{input.selector.itemType
                  ? t(`items.${input.selector.itemType}`)
                  : t(`itemTags.${input.selector.tag}`)}</span>
                <span>×{input.count}</span>
              </li>
            ))}
          </ul>
          <div className={`${styles.craftState} ${activeRecipeView.craftable ? styles.ready : ''}`}>
            {t(activeRecipeView.craftable
              ? 'fabrication.ready'
              : 'fabrication.missingIngredients')}
          </div>
        </div>
      )}
    </section>
  );
};
