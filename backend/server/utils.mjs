export const normaliseTelegramId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return String(Math.trunc(numeric));
    }
    return trimmed;
  }
  return null;
};

export const normaliseVkId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return String(Math.trunc(numeric));
    }
    return trimmed;
  }
  return null;
};

export const normaliseNullableString = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalisePhone = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
};
