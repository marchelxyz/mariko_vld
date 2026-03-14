#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_TIMEOUT_MS = 30000;

const printHelp = () => {
  console.log(`
Usage:
  node scripts/iiko/onboard-network.mjs --file <path-to-json> --backend-url <url> [options]

Required:
  --file <path>              Path to JSON manifest with restaurants
  --backend-url <url>        Backend base URL, e.g. https://your-backend.up.railway.app

Authentication (choose one mode):
  --admin-telegram-id <id>   Recommended: use protected /api/admin/* endpoints
  --telegram-init-data <raw> Signed Telegram WebApp initData for strict admin auth
  --telegram-init-data-file  Path to file with signed Telegram WebApp initData
  --setup-key <key>          Legacy: use /api/db/* temporary endpoints (non-production)

Optional:
  --apply-menu-sync          Apply iiko->menu sync (default is preview mode)
  --skip-menu-sync           Do not call menu sync endpoint at all
  --dry-run                  Validate manifest only, do not call backend
  --strict                   Exit with code 1 if any restaurant has errors
  --report-file <path>       Save JSON report to file
  --timeout-ms <number>      HTTP timeout in ms (default: 30000)
  --menu-source <mode>       auto | external_menu | nomenclature (default: auto)
  --force-fresh-token        Force fresh iiko access_token for menu sync

Env fallbacks:
  BACKEND_URL, ADMIN_TELEGRAM_ID, TELEGRAM_INIT_DATA, IIKO_SETUP_KEY, IIKO_MENU_SOURCE
`);
};

const ALLOWED_MENU_SOURCES = new Set(["auto", "external_menu", "nomenclature"]);

const parseArgs = (argv) => {
  const options = {
    file: "",
    backendUrl: process.env.BACKEND_URL || "",
    setupKey: process.env.IIKO_SETUP_KEY || "",
    adminTelegramId: process.env.ADMIN_TELEGRAM_ID || "",
    telegramInitData: process.env.TELEGRAM_INIT_DATA || "",
    telegramInitDataFile: "",
    applyMenuSync: false,
    skipMenuSync: false,
    dryRun: false,
    strict: false,
    reportFile: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    menuSource: process.env.IIKO_MENU_SOURCE || "auto",
    forceFreshToken: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--apply-menu-sync") {
      options.applyMenuSync = true;
      continue;
    }
    if (arg === "--skip-menu-sync") {
      options.skipMenuSync = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--strict") {
      options.strict = true;
      continue;
    }
    if (arg === "--force-fresh-token") {
      options.forceFreshToken = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next) {
      throw new Error(`Missing value for argument ${arg}`);
    }

    if (arg === "--file") {
      options.file = next;
      i += 1;
      continue;
    }
    if (arg === "--backend-url") {
      options.backendUrl = next;
      i += 1;
      continue;
    }
    if (arg === "--setup-key") {
      options.setupKey = next;
      i += 1;
      continue;
    }
    if (arg === "--admin-telegram-id") {
      options.adminTelegramId = next;
      i += 1;
      continue;
    }
    if (arg === "--telegram-init-data") {
      options.telegramInitData = next;
      i += 1;
      continue;
    }
    if (arg === "--telegram-init-data-file") {
      options.telegramInitDataFile = next;
      i += 1;
      continue;
    }
    if (arg === "--report-file") {
      options.reportFile = next;
      i += 1;
      continue;
    }
    if (arg === "--menu-source") {
      options.menuSource = next;
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid timeout value: ${next}`);
      }
      options.timeoutMs = parsed;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const normalizeBaseUrl = (value) => String(value || "").replace(/\/+$/, "");

const parseTelegramIdFromInitData = (rawInitData) => {
  if (!rawInitData) {
    return "";
  }
  try {
    const params = new URLSearchParams(rawInitData);
    const userRaw = params.get("user");
    if (!userRaw) {
      return "";
    }
    const user = JSON.parse(userRaw);
    return user?.id ? String(user.id).trim() : "";
  } catch {
    return "";
  }
};

const buildAdminHeaders = ({ adminTelegramId, telegramInitData, contentType = null } = {}) => {
  const headers = {
    Accept: "application/json",
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (adminTelegramId) {
    headers["x-telegram-id"] = String(adminTelegramId);
  }
  if (telegramInitData) {
    headers["x-telegram-init-data"] = String(telegramInitData);
  }
  return headers;
};

const requestJson = async (url, { method = "GET", headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const errorMessage =
        payload?.message ||
        payload?.error ||
        `HTTP ${response.status} ${response.statusText}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

const normalizeRestaurant = (raw, index) => {
  const restaurantId = raw?.restaurant_id ?? raw?.restaurantId ?? "";
  const apiLogin = raw?.api_login ?? raw?.apiLogin ?? "";
  const organizationId = raw?.organization_id ?? raw?.organizationId ?? raw?.iiko_organization_id ?? "";
  const terminalGroupId = raw?.terminal_group_id ?? raw?.terminalGroupId ?? raw?.iiko_terminal_group_id ?? "";
  const deliveryTerminalId = raw?.delivery_terminal_id ?? raw?.deliveryTerminalId ?? null;
  const defaultPaymentType = raw?.default_payment_type ?? raw?.defaultPaymentType ?? null;
  const sourceKey = raw?.source_key ?? raw?.sourceKey ?? null;

  const normalized = {
    restaurantId: String(restaurantId || "").trim(),
    apiLogin: String(apiLogin || "").trim(),
    organizationId: String(organizationId || "").trim(),
    terminalGroupId: String(terminalGroupId || "").trim(),
    deliveryTerminalId: deliveryTerminalId ? String(deliveryTerminalId).trim() : null,
    defaultPaymentType: defaultPaymentType ? String(defaultPaymentType).trim() : null,
    sourceKey: sourceKey ? String(sourceKey).trim() : null,
    __index: index,
  };

  const errors = [];
  if (!normalized.restaurantId) errors.push("restaurantId is required");
  if (!normalized.apiLogin) errors.push("apiLogin is required");
  if (!normalized.organizationId) errors.push("organizationId is required");
  if (!normalized.terminalGroupId) errors.push("terminalGroupId is required");

  return { normalized, errors };
};

const loadManifest = async (filePath) => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.restaurants) ? parsed.restaurants : [];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("Manifest does not contain restaurants array");
  }

  const normalizedList = [];
  const errors = [];

  list.forEach((item, index) => {
    const { normalized, errors: itemErrors } = normalizeRestaurant(item, index);
    normalizedList.push(normalized);
    if (itemErrors.length > 0) {
      errors.push({
        restaurantId: normalized.restaurantId || `index:${index}`,
        errors: itemErrors,
      });
    }
  });

  const duplicateRestaurantIds = normalizedList
    .map((item) => item.restaurantId)
    .filter((value, index, source) => source.indexOf(value) !== index);
  if (duplicateRestaurantIds.length > 0) {
    errors.push({
      restaurantId: "manifest",
      errors: [`Duplicate restaurant IDs: ${Array.from(new Set(duplicateRestaurantIds)).join(", ")}`],
    });
  }

  return { restaurants: normalizedList, validationErrors: errors };
};

const upsertIikoConfig = async ({ backendUrl, setupKey, restaurant, timeoutMs }) => {
  const url = `${backendUrl}/api/db/add-iiko-config?key=${encodeURIComponent(setupKey)}`;
  return requestJson(url, {
    method: "POST",
    timeoutMs,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      restaurant_id: restaurant.restaurantId,
      api_login: restaurant.apiLogin,
      organization_id: restaurant.organizationId,
      terminal_group_id: restaurant.terminalGroupId,
      delivery_terminal_id: restaurant.deliveryTerminalId,
      default_payment_type: restaurant.defaultPaymentType,
      source_key: restaurant.sourceKey,
    }),
  });
};

const upsertIikoConfigAdmin = async ({
  backendUrl,
  adminTelegramId,
  telegramInitData,
  restaurant,
  timeoutMs,
}) => {
  const url = `${backendUrl}/api/admin/integrations/iiko/config`;
  return requestJson(url, {
    method: "POST",
    timeoutMs,
    headers: buildAdminHeaders({
      adminTelegramId,
      telegramInitData,
      contentType: "application/json",
    }),
    body: JSON.stringify({
      restaurantId: restaurant.restaurantId,
      apiLogin: restaurant.apiLogin,
      organizationId: restaurant.organizationId,
      terminalGroupId: restaurant.terminalGroupId,
      deliveryTerminalId: restaurant.deliveryTerminalId,
      defaultPaymentType: restaurant.defaultPaymentType,
      sourceKey: restaurant.sourceKey,
      isEnabled: true,
    }),
  });
};

const checkTerminalGroups = async ({ backendUrl, setupKey, restaurantId, timeoutMs }) => {
  const url = `${backendUrl}/api/db/check-terminal-groups?key=${encodeURIComponent(setupKey)}&restaurantId=${encodeURIComponent(restaurantId)}`;
  return requestJson(url, { method: "GET", timeoutMs });
};

const checkTerminalGroupsAdmin = async ({
  backendUrl,
  adminTelegramId,
  telegramInitData,
  restaurantId,
  timeoutMs,
}) => {
  const url = `${backendUrl}/api/admin/integrations/iiko/${encodeURIComponent(restaurantId)}/terminal-groups`;
  return requestJson(url, {
    method: "GET",
    timeoutMs,
    headers: buildAdminHeaders({ adminTelegramId, telegramInitData }),
  });
};

const checkPaymentTypes = async ({ backendUrl, setupKey, restaurantId, timeoutMs }) => {
  const url = `${backendUrl}/api/db/get-iiko-payment-types?key=${encodeURIComponent(setupKey)}&restaurantId=${encodeURIComponent(restaurantId)}`;
  return requestJson(url, { method: "GET", timeoutMs });
};

const checkPaymentTypesAdmin = async ({
  backendUrl,
  adminTelegramId,
  telegramInitData,
  restaurantId,
  timeoutMs,
}) => {
  const url = `${backendUrl}/api/admin/integrations/iiko/${encodeURIComponent(restaurantId)}/payment-types`;
  return requestJson(url, {
    method: "GET",
    timeoutMs,
    headers: buildAdminHeaders({ adminTelegramId, telegramInitData }),
  });
};

const syncMenu = async ({
  backendUrl,
  restaurantId,
  adminTelegramId,
  telegramInitData,
  applyMenuSync,
  timeoutMs,
  menuSource,
  forceFreshToken,
}) => {
  const url = `${backendUrl}/api/admin/menu/${encodeURIComponent(restaurantId)}/sync-iiko`;
  return requestJson(url, {
    method: "POST",
    timeoutMs,
    headers: buildAdminHeaders({
      adminTelegramId,
      telegramInitData,
      contentType: "application/json",
    }),
    body: JSON.stringify({
      apply: Boolean(applyMenuSync),
      includeInactive: false,
      returnMenu: false,
      menuSource,
      forceFreshToken: Boolean(forceFreshToken),
    }),
  });
};

const processRestaurant = async ({
  options,
  restaurant,
}) => {
  const hasAdminAuth = Boolean(options.adminTelegramId || options.telegramInitData);
  const result = {
    restaurantId: restaurant.restaurantId,
    configUpserted: false,
    terminalGroupsCount: null,
    paymentTypesCount: null,
    menuSync: null,
    errors: [],
  };

  try {
    if (hasAdminAuth) {
      await upsertIikoConfigAdmin({
        backendUrl: options.backendUrl,
        adminTelegramId: options.adminTelegramId,
        telegramInitData: options.telegramInitData,
        restaurant,
        timeoutMs: options.timeoutMs,
      });
    } else {
      await upsertIikoConfig({
        backendUrl: options.backendUrl,
        setupKey: options.setupKey,
        restaurant,
        timeoutMs: options.timeoutMs,
      });
    }
    result.configUpserted = true;
  } catch (error) {
    result.errors.push(`add-iiko-config failed: ${error.message}`);
    return result;
  }

  try {
    const terminalCheck = hasAdminAuth
      ? await checkTerminalGroupsAdmin({
          backendUrl: options.backendUrl,
          adminTelegramId: options.adminTelegramId,
          telegramInitData: options.telegramInitData,
          restaurantId: restaurant.restaurantId,
          timeoutMs: options.timeoutMs,
        })
      : await checkTerminalGroups({
          backendUrl: options.backendUrl,
          setupKey: options.setupKey,
          restaurantId: restaurant.restaurantId,
          timeoutMs: options.timeoutMs,
        });
    result.terminalGroupsCount = Array.isArray(terminalCheck?.terminalGroups)
      ? terminalCheck.terminalGroups.length
      : 0;
    if (!terminalCheck?.success) {
      result.errors.push(`check-terminal-groups returned success=false: ${terminalCheck?.error || "unknown error"}`);
    }
  } catch (error) {
    result.errors.push(`check-terminal-groups failed: ${error.message}`);
  }

  try {
    const paymentCheck = hasAdminAuth
      ? await checkPaymentTypesAdmin({
          backendUrl: options.backendUrl,
          adminTelegramId: options.adminTelegramId,
          telegramInitData: options.telegramInitData,
          restaurantId: restaurant.restaurantId,
          timeoutMs: options.timeoutMs,
        })
      : await checkPaymentTypes({
          backendUrl: options.backendUrl,
          setupKey: options.setupKey,
          restaurantId: restaurant.restaurantId,
          timeoutMs: options.timeoutMs,
        });
    result.paymentTypesCount = Array.isArray(paymentCheck?.paymentTypes)
      ? paymentCheck.paymentTypes.length
      : 0;
    if (!paymentCheck?.success) {
      result.errors.push(`get-iiko-payment-types returned success=false: ${paymentCheck?.error || "unknown error"}`);
    }
  } catch (error) {
    result.errors.push(`get-iiko-payment-types failed: ${error.message}`);
  }

  if (!options.skipMenuSync) {
    if (!hasAdminAuth) {
      result.menuSync = {
        mode: options.applyMenuSync ? "apply" : "preview",
        skipped: true,
        reason: "admin auth was not provided",
      };
    } else {
      try {
        const syncResult = await syncMenu({
          backendUrl: options.backendUrl,
          restaurantId: restaurant.restaurantId,
          adminTelegramId: options.adminTelegramId,
          telegramInitData: options.telegramInitData,
          applyMenuSync: options.applyMenuSync,
          timeoutMs: options.timeoutMs,
          menuSource: options.menuSource,
          forceFreshToken: options.forceFreshToken,
        });
        result.menuSync = {
          mode: options.applyMenuSync ? "apply" : "preview",
          success: Boolean(syncResult?.success),
          summary: syncResult?.summary ?? null,
          warningsCount: Array.isArray(syncResult?.warnings) ? syncResult.warnings.length : 0,
          source: syncResult?.source ?? null,
          sourceDiagnostics: syncResult?.sourceDiagnostics ?? null,
        };
      } catch (error) {
        result.menuSync = {
          mode: options.applyMenuSync ? "apply" : "preview",
          success: false,
          error: error.message,
        };
        result.errors.push(`menu sync failed: ${error.message}`);
      }
    }
  } else {
    result.menuSync = { skipped: true, reason: "skipMenuSync=true" };
  }

  return result;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file) {
    throw new Error("--file is required");
  }
  if (options.telegramInitDataFile) {
    const filePath = path.resolve(process.cwd(), options.telegramInitDataFile);
    options.telegramInitData = (await fs.readFile(filePath, "utf8")).trim();
  }
  if (!ALLOWED_MENU_SOURCES.has(options.menuSource)) {
    throw new Error(`Unsupported --menu-source value: ${options.menuSource}`);
  }
  if (!options.adminTelegramId && options.telegramInitData) {
    options.adminTelegramId = parseTelegramIdFromInitData(options.telegramInitData);
  }

  const manifest = await loadManifest(options.file);
  if (manifest.validationErrors.length > 0) {
    console.error("Manifest validation errors:");
    for (const entry of manifest.validationErrors) {
      console.error(`- ${entry.restaurantId}: ${entry.errors.join("; ")}`);
    }
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(`Dry run OK: ${manifest.restaurants.length} restaurant(s) validated.`);
    return;
  }

  options.backendUrl = normalizeBaseUrl(options.backendUrl);
  if (!options.backendUrl) {
    throw new Error("--backend-url is required (or set BACKEND_URL)");
  }
  if (!options.adminTelegramId && !options.telegramInitData && !options.setupKey) {
    throw new Error("Provide --telegram-init-data / --admin-telegram-id (admin mode) or --setup-key (legacy)");
  }

  console.log(
    `Start network onboarding: restaurants=${manifest.restaurants.length}, menuSync=${
      options.skipMenuSync ? "skip" : options.applyMenuSync ? "apply" : "preview"
    }, menuSource=${options.menuSource}, auth=${
      options.telegramInitData ? "telegram-init-data" : options.adminTelegramId ? "telegram-id" : "setup-key"
    }`,
  );

  const report = {
    startedAt: new Date().toISOString(),
    backendUrl: options.backendUrl,
    restaurants: [],
  };

  for (const restaurant of manifest.restaurants) {
    console.log(`Processing ${restaurant.restaurantId}...`);
    const result = await processRestaurant({ options, restaurant });
    report.restaurants.push(result);
    if (result.errors.length === 0) {
      console.log(`OK ${restaurant.restaurantId}`);
    } else {
      console.log(`FAIL ${restaurant.restaurantId}: ${result.errors.join(" | ")}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  report.summary = {
    total: report.restaurants.length,
    success: report.restaurants.filter((item) => item.errors.length === 0).length,
    failed: report.restaurants.filter((item) => item.errors.length > 0).length,
  };

  console.log("Summary:", JSON.stringify(report.summary));

  if (options.reportFile) {
    const reportPath = path.resolve(process.cwd(), options.reportFile);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Report saved: ${reportPath}`);
  }

  if (options.strict && report.summary.failed > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
