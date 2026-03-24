type SmokePlatform = "telegram" | "vk";
type SmokeRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "restaurant_manager"
  | "marketer"
  | "delivery_manager"
  | "user";

type SmokeProfile = {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  photo: string;
  notificationsEnabled: boolean;
  onboardingTourShown: boolean;
  telegramId?: number;
  vkId?: number;
  favoriteCityId: string | null;
  favoriteCityName: string | null;
  favoriteRestaurantId: string | null;
  favoriteRestaurantName: string | null;
  favoriteRestaurantAddress: string | null;
  lastAddressText: string | null;
  lastAddressLat: number | null;
  lastAddressLon: number | null;
  lastAddressUpdatedAt: string | null;
  personalDataConsentGiven: boolean;
  personalDataConsentDate: string | null;
  personalDataPolicyConsentGiven: boolean;
  personalDataPolicyConsentDate: string | null;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
};

type SmokeAdminUser = {
  id: string;
  telegramId: string | null;
  vkId: string | null;
  name: string;
  phone: string | null;
  role: SmokeRole;
  allowedRestaurants: string[];
  createdAt: string;
  updatedAt: string;
  permissions: string[];
};

type SmokeDeliveryAccessUser = {
  userId: string;
  name: string;
  phone: string | null;
  telegramId: string | null;
  vkId: string | null;
  createdAt: string;
  updatedAt: string;
  accessUpdatedAt: string | null;
  listEnabled: boolean;
  hasAccess: boolean;
};

type SmokeOrder = {
  id: string;
  external_id: string | null;
  restaurant_id: string | null;
  city_id: string | null;
  order_type: "delivery" | "pickup";
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  comment: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    amount: number;
    weight?: string;
    imageUrl?: string;
  }>;
  warnings: string[];
  meta: Record<string, unknown> | null;
  payment_status?: string | null;
  payment_method?: string | null;
  provider_status?: string | null;
  provider_order_id?: string | null;
  provider_error?: string | null;
  iiko_status?: string | null;
  iiko_order_id?: string | null;
  iiko_details?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SmokeBooking = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  reviewLink: string | null;
  remarkedRestaurantId: number | null;
  remarkedReserveId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  bookingDate: string;
  bookingTime: string;
  guestsCount: number;
  comment: string | null;
  eventTags: number[];
  source: string;
  status: string;
  platform: "telegram" | "vk" | null;
  createdAt: string;
  updatedAt: string;
};

type SmokeErrorLog = {
  id: string;
  status: "new" | "resolved";
  source: string;
  level: "debug" | "info" | "warn" | "error";
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  message: string;
  errorName: string | null;
  errorStack: string | null;
  payload: Record<string, unknown>;
  userId: string | null;
  userName: string | null;
  telegramId: string | null;
  vkId: string | null;
  role: string;
  platform: string | null;
  pathname: string | null;
  pageUrl: string | null;
  sessionId: string | null;
  userAgent: string | null;
  resolvedAt: string | null;
  resolvedByTelegramId: string | null;
  createdAt: string;
  updatedAt: string;
};

type SmokeGuest = {
  id: string;
  name: string;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  favoriteCityId: string | null;
  favoriteCityName: string | null;
  favoriteRestaurantId: string | null;
  favoriteRestaurantName: string | null;
  cityId: string | null;
  cityName: string | null;
  status: "verified" | "full_profile" | "restaurant_only" | "unverified";
  isVerified: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  updatedAt: string;
  telegramId: string | null;
  vkId: string | null;
  platform: "telegram" | "vk" | "multi" | null;
};

type SmokeState = {
  config: SmokeConfig;
  profile: SmokeProfile;
  settings: {
    supportTelegramUrl: string;
    supportVkUrl: string;
    personalDataConsentUrl: string;
    personalDataPolicyUrl: string;
  };
  cartItems: SmokeOrder["items"];
  orders: SmokeOrder[];
  bookings: SmokeBooking[];
  adminUsers: SmokeAdminUser[];
  deliveryAccessMode: "list" | "all_on" | "all_off";
  deliveryUsers: SmokeDeliveryAccessUser[];
  errorLogs: SmokeErrorLog[];
  guests: SmokeGuest[];
  bookingStatusMessages: Record<string, { telegram: string; vk: string }>;
  cities: Array<{
    id: string;
    name: string;
    is_active?: boolean;
    restaurants: Array<{
      id: string;
      name: string;
      address: string;
      city: string;
      isActive?: boolean;
      isDeliveryEnabled?: boolean;
      remarkedRestaurantId?: number;
      reviewLink?: string;
      phoneNumber?: string;
      maxCartItemQuantity?: number;
    }>;
  }>;
  logsEndpointHits: number;
  onboardingShown: boolean;
};

type SmokeConfig = {
  platform: SmokePlatform;
  role: SmokeRole;
  userId: string;
};

type MockContext = {
  url: URL;
  method: string;
  bodyText: string | null;
  bodyJson: unknown;
};

const LOCAL_SMOKE_ENABLED = import.meta.env.VITE_LOCAL_SMOKE_MOCKS === "true";
const TELEGRAM_INIT_DATA_STORAGE_KEY = "mariko_tg_init_data";
const TELEGRAM_USER_ID_STORAGE_KEY = "mariko_tg_user_id";
const LOCAL_SMOKE_SENTINEL = "__marikoLocalSmokeInstalled";

const ALL_PERMISSIONS = [
  "manage_cities",
  "view_cities",
  "manage_restaurants",
  "view_restaurants",
  "manage_menu",
  "view_menu",
  "manage_users",
  "view_users",
  "manage_roles",
  "view_roles",
  "manage_reviews",
  "view_reviews",
  "manage_promotions",
  "view_promotions",
  "manage_deliveries",
  "view_deliveries",
  "manage_bookings",
];

const ROLE_PERMISSIONS: Record<SmokeRole, string[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: [
    "manage_roles",
    "manage_restaurants",
    "manage_menu",
    "manage_promotions",
    "manage_deliveries",
    "manage_users",
    "view_cities",
    "view_restaurants",
    "view_users",
    "view_menu",
    "manage_bookings",
  ],
  manager: [
    "manage_restaurants",
    "manage_menu",
    "manage_promotions",
    "manage_deliveries",
    "view_restaurants",
    "view_menu",
    "manage_bookings",
  ],
  restaurant_manager: ["manage_menu", "manage_deliveries", "view_menu", "manage_bookings"],
  marketer: ["manage_promotions", "view_promotions"],
  delivery_manager: ["manage_deliveries", "view_deliveries"],
  user: [],
};

type LocalSmokeWindow = Window &
  typeof globalThis & {
    Telegram?: {
      WebApp?: Record<string, unknown>;
    };
    vk?: {
      WebApp?: Record<string, unknown>;
    };
    [LOCAL_SMOKE_SENTINEL]?: boolean;
  };

let smokeState: SmokeState | null = null;

function getWindowObject(): LocalSmokeWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as LocalSmokeWindow;
}

function getSmokeConfig(): SmokeConfig {
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const smokePlatform = search.get("smoke_platform");
  const platform: SmokePlatform =
    smokePlatform === "vk" ? "vk" : search.has("vk_user_id") || search.has("vk_app_id") ? "vk" : "telegram";
  const requestedRole = (search.get("smoke_role") || "super_admin").trim() as SmokeRole;
  const role: SmokeRole = Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, requestedRole)
    ? requestedRole
    : "super_admin";
  const defaultUserId = platform === "vk" ? "8670261122" : "1189569891";
  const userId = (search.get("smoke_user_id") || defaultUserId).trim() || defaultUserId;

  return {
    platform,
    role,
    userId,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildSmokeProfile(config: SmokeConfig): SmokeProfile {
  return {
    id: config.userId,
    name: config.platform === "vk" ? "Smoke VK Admin" : "Smoke TG Admin",
    phone: "+79990000000",
    birthDate: "1996-03-24",
    gender: "Не указан",
    photo: "",
    notificationsEnabled: true,
    onboardingTourShown: false,
    telegramId: config.platform === "telegram" ? Number(config.userId) : undefined,
    vkId: config.platform === "vk" ? Number(config.userId) : undefined,
    favoriteCityId: "nizhny-novgorod",
    favoriteCityName: "Нижний Новгород",
    favoriteRestaurantId: "nn-rozh",
    favoriteRestaurantName: "Хачапури Марико",
    favoriteRestaurantAddress: "Рождественская, 39",
    lastAddressText: "Нижний Новгород, Рождественская, 39",
    lastAddressLat: 56.3269,
    lastAddressLon: 44.0075,
    lastAddressUpdatedAt: nowIso(),
    personalDataConsentGiven: true,
    personalDataConsentDate: nowIso(),
    personalDataPolicyConsentGiven: true,
    personalDataPolicyConsentDate: nowIso(),
    isBanned: false,
    bannedAt: null,
    bannedReason: null,
  };
}

function buildSmokeState(config: SmokeConfig): SmokeState {
  const currentProfile = buildSmokeProfile(config);
  const timestamp = nowIso();
  const adminUsers: SmokeAdminUser[] = [
    {
      id: "admin-smoke-current",
      telegramId: config.platform === "telegram" ? config.userId : null,
      vkId: config.platform === "vk" ? config.userId : null,
      name: currentProfile.name,
      phone: currentProfile.phone,
      role: config.role,
      allowedRestaurants: ["nn-rozh"],
      createdAt: timestamp,
      updatedAt: timestamp,
      permissions: ROLE_PERMISSIONS[config.role],
    },
    {
      id: "admin-smoke-tg",
      telegramId: "577222108",
      vkId: null,
      name: "TG Seed Admin",
      phone: "+79990000001",
      role: "super_admin",
      allowedRestaurants: ["nn-rozh"],
      createdAt: timestamp,
      updatedAt: timestamp,
      permissions: ROLE_PERMISSIONS.super_admin,
    },
    {
      id: "admin-smoke-vk",
      telegramId: null,
      vkId: "8670261122",
      name: "VK Seed Admin",
      phone: "+79990000002",
      role: "admin",
      allowedRestaurants: ["nn-rozh"],
      createdAt: timestamp,
      updatedAt: timestamp,
      permissions: ROLE_PERMISSIONS.admin,
    },
    {
      id: "admin-smoke-user",
      telegramId: "932608372",
      vkId: null,
      name: "Noise User",
      phone: "+79990000003",
      role: "user",
      allowedRestaurants: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      permissions: [],
    },
  ];

  const deliveryUsers: SmokeDeliveryAccessUser[] = adminUsers.map((user, index) => ({
    userId: user.id,
    name: user.name,
    phone: user.phone,
    telegramId: user.telegramId,
    vkId: user.vkId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessUpdatedAt: index === 0 ? timestamp : null,
    listEnabled: index !== 3,
    hasAccess: index !== 3,
  }));

  const bookings: SmokeBooking[] = [
    {
      id: "booking-smoke-1",
      restaurantId: "nn-rozh",
      restaurantName: "Хачапури Марико",
      restaurantAddress: "Рождественская, 39",
      reviewLink: "https://example.com/review",
      remarkedRestaurantId: 1234,
      remarkedReserveId: 4321,
      customerName: currentProfile.name,
      customerPhone: currentProfile.phone,
      customerEmail: "smoke@example.com",
      bookingDate: "2026-03-25",
      bookingTime: "19:00",
      guestsCount: 2,
      comment: "Smoke booking",
      eventTags: [],
      source: "mobile_app",
      status: "confirmed",
      platform: config.platform,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const orders: SmokeOrder[] = [
    {
      id: "order-smoke-1",
      external_id: "SMOKE-ORDER-1",
      restaurant_id: "nn-rozh",
      city_id: "nizhny-novgorod",
      order_type: "delivery",
      customer_name: currentProfile.name,
      customer_phone: currentProfile.phone,
      delivery_address: currentProfile.lastAddressText,
      comment: "Smoke order, not sent to provider",
      subtotal: 990,
      delivery_fee: 0,
      total: 990,
      status: "draft",
      items: [
        {
          id: "smoke-item-1",
          name: "Хачапури по-аджарски",
          price: 490,
          amount: 2,
        },
      ],
      warnings: [],
      meta: { smoke: true },
      payment_status: "pending",
      payment_method: "cash",
      provider_status: "mocked",
      provider_order_id: null,
      provider_error: null,
      iiko_status: "not_sent",
      iiko_order_id: null,
      iiko_details: { smoke: true },
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  const errorLogs: SmokeErrorLog[] = [
    {
      id: "log-smoke-high",
      status: "new",
      source: "backend",
      level: "error",
      severity: "high",
      category: "iiko-menu-sync",
      message: "Smoke iiko auth issue",
      errorName: null,
      errorStack: null,
      payload: {
        lines: ["Smoke local mode", "No real iiko calls"],
      },
      userId: null,
      userName: "Система",
      telegramId: null,
      vkId: null,
      role: "system",
      platform: null,
      pathname: "/backend/iiko/menu-sync",
      pageUrl: null,
      sessionId: null,
      userAgent: "local-smoke",
      resolvedAt: null,
      resolvedByTelegramId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "log-smoke-low",
      status: "new",
      source: "frontend",
      level: "error",
      severity: "low",
      category: "admin-api",
      message: "Smoke 401 example",
      errorName: "Error",
      errorStack: "smoke stack",
      payload: {
        data: {
          status: 401,
        },
      },
      userId: "932608372",
      userName: "Noise User",
      telegramId: "932608372",
      vkId: null,
      role: "user",
      platform: "telegram",
      pathname: "/tg/",
      pageUrl: "http://127.0.0.1:4173/",
      sessionId: "session-smoke",
      userAgent: "local-smoke",
      resolvedAt: null,
      resolvedByTelegramId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const guests: SmokeGuest[] = [
    {
      id: "guest-smoke-current",
      name: currentProfile.name,
      phone: currentProfile.phone,
      birthDate: currentProfile.birthDate,
      gender: currentProfile.gender,
      favoriteCityId: currentProfile.favoriteCityId,
      favoriteCityName: currentProfile.favoriteCityName,
      favoriteRestaurantId: currentProfile.favoriteRestaurantId,
      favoriteRestaurantName: currentProfile.favoriteRestaurantName,
      cityId: currentProfile.favoriteCityId,
      cityName: currentProfile.favoriteCityName,
      status: "verified",
      isVerified: true,
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      telegramId: config.platform === "telegram" ? config.userId : null,
      vkId: config.platform === "vk" ? config.userId : null,
      platform: config.platform,
    },
  ];

  return {
    config,
    profile: currentProfile,
    settings: {
      supportTelegramUrl: "https://t.me/mariko_support",
      supportVkUrl: "https://vk.me/mariko_support",
      personalDataConsentUrl: "https://example.com/consent",
      personalDataPolicyUrl: "https://example.com/policy",
    },
    cartItems: orders[0].items.slice(),
    orders,
    bookings,
    adminUsers,
    deliveryAccessMode: "list",
    deliveryUsers,
    errorLogs,
    guests,
    bookingStatusMessages: {
      confirmed: {
        telegram: "Smoke TG booking confirmed",
        vk: "Smoke VK booking confirmed",
      },
    },
    cities: [
      {
        id: "nizhny-novgorod",
        name: "Нижний Новгород",
        is_active: true,
        restaurants: [
          {
            id: "nn-rozh",
            name: "Хачапури Марико",
            address: "Рождественская, 39",
            city: "Нижний Новгород",
            isActive: true,
            isDeliveryEnabled: true,
            remarkedRestaurantId: 1234,
            reviewLink: "https://example.com/review",
            phoneNumber: "+7 999 000-00-00",
            maxCartItemQuantity: 10,
          },
        ],
      },
    ],
    logsEndpointHits: 0,
    onboardingShown: false,
  };
}

async function loadSmokeMenu(restaurantId: string): Promise<unknown> {
  const { staticMenus } = await import("@/shared/data/menuData.static");
  return staticMenus.find((menu) => menu.restaurantId === restaurantId) ?? staticMenus[0] ?? null;
}

function getState(): SmokeState {
  if (!smokeState) {
    smokeState = buildSmokeState(getSmokeConfig());
  }
  return smokeState;
}

function ensureStorageValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore storage issues in smoke mode
  }
}

function bootstrapTelegramSmoke(config: SmokeConfig): void {
  const telegramUser = {
    id: Number(config.userId),
    first_name: "Smoke",
    last_name: "TG",
    username: "smoke_tg",
  };
  const initData = new URLSearchParams({
    user: JSON.stringify(telegramUser),
    auth_date: "1711111111",
    hash: "smoke_hash",
  }).toString();

  ensureStorageValue(TELEGRAM_INIT_DATA_STORAGE_KEY, initData);
  ensureStorageValue(TELEGRAM_USER_ID_STORAGE_KEY, config.userId);

  const win = getWindowObject();
  if (!win) {
    return;
  }

  if (!win.Telegram) {
    win.Telegram = {};
  }

  if (!win.Telegram.WebApp) {
    win.Telegram.WebApp = {};
  }

  Object.assign(win.Telegram.WebApp, {
    initData,
    initDataUnsafe: { user: telegramUser },
    platform: "ios",
    version: "10.0",
    isFullscreen: false,
    ready() {},
    expand() {},
    showAlert(message: string) {
      console.log("[local-smoke][tg alert]", message);
    },
    openLink(url: string) {
      window.open(url, "_blank", "noopener");
    },
    openTelegramLink(url: string) {
      window.open(url, "_blank", "noopener");
    },
    onEvent() {},
    offEvent() {},
    isVersionAtLeast() {
      return true;
    },
  });
}

function bootstrapVkSmoke(config: SmokeConfig): void {
  const win = getWindowObject();
  if (!win) {
    return;
  }

  if (!win.vk) {
    win.vk = {};
  }

  if (!win.vk.WebApp) {
    win.vk.WebApp = {};
  }

  Object.assign(win.vk.WebApp, {
    initData: {
      vk_user_id: config.userId,
      vk_app_id: "777777",
      sign: "smoke_sign",
      ts: "1711111111",
    },
    initDataUnsafe: {
      user: {
        id: Number(config.userId),
      },
    },
    platform: "mobile_iphone",
    version: "1.0",
    ready() {},
    expand() {},
    openLink(url: string) {
      window.open(url, "_blank", "noopener");
    },
  });
}

function bootstrapPlatformMocks(): void {
  const config = getSmokeConfig();
  if (config.platform === "vk") {
    bootstrapVkSmoke(config);
    return;
  }
  bootstrapTelegramSmoke(config);
}

function jsonResponse(payload: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });
}

function textResponse(payload: string, status = 200, headers?: Record<string, string>): Response {
  return new Response(payload, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(headers ?? {}),
    },
  });
}

function notFoundResponse(message = "Not found"): Response {
  return jsonResponse({ success: false, message }, 404);
}

function unauthorizedAdminResponse(): Response {
  return jsonResponse({ success: false, message: "Не удалось определить администратора" }, 401);
}

async function extractMockContext(input: RequestInfo | URL, init?: RequestInit): Promise<MockContext> {
  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input instanceof Request
          ? input.url
          : String(input);
  const url = new URL(requestUrl, window.location.origin);
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  let bodyText: string | null = null;

  const bodySource = init?.body;
  if (typeof bodySource === "string") {
    bodyText = bodySource;
  } else if (bodySource instanceof URLSearchParams) {
    bodyText = bodySource.toString();
  } else if (input instanceof Request && !bodySource) {
    bodyText = await input.clone().text().catch(() => null);
  }

  let bodyJson: unknown = null;
  if (bodyText) {
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = bodyText;
    }
  }

  return {
    url,
    method,
    bodyText,
    bodyJson,
  };
}

function filterErrorLogs(
  logs: SmokeErrorLog[],
  search: URLSearchParams,
): { logs: SmokeErrorLog[]; counts: { total: number; new: number; resolved: number } } {
  let filtered = logs.slice();
  const status = search.get("status");
  const severity = search.get("severity");
  const text = (search.get("search") || "").trim().toLowerCase();

  if (status === "new" || status === "resolved") {
    filtered = filtered.filter((log) => log.status === status);
  }
  if (severity) {
    filtered = filtered.filter((log) => log.severity === severity);
  }
  if (text) {
    filtered = filtered.filter((log) =>
      JSON.stringify(log).toLowerCase().includes(text),
    );
  }

  return {
    logs: filtered,
    counts: {
      total: logs.length,
      new: logs.filter((log) => log.status === "new").length,
      resolved: logs.filter((log) => log.status === "resolved").length,
    },
  };
}

function buildErrorExport(logs: SmokeErrorLog[]): string {
  return logs
    .map((log, index) => {
      return [
        `#${index + 1}`,
        `ID: ${log.id}`,
        `Статус: ${log.status}`,
        `Критичность: ${log.severity}`,
        `Категория: ${log.category}`,
        `Сообщение: ${log.message}`,
        "",
      ].join("\n");
    })
    .join("\n");
}

function buildRolePermissionsMatrix() {
  return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
    role,
    permissions,
  }));
}

function applyRecalculation(items: SmokeState["cartItems"]) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.amount, 0);
  const deliveryFee = subtotal >= 800 ? 0 : 199;
  return {
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    minOrder: 0,
    canSubmit: items.length > 0,
    warnings: [],
    paymentMethods: {
      cash: { available: true },
      card: { available: true },
      online: { available: true },
    },
  };
}

function buildGeoSuggestResponse(query: string) {
  const label = query.trim() || "Рождественская, 39";
  return {
    response: {
      GeoObjectCollection: {
        featureMember: [
          {
            GeoObject: {
              Point: {
                pos: "44.0075 56.3269",
              },
              metaDataProperty: {
                GeocoderMetaData: {
                  Address: {
                    formatted: `Нижний Новгород, ${label}`,
                    Components: [
                      { kind: "locality", name: "Нижний Новгород" },
                      { kind: "street", name: "Рождественская" },
                      { kind: "house", name: "39" },
                    ],
                  },
                },
              },
              name: "Рождественская 39",
              description: "Нижний Новгород",
            },
          },
        ],
      },
    },
  };
}

async function handleApiRequest(context: MockContext): Promise<Response | null> {
  const state = getState();
  const { url, method, bodyJson } = context;
  const { pathname, searchParams } = url;

  if (!pathname.startsWith("/api/")) {
    return null;
  }

  if (pathname === "/api/logs" && method === "POST") {
    state.logsEndpointHits += 1;
    return jsonResponse({ success: true, stored: true, smoke: true });
  }

  if (pathname === "/api/cart/settings" && method === "GET") {
    return jsonResponse({ success: true, settings: state.settings });
  }

  if (pathname === "/api/cart/profile/me" && method === "GET") {
    return jsonResponse({ success: true, profile: state.profile });
  }

  if (pathname === "/api/cart/profile/me" && method === "PATCH") {
    const patch = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.profile = {
      ...state.profile,
      ...patch,
    };
    return jsonResponse({ success: true, profile: state.profile });
  }

  if (pathname === "/api/cart/profile/sync" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.profile = {
      ...state.profile,
      id: String(payload.id ?? state.profile.id),
      name: String(payload.name ?? state.profile.name),
      photo: String(payload.photo ?? state.profile.photo),
      telegramId:
        typeof payload.telegramId === "number" ? payload.telegramId : state.profile.telegramId,
      vkId: typeof payload.vkId === "number" ? payload.vkId : state.profile.vkId,
    };
    return jsonResponse({ success: true, profile: state.profile });
  }

  if (pathname === "/api/cart/profile/onboarding-tour-shown" && method === "GET") {
    return jsonResponse({ success: true, shown: state.onboardingShown });
  }

  if (pathname === "/api/cart/profile/onboarding-tour-shown" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.onboardingShown = payload.shown === true;
    state.profile.onboardingTourShown = state.onboardingShown;
    return jsonResponse({ success: true, shown: state.onboardingShown });
  }

  if (pathname === "/api/cart/delivery-access/me" && method === "GET") {
    const current = state.deliveryUsers.find(
      (user) =>
        user.telegramId === state.profile.telegramId?.toString() ||
        user.vkId === state.profile.vkId?.toString(),
    );
    return jsonResponse({
      success: true,
      mode: state.deliveryAccessMode,
      hasAccess: current?.hasAccess ?? true,
      profileId: state.profile.id,
      source: "local_smoke",
    });
  }

  if (pathname === "/api/cart/cart" && method === "GET") {
    return jsonResponse({ success: true, items: state.cartItems });
  }

  if (pathname === "/api/cart/cart" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    if (Array.isArray(payload.items)) {
      state.cartItems = payload.items as SmokeState["cartItems"];
    }
    return jsonResponse({ success: true, items: state.cartItems });
  }

  if (pathname === "/api/cart/cart" && method === "DELETE") {
    state.cartItems = [];
    return jsonResponse({ success: true });
  }

  if (pathname === "/api/cart/recalculate" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? (payload.items as SmokeState["cartItems"]) : [];
    return jsonResponse({
      success: true,
      ...applyRecalculation(items),
    });
  }

  if (pathname === "/api/cart/submit" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    const orderId = `smoke-order-${Date.now()}`;
    const items = Array.isArray(payload.items) ? (payload.items as SmokeState["cartItems"]) : [];
    const totals = applyRecalculation(items);
    state.orders = [
      {
        id: orderId,
        external_id: null,
        restaurant_id: String(payload.restaurantId ?? "nn-rozh"),
        city_id: String(payload.cityId ?? "nizhny-novgorod"),
        order_type: payload.orderType === "pickup" ? "pickup" : "delivery",
        customer_name: String(payload.customerName ?? state.profile.name),
        customer_phone: String(payload.customerPhone ?? state.profile.phone),
        delivery_address: typeof payload.deliveryAddress === "string" ? payload.deliveryAddress : null,
        comment: typeof payload.comment === "string" ? payload.comment : null,
        subtotal: totals.subtotal,
        delivery_fee: totals.deliveryFee,
        total: totals.total,
        status: "draft",
        items,
        warnings: [],
        meta: { smoke: true, preventedProviderCall: true },
        payment_status: "pending",
        payment_method: String(payload.paymentMethod ?? "cash"),
        provider_status: "mocked",
        provider_order_id: null,
        provider_error: null,
        iiko_status: "not_sent",
        iiko_order_id: null,
        iiko_details: { smoke: true },
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      ...state.orders,
    ];
    return jsonResponse({
      success: true,
      orderId,
      message: "Smoke order created locally only",
    });
  }

  if ((pathname === "/api/cart/orders" || pathname === "/api/cart/user-orders") && method === "GET") {
    return jsonResponse({ success: true, orders: state.orders });
  }

  if (pathname === "/api/cart/geocode/suggest" && method === "GET") {
    return jsonResponse(buildGeoSuggestResponse(searchParams.get("query") || ""));
  }

  if (pathname === "/api/cart/geocode/reverse" && method === "GET") {
    return jsonResponse(buildGeoSuggestResponse("Рождественская, 39"));
  }

  if (pathname === "/api/cart/admin/me" && method === "GET") {
    if (state.config.role === "user") {
      return unauthorizedAdminResponse();
    }
    return jsonResponse({
      success: true,
      role: state.config.role,
      allowedRestaurants: ["nn-rozh"],
      permissions: ROLE_PERMISSIONS[state.config.role],
    });
  }

  if (pathname === "/api/cart/admin/users" && method === "GET") {
    return jsonResponse({ success: true, users: state.adminUsers });
  }

  if (pathname === "/api/cart/admin/role-permissions" && method === "GET") {
    return jsonResponse({
      success: true,
      roles: buildRolePermissionsMatrix(),
      availablePermissions: ALL_PERMISSIONS,
    });
  }

  if (pathname.startsWith("/api/cart/admin/role-permissions/") && method === "PATCH") {
    const role = decodeURIComponent(pathname.split("/").pop() || "") as SmokeRole;
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    const permissions = Array.isArray(payload.permissions) ? payload.permissions.map(String) : [];
    ROLE_PERMISSIONS[role] = permissions;
    state.adminUsers = state.adminUsers.map((user) =>
      user.role === role ? { ...user, permissions } : user,
    );
    return jsonResponse({ success: true, role, permissions });
  }

  if (pathname === "/api/cart/admin/delivery-access/users" && method === "GET") {
    return jsonResponse({
      success: true,
      mode: state.deliveryAccessMode,
      users: state.deliveryUsers,
    });
  }

  if (pathname === "/api/cart/admin/delivery-access/enable-all" && method === "POST") {
    state.deliveryAccessMode = "all_on";
    state.deliveryUsers = state.deliveryUsers.map((user) => ({
      ...user,
      hasAccess: true,
      accessUpdatedAt: nowIso(),
    }));
    return jsonResponse({ success: true, mode: state.deliveryAccessMode });
  }

  if (pathname === "/api/cart/admin/delivery-access/disable-all" && method === "POST") {
    state.deliveryAccessMode = "all_off";
    state.deliveryUsers = state.deliveryUsers.map((user) => ({
      ...user,
      hasAccess: false,
      accessUpdatedAt: nowIso(),
    }));
    return jsonResponse({ success: true, mode: state.deliveryAccessMode });
  }

  if (pathname.startsWith("/api/cart/admin/delivery-access/users/") && method === "PATCH") {
    const userId = decodeURIComponent(pathname.split("/").pop() || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    const enabled = payload.enabled === true;
    state.deliveryUsers = state.deliveryUsers.map((user) =>
      user.userId === userId
        ? {
            ...user,
            listEnabled: enabled,
            hasAccess: state.deliveryAccessMode === "list" ? enabled : state.deliveryAccessMode === "all_on",
            accessUpdatedAt: nowIso(),
          }
        : user,
    );
    return jsonResponse({ success: true, mode: state.deliveryAccessMode });
  }

  if (pathname.startsWith("/api/cart/admin/users/") && pathname.endsWith("/ban") && method === "PATCH") {
    const guestId = decodeURIComponent(pathname.split("/")[5] || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.guests = state.guests.map((guest) =>
      guest.id === guestId
        ? {
            ...guest,
            isBanned: payload.isBanned === true,
            bannedAt: payload.isBanned === true ? nowIso() : null,
            bannedReason: typeof payload.reason === "string" ? payload.reason : null,
          }
        : guest,
    );
    const user = state.guests.find((guest) => guest.id === guestId);
    return jsonResponse({
      success: true,
      user: {
        id: user?.id ?? guestId,
        isBanned: user?.isBanned ?? false,
        bannedAt: user?.bannedAt ?? null,
        bannedReason: user?.bannedReason ?? null,
      },
    });
  }

  if (pathname.startsWith("/api/cart/admin/users/") && method === "PATCH") {
    const userId = decodeURIComponent(pathname.split("/").pop() || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.adminUsers = state.adminUsers.map((user) =>
      user.id === userId
        ? {
            ...user,
            role: typeof payload.role === "string" ? (payload.role as SmokeRole) : user.role,
            allowedRestaurants: Array.isArray(payload.allowedRestaurants)
              ? payload.allowedRestaurants.map(String)
              : user.allowedRestaurants,
            name: typeof payload.name === "string" ? payload.name : user.name,
            updatedAt: nowIso(),
            permissions:
              typeof payload.role === "string"
                ? ROLE_PERMISSIONS[payload.role as SmokeRole] ?? user.permissions
                : user.permissions,
          }
        : user,
    );
    const nextUser = state.adminUsers.find((user) => user.id === userId);
    return jsonResponse({ success: true, user: nextUser });
  }

  if (pathname === "/api/cart/admin/orders" && method === "GET") {
    return jsonResponse({ success: true, orders: state.orders });
  }

  if (pathname === "/api/cart/admin/bookings" && method === "GET") {
    return jsonResponse({ success: true, bookings: state.bookings });
  }

  if (pathname.startsWith("/api/cart/admin/bookings/") && pathname.endsWith("/status") && method === "PATCH") {
    const bookingId = decodeURIComponent(pathname.split("/")[5] || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.bookings = state.bookings.map((booking) =>
      booking.id === bookingId
        ? {
            ...booking,
            status: typeof payload.status === "string" ? payload.status : booking.status,
            updatedAt: nowIso(),
          }
        : booking,
    );
    return jsonResponse({
      success: true,
      notification: payload.sendNotification ? { success: true } : null,
    });
  }

  if (pathname === "/api/cart/admin/bookings/status-message" && method === "GET") {
    const status = searchParams.get("status") || "confirmed";
    const platform = searchParams.get("platform") === "vk" ? "vk" : "telegram";
    return jsonResponse({
      success: true,
      message: state.bookingStatusMessages[status]?.[platform] ?? null,
    });
  }

  if (pathname === "/api/cart/admin/settings" && method === "GET") {
    return jsonResponse({ success: true, settings: state.settings });
  }

  if (pathname === "/api/cart/admin/settings" && method === "PATCH") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.settings = {
      ...state.settings,
      ...(payload as Partial<typeof state.settings>),
    };
    return jsonResponse({ success: true, settings: state.settings });
  }

  if (pathname === "/api/cart/admin/error-logs" && method === "GET") {
    const data = filterErrorLogs(state.errorLogs, searchParams);
    return jsonResponse({
      success: true,
      logs: data.logs,
      counts: data.counts,
    });
  }

  if (pathname === "/api/cart/admin/error-logs/export" && method === "GET") {
    const data = filterErrorLogs(state.errorLogs, searchParams);
    return textResponse(buildErrorExport(data.logs), 200, {
      "content-disposition": 'attachment; filename="app-error-logs.txt"',
    });
  }

  if (pathname.startsWith("/api/cart/admin/error-logs/") && pathname.endsWith("/status") && method === "PATCH") {
    const logId = decodeURIComponent(pathname.split("/")[5] || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.errorLogs = state.errorLogs.map((log) =>
      log.id === logId
        ? {
            ...log,
            status: payload.status === "resolved" ? "resolved" : "new",
            resolvedAt: payload.status === "resolved" ? nowIso() : null,
            resolvedByTelegramId: payload.status === "resolved" ? "1189569891" : null,
            updatedAt: nowIso(),
          }
        : log,
    );
    const log = state.errorLogs.find((item) => item.id === logId);
    return jsonResponse({ success: true, log });
  }

  if (pathname === "/api/cart/admin/guests" && method === "GET") {
    const platform = searchParams.get("platform");
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    let guests = state.guests.slice();
    if (platform === "telegram" || platform === "vk") {
      guests = guests.filter((guest) => guest.platform === platform);
    }
    if (search) {
      guests = guests.filter((guest) => JSON.stringify(guest).toLowerCase().includes(search));
    }
    return jsonResponse({ success: true, guests });
  }

  if (pathname.startsWith("/api/cart/admin/guests/") && pathname.endsWith("/bookings") && method === "GET") {
    return jsonResponse({ success: true, bookings: state.bookings });
  }

  if (pathname.startsWith("/api/cart/admin/restaurants/") && pathname.endsWith("/status") && method === "PATCH") {
    const restaurantId = decodeURIComponent(pathname.split("/")[5] || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.cities = state.cities.map((city) => ({
      ...city,
      restaurants: city.restaurants.map((restaurant) =>
        restaurant.id === restaurantId
          ? {
              ...restaurant,
              isActive: payload.isActive === true,
            }
          : restaurant,
      ),
    }));
    return jsonResponse({ success: true });
  }

  if (pathname === "/api/cart/admin/logs" && method === "POST") {
    return jsonResponse({ success: true });
  }

  if (pathname === "/api/cities/active" && method === "GET") {
    return jsonResponse(state.cities.filter((city) => city.is_active !== false));
  }

  if (pathname === "/api/cities/all" && method === "GET") {
    return jsonResponse(state.cities);
  }

  if (pathname === "/api/cities/status" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.cities = state.cities.map((city) =>
      city.id === payload.cityId
        ? { ...city, is_active: payload.isActive === true }
        : city,
    );
    return jsonResponse({ success: true });
  }

  if (pathname === "/api/cities" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.cities = [
      ...state.cities,
      {
        id: String(payload.id ?? `city-${Date.now()}`),
        name: String(payload.name ?? "Новый город"),
        is_active: true,
        restaurants: [],
      },
    ];
    return jsonResponse({ success: true });
  }

  if (pathname === "/api/cities/restaurants" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    const cityId = String(payload.cityId ?? "");
    const restaurantId = `restaurant-${Date.now()}`;
    state.cities = state.cities.map((city) =>
      city.id === cityId
        ? {
            ...city,
            restaurants: [
              ...city.restaurants,
              {
                id: restaurantId,
                name: String(payload.name ?? "Новый ресторан"),
                address: String(payload.address ?? "Smoke address"),
                city: city.name,
                isActive: true,
                isDeliveryEnabled: true,
              },
            ],
          }
        : city,
    );
    return jsonResponse({ success: true, restaurantId });
  }

  if (pathname.startsWith("/api/cities/restaurants/") && method === "PATCH") {
    const restaurantId = decodeURIComponent(pathname.split("/").pop() || "");
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    state.cities = state.cities.map((city) => ({
      ...city,
      restaurants: city.restaurants.map((restaurant) =>
        restaurant.id === restaurantId
          ? {
              ...restaurant,
              ...payload,
            }
          : restaurant,
      ),
    }));
    return jsonResponse({ success: true });
  }

  if (pathname.startsWith("/api/menu/") && method === "GET") {
    const restaurantId = decodeURIComponent(pathname.split("/").pop() || "");
    return jsonResponse(await loadSmokeMenu(restaurantId));
  }

  if (pathname.startsWith("/api/promotions/") && method === "GET") {
    return jsonResponse([]);
  }

  if (pathname.startsWith("/api/recommended-dishes/") && method === "GET") {
    return jsonResponse([]);
  }

  if (pathname.startsWith("/api/storage/") && method === "GET") {
    return jsonResponse([]);
  }

  if (pathname.startsWith("/api/storage/") && method === "POST") {
    return jsonResponse({ url: "https://example.com/local-smoke-image.jpg" });
  }

  if (pathname === "/api/booking/token" && method === "GET") {
    return jsonResponse({
      success: true,
      data: {
        token: "smoke-booking-token",
        capacity: { min: 1, max: 8 },
      },
    });
  }

  if (pathname === "/api/booking/slots" && method === "GET") {
    const date = searchParams.get("date") || "2026-03-25";
    const guestsCount = Number(searchParams.get("guests_count") || "2");
    return jsonResponse({
      success: true,
      data: {
        date,
        guests_count: guestsCount,
        slots: [
          {
            start_stamp: 1742912400,
            end_stamp: 1742917800,
            duration: 90,
            start_datetime: `${date}T19:00:00+03:00`,
            end_datetime: `${date}T20:30:00+03:00`,
            is_free: true,
            tables_count: 4,
            tables_ids: [1, 2],
          },
          {
            start_stamp: 1742916000,
            end_stamp: 1742921400,
            duration: 90,
            start_datetime: `${date}T20:00:00+03:00`,
            end_datetime: `${date}T21:30:00+03:00`,
            is_free: true,
            tables_count: 4,
            tables_ids: [3, 4],
          },
        ],
      },
    });
  }

  if (pathname === "/api/booking" && method === "POST") {
    const payload = (bodyJson && typeof bodyJson === "object" ? bodyJson : {}) as Record<string, unknown>;
    const bookingId = `smoke-booking-${Date.now()}`;
    state.bookings = [
      {
        id: bookingId,
        restaurantId: String(payload.restaurantId ?? "nn-rozh"),
        restaurantName: "Хачапури Марико",
        restaurantAddress: "Рождественская, 39",
        reviewLink: "https://example.com/review",
        remarkedRestaurantId: 1234,
        remarkedReserveId: 9876,
        customerName: String(payload.name ?? state.profile.name),
        customerPhone: String(payload.phone ?? state.profile.phone),
        customerEmail: typeof payload.email === "string" ? payload.email : null,
        bookingDate: String(payload.date ?? "2026-03-25"),
        bookingTime: String(payload.time ?? "19:00"),
        guestsCount: Number(payload.guestsCount ?? 2),
        comment: typeof payload.comment === "string" ? payload.comment : null,
        eventTags: Array.isArray(payload.eventTags) ? payload.eventTags.map(Number) : [],
        source: String(payload.source ?? "mobile_app"),
        status: "confirmed",
        platform: state.config.platform,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      ...state.bookings,
    ];
    return jsonResponse({
      success: true,
      booking: {
        id: bookingId,
        reserveId: 9876,
      },
      data: {
        form_url: "https://example.com/smoke-booking",
      },
    });
  }

  if (pathname === "/api/booking" && method === "GET") {
    return jsonResponse({
      success: true,
      bookings: state.bookings.map((booking) => ({
        id: booking.id,
        restaurantId: booking.restaurantId,
        restaurantName: booking.restaurantName,
        remarkedRestaurantId: booking.remarkedRestaurantId ?? undefined,
        remarkedReserveId: booking.remarkedReserveId ?? undefined,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail ?? undefined,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        guestsCount: booking.guestsCount,
        comment: booking.comment ?? undefined,
        eventTags: booking.eventTags,
        source: booking.source,
        status: booking.status,
        createdAt: booking.createdAt,
      })),
    });
  }

  if (pathname.startsWith("/api/payments/") && pathname.endsWith("/yookassa/create") && method === "POST") {
    return jsonResponse({
      success: true,
      paymentId: "smoke-payment-1",
      providerPaymentId: "provider-smoke-1",
      confirmationUrl: "https://example.com/smoke-payment",
      status: "pending",
      message: "Smoke payment created locally",
    });
  }

  if (pathname.startsWith("/api/payments/") && method === "GET") {
    return jsonResponse({
      success: true,
      payment: {
        id: pathname.split("/").pop() || "smoke-payment-1",
        status: "pending",
        provider_payment_id: "provider-smoke-1",
        order_id: state.orders[0]?.id ?? null,
        provider_code: "yookassa",
      },
    });
  }

  return jsonResponse({ success: true, smoke: true, path: pathname });
}

async function handleRemarkedRequest(context: MockContext): Promise<Response | null> {
  if (context.url.hostname !== "app.remarked.ru") {
    return null;
  }

  const payload = (context.bodyJson && typeof context.bodyJson === "object" ? context.bodyJson : {}) as Record<
    string,
    unknown
  >;
  const method = String(payload.method ?? "");

  if (context.url.pathname.endsWith("/ApiReservesWidget")) {
    if (method === "GetToken") {
      return jsonResponse({
        status: "success",
        token: "smoke-remarked-token",
        capacity: { min: 1, max: 8 },
      });
    }
    if (method === "GetSlots") {
      const period = (payload.reserve_date_period ?? {}) as Record<string, unknown>;
      const date = String(period.from ?? "2026-03-25");
      return jsonResponse({
        status: "success",
        slots: [
          {
            start_stamp: 1742912400,
            end_stamp: 1742917800,
            duration: 90,
            start_datetime: `${date}T19:00:00+03:00`,
            end_datetime: `${date}T20:30:00+03:00`,
            is_free: true,
            tables_count: 2,
            tables_ids: [1, 2],
          },
        ],
      });
    }
    if (method === "CreateReserve") {
      return jsonResponse({
        status: "success",
        reserve_id: 12345,
        form_url: "https://example.com/smoke-remarked",
      });
    }
    if (method === "GetReservesByPhone") {
      return jsonResponse({
        status: "success",
        total: 1,
        count: 1,
        reserves: [
          {
            id: 12345,
            name: "Smoke Guest",
            phone: "+79990000000",
            estimated_time: "2026-03-25T19:00:00+03:00",
            guests_count: "2",
            inner_status: "confirmed",
          },
        ],
      });
    }
  }

  if (context.url.pathname.endsWith("/api")) {
    return jsonResponse({
      result: {
        status: "success",
        eventTags: [
          { id: 1, name: "Birthday", color: "#F59E0B" },
          { id: 2, name: "Family", color: "#10B981" },
        ],
      },
    });
  }

  return jsonResponse({ status: "success" });
}

async function smokeFetch(
  originalFetch: typeof window.fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (init?.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const context = await extractMockContext(input, init);
  const remarkedResponse = await handleRemarkedRequest(context);
  if (remarkedResponse) {
    return remarkedResponse;
  }

  const apiResponse = await handleApiRequest(context);
  if (apiResponse) {
    return apiResponse;
  }

  return originalFetch(input, init);
}

export function installLocalSmokeMode(): void {
  if (!LOCAL_SMOKE_ENABLED) {
    return;
  }

  const win = getWindowObject();
  if (!win || win[LOCAL_SMOKE_SENTINEL]) {
    return;
  }

  win[LOCAL_SMOKE_SENTINEL] = true;
  bootstrapPlatformMocks();
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!LOCAL_SMOKE_ENABLED) {
      return originalFetch(input, init);
    }
    return smokeFetch(originalFetch, input, init);
  };
  console.info("[local-smoke] enabled", getSmokeConfig());
}
