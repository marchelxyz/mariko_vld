import { bookingApi } from "@shared/api";
import { initEmailService, sendJobApplicationEmail } from "@/lib/emailService";

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

    // Письмо менеджеру — пока используем jobApplication Email API как пример
    initEmailService();
    await sendJobApplicationEmail({
      name: payload.name,
      desiredCity: payload.restaurant.split(",")[0] || "",
      restaurant: payload.restaurant,
      age: 0,
      position: "booking",
      experience: payload.comment,
      phone: payload.phone,
      email: "", // не запрашиваем email у гостя
    });

    return tgResult.success;
  } catch (err) {
    console.error("Ошибка создания бронирования:", err);
    return false;
  }
}; 