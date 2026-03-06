import { invoke } from "@tauri-apps/api/core";
import type { LunchImage } from "../types";

interface TauriCommandError {
  code?: string;
  message?: string;
}

function normalizeInvokeError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);

  if (err && typeof err === "object") {
    const commandErr = err as TauriCommandError;
    if (typeof commandErr.message === "string" && commandErr.message.length > 0) {
      const prefix =
        typeof commandErr.code === "string" && commandErr.code.length > 0
          ? `[${commandErr.code}] `
          : "";
      return new Error(`${prefix}${commandErr.message}`);
    }
  }

  return new Error(String(err));
}

async function invokeCommand<T>(
  command: string,
  args: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw normalizeInvokeError(err);
  }
}

export async function fetchLunchImages(
  token: string,
  channelName: string,
  username: string
): Promise<LunchImage[]> {
  return invokeCommand<LunchImage[]>("fetch_lunch_images", {
    token,
    channelName,
    username,
  });
}

export async function checkLunchMessageTs(
  token: string,
  channelName: string,
  username: string
): Promise<string | null> {
  return invokeCommand<string | null>("check_lunch_message_ts", {
    token,
    channelName,
    username,
  });
}

export async function analyzeMenuWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  return invokeCommand<string>("analyze_menu_with_gemini", { imageBase64, apiKey });
}
