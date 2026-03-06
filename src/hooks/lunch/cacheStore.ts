import { load } from "@tauri-apps/plugin-store";
import type { WeeklyMenuCache } from "../../types";

const CACHE_STORE = "lunch-cache.json";
const CACHE_MAP_KEY = "menu_cache_map";

type CacheMap = Record<string, WeeklyMenuCache>;

export async function loadCacheMap(): Promise<CacheMap> {
  try {
    const store = await load(CACHE_STORE);
    return (await store.get<CacheMap>(CACHE_MAP_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function saveCacheMap(
  weekKey: string,
  data: WeeklyMenuCache,
  validKeys: string[]
): Promise<void> {
  const store = await load(CACHE_STORE);
  const map = (await store.get<CacheMap>(CACHE_MAP_KEY)) ?? {};
  map[weekKey] = data;

  const validKeySet = new Set(validKeys);
  for (const key of Object.keys(map)) {
    if (!validKeySet.has(key)) {
      delete map[key];
    }
  }

  await store.set(CACHE_MAP_KEY, map);
  await store.save();
}
