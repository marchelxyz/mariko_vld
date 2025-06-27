import { bookingApi } from "@shared/api";
import { initEmailService, sendBookingEmail } from "@/services/emailService";

export interface BookingPayload {
  name: string;
  phone: string;
  guests: string;
  date: string;
  time: string;
  restaurant: string;
  comment?: string;
}

/**
 * Создаёт бронирование через Telegram-бот + отправляет email менеджеру.
 */
export const createBooking = async (payload: BookingPayload): Promise<boolean> => {
  try {
    const tgResult = await bookingApi.submitBooking({
      ...payload,
      guests: parseInt(payload.guests, 10) || 1,
      birthDate: "", // не запрашиваем дату рождения при бронировании
    });

    // Отправляем письмо с бронированием
    initEmailService();
    await sendBookingEmail({
      name: payload.name,
      phone: payload.phone,
      guests: parseInt(payload.guests, 10) || 1,
      date: payload.date,
      time: payload.time,
      restaurant: payload.restaurant,
      comment: payload.comment,
    });

    return tgResult.success;
  } catch (err) {
    console.error("Ошибка создания бронирования:", err);
    return false;
  }
}; 