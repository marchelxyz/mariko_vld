#!/usr/bin/env node

import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  encryptSecretValue,
  hasSecretsMasterKeyConfigured,
  isEncryptedSecretValue,
} from "../utils/secretsCrypto.mjs";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: false });

const DATABASE_URL = process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL не задан");
  process.exit(1);
}

if (!hasSecretsMasterKeyConfigured()) {
  console.error("❌ APP_SECRETS_MASTER_KEY или SECRETS_ENCRYPTION_KEY не настроен");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "1" ||
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const secretFields = ["api_login", "source_key"];

const isPlaintextSecret = (value) =>
  typeof value === "string" && value.trim().length > 0 && !isEncryptedSecretValue(value);

try {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, restaurant_id, provider, api_login, source_key
      FROM restaurant_integrations
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id ASC
    `);

    const updates = rows
      .map((row) => {
        const payload = {};
        for (const field of secretFields) {
          if (isPlaintextSecret(row[field])) {
            payload[field] = encryptSecretValue(row[field]);
          }
        }
        return {
          id: row.id,
          restaurantId: row.restaurant_id,
          provider: row.provider,
          updates: payload,
        };
      })
      .filter((row) => Object.keys(row.updates).length > 0);

    console.log(
      JSON.stringify(
        {
          totalRows: rows.length,
          rowsNeedingEncryption: updates.length,
          dryRun: !apply,
          sample: updates.slice(0, 20).map((row) => ({
            id: row.id,
            restaurantId: row.restaurantId,
            provider: row.provider,
            fields: Object.keys(row.updates),
          })),
        },
        null,
        2,
      ),
    );

    if (apply && updates.length > 0) {
      await client.query("BEGIN");
      for (const row of updates) {
        const assignments = [];
        const values = [];
        let index = 1;

        for (const field of secretFields) {
          if (!(field in row.updates)) {
            continue;
          }
          assignments.push(`${field} = $${index++}`);
          values.push(row.updates[field]);
        }

        values.push(row.id);
        await client.query(
          `UPDATE restaurant_integrations
           SET ${assignments.join(", ")}, updated_at = NOW()
           WHERE id = $${index}`,
          values,
        );
      }
      await client.query("COMMIT");
      console.log(`✅ Зашифровано строк: ${updates.length}`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error("❌ Не удалось выполнить backfill секретов restaurant_integrations");
  console.error(error?.message || error);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
