import fs from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR, USER_AGENT } from "./config.mjs";

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function fetchJson(url, cacheKey, { refresh = false } = {}) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheKey);
  if (!refresh) {
    try {
      return await readJson(file);
    } catch {}
  }

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const data = await response.json();
      await fs.writeFile(file, JSON.stringify(data));
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 5)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(attempt * 2_000, 10_000)),
        );
    }
  }
  throw lastError;
}

export async function writeCachedReport(iso3, contents, extension) {
  const directory = path.join(CACHE_DIR, "reports");
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `${iso3}.${extension}`);
  await fs.writeFile(file, contents);
  return file;
}
