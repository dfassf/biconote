import { invoke } from "@tauri-apps/api/core";
import type { LunchImage } from "../types";

export async function fetchLunchImages(
  token: string,
  channelName: string,
  username: string
): Promise<LunchImage[]> {
  return invoke<LunchImage[]>("fetch_lunch_images", {
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
  return invoke<string | null>("check_lunch_message_ts", {
    token,
    channelName,
    username,
  });
}

export async function analyzeMenuWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  return invoke<string>("analyze_menu_with_gemini", { imageBase64, apiKey });
}
