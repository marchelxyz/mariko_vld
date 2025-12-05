#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const args = process.argv.slice(2);

let dumpOnly = false;
let restoreFrom = null;
let outputPath = null;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case "--dump-only":
      dumpOnly = true;
      break;
    case "--restore-from":
      restoreFrom = args[i + 1];
      if (!restoreFrom || restoreFrom.startsWith("--")) {
        console.error("Provide a path after --restore-from");
        process.exit(1);
      }
      i += 1;
      break;
    case "--output":
      outputPath = args[i + 1];
      if (!outputPath || outputPath.startsWith("--")) {
        console.error("Provide a path after --output");
        process.exit(1);
      }
      i += 1;
      break;
    case "--help":
    case "-h":
      printUsage();
      process.exit(0);
    default:
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
  }
}

if (dumpOnly && restoreFrom) {
  console.error("Use --dump-only or --restore-from, not both.");
  process.exit(1);
}

const sourceUrl = process.env.SUPABASE_DB_URL;
const targetUrl = process.env.TARGET_DB_URL;

if (!restoreFrom && !sourceUrl) {
  console.error("SUPABASE_DB_URL is required to create a dump.");
  process.exit(1);
}

if (!dumpOnly && !targetUrl) {
  console.error("TARGET_DB_URL is required to restore the dump.");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupDir = path.join(rootDir, "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

const dumpFile = resolveDumpPath(
  rootDir,
  restoreFrom ??
    outputPath ??
    path.join(backupDir, `supabase_dump_${timestamp}.sql`),
);

if (!restoreFrom) {
  ensureDir(path.dirname(dumpFile));
}

try {
  if (!restoreFrom) {
    assertBinary("pg_dump");
    createDump(sourceUrl, dumpFile);
  } else {
    if (!fs.existsSync(dumpFile)) {
      throw new Error(`Dump file not found: ${dumpFile}`);
    }
    console.log(`Using existing dump: ${dumpFile}`);
  }

  if (!dumpOnly) {
    assertBinary("psql");
    restoreDump(targetUrl, dumpFile);
  } else {
    console.log("Dump created. Restore skipped (--dump-only).");
  }

  console.log("✅ Done.");
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

function createDump(dbUrl, filePath) {
  console.log(`→ Dumping Supabase to ${filePath}`);

  const dumpFd = fs.openSync(filePath, "w");
  const dump = spawnSync(
    "pg_dump",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--format=plain",
      "--verbose",
      "--dbname",
      dbUrl,
    ],
    { stdio: ["ignore", dumpFd, "inherit"] },
  );
  fs.closeSync(dumpFd);

  if (dump.error) {
    throw dump.error;
  }
  if (dump.status !== 0) {
    throw new Error(`pg_dump exited with code ${dump.status}`);
  }
}

function restoreDump(dbUrl, filePath) {
  console.log(`→ Restoring dump into TARGET_DB_URL`);

  const restore = spawnSync(
    "psql",
    ["--set", "ON_ERROR_STOP=1", "--single-transaction", "--dbname", dbUrl, "--file", filePath],
    { stdio: "inherit" },
  );

  if (restore.error) {
    throw restore.error;
  }
  if (restore.status !== 0) {
    throw new Error(`psql exited with code ${restore.status}`);
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveDumpPath(baseDir, targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
}

function assertBinary(binary) {
  const check = spawnSync(binary, ["--version"], { stdio: "ignore" });
  if (check.error || check.status !== 0) {
    throw new Error(`${binary} is required. Install PostgreSQL client tools and retry.`);
  }
}

function printUsage() {
  console.log(`
Usage: node scripts/migrate-supabase-db.js [--dump-only] [--output <path>] [--restore-from <path>]

Env:
  SUPABASE_DB_URL  Postgres connection string from Supabase (source)
  TARGET_DB_URL    Postgres connection string for the target DB

Examples:
  SUPABASE_DB_URL=... TARGET_DB_URL=... node scripts/migrate-supabase-db.js
  SUPABASE_DB_URL=... node scripts/migrate-supabase-db.js --dump-only --output backups/supabase.sql
  TARGET_DB_URL=... node scripts/migrate-supabase-db.js --restore-from backups/supabase.sql
`);
}
