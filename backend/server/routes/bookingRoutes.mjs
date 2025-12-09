import express from "express";
import { db, ensureDatabase, query, queryOne } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";

const logger = createLogger('booking');

const REMARKED_API_BASE = "https://app.remarked.ru/api/v1";

/**
 * Получить токен от Remarked API
 */
async function getRemarkedToken(restaurantId) {
  const request = {
    method: "GetToken",
    point: restaurantId,
  };

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = `Не удалось получить токен от сервиса бронирования`;
    try {
      const text = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(text);
      } catch {
        parsedError = { message: text };
      }
      
      if (parsedError.message && parsedError.message.trim() && parsedError.message.toLowerCase() !== "unknown error") {
        errorMessage = parsedError.message.trim();
      } else if (parsedError.error && parsedError.error.trim() && parsedError.error.toLowerCase() !== "unknown error") {
        errorMessage = parsedError.error.trim();
      } else if (response.status === 400) {
        errorMessage = "Неверный запрос к сервису бронирования. Проверьте настройки ресторана.";
      } else if (response.status === 404) {
        errorMessage = "Ресторан не найден в системе бронирования. Проверьте настройки ресторана.";
      } else if (response.status >= 500) {
        errorMessage = "Сервис бронирования временно недоступен. Попробуйте позже.";
      }
    } catch {
      // Используем дефолтное сообщение
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  if (data.status === "error") {
    const errorMessage = data.message && data.message.trim() && data.message.toLowerCase() !== "unknown error"
      ? data.message.trim()
      : `Ошибка получения токена для ресторана ${restaurantId}`;
    throw new Error(errorMessage);
  }
  
  return data;
}

/**
 * Получить доступные временные слоты от Remarked API
 */
async function getRemarkedSlots(token, period, guestsCount, options = {}) {
  const request = {
    method: "GetSlots",
    token,
    reserve_date_period: period,
    guests_count: guestsCount,
  };

  // Добавляем опциональные параметры
  if (options.with_rooms !== undefined) {
    request.with_rooms = options.with_rooms;
  }
  if (options.slot_duration !== undefined) {
    request.slot_duration = options.slot_duration;
  }

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Remarked slots: ${response.status} ${text}`);
  }

  const data = await response.json();
  
  if (data.status === "error") {
    throw new Error(data.message || "Ошибка получения слотов");
  }
  
  return data;
}

/**
 * Создать бронирование в Remarked
 */
async function createRemarkedReserve(token, reserve) {
  // Формируем объект reserve согласно спецификации Remarked API
  const reserveData = {
    name: reserve.name,
    phone: reserve.phone,
    date: reserve.date, // формат: "yyyy-MM-dd"
    time: reserve.time, // формат: "HH:mm"
    guests_count: Number(reserve.guests_count), // обязательно integer
    type: "booking", // "booking" | "banquet"
    source: reserve.source || "mobile_app", // "site" | "mobile_app"
  };

  // Опциональные поля добавляем только если они есть
  if (reserve.email) {
    reserveData.email = reserve.email;
  }
  if (reserve.comment) {
    reserveData.comment = reserve.comment;
  }
  if (reserve.duration) {
    reserveData.duration = Number(reserve.duration);
  }
  if (reserve.eventTags && Array.isArray(reserve.eventTags) && reserve.eventTags.length > 0) {
    reserveData.eventTags = reserve.eventTags.map(id => Number(id));
  }

  const request = {
    method: "CreateReserve",
    token,
    reserve: reserveData,
  };

  const response = await fetch(`${REMARKED_API_BASE}/ApiReservesWidget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create Remarked reserve: ${response.status} ${text}`);
  }

  const data = await response.json();
  
  if (data.status === "error") {
    throw new Error(data.message || "Ошибка создания бронирования в Remarked");
  }
  
  return data;
}

/**
 * Форматирование телефона для Remarked API
 */
function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, "");
  
  // Если номер начинается с 8, заменяем на 7
  if (cleaned.startsWith("8")) {
    return `+7${cleaned.slice(1)}`;
  }
  
  // Если номер начинается с 7, добавляем +
  if (cleaned.startsWith("7")) {
    return `+${cleaned}`;
  }
  
  // Если номер уже начинается с +7, возвращаем как есть
  if (phone.startsWith("+7")) {
    return phone;
  }
  
  // Если номер короткий (10 цифр), добавляем +7
  if (cleaned.length === 10) {
    return `+7${cleaned}`;
  }
  
  // В остальных случаях возвращаем как есть (может быть уже отформатирован)
  return phone.startsWith("+") ? phone : `+${phone}`;
}

export function createBookingRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    logger.request(req.method, req.path, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    
    if (!ensureDatabase(res)) {
      logger.error('База данных не инициализирована');
      return;
    }
    next();
  });

  /**
   * GET /booking/slots
   * Получение доступных временных слотов со столами для бронирования
   * 
   * Query параметры:
   * - restaurantId: string (UUID ресторана) - обязательный
   * - date: string (Дата в формате YYYY-MM-DD) - обязательный
   * - guests_count: number (Количество гостей) - обязательный
   * - with_rooms: boolean (Получить информацию о залах и столах) - опционально, по умолчанию true
   */
  router.get("/slots", async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { restaurantId, date, guests_count, with_rooms } = req.query;

      // Валидация обязательных параметров
      if (!restaurantId || !date || !guests_count) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/slots', new Error('Отсутствуют обязательные параметры'), 400);
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют обязательные параметры: restaurantId, date, guests_count',
        });
      }

      // Получаем ресторан из БД
      const restaurant = await queryOne(
        `SELECT id, name, remarked_restaurant_id FROM restaurants WHERE id = $1`,
        [restaurantId]
      );

      if (!restaurant) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/slots', new Error('Ресторан не найден'), 404);
        return res.status(404).json({
          success: false,
          error: 'Ресторан не найден',
        });
      }

      if (!restaurant.remarked_restaurant_id) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/slots', new Error('У ресторана не настроен Remarked ID'), 400);
        return res.status(400).json({
          success: false,
          error: 'Ресторан не настроен для бронирования. Обратитесь к администратору.',
        });
      }

      // Получаем токен от ReMarked API
      let token;
      try {
        const tokenData = await getRemarkedToken(restaurant.remarked_restaurant_id);
        token = tokenData.token;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/slots', error, 500);
        
        // Формируем понятное сообщение об ошибке
        let errorMessage = 'Не удалось подключиться к сервису бронирования. Попробуйте позже.';
        if (error instanceof Error && error.message && error.message.trim() && error.message.toLowerCase() !== "unknown error") {
          errorMessage = error.message.trim();
        }
        
        return res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }

      // Формируем период (одна дата)
      const dateStr = date;
      const period = {
        from: dateStr,
        to: dateStr,
      };

      const guestsCount = Number(guests_count);
      const withRooms = with_rooms === 'true' || with_rooms === undefined || with_rooms === '';

      // Получаем слоты со столами из ReMarked API
      try {
        const slotsResponse = await getRemarkedSlots(
          token,
          period,
          guestsCount,
          { with_rooms: withRooms }
        );

        const duration = Date.now() - startTime;
        logger.requestSuccess('GET', '/slots', duration, 200);

        return res.json({
          success: true,
          data: {
            slots: slotsResponse.slots || [],
            date: dateStr,
            guests_count: guestsCount,
          },
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.requestError('GET', '/slots', error, 500);
        
        // Формируем понятное сообщение об ошибке
        let errorMessage = 'Не удалось получить доступные слоты. Попробуйте позже.';
        if (error instanceof Error && error.message && error.message.trim() && error.message.toLowerCase() !== "unknown error") {
          errorMessage = error.message.trim();
        }
        
        if (error instanceof Error && error.message && error.message.includes('400')) {
          return res.status(400).json({
            success: false,
            error: errorMessage,
          });
        }

        return res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/slots', error, 500);
      logger.error('Ошибка получения слотов', error);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = 'Не удалось получить доступные слоты. Попробуйте позже.';
      if (error instanceof Error && error.message && error.message.trim() && error.message.toLowerCase() !== "unknown error") {
        errorMessage = error.message.trim();
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * Создать бронирование столика
   */
  router.post("/", async (req, res) => {
    const startTime = Date.now();
    
    try {
      const {
        restaurantId,
        name,
        phone,
        email,
        date,
        time,
        guestsCount,
        comment,
        eventTags,
        source = "mobile_app",
        duration: bookingDuration,
      } = req.body ?? {};

      // Валидация обязательных полей
      if (!restaurantId || typeof restaurantId !== "string") {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Не указан restaurantId'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "Необходимо указать restaurantId" 
        });
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Не указано имя'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "Необходимо указать имя" 
        });
      }

      if (!phone || typeof phone !== "string" || !phone.trim()) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Не указан телефон'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "Необходимо указать телефон" 
        });
      }

      if (!date || typeof date !== "string") {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Не указана дата'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "Необходимо указать дату бронирования" 
        });
      }

      if (!time || typeof time !== "string") {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Не указано время'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "Необходимо указать время бронирования" 
        });
      }

      // Приводим guestsCount к числу на случай, если придет строка
      const guestsCountNum = typeof guestsCount === "number" ? guestsCount : parseInt(String(guestsCount), 10);
      
      if (!guestsCountNum || isNaN(guestsCountNum) || guestsCountNum < 1) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Не указано количество гостей'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "Необходимо указать количество гостей (минимум 1)" 
        });
      }

      logger.info('Создание бронирования', { restaurantId, name, phone, date, time, guestsCount });

      // Получаем информацию о ресторане из БД
      const restaurant = await queryOne(
        `SELECT id, name, remarked_restaurant_id FROM restaurants WHERE id = $1`,
        [restaurantId]
      );

      if (!restaurant) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('Ресторан не найден'), 404);
        return res.status(404).json({ 
          success: false, 
          error: "Ресторан не найден" 
        });
      }

      if (!restaurant.remarked_restaurant_id) {
        const duration = Date.now() - startTime;
        logger.requestError('POST', '/', new Error('У ресторана не настроен Remarked ID'), 400);
        return res.status(400).json({ 
          success: false, 
          error: "У ресторана не настроен ID для системы бронирования. Обратитесь к администратору." 
        });
      }

      // Получаем токен от Remarked
      logger.debug('Получение токена от Remarked', { remarkedRestaurantId: restaurant.remarked_restaurant_id });
      const tokenData = await getRemarkedToken(restaurant.remarked_restaurant_id);
      const token = tokenData.token;

      // Форматируем телефон
      const formattedPhone = formatPhone(phone);

      // Создаем бронирование в Remarked
      logger.debug('Создание бронирования в Remarked', { 
        token: token.substring(0, 10) + '...',
        date,
        time,
        guestsCount 
      });

      const remarkedReserve = await createRemarkedReserve(token, {
        name: name.trim(),
        phone: formattedPhone,
        email: email?.trim() || undefined,
        date,
        time,
        guests_count: guestsCountNum,
        comment: comment?.trim() || undefined,
        eventTags: eventTags || [],
        source,
        duration: bookingDuration,
      });

      // Проверяем, что получили валидный ответ от Remarked
      if (!remarkedReserve || typeof remarkedReserve !== 'object') {
        throw new Error('Неверный формат ответа от сервиса бронирования');
      }

      // Безопасно извлекаем reserve_id (может быть 0, null или undefined)
      const reserveId = remarkedReserve.reserve_id != null ? remarkedReserve.reserve_id : null;

      logger.info('Бронирование создано в Remarked', { 
        reserveId: reserveId,
        restaurantId: restaurant.remarked_restaurant_id
      });

      // Сохраняем бронирование в БД
      const bookingResult = await query(
        `INSERT INTO bookings (
          restaurant_id, 
          remarked_restaurant_id, 
          remarked_reserve_id,
          customer_name, 
          customer_phone, 
          customer_email,
          booking_date, 
          booking_time, 
          guests_count, 
          comment, 
          event_tags, 
          source, 
          status,
          remarked_response
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, created_at`,
        [
          restaurantId,
          restaurant.remarked_restaurant_id,
          reserveId,
          name.trim(),
          formattedPhone,
          email?.trim() || null,
          date,
          time,
          guestsCountNum,
          comment?.trim() || null,
          JSON.stringify(eventTags || []),
          source,
          'created',
          JSON.stringify(remarkedReserve),
        ]
      );

      const booking = bookingResult.rows[0];

      if (!booking || !booking.id) {
        throw new Error('Не удалось сохранить бронирование в базу данных');
      }

      logger.info('Бронирование сохранено в БД', { 
        bookingId: booking.id,
        reserveId: reserveId 
      });

      const duration = Date.now() - startTime;
      logger.requestSuccess('POST', '/', duration, 200);

      return res.json({
        success: true,
        booking: {
          id: booking.id,
          reserveId: reserveId,
        },
        data: {
          form_url: remarkedReserve.form_url || undefined,
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('POST', '/', error, 500);
      logger.error('Ошибка создания бронирования', error);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = "Не удалось создать бронирование. Попробуйте позже.";
      if (error instanceof Error && error.message && error.message.trim() && error.message.toLowerCase() !== "unknown error") {
        errorMessage = error.message.trim();
      }
      
      return res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  /**
   * Получить список бронирований (для статистики/админки)
   */
  router.get("/", async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { restaurantId, phone, limit = 50, offset = 0 } = req.query;

      let queryText = `
        SELECT 
          b.id,
          b.restaurant_id,
          b.remarked_restaurant_id,
          b.remarked_reserve_id,
          b.customer_name,
          b.customer_phone,
          b.customer_email,
          b.booking_date,
          b.booking_time,
          b.guests_count,
          b.comment,
          b.event_tags,
          b.source,
          b.status,
          b.created_at,
          r.name as restaurant_name
        FROM bookings b
        LEFT JOIN restaurants r ON b.restaurant_id = r.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramIndex = 1;

      if (restaurantId) {
        queryText += ` AND b.restaurant_id = $${paramIndex++}`;
        params.push(restaurantId);
      }

      if (phone) {
        queryText += ` AND b.customer_phone = $${paramIndex++}`;
        params.push(phone);
      }

      queryText += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const result = await query(queryText, params);

      const duration = Date.now() - startTime;
      logger.requestSuccess('GET', '/', duration, 200);

      return res.json({
        success: true,
        bookings: result.rows.map((row) => ({
          id: row.id,
          restaurantId: row.restaurant_id,
          restaurantName: row.restaurant_name,
          remarkedRestaurantId: row.remarked_restaurant_id,
          remarkedReserveId: row.remarked_reserve_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          customerEmail: row.customer_email,
          bookingDate: row.booking_date,
          bookingTime: row.booking_time,
          guestsCount: row.guests_count,
          comment: row.comment,
          eventTags: row.event_tags,
          source: row.source,
          status: row.status,
          createdAt: row.created_at,
        })),
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.requestError('GET', '/', error, 500);
      logger.error('Ошибка получения списка бронирований', error);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = "Не удалось получить список бронирований. Попробуйте позже.";
      if (error instanceof Error && error.message && error.message.trim() && error.message.toLowerCase() !== "unknown error") {
        errorMessage = error.message.trim();
      }
      
      return res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  return router;
}
