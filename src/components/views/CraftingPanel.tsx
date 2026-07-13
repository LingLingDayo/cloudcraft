import type { FC } from 'react';
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

export const CraftingPanel: FC<CraftingPanelProps> = ({
  hotbar,
  inventory,
  capabilities,
  onCraft,
}) => {
  const { t } = useTranslation();
  const capabilitySet = new Set(capabilities);
  const recipes = coreCraftingService.getRecipes().filter(recipe =>
    recipe.steps.every(step => capabilitySet.has(step.capability)),
  );

  return (
    <section className={styles.panel} aria-labelledby="crafting-panel-title">
      <h3 id="crafting-panel-title" className={styles.title}>{t('fabrication.title')}</h3>
      <div className={styles.recipeList}>
        {recipes.map(recipe => {
          const outputNames = recipe.outputs.map(output => t(`items.${output.type}`));
          const craftable = coreCraftingService.canCraft(
            recipe.id,
            { hotbar, inventory },
            capabilitySet,
          );

          return (
            <div className={styles.recipeRow} key={recipe.id}>
              <div className={styles.outputs}>
                {recipe.outputs.map((output, index) => (
                  <div className={styles.output} key={`${output.type}-${index}`}>
                    <BlockIcon itemId={output.type} size={24} className={styles.outputIcon} />
                    <span className={styles.outputName}>{outputNames[index]}</span>
                    {output.count > 1 && <span className={styles.outputCount}>x{output.count}</span>}
                  </div>
                ))}
              </div>
              <div className={styles.ingredients}>
                {recipe.inputs.map((input, index) => (
                  <span className={styles.ingredient} key={`${recipe.id}-${index}`}>
                    {input.count}x {input.selector.itemType
                      ? t(`items.${input.selector.itemType}`)
                      : t(`itemTags.${input.selector.tag}`)}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className={styles.craftButton}
                disabled={!craftable}
                aria-label={`${t('fabrication.craft')} ${outputNames[0]}`}
                onClick={() => onCraft(recipe.id)}
              >
                {t('fabrication.craft')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
