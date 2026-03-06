import { useState, useCallback, useRef, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import type { AppSettings, WeeklyMenuCache, DayMenu, Weekday } from "../types";
import {
  fetchLunchImages,
  analyzeMenuWithGemini,
  checkLunchMessageTs,
} from "../services/tauriCommands";
import { getNowKST, getWeekdayByOffset, isWeekendByOffset } from "../utils/dateUtils";

type LoadingStatus = "idle" | "fetching" | "analyzing" | "done" | "error";

const CACHE_STORE = "lunch-cache.json";
const CACHE_MAP_KEY = "menu_cache_map";

/** 주차별 캐시 맵 */
type CacheMap = Record<string, WeeklyMenuCache>;

export function useLunchMenu(settings: AppSettings) {
  const [cache, setCache] = useState<WeeklyMenuCache | null>(null);
  const [status, setStatus] = useState<LoadingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const currentDay = getWeekdayByOffset(dayOffset) as Weekday;
  const todayMenu: DayMenu | null =
    cache?.menus.find((m) => m.day === currentDay) ?? null;
  const isWeekendDay = isWeekendByOffset(dayOffset);

  const weekNames = ["", "첫째주", "둘째주", "셋째주", "넷째주", "다섯째주"];

  const getWeekKeyForOffset = (offsetDays: number) => {
    const now = getNowKST();
    now.setDate(now.getDate() + offsetDays);
    const month = now.getMonth() + 1;
    const weekNum = Math.ceil(now.getDate() / 7);
    return `${month}월 ${weekNames[weekNum]}`;
  };

  const getWeekKey = (offsetDays = 0) => getWeekKeyForOffset(offsetDays);

  // 메뉴 데이터가 있는 요일 목록
  const availableDays = cache?.menus.map((m) => m.day) ?? [];

  // < > 네비게이션: 같은 주차 내에서 데이터 있는 요일만 허용
  const canNavigate = (direction: -1 | 1) => {
    let testOffset = dayOffset + direction;
    for (let i = 0; i < 7; i++) {
      const day = getWeekdayByOffset(testOffset);
      if (day === "토" || day === "일") {
        testOffset += direction;
        continue;
      }
      // 주차가 다르면 불가
      if (cache && getWeekKeyForOffset(testOffset) !== cache.weekKey) {
        return false;
      }
      return availableDays.includes(day as Weekday);
    }
    return false;
  };

  const canGoPrev = canNavigate(-1);
  const canGoNext = canNavigate(1);

  // 캐시맵 로드
  const loadCacheMap = async (): Promise<CacheMap> => {
    try {
      const store = await load(CACHE_STORE);
      return (await store.get<CacheMap>(CACHE_MAP_KEY)) ?? {};
    } catch {
      return {};
    }
  };

  // 캐시맵 저장 (이번 주 + 다음 주만 유지)
  const saveCacheMap = async (weekKey: string, data: WeeklyMenuCache) => {
    const store = await load(CACHE_STORE);
    const map = (await store.get<CacheMap>(CACHE_MAP_KEY)) ?? {};
    map[weekKey] = data;

    // 이번 주, 다음 주 키만 유지 (나머지 삭제)
    const thisWeek = getWeekKey();
    const nextWeek = getWeekKey(7);
    const validKeys = new Set([thisWeek, nextWeek]);
    for (const key of Object.keys(map)) {
      if (!validKeys.has(key)) {
        delete map[key];
      }
    }

    await store.set(CACHE_MAP_KEY, map);
    await store.save();
    setCache(data);
  };

  // 앱 시작 시 현재 주차 캐시 로드
  useEffect(() => {
    (async () => {
      const map = await loadCacheMap();
      const weekKey = getWeekKey();
      const saved = map[weekKey];
      if (saved) {
        setCache(saved);
        setStatus("done");
      }
    })();
  }, []);

  const refresh = useCallback(
    async (overrideSettings?: AppSettings) => {
      const s = overrideSettings ?? settingsRef.current;
      const currentCache = cacheRef.current;

      if (!s.slackToken) {
        setError("Slack 토큰이 설정되지 않았습니다.");
        setStatus("error");
        return;
      }

      const weekKey = getWeekKey();

      // 캐시 있고 weekKey 동일하면 ts만 체크
      if (currentCache && currentCache.weekKey === weekKey) {
        setStatus("fetching");
        setError(null);
        try {
          const latestTs = await checkLunchMessageTs(
            s.slackToken,
            s.channelName,
            s.username
          );
          if (latestTs && latestTs === currentCache.slackTs) {
            setStatus("done");
            return;
          }
        } catch {
          // ts 체크 실패해도 전체 fetch 시도
        }
      }

      // 전체 fetch + analyze
      setStatus("fetching");
      setError(null);

      try {
        const images = await fetchLunchImages(
          s.slackToken,
          s.channelName,
          s.username
        );

        if (images.length === 0) {
          // 검색 결과 없으면 캐시맵에서 현재 주차 캐시 확인
          const map = await loadCacheMap();
          if (map[weekKey]) {
            setCache(map[weekKey]);
            setStatus("done");
            return;
          }
          setError("이번 주 점심 메뉴를 찾지 못했습니다.");
          setStatus("error");
          return;
        }

        // 가져온 메시지가 현재 주차인지 검증
        const msgText = images[0].message_text;
        if (!msgText.includes(weekKey)) {
          // 다른 주차 데이터 → 현재 주차 캐시가 있으면 유지
          const map = await loadCacheMap();
          if (map[weekKey]) {
            setCache(map[weekKey]);
            setStatus("done");
            return;
          }
          // 캐시도 없으면 에러 표시 (다른 주차 데이터를 보여주지 않음)
          setError("이번 주 점심 메뉴를 찾지 못했습니다.");
          setStatus("error");
          return;
        }

        if (!s.geminiApiKey) {
          setError("Gemini API Key가 설정되지 않았습니다.");
          setStatus("error");
          return;
        }

        setStatus("analyzing");
        const menuJson = await analyzeMenuWithGemini(
          images[0].url,
          s.geminiApiKey
        );
        const menus: DayMenu[] = JSON.parse(menuJson);

        await saveCacheMap(weekKey, {
          slackTs: images[0].timestamp,
          cachedAt: getNowKST().toISOString(),
          weekKey,
          menus,
          imageUrl: images[0].url,
          messageText: images[0].message_text,
        });

        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    []
  );

  const navigateDay = useCallback((direction: -1 | 1) => {
    setDayOffset((prev) => {
      const next = prev + direction;
      const nextDay = getWeekdayByOffset(next);
      if (nextDay === "토") return prev + (direction > 0 ? 2 : -1);
      if (nextDay === "일") return prev + (direction > 0 ? 1 : -2);
      return next;
    });
  }, []);

  return {
    status,
    error,
    todayMenu,
    cache,
    dayOffset,
    isWeekendDay,
    canGoPrev,
    canGoNext,
    refresh,
    navigateDay,
  };
}
