/** KST 기준 현재 Date 객체 반환 */
export function getNowKST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}

/** KST 기준 날짜 문자열 "YYYY.MM.DD (요일)" */
export function getKSTDateStr(offset = 0): string {
  const now = getNowKST();
  now.setDate(now.getDate() + offset);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const day = days[now.getDay()];
  return `${y}.${m}.${d} (${day})`;
}

/** offset 적용된 날짜의 요일 한글 */
export function getWeekdayByOffset(offset: number): string {
  const now = getNowKST();
  now.setDate(now.getDate() + offset);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[now.getDay()];
}

/** KST 기준 오늘이 주말인지 */
export function isWeekendByOffset(offset: number): boolean {
  const day = getWeekdayByOffset(offset);
  return day === "일" || day === "토";
}

/** KST 기준 오늘의 date string (변경 감지용) */
export function getKSTDateString(): string {
  return getNowKST().toDateString();
}
