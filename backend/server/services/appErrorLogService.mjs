import { ADMIN_ROLE_VALUES, ADMIN_TELEGRAM_IDS } from "../config.mjs";
import { query, queryMany, queryOne } from "../postgresClient.mjs";
import { fetchAdminRecordByTelegram, getTelegramIdFromRequest } from "./adminService.mjs";

const ERROR_LOG_STATUS_VALUES = new Set(["new", "resolved"]);
const LOG_LEVEL_VALUES = new Set(["debug", "info", "warn", "error"]);
const ERROR_LOG_SEVERITY_VALUES = new Set(["critical", "high", "medium", "low"]);

const truncate = (value, maxLength = 1000) => {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }
  return stringValue.length > maxLength ? stringValue.slice(0, maxLength) : stringValue;
};

const parseBigIntValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.trunc(numeric);
};

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getRequestHeader = (req, name) => {
  if (!req || typeof req.get !== "function") {
    return null;
  }
  return req.get(name);
};

const getNestedValue = (value, path) => {
  let current = value;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return null;
    }
    current = current[segment];
  }
  return current ?? null;
};

const ensureSerializable = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (depth > 5) {
    return "[MaxDepth]";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => ensureSerializable(item, depth + 1, seen));
  }
  if (typeof value === "function") {
    return "[Function]";
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const result = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, 100)) {
      result[key] = ensureSerializable(nestedValue, depth + 1, seen);
    }
    seen.delete(value);
    return result;
  }
  return String(value);
};

const toJsonString = (value, fallback = {}) => {
  try {
    return JSON.stringify(ensureSerializable(value ?? fallback));
  } catch {
    return JSON.stringify(fallback);
  }
};

const parseJsonField = (value, fallback) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

const normalizeStatus = (value) => {
  const normalized = truncate(value, 20);
  if (!normalized) {
    return "new";
  }
  return ERROR_LOG_STATUS_VALUES.has(normalized) ? normalized : "new";
};

const normalizeLevel = (value) => {
  const normalized = truncate(value, 20);
  if (!normalized) {
    return "error";
  }
  return LOG_LEVEL_VALUES.has(normalized) ? normalized : "error";
};

const normalizeSeverity = (value) => {
  const normalized = truncate(value, 20);
  if (!normalized) {
    return "high";
  }
  return ERROR_LOG_SEVERITY_VALUES.has(normalized) ? normalized : "high";
};

const normalizeSeverityFilter = (value) => {
  const normalized = truncate(value, 20);
  if (!normalized) {
    return null;
  }
  return ERROR_LOG_SEVERITY_VALUES.has(normalized) ? normalized : null;
};

const buildComparableText = (value) => String(value ?? "").trim().toLowerCase();

const buildPayloadSearchText = (payload) => {
  try {
    return JSON.stringify(ensureSerializable(payload ?? {})).toLowerCase();
  } catch {
    return "";
  }
};

const extractPayloadStatusCode = (payload) => {
  const candidates = [
    getNestedValue(payload, ["data", "status"]),
    getNestedValue(payload, ["status"]),
    getNestedValue(payload, ["data", "apiError", "status"]),
    getNestedValue(payload, ["data", "apiNetworkError", "status"]),
    getNestedValue(payload, ["data", "details", "status"]),
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      return Math.trunc(numeric);
    }
  }

  return null;
};

const resolveErrorLogSeverity = ({ source, level, category, message, errorName, payload }) => {
  const normalizedSource = buildComparableText(source);
  const normalizedCategory = buildComparableText(category);
  const normalizedMessage = buildComparableText(message);
  const normalizedErrorName = buildComparableText(errorName);
  const payloadText = buildPayloadSearchText(payload);
  const combinedText = [
    normalizedCategory,
    normalizedMessage,
    normalizedErrorName,
    payloadText,
  ]
    .filter(Boolean)
    .join(" ");
  const statusCode = extractPayloadStatusCode(payload);

  const isBookingOutage =
    (normalizedCategory === "booking-api" || normalizedCategory === "api") &&
    (combinedText.includes("/api/booking/") ||
      combinedText.includes("get_slots_error") ||
      combinedText.includes("сервис бронирования временно недоступен") ||
      combinedText.includes("load failed"));

  if (isBookingOutage) {
    return "critical";
  }

  const isIikoOperationalIssue =
    normalizedSource === "backend" &&
    (normalizedCategory.startsWith("iiko") ||
      combinedText.includes("iiko") ||
      combinedText.includes("/api/1/access_token"));

  if (isIikoOperationalIssue) {
    return "high";
  }

  const isAdminUnauthorizedProbe =
    normalizedCategory === "admin-api" &&
    normalizedMessage === "getcurrentadmin error" &&
    (statusCode === 401 || statusCode === 403 || combinedText.includes("не удалось определить администратора"));

  if (isAdminUnauthorizedProbe) {
    return "low";
  }

  const isUnsupportedTelegramClientApi =
    normalizedCategory === "console" && combinedText.includes("not supported in version");

  if (isUnsupportedTelegramClientApi) {
    return "low";
  }

  const isClipboardPlatformLimitation =
    combinedText.includes("clipboard_unavailable") ||
    combinedText.includes("notallowederror") ||
    combinedText.includes("ошибка копирования");

  if (isClipboardPlatformLimitation) {
    return "low";
  }

  const isPermissionOrAccessIssue =
    statusCode === 403 ||
    combinedText.includes("недостаточно прав") ||
    combinedText.includes("forbidden");

  if (isPermissionOrAccessIssue) {
    return "medium";
  }

  if (level === "debug" || level === "info") {
    return "low";
  }

  if (level === "warn") {
    return "medium";
  }

  return "high";
};

const resolveProfileName = async ({ userId, telegramId, vkId }) => {
  const conditions = [];
  const params = [];

  if (userId) {
    params.push(userId);
    conditions.push(`id = $${params.length}`);
  }

  if (telegramId) {
    params.push(telegramId);
    conditions.push(`telegram_id = $${params.length}`);
  }

  if (vkId) {
    params.push(vkId);
    conditions.push(`vk_id = $${params.length}`);
  }

  if (!conditions.length) {
    return null;
  }

  const row = await queryOne(
    `SELECT id, name, telegram_id, vk_id
     FROM user_profiles
     WHERE ${conditions.join(" OR ")}
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`,
    params,
  );

  return row?.name ? String(row.name) : null;
};

const resolveRoleAndAdminName = async (telegramId) => {
  if (!telegramId) {
    return { role: "user", adminName: null };
  }

  const normalizedId = String(telegramId);
  if (ADMIN_TELEGRAM_IDS.has(normalizedId)) {
    return { role: "super_admin", adminName: null };
  }

  const record = await fetchAdminRecordByTelegram(normalizedId);
  if (!record) {
    return { role: "user", adminName: null };
  }

  const role = ADMIN_ROLE_VALUES.has(record.role) ? record.role : "user";
  return {
    role,
    adminName: record.name ? String(record.name) : null,
  };
};

const mapErrorLogRow = (row) => {
  const payload = parseJsonField(row.payload, {});
  const status = normalizeStatus(row.status);
  const source = row.source ?? "frontend";
  const level = normalizeLevel(row.level);
  const category = row.category ?? "app";
  const message = row.message ?? "Ошибка";
  const errorName = row.error_name ?? null;

  return {
    id: row.id,
    status,
    source,
    level,
    severity: normalizeSeverity(
      resolveErrorLogSeverity({
        source,
        level,
        category,
        message,
        errorName,
        payload,
      }),
    ),
    category,
    message,
    errorName,
    errorStack: row.error_stack ?? null,
    payload,
    userId: row.user_id ?? null,
    userName: row.user_name ?? null,
    telegramId: row.telegram_id ? String(row.telegram_id) : null,
    vkId: row.vk_id ? String(row.vk_id) : null,
    role: row.role ?? "user",
    platform: row.platform ?? null,
    pathname: row.pathname ?? null,
    pageUrl: row.page_url ?? null,
    sessionId: row.session_id ?? null,
    userAgent: row.user_agent ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedByTelegramId: row.resolved_by_telegram_id ? String(row.resolved_by_telegram_id) : null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
};

const buildSearchClause = (search, params) => {
  const normalizedSearch = truncate(search, 200);
  if (!normalizedSearch) {
    return "";
  }
  params.push(`%${normalizedSearch.toLowerCase()}%`);
  const placeholder = `$${params.length}`;
  return `
    AND (
      LOWER(COALESCE(message, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(category, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(user_name, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(role, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(pathname, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(platform, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(error_name, '')) LIKE ${placeholder}
    )
  `;
};

const buildErrorLogFilters = ({ status = null, search = null } = {}) => {
  const params = [];
  let filters = "WHERE 1 = 1";

  if (status && ERROR_LOG_STATUS_VALUES.has(status)) {
    params.push(status);
    filters += ` AND status = $${params.length}`;
  }

  filters += buildSearchClause(search, params);
  return { filters, params };
};

const insertAppErrorLog = async ({ req = null, payload }) => {
  const entry = isPlainObject(payload) ? payload : {};
  const telegramId = parseBigIntValue(
    (req ? getTelegramIdFromRequest(req) : null) ?? entry.telegramId,
  );
  const vkId = parseBigIntValue(getRequestHeader(req, "x-vk-id") ?? entry.vkId);
  const userId = truncate(entry.userId, 255);
  const explicitRole = truncate(entry.role, 50);
  const roleInfo = explicitRole
    ? { role: explicitRole, adminName: null }
    : await resolveRoleAndAdminName(telegramId);
  const profileName =
    roleInfo.role === "system" ? null : await resolveProfileName({ userId, telegramId, vkId });
  const userName =
    truncate(entry.userName, 255) ??
    roleInfo.adminName ??
    profileName ??
    (roleInfo.role === "system" ? "Система" : null);

  const errorInfo = isPlainObject(entry.error) ? entry.error : {};
  const level = normalizeLevel(entry.level);
  const category = truncate(entry.category, 100) ?? "app";
  const message =
    truncate(entry.message, 4000) ??
    truncate(errorInfo.message, 4000) ??
    "Ошибка приложения";
  const source = truncate(entry.source, 50) ?? "frontend";
  const platform = truncate(entry.platform, 20) ?? null;
  const pathname = truncate(entry.pathname, 1000) ?? null;
  const pageUrl = truncate(entry.pageUrl, 2000) ?? null;
  const sessionId = truncate(entry.sessionId, 255) ?? null;
  const userAgent =
    truncate(entry.userAgent ?? getRequestHeader(req, "user-agent"), 1000) ??
    (source === "backend" ? "backend" : null);

  const row = await queryOne(
    `INSERT INTO app_error_logs (
      status,
      source,
      level,
      category,
      message,
      error_name,
      error_stack,
      payload,
      user_id,
      user_name,
      telegram_id,
      vk_id,
      role,
      platform,
      pathname,
      page_url,
      session_id,
      user_agent,
      created_at,
      updated_at
    ) VALUES (
      'new',
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      $16,
      $17,
      NOW(),
      NOW()
    )
    RETURNING *`,
    [
      source,
      level,
      category,
      message,
      truncate(errorInfo.name, 255),
      truncate(errorInfo.stack, 12000),
      toJsonString(entry, {}),
      userId,
      userName,
      telegramId,
      vkId,
      roleInfo.role,
      platform,
      pathname,
      pageUrl,
      sessionId,
      userAgent,
    ],
  );

  return mapErrorLogRow(row);
};

export const createAppErrorLog = async (req, payload) => insertAppErrorLog({ req, payload });

export const createSystemAppErrorLog = async (payload) =>
  insertAppErrorLog({
    payload: {
      source: "backend",
      role: "system",
      userName: "Система",
      userAgent: "backend",
      ...payload,
    },
  });

const filterLogsBySeverity = (logs, severity) => {
  const normalizedSeverity = normalizeSeverityFilter(severity);
  if (!normalizedSeverity) {
    return logs;
  }
  return logs.filter((log) => log.severity === normalizedSeverity);
};

export const listAppErrorLogs = async ({ status = null, search = null, severity = null, limit = 200 } = {}) => {
  const { filters, params } = buildErrorLogFilters({ status, search });
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  params.push(safeLimit);

  const rows = await queryMany(
    `SELECT *
     FROM app_error_logs
     ${filters}
     ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const countRows = await queryMany(
    `SELECT status, COUNT(*)::int AS count
     FROM app_error_logs
     GROUP BY status`,
  );

  const counts = {
    total: 0,
    new: 0,
    resolved: 0,
  };

  for (const row of countRows) {
    const rowStatus = normalizeStatus(row.status);
    const rowCount = Number(row.count) || 0;
    counts.total += rowCount;
    if (rowStatus === "new") {
      counts.new = rowCount;
    }
    if (rowStatus === "resolved") {
      counts.resolved = rowCount;
    }
  }

  const mappedLogs = rows.map(mapErrorLogRow);

  return {
    logs: filterLogsBySeverity(mappedLogs, severity),
    counts,
  };
};

export const exportAppErrorLogs = async ({ status = null, search = null, severity = null, limit = 1000 } = {}) => {
  const { filters, params } = buildErrorLogFilters({ status, search });
  const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
  params.push(safeLimit);

  const rows = await queryMany(
    `SELECT *
     FROM app_error_logs
     ${filters}
     ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const mappedLogs = filterLogsBySeverity(rows.map(mapErrorLogRow), severity);

  return {
    exportedAt: new Date().toISOString(),
    status: status && ERROR_LOG_STATUS_VALUES.has(status) ? status : null,
    search: truncate(search, 200) ?? null,
    severity: normalizeSeverityFilter(severity),
    limit: safeLimit,
    count: mappedLogs.length,
    logs: mappedLogs,
  };
};

export const formatAppErrorLogsAsText = (report) => {
  const lines = [
    "Журнал ошибок приложения",
    `Сформирован: ${report?.exportedAt ?? new Date().toISOString()}`,
    `Статус: ${report?.status ?? "all"}`,
    `Поиск: ${report?.search ?? "-"}`,
    `Критичность: ${report?.severity ?? "all"}`,
    `Количество: ${Number(report?.count) || 0}`,
    "",
  ];

  const logs = Array.isArray(report?.logs) ? report.logs : [];
  for (const [index, log] of logs.entries()) {
    lines.push(`#${index + 1}`);
    lines.push(`ID: ${log?.id ?? "-"}`);
    lines.push(`Статус: ${log?.status ?? "-"}`);
    lines.push(`Уровень: ${log?.level ?? "-"}`);
    lines.push(`Критичность: ${log?.severity ?? "-"}`);
    lines.push(`Категория: ${log?.category ?? "-"}`);
    lines.push(`Сообщение: ${log?.message ?? "-"}`);
    lines.push(`Ошибка: ${log?.errorName ?? "-"}`);
    lines.push(`Роль: ${log?.role ?? "-"}`);
    lines.push(`Пользователь: ${log?.userName ?? "-"}`);
    lines.push(`Telegram ID: ${log?.telegramId ?? "-"}`);
    lines.push(`VK ID: ${log?.vkId ?? "-"}`);
    lines.push(`Платформа: ${log?.platform ?? "-"}`);
    lines.push(`Страница: ${log?.pathname ?? "-"}`);
    lines.push(`URL: ${log?.pageUrl ?? "-"}`);
    lines.push(`Сессия: ${log?.sessionId ?? "-"}`);
    lines.push(`Создано: ${log?.createdAt ?? "-"}`);
    lines.push(`Обновлено: ${log?.updatedAt ?? "-"}`);
    lines.push(`Решено: ${log?.resolvedAt ?? "-"}`);
    lines.push(`Кем решено: ${log?.resolvedByTelegramId ?? "-"}`);
    lines.push(`User-Agent: ${log?.userAgent ?? "-"}`);
    lines.push("Payload:");
    lines.push(JSON.stringify(log?.payload ?? {}, null, 2));
    if (log?.errorStack) {
      lines.push("Stack:");
      lines.push(String(log.errorStack));
    }
    lines.push("");
  }

  return lines.join("\n");
};

export const updateAppErrorLogStatus = async ({ id, status, resolvedByTelegramId = null }) => {
  const normalizedStatus = normalizeStatus(status);
  const row = await queryOne(
    `UPDATE app_error_logs
     SET status = $2::varchar(20),
         resolved_at = CASE WHEN $2::varchar(20) = 'resolved' THEN NOW() ELSE NULL END,
         resolved_by_telegram_id = CASE WHEN $2::varchar(20) = 'resolved' THEN $3::bigint ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, normalizedStatus, parseBigIntValue(resolvedByTelegramId)],
  );

  if (!row) {
    return null;
  }

  return mapErrorLogRow(row);
};
