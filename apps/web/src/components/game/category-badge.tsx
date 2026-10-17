import { CATEGORY_LABELS, type GameCategory } from '@everydaily/shared/domain';
import { cn } from '@/lib/cn';

/** Each category has a colour (tokens --cat-<category> and --cat-<category>-soft). */
export const categoryColor = (c: GameCategory) => `var(--cat-${c})`;

export function CategoryBadge({
  category,
  className,
}: {
  category: GameCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border-2 border-transparent px-2 py-0.5 font-display text-xs font-semibold leading-none',
        className,
      )}
      style={{ backgroundColor: `var(--cat-${category}-soft)`, color: categoryColor(category) }}
      data-category={category}
    >
      <CategoryDot category={category} />
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function CategoryDot({ category }: { category: GameCategory }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: categoryColor(category) }}
      aria-hidden
    />
  );
}
