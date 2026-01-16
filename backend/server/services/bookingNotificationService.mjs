import { queryMany, queryOne } from "../postgresClient.mjs";

const DEFAULT_BATCH_SIZE = 50;

export const enqueueBookingNotification = async ({
  bookingId,
  restaurantId,
  platform,
  recipientId,
  message,
  payload,
}) => {
  const safePayload = payload ? JSON.stringify(payload) : JSON.stringify({});
  return await queryOne(
    `INSERT INTO booking_notifications (
      booking_id,
      restaurant_id,
      platform,
      recipient_id,
      message,
      payload,
      status,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', NOW(), NOW())
    RETURNING id`,
    [bookingId, restaurantId, platform, recipientId, message, safePayload],
  );
};

export const fetchPendingBookingNotifications = async (limit = DEFAULT_BATCH_SIZE) =>
  await queryMany(
    `SELECT *
     FROM booking_notifications
     WHERE status = 'pending' AND scheduled_at <= NOW()
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );

export const markBookingNotificationSent = async (id) =>
  await queryOne(
    `UPDATE booking_notifications
     SET status = 'sent', sent_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id],
  );

export const markBookingNotificationFailed = async (id, errorMessage) =>
  await queryOne(
    `UPDATE booking_notifications
     SET status = 'failed',
         attempts = attempts + 1,
         last_error = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [id, errorMessage],
  );
