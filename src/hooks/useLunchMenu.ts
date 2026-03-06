import { useState, useCallback, useRef, useEffect } from "react";
import type { AppSettings, WeeklyMenuCache, DayMenu, Weekday } from "../types";
import {
  fetchLunchImages,
  analyzeMenuWithGemini,
  checkLunchMessageTs,
} from "../services/tauriCommands";
import { getNowKST, getWeekdayByOffset, isWeekendByOffset } from "../utils/dateUtils";
import { loadCacheMap, saveCacheMap } from "./lunch/cacheStore";
import {
  canNavigateDay,
  getAvailableDays,
  getWeekKey,
} from "./lunch/weekUtils";

type LoadingStatus = "idle" | "fetching" | "analyzing" | "done" | "error";

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

  // 메뉴 데이터가 있는 요일 목록
  const availableDays = getAvailableDays(cache);
  const canGoPrev = canNavigateDay(dayOffset, -1, cache, availableDays);
  const canGoNext = canNavigateDay(dayOffset, 1, cache, availableDays);

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

  const restoreCachedWeek = useCallback(async (weekKey: string): Promise<boolean> => {
    const map = await loadCacheMap();
    const saved = map[weekKey];
    if (!saved) return false;
    setCache(saved);
    setStatus("done");
    return true;
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
          if (await restoreCachedWeek(weekKey)) {
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
          if (await restoreCachedWeek(weekKey)) {
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
        const nextCache: WeeklyMenuCache = {
          slackTs: images[0].timestamp,
          cachedAt: getNowKST().toISOString(),
          weekKey,
          menus,
          imageUrl: images[0].url,
          messageText: images[0].message_text,
        };

        await saveCacheMap(weekKey, nextCache, [getWeekKey(), getWeekKey(7)]);
        setCache(nextCache);

        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [restoreCachedWeek]
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
