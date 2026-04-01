const MOSCOW_UTC_OFFSET = "+03:00";
const LOCAL_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d{1,6})?$/;

const pad = (value, length = 2) => String(value).padStart(length, "0");

const toDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const recoverTimestampWallClock = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);

export const serializeMoscowTimestamp = (value) => {
  if (value === null || value === undefined || value === "") {
    return value ?? null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(LOCAL_TIMESTAMP_PATTERN);
    if (match) {
      const [, datePart, timePart, fractionPart = ".000"] = match;
      const milliseconds = `${fractionPart.slice(1)}000`.slice(0, 3);
      return `${datePart}T${timePart}.${milliseconds}${MOSCOW_UTC_OFFSET}`;
    }
  }

  const date = toDate(value);
  if (!date) {
    return value;
  }

  const wallClock = recoverTimestampWallClock(date);
  const year = wallClock.getUTCFullYear();
  const month = pad(wallClock.getUTCMonth() + 1);
  const day = pad(wallClock.getUTCDate());
  const hours = pad(wallClock.getUTCHours());
  const minutes = pad(wallClock.getUTCMinutes());
  const seconds = pad(wallClock.getUTCSeconds());
  const milliseconds = pad(wallClock.getUTCMilliseconds(), 3);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${MOSCOW_UTC_OFFSET}`;
};

export const serializeCartOrderTimestamps = (order) => {
  if (!order || typeof order !== "object") {
    return order;
  }

  const {
    created_at_raw,
    updated_at_raw,
    provider_synced_at_raw,
    ...rest
  } = order;

  return {
    ...rest,
    created_at: serializeMoscowTimestamp(created_at_raw ?? order.created_at),
    updated_at: serializeMoscowTimestamp(updated_at_raw ?? order.updated_at),
    provider_synced_at: serializeMoscowTimestamp(
      provider_synced_at_raw ?? order.provider_synced_at,
    ),
  };
};
