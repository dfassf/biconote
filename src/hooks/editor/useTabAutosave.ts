import { useCallback, useEffect, useRef } from "react";
import type { EditorTab } from "../../types";

export function useTabAutosave(
  delay: number,
  onSave: (tab: EditorTab) => Promise<void>
) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const clearTimer = useCallback((tabId: string) => {
    const timer = timersRef.current.get(tabId);
    if (!timer) return;
    clearTimeout(timer);
    timersRef.current.delete(tabId);
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const scheduleSave = useCallback(
    (tab: EditorTab) => {
      clearTimer(tab.id);
      const timer = setTimeout(() => {
        clearTimer(tab.id);
        void onSave(tab);
      }, delay);
      timersRef.current.set(tab.id, timer);
    },
    [clearTimer, delay, onSave]
  );

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    scheduleSave,
    clearTimer,
    clearAllTimers,
  };
}
