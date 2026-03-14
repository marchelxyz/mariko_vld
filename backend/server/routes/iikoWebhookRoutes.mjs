import express from "express";
import { ensureDatabase } from "../postgresClient.mjs";
import { createLogger } from "../utils/logger.mjs";
import {
  applyIikoOrderStatusUpdate,
} from "../services/integrationService.mjs";
import {
  extractIikoWebhookEventData,
  extractIikoWebhookEvents,
} from "../services/iikoOrderStatusService.mjs";

const logger = createLogger("iiko-webhook");

const getConfiguredWebhookTokens = () =>
  String(process.env.IIKO_WEBHOOK_TOKENS ?? process.env.IIKO_WEBHOOK_TOKEN ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

const getIncomingWebhookToken = (req) => {
  const authorization = req.get("authorization");
  if (authorization) {
    const match = authorization.match(/^bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
    return authorization.trim();
  }

  for (const headerName of ["x-webhook-token", "x-api-key", "x-auth-token"]) {
    const value = req.get(headerName);
    if (value && value.trim()) {
      return value.trim();
    }
  }

  const queryToken = typeof req.query?.token === "string" ? req.query.token.trim() : "";
  return queryToken || "";
};

const authorizeWebhookRequest = (req) => {
  const configuredTokens = getConfiguredWebhookTokens();
  if (configuredTokens.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        status: 503,
        message: "IIKO_WEBHOOK_TOKEN не настроен",
      };
    }
    return {
      ok: true,
      unsecured: true,
    };
  }

  const incomingToken = getIncomingWebhookToken(req);
  if (!incomingToken || !configuredTokens.includes(incomingToken)) {
    return {
      ok: false,
      status: 401,
      message: "Некорректный webhook token",
    };
  }

  return { ok: true, unsecured: false };
};

export function createIikoWebhookRouter() {
  const router = express.Router();

  router.post("/webhook", async (req, res) => {
    const startTime = Date.now();
    logger.request(req.method, req.path, {
      hasBody: Boolean(req.body),
      contentType: req.get("content-type") ?? null,
    });

    if (!ensureDatabase(res)) {
      return;
    }

    const auth = authorizeWebhookRequest(req);
    if (!auth.ok) {
      logger.warn("Отклонен webhook iiko", {
        reason: auth.message,
        ip: req.ip,
      });
      return res.status(auth.status).json({ success: false, message: auth.message });
    }
    if (auth.unsecured) {
      logger.warn("Webhook iiko принят без токена авторизации (не production)", {
        ip: req.ip,
      });
    }

    try {
      const payload = req.body ?? {};
      const events = extractIikoWebhookEvents(payload);
      if (events.length === 0) {
        logger.warn("Webhook iiko не содержит событий", {
          rawType: Array.isArray(payload) ? "array" : typeof payload,
        });
        return res.status(400).json({
          success: false,
          message: "Webhook не содержит распознаваемых событий",
        });
      }

      const results = [];
      for (const event of events) {
        const parsed = extractIikoWebhookEventData(event);
        if (!parsed.providerOrderId && !parsed.externalId) {
          results.push({
            status: "ignored",
            reason: "missing_order_reference",
            eventName: parsed.eventName,
            rawStatus: parsed.rawStatus,
          });
          continue;
        }

        const updateResult = await applyIikoOrderStatusUpdate({
          providerOrderId: parsed.providerOrderId,
          externalId: parsed.externalId,
          rawStatus: parsed.rawStatus,
          payload: event,
          source: parsed.eventName || "iiko_webhook",
        });

        results.push({
          status: updateResult.success ? "updated" : "ignored",
          reason: updateResult.success ? null : updateResult.reason,
          providerOrderId: parsed.providerOrderId,
          externalId: parsed.externalId,
          rawStatus: parsed.rawStatus,
          normalizedStatus: updateResult.normalizedStatus ?? parsed.normalizedStatus ?? null,
          eventName: parsed.eventName,
        });
      }

      const updated = results.filter((entry) => entry.status === "updated").length;
      const ignored = results.length - updated;
      logger.requestSuccess(req.method, req.path, Date.now() - startTime, 200);
      return res.status(200).json({
        success: true,
        received: events.length,
        updated,
        ignored,
        results,
      });
    } catch (error) {
      logger.requestError(req.method, req.path, error, 500);
      return res.status(500).json({
        success: false,
        message: "Не удалось обработать webhook iiko",
      });
    }
  });

  return router;
}
