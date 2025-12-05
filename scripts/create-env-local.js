#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const force = process.argv.includes("--force");

const targets = [
  {
    name: "frontend",
    dest: path.join(rootDir, ".env.local"),
    sources: [path.join(rootDir, ".env"), path.join(rootDir, ".env.example")],
    transform: addServerApiIfMissing,
  },
  {
    name: "cart-server",
    dest: path.join(rootDir, "server/.env.local"),
    sources: [path.join(rootDir, "server/.env"), path.join(rootDir, "server/.env.example")],
  },
  {
    name: "bot",
    dest: path.join(rootDir, "bot/.env.local"),
    sources: [path.join(rootDir, "bot/.env"), path.join(rootDir, "bot/.env.example")],
  },
];

let created = 0;
let skipped = 0;

targets.forEach((target) => {
  const result = processTarget(target);
  if (result === "created") {
    created += 1;
  } else if (result === "skipped") {
    skipped += 1;
  }
});

console.log(
  `Done. ${created} file${created === 1 ? "" : "s"} created${skipped ? `, ${skipped} skipped` : ""}.`,
);
console.log("Use --force to overwrite existing .env.local files.");

function processTarget(target) {
  const destExists = fs.existsSync(target.dest);
  if (destExists && !force) {
    console.log(`↩️  Skipped ${rel(target.dest)} (already exists)`);
    return "skipped";
  }

  const source = target.sources.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    console.warn(`⚠️  No source env file found for ${target.name} (${rel(target.dest)})`);
    return "missing";
  }

  const raw = fs.readFileSync(source, "utf8");
  const envMap = parseEnv(raw);
  const content = typeof target.transform === "function" ? target.transform(raw, envMap) : raw;

  fs.mkdirSync(path.dirname(target.dest), { recursive: true });
  fs.writeFileSync(target.dest, content);

  console.log(`✅ ${rel(target.dest)} created from ${rel(source)}`);
  return "created";
}

function parseEnv(raw) {
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!match) {
      return;
    }
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  });
  return env;
}

function addServerApiIfMissing(raw, envMap) {
  if (envMap.VITE_SERVER_API_URL) {
    return raw;
  }

  const derivedBase = deriveServerApiBase(envMap);
  if (!derivedBase) {
    return raw;
  }

  const normalized = raw.endsWith("\n") ? raw : `${raw}\n`;
  return `${normalized}VITE_SERVER_API_URL=${derivedBase}\n`;
}

function deriveServerApiBase(envMap) {
  const candidates = [
    envMap.VITE_SERVER_API_URL,
    envMap.VITE_CART_API_URL,
    envMap.VITE_CART_RECALC_URL,
    envMap.VITE_CART_ORDERS_URL,
    envMap.VITE_ADMIN_API_URL,
  ];

  for (const value of candidates) {
    const base = extractApiBase(value);
    if (base) {
      return base;
    }
  }

  return null;
}

function extractApiBase(rawValue) {
  if (!rawValue || !/^https?:\/\//i.test(rawValue)) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    const apiIndex = url.pathname.indexOf("/api");
    if (apiIndex === -1) {
      return null;
    }

    url.pathname = url.pathname.slice(0, apiIndex + 4);
    url.search = "";
    url.hash = "";

    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function rel(filePath) {
  return path.relative(rootDir, filePath) || path.basename(filePath);
}
