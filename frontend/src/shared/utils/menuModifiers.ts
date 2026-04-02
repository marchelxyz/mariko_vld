import type {
  MenuItem,
  MenuItemModifierGroup,
  SelectedMenuItemModifier,
} from "@shared/data";

const normalizeMoneyValue = (value: unknown): number => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const getMenuItemModifierGroups = (
  item?: MenuItem | null,
): MenuItemModifierGroup[] =>
  Array.isArray(item?.modifierGroups)
    ? item.modifierGroups.filter(
        (group): group is MenuItemModifierGroup =>
          Boolean(group?.id && group?.name && Array.isArray(group?.options) && group.options.length > 0),
      )
    : [];

export const hasSelectableModifierGroups = (item?: MenuItem | null): boolean =>
  getMenuItemModifierGroups(item).length > 0;

export const createDefaultModifierSelectionMap = (
  item?: MenuItem | null,
): Record<string, string> => {
  const nextState: Record<string, string> = {};

  for (const group of getMenuItemModifierGroups(item)) {
    const defaultOption =
      group.options.find((option) => option?.isDefault === true) ??
      (group.options.length === 1 ? group.options[0] : null);

    if (defaultOption?.id) {
      nextState[group.id] = defaultOption.id;
    }
  }

  return nextState;
};

export const resolveSelectedModifiersFromMap = (
  item: MenuItem | null | undefined,
  selectionMap: Record<string, string>,
): SelectedMenuItemModifier[] => {
  const selected: SelectedMenuItemModifier[] = [];

  for (const group of getMenuItemModifierGroups(item)) {
    const optionId = selectionMap[group.id];
    if (!optionId) {
      continue;
    }

    const option = group.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      continue;
    }

    selected.push({
      groupId: group.id,
      groupName: group.name,
      optionId: option.id,
      optionName: option.name,
      price: normalizeMoneyValue(option.price),
    });
  }

  return selected;
};

export const getMissingRequiredModifierGroups = (
  item: MenuItem | null | undefined,
  selectionMap: Record<string, string>,
): MenuItemModifierGroup[] =>
  getMenuItemModifierGroups(item).filter(
    (group) => group.required === true && !selectionMap[group.id],
  );

export const buildModifierSelectionKey = (
  modifiers?: SelectedMenuItemModifier[] | null,
): string => {
  const safeModifiers = Array.isArray(modifiers) ? modifiers : [];
  if (safeModifiers.length === 0) {
    return "base";
  }

  return safeModifiers
    .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
    .sort()
    .join("|");
};

export const getModifierSelectionExtraPrice = (
  modifiers?: SelectedMenuItemModifier[] | null,
): number =>
  normalizeMoneyValue(
    (Array.isArray(modifiers) ? modifiers : []).reduce(
      (sum, modifier) => sum + normalizeMoneyValue(modifier?.price),
      0,
    ),
  );

export const formatSelectedModifiersLabel = (
  modifiers?: SelectedMenuItemModifier[] | null,
): string => {
  const labels = (Array.isArray(modifiers) ? modifiers : [])
    .map((modifier) => String(modifier?.optionName ?? "").trim())
    .filter(Boolean);

  return labels.join(", ");
};
