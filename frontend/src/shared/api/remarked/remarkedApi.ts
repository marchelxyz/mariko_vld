/**
 * API клиент для работы с Remarked (система бронирования столиков)
 */

const REMARKED_API_BASE = "https://app.remarked.ru/api/v1";

type RemarkedRequest = {
  method: string;
  [key: string]: unknown;
};

type RemarkedResponse<T = unknown> = {
  status?: string;
  [key: string]: T | unknown;
};

/**
 * Получить токен для работы с API
 */
export async function getRemarkedToken(
  restaurantId: number,
  additionalInfo?: boolean
): Promise<{ token: string; capacity?: { min: number; max: number } }> {
  const request: RemarkedRequest = {
    method: "GetToken",
    point: restaurantId,
  };

  if (additionalInfo) {
    request.additional_info = true;
  }

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = `Failed to get token: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Если не удалось распарсить JSON, используем стандартное сообщение
    }
    throw new Error(`${errorMessage} (Restaurant ID: ${restaurantId})`);
  }

  const data = await response.json();
  
  // Проверяем наличие ошибки в ответе
  if (data.status === "error") {
    throw new Error(data.message || `Ошибка получения токена для ресторана ${restaurantId}`);
  }
  
  return data;
}

/**
 * Получить доступные временные слоты для бронирования
 */
export async function getRemarkedSlots(
  token: string,
  date: string,
  guestsCount: number
): Promise<{
  status: string;
  slots: Array<{
    start_stamp: number;
    end_stamp: number;
    duration: number;
    start_datetime: string;
    end_datetime: string;
    is_free: boolean;
    tables_count: number;
    tables_ids: number[];
  }>;
}> {
  const request: RemarkedRequest = {
    method: "GetSlots",
    token,
    reserve_date_period: {
      from: date,
      to: date,
    },
    guests_count: guestsCount,
  };

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = `Failed to get slots: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Если не удалось распарсить JSON, используем стандартное сообщение
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Проверяем наличие ошибки в ответе
  if (data.status === "error") {
    throw new Error(data.message || "Ошибка получения слотов");
  }
  
  return data;
}

/**
 * Получить теги событий
 */
export async function getRemarkedEventTags(
  token: string
): Promise<{
  status: string;
  eventTags: Array<{
    id: number;
    name: string;
    color: string;
  }>;
}> {
  const request = {
    method: "ReservesWidgetApi.getEventTags",
    jsonrpc: "2.0",
    params: {
      token,
    },
  };

  const response = await fetch(`${REMARKED_API_BASE}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to get event tags: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Создать бронирование
 */
export async function createRemarkedReserve(
  token: string,
  reserve: {
    name: string;
    phone: string;
    email?: string;
    date: string;
    time: string;
    guests_count: number;
    comment?: string;
    eventTags?: number[];
    source?: "site" | "mobile_app";
    duration?: number;
  }
): Promise<{
  status: string;
  reserve_id?: number;
  form_url?: string;
}> {
  const request: RemarkedRequest = {
    method: "CreateReserve",
    token,
    reserve: {
      name: reserve.name,
      phone: reserve.phone,
      email: reserve.email,
      date: reserve.date,
      time: reserve.time,
      guests_count: reserve.guests_count,
      comment: reserve.comment || "",
      eventTags: reserve.eventTags || [],
      source: reserve.source || "mobile_app",
      duration: reserve.duration,
      type: "booking",
    },
  };

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = `Failed to create reserve: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Если не удалось распарсить JSON, используем стандартное сообщение
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Проверяем наличие ошибки в ответе
  if (data.status === "error") {
    throw new Error(data.message || "Ошибка создания бронирования");
  }
  
  return data;
}

/**
 * Получить брони по номеру телефона
 */
export async function getRemarkedReservesByPhone(
  token: string,
  phone: string,
  limit: number = 1
): Promise<{
  status: string;
  total: number;
  count: number;
  reserves: Array<{
    id: number;
    name: string;
    phone: string;
    estimated_time: string;
    guests_count: string;
    inner_status: string;
  }>;
}> {
  const request: RemarkedRequest = {
    method: "GetReservesByPhone",
    token,
    phone,
    limit: limit.toString(),
    offset: "0",
    sort_by: "id",
    sort_direction: "DESC",
  };

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to get reserves: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.status === "error") {
    throw new Error(data.message || "Ошибка получения броней");
  }
  
  return data;
}
