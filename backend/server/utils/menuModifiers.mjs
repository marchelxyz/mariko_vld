const toTrimmedString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseMaybeJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return [];
  }

  const raw = value.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeMoneyValue = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const resolveModifierOptionPrice = (modifier) => {
  const directPrice = Number(modifier?.price);
  if (Number.isFinite(directPrice)) {
    return normalizeMoneyValue(directPrice);
  }

  const currentPrice = Number(modifier?.price?.currentPrice);
  if (Number.isFinite(currentPrice)) {
    return normalizeMoneyValue(currentPrice);
  }

  const additionalPrice = Number(modifier?.additionalPrice);
  if (Number.isFinite(additionalPrice)) {
    return normalizeMoneyValue(additionalPrice);
  }

  return 0;
};

const normalizeModifierOption = (rawOption, options = {}) => {
  const resolveOptionName =
    typeof options.resolveModifierName === "function" ? options.resolveModifierName : () => "";
  const resolveOptionPrice =
    typeof options.resolveModifierPrice === "function"
      ? options.resolveModifierPrice
      : () => undefined;
  const id =
    toTrimmedString(rawOption?.id) ||
    toTrimmedString(rawOption?.productId) ||
    toTrimmedString(rawOption?.optionId);
  const name =
    toTrimmedString(rawOption?.name) ||
    toTrimmedString(rawOption?.optionName) ||
    toTrimmedString(rawOption?.productName) ||
    toTrimmedString(resolveOptionName(id));

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    price:
      resolveOptionPrice(id) !== undefined
        ? normalizeMoneyValue(resolveOptionPrice(id))
        : resolveModifierOptionPrice(rawOption),
    isDefault:
      rawOption?.isDefault === true || normalizeMoneyValue(rawOption?.defaultAmount) > 0,
    isActive: rawOption?.isDeleted !== true && rawOption?.isIncludedInMenu !== false,
  };
};

const normalizeModifierGroup = (rawGroup, options = {}) => {
  const resolveGroupName =
    typeof options.resolveGroupName === "function" ? options.resolveGroupName : () => "";

  const id =
    toTrimmedString(rawGroup?.id) ||
    toTrimmedString(rawGroup?.modifierGroupId) ||
    toTrimmedString(rawGroup?.productGroupId) ||
    toTrimmedString(rawGroup?.groupId);
  const name =
    toTrimmedString(rawGroup?.name) ||
    toTrimmedString(rawGroup?.modifierGroupName) ||
    toTrimmedString(resolveGroupName(id));

  const minAmountRaw = Number(rawGroup?.minAmount);
  const maxAmountRaw = Number(rawGroup?.maxAmount);
  const minAmount = Number.isFinite(minAmountRaw) && minAmountRaw >= 0 ? minAmountRaw : 0;
  const maxAmount =
    Number.isFinite(maxAmountRaw) && maxAmountRaw > 0 ? maxAmountRaw : 1;
  const required = rawGroup?.required === true || minAmount > 0;
  const optionsList = asArray(rawGroup?.options ?? rawGroup?.childModifiers)
    .map((entry) => normalizeModifierOption(entry, options))
    .filter(Boolean)
    .filter((entry) => entry.isActive !== false);

  if (!id || !name || optionsList.length === 0) {
    return null;
  }

  return {
    id,
    name,
    required,
    minAmount,
    maxAmount,
    options: optionsList,
  };
};

export const normalizeMenuModifierGroups = (rawValue) =>
  parseMaybeJsonArray(rawValue)
    .map((entry) => normalizeModifierGroup(entry))
    .filter(Boolean);

export const normalizeSelectedOrderModifiers = (rawValue) =>
  parseMaybeJsonArray(rawValue)
    .map((entry) => {
      const groupId =
        toTrimmedString(entry?.groupId) ||
        toTrimmedString(entry?.productGroupId) ||
        toTrimmedString(entry?.iikoModifierGroupId);
      const optionId =
        toTrimmedString(entry?.optionId) ||
        toTrimmedString(entry?.productId) ||
        toTrimmedString(entry?.id) ||
        toTrimmedString(entry?.iikoModifierId);

      if (!groupId || !optionId) {
        return null;
      }

      return {
        groupId,
        groupName: toTrimmedString(entry?.groupName) || undefined,
        optionId,
        optionName:
          toTrimmedString(entry?.optionName) ||
          toTrimmedString(entry?.name) ||
          undefined,
        price: normalizeMoneyValue(entry?.price),
      };
    })
    .filter(Boolean);

export const extractSupportedIikoModifierGroups = (product, options = {}) => {
  const supportedGroups = [];
  const unsupportedGroups = [];

  for (const rawGroup of asArray(product?.groupModifiers)) {
    const normalizedGroup = normalizeModifierGroup(rawGroup, options);
    const minAmountRaw = Number(rawGroup?.minAmount);
    const maxAmountRaw = Number(rawGroup?.maxAmount);
    const minAmount = Number.isFinite(minAmountRaw) && minAmountRaw >= 0 ? minAmountRaw : 0;
    const maxAmount = Number.isFinite(maxAmountRaw) && maxAmountRaw > 0 ? maxAmountRaw : 1;
    const required = rawGroup?.required === true || minAmount > 0;

    if (!normalizedGroup) {
      unsupportedGroups.push({
        id:
          toTrimmedString(rawGroup?.id) ||
          toTrimmedString(rawGroup?.modifierGroupId) ||
          toTrimmedString(rawGroup?.productGroupId) ||
          toTrimmedString(rawGroup?.groupId),
        name:
          toTrimmedString(rawGroup?.name) ||
          toTrimmedString(rawGroup?.modifierGroupName) ||
          "",
        required,
        reason: "missing_id_name_or_options",
      });
      continue;
    }

    if (maxAmount > 1 || minAmount > 1) {
      unsupportedGroups.push({
        id: normalizedGroup.id,
        name: normalizedGroup.name,
        required,
        reason: "multi_select_not_supported",
      });
      continue;
    }

    supportedGroups.push({
      ...normalizedGroup,
      required,
      minAmount,
      maxAmount,
    });
  }

  return {
    modifierGroups: supportedGroups,
    unsupportedGroups,
  };
};

export const validateSelectedOrderModifiers = ({
  modifierGroups,
  rawSelectedModifiers,
}) => {
  const groups = normalizeMenuModifierGroups(modifierGroups);
  const selectedModifiers = normalizeSelectedOrderModifiers(rawSelectedModifiers);
  const errors = [];
  const normalizedSelected = [];
  const seenGroups = new Set();
  const groupById = new Map(groups.map((group) => [group.id, group]));

  for (const selected of selectedModifiers) {
    const group = groupById.get(selected.groupId);
    if (!group) {
      errors.push({
        reason: "unknown_modifier_group",
        groupId: selected.groupId,
      });
      continue;
    }

    if (seenGroups.has(group.id)) {
      errors.push({
        reason: "duplicate_modifier_group",
        groupId: group.id,
        groupName: group.name,
      });
      continue;
    }

    const option = group.options.find((candidate) => candidate.id === selected.optionId);
    if (!option) {
      errors.push({
        reason: "unknown_modifier_option",
        groupId: group.id,
        groupName: group.name,
        optionId: selected.optionId,
      });
      continue;
    }

    seenGroups.add(group.id);
    normalizedSelected.push({
      groupId: group.id,
      groupName: group.name,
      optionId: option.id,
      optionName: option.name,
      price: normalizeMoneyValue(option.price),
    });
  }

  for (const group of groups) {
    if (group.required !== true) {
      continue;
    }
    if (seenGroups.has(group.id)) {
      continue;
    }
    errors.push({
      reason: "missing_required_modifier_group",
      groupId: group.id,
      groupName: group.name,
    });
  }

  return {
    modifierGroups: groups,
    normalizedSelectedModifiers: normalizedSelected,
    totalModifierPrice: normalizeMoneyValue(
      normalizedSelected.reduce((sum, entry) => sum + normalizeMoneyValue(entry.price), 0),
    ),
    errors,
  };
};
