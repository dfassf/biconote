export interface LunchImage {
  url: string;
  filename: string;
  timestamp: string;
  message_text: string;
}

export interface EditorTab {
  id: string;
  filePath: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  isModified: boolean;
}

export type ThemeId =
  | "monokai" | "dracula" | "nord" | "github-dark" | "solarized-dark"
  | "github-light" | "solarized-light" | "one-light" | "strawberry-milk";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  bg: string;
  fg: string;
  accent: string;
}

export const THEMES: ThemeInfo[] = [
  { id: "monokai", label: "Sublime (기본)", bg: "#282923", fg: "#f8f8f2", accent: "#a6e22e" },
  { id: "dracula", label: "Dracula", bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9" },
  { id: "nord", label: "Nord", bg: "#2e3440", fg: "#eceff4", accent: "#a3be8c" },
  { id: "github-dark", label: "GitHub Dark", bg: "#0d1117", fg: "#e6edf3", accent: "#3fb950" },
  { id: "solarized-dark", label: "Solarized", bg: "#002b36", fg: "#fdf6e3", accent: "#b58900" },
  { id: "github-light", label: "GitHub Light", bg: "#ffffff", fg: "#1f2328", accent: "#1a7f37" },
  { id: "solarized-light", label: "Solarized Light", bg: "#fdf6e3", fg: "#586e75", accent: "#b58900" },
  { id: "one-light", label: "One Light", bg: "#fafafa", fg: "#383a42", accent: "#4078f2" },
  { id: "strawberry-milk", label: "Strawberry Milk", bg: "#fff5f5", fg: "#5c3a3a", accent: "#e8578a" },
];

export type Weekday = "월" | "화" | "수" | "목" | "금";

export interface DayMenu {
  day: Weekday;
  lunch: string[];
  dinner: string[];
}

export interface WeeklyMenuCache {
  slackTs: string;
  cachedAt: string;
  weekKey: string;
  menus: DayMenu[];
  imageUrl: string;
  messageText: string;
}

export interface AppSettings {
  slackToken: string;
  channelName: string;
  username: string;
  geminiApiKey: string;
  noteDir: string;
  theme: ThemeId;
  resolvedChannelId?: string;
  resolvedUserId?: string;
}
