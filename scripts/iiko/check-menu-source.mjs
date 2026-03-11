#!/usr/bin/env node

/**
 * Диагностика видимости меню в iiko Cloud API.
 *
 * Проверяет на свежем bearer-токене:
 * - organizations
 * - nomenclature
 * - external_menus (probe)
 * - price_categories (probe)
 * - pricelists (probe)
 *
 * Использование:
 *   node scripts/iiko/check-menu-source.mjs YOUR_API_LOGIN
 *   IIKO_API_LOGIN=... node scripts/iiko/check-menu-source.mjs
 *   node scripts/iiko/check-menu-source.mjs YOUR_API_LOGIN 77b29d06-...
 */

const IIKO_API_BASE = "https://api-ru.iiko.services/api/1";

const apiLogin = process.argv[2] || process.env.IIKO_API_LOGIN;
const requestedOrganizationId = process.argv[3] || process.env.IIKO_ORGANIZATION_ID || null;

if (!apiLogin) {
  console.error("❌ Ошибка: не указан API Login");
  console.error("Использование: node scripts/iiko/check-menu-source.mjs YOUR_API_LOGIN [ORGANIZATION_ID]");
  console.error("Или: IIKO_API_LOGIN=... node scripts/iiko/check-menu-source.mjs");
  process.exit(1);
}

const mask = (value, head = 8, tail = 8) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (raw.length <= head + tail) {
    return raw;
  }
  return `${raw.slice(0, head)}...${raw.slice(-tail)}`;
};

const requestJson = async (url, body, token) => {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
};

const getAccessToken = async () => {
  const response = await requestJson(`${IIKO_API_BASE}/access_token`, { apiLogin });
  if (!response.ok || !response.payload?.token) {
    throw new Error(
      `Не удалось получить access_token: HTTP ${response.status} ${JSON.stringify(response.payload)}`,
    );
  }
  return response.payload.token;
};

const getOrganizations = async (token) => {
  const response = await requestJson(
    `${IIKO_API_BASE}/organizations`,
    {
      organizationIds: null,
      returnAdditionalInfo: true,
      includeDisabled: false,
    },
    token,
  );

  if (!response.ok) {
    throw new Error(
      `Не удалось получить organizations: HTTP ${response.status} ${JSON.stringify(response.payload)}`,
    );
  }

  return Array.isArray(response.payload?.organizations) ? response.payload.organizations : [];
};

const resolveOrganization = (organizations) => {
  if (requestedOrganizationId) {
    return organizations.find((entry) => entry?.id === requestedOrganizationId) || null;
  }
  return organizations[0] || null;
};

const extractErrorMessage = (payload) =>
  payload?.errorDescription ||
  payload?.message ||
  payload?.error?.message ||
  payload?.raw ||
  null;

const logProbe = (label, response, successSummary) => {
  if (response.ok) {
    console.log(`   ✅ ${label}: HTTP ${response.status}${successSummary ? `, ${successSummary}` : ""}`);
    return;
  }
  console.log(
    `   ⚠️ ${label}: HTTP ${response.status}${extractErrorMessage(response.payload) ? `, ${extractErrorMessage(response.payload)}` : ""}`,
  );
};

const main = async () => {
  console.log("🔍 Проверка источника меню в iiko Cloud API");
  console.log(`API Login: ${mask(apiLogin)}`);
  console.log("");

  const token = await getAccessToken();
  console.log(`1️⃣ Свежий bearer token: ${mask(token)}`);
  console.log("");

  const organizations = await getOrganizations(token);
  console.log(`2️⃣ Организаций доступно: ${organizations.length}`);
  organizations.forEach((organization, index) => {
    console.log(`   ${index + 1}. ${organization.name} (${organization.id})`);
  });
  console.log("");

  const organization = resolveOrganization(organizations);
  if (!organization) {
    throw new Error(
      requestedOrganizationId
        ? `Организация ${requestedOrganizationId} не найдена для этого API Login`
        : "Для этого API Login не найдено ни одной организации",
    );
  }

  console.log(`3️⃣ Проверяю организацию: ${organization.name} (${organization.id})`);

  const nomenclature = await requestJson(
    `${IIKO_API_BASE}/nomenclature`,
    { organizationId: organization.id },
    token,
  );
  const externalMenus = await requestJson(
    `${IIKO_API_BASE}/external_menus`,
    { organizationIds: [organization.id] },
    token,
  );
  const priceCategories = await requestJson(
    `${IIKO_API_BASE}/price_categories`,
    { organizationIds: [organization.id] },
    token,
  );
  const priceLists = await requestJson(
    `${IIKO_API_BASE}/pricelists`,
    { organizationIds: [organization.id] },
    token,
  );

  const productCount = Array.isArray(nomenclature.payload?.products)
    ? nomenclature.payload.products.length
    : 0;
  const groupCount = Array.isArray(nomenclature.payload?.groups) ? nomenclature.payload.groups.length : 0;
  const revision = nomenclature.payload?.revision ?? null;

  logProbe(
    "nomenclature",
    nomenclature,
    nomenclature.ok ? `products=${productCount}, groups=${groupCount}, revision=${revision ?? "n/a"}` : "",
  );
  logProbe("external_menus (probe)", externalMenus);
  logProbe("price_categories (probe)", priceCategories);
  logProbe("pricelists (probe)", priceLists);
  console.log("");

  if (nomenclature.ok && !externalMenus.ok) {
    console.log("Вывод:");
    console.log("   • Логин читает общую номенклатуру организации через /nomenclature.");
    console.log("   • Логин не может читать external_menu endpoints как отдельный источник.");
    console.log("   • Если в Cloud API настроено внешнее меню, текущий backend его не использует напрямую.");
    return;
  }

  if (nomenclature.ok && externalMenus.ok) {
    console.log("Вывод:");
    console.log("   • Логин видит и общую номенклатуру, и external_menu API.");
    console.log("   • Можно реализовывать отдельный sync из external_menu endpoints.");
    return;
  }

  console.log("Вывод:");
  console.log("   • Нужна дополнительная проверка ответа iiko по этому логину.");
};

main().catch((error) => {
  console.error("");
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
