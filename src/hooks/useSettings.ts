import { useState, useEffect, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import type { AppSettings } from "../types";

const STORE_FILE = "settings.json";
const SETTINGS_KEY = "app_settings";

const DEFAULT_SETTINGS: AppSettings = {
  slackToken: import.meta.env.VITE_SLACK_TOKEN ?? "",
  channelName: import.meta.env.VITE_CHANNEL_NAME ?? "",
  username: import.meta.env.VITE_USERNAME ?? "",
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY ?? "",
  noteDir: "biconote",
  theme: "monokai",
};

export function useSettings() {
  const [settings, setSettingsState] =
    useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const store = await load(STORE_FILE);
        const saved = await store.get<AppSettings>(SETTINGS_KEY);
        if (saved) {
          setSettingsState({ ...DEFAULT_SETTINGS, ...saved });
        }
      } catch {
        // 첫 실행 시 store가 없을 수 있음
      }
      setIsLoaded(true);
    })();
  }, []);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    const store = await load(STORE_FILE);
    await store.set(SETTINGS_KEY, newSettings);
    await store.save();
    setSettingsState(newSettings);
  }, []);

  return { settings, saveSettings, isLoaded };
}
