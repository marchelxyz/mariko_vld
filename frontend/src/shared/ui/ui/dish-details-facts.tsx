type DishDetailsFactsProps = {
  weight?: string;
  calories?: string;
  proteins?: string;
  fats?: string;
  carbs?: string;
  allergens?: string[];
};

const hasText = (value?: string) => Boolean(value && value.trim());

export function DishDetailsFacts({
  weight,
  calories,
  proteins,
  fats,
  carbs,
  allergens,
}: DishDetailsFactsProps): JSX.Element | null {
  const factChips = [weight, calories].filter(hasText) as string[];
  const macroFacts = [
    hasText(proteins) ? { label: "Белки", shortLabel: "Б", value: proteins! } : null,
    hasText(fats) ? { label: "Жиры", shortLabel: "Ж", value: fats! } : null,
    hasText(carbs) ? { label: "Углеводы", shortLabel: "У", value: carbs! } : null,
  ].filter(Boolean) as Array<{ label: string; shortLabel: string; value: string }>;
  const allergenList = (allergens ?? []).filter(hasText) as string[];

  if (factChips.length === 0 && macroFacts.length === 0 && allergenList.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#e8dcc9] bg-[#faf5ee] p-4">
      <div className="space-y-3">
        {factChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {factChips.map((value) => (
              <span
                key={value}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#6f5a43] shadow-sm"
              >
                {value}
              </span>
            ))}
          </div>
        )}

        {macroFacts.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {macroFacts.map((macro) => (
              <div
                key={macro.label}
                className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b7c57]">
                  {macro.shortLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#3f2e1c]">{macro.value}</p>
              </div>
            ))}
          </div>
        )}

        {allergenList.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b7c57]">
              Аллергены
            </p>
            <div className="flex flex-wrap gap-2">
              {allergenList.map((allergen) => (
                <span
                  key={allergen}
                  className="rounded-full border border-[#ead7b8] bg-[#fff8ec] px-3 py-1 text-xs font-medium text-[#7f5d33]"
                >
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
