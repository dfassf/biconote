import type { Weekday, WeeklyMenuCache } from "../../types";
import { getNowKST, getWeekdayByOffset } from "../../utils/dateUtils";

const WEEK_NAMES = ["", "첫째주", "둘째주", "셋째주", "넷째주", "다섯째주"];

export function getWeekKeyForOffset(offsetDays: number): string {
  const now = getNowKST();
  now.setDate(now.getDate() + offsetDays);
  const month = now.getMonth() + 1;
  const weekNum = Math.ceil(now.getDate() / 7);
  return `${month}월 ${WEEK_NAMES[weekNum]}`;
}

export function getWeekKey(offsetDays = 0): string {
  return getWeekKeyForOffset(offsetDays);
}

export function getAvailableDays(cache: WeeklyMenuCache | null): Weekday[] {
  return cache?.menus.map((menu) => menu.day) ?? [];
}

export function canNavigateDay(
  dayOffset: number,
  direction: -1 | 1,
  cache: WeeklyMenuCache | null,
  availableDays: Weekday[]
): boolean {
  let testOffset = dayOffset + direction;
  for (let i = 0; i < 7; i++) {
    const day = getWeekdayByOffset(testOffset);
    if (day === "토" || day === "일") {
      testOffset += direction;
      continue;
    }
    if (cache && getWeekKeyForOffset(testOffset) !== cache.weekKey) {
      return false;
    }
    return availableDays.includes(day as Weekday);
  }
  return false;
}
