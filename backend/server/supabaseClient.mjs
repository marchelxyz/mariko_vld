import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config.mjs";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠️  SUPABASE env vars not found. Orders will only be logged.");
}

export const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

export const ensureSupabase = (res) => {
  if (!supabase) {
    res
      .status(503)
      .json({ success: false, message: "Управление доступно только при подключенном Supabase" });
    return false;
  }
  return true;
};
