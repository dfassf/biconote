import { useState } from "react";
import type { DayMenu, WeeklyMenuCache } from "../../types";
import { getKSTDateStr } from "../../utils/dateUtils";

type LoadingStatus = "idle" | "fetching" | "analyzing" | "done" | "error";

interface Props {
  status: LoadingStatus;
  error: string | null;
  todayMenu: DayMenu | null;
  cache: WeeklyMenuCache | null;
  dayOffset: number;
  isWeekendDay: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onRefresh: () => void;
  onNavigateDay: (direction: -1 | 1) => void;
}

interface MenuSectionProps {
  title: string;
  items: string[];
}

function MenuSection({ title, items }: MenuSectionProps) {
  if (items.length === 0) return null;
  return (
    <div className="menu-section">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function LunchPanel({
  status,
  error,
  todayMenu,
  cache,
  dayOffset,
  isWeekendDay,
  canGoPrev,
  canGoNext,
  onRefresh,
  onNavigateDay,
}: Props) {
  const [showImage, setShowImage] = useState(false);

  return (
    <div className="lunch-panel">
      <div className="lunch-header">
        <div className="lunch-header-title">오늘의 🍚</div>
        <div className="lunch-header-date-nav">
          <button
            className="day-nav-btn"
            disabled={!canGoPrev}
            onClick={() => onNavigateDay(-1)}
          >
            &lt;
          </button>
          <div className="lunch-header-date">{getKSTDateStr(dayOffset)}</div>
          <button
            className="day-nav-btn"
            disabled={!canGoNext}
            onClick={() => onNavigateDay(1)}
          >
            &gt;
          </button>
        </div>
        {status === "error" && (
          <button className="lunch-refresh-btn" onClick={onRefresh}>
            새로고침
          </button>
        )}
      </div>
      <div className="lunch-panel-content">
        {error && <div className="lunch-error">{error}</div>}

        {(status === "fetching" || status === "analyzing") && (
          <div className="lunch-loading">메뉴 로딩 중...</div>
        )}

        {isWeekendDay && status !== "fetching" && status !== "analyzing" && (
          <div className="lunch-weekend">주말입니다</div>
        )}

        {!isWeekendDay && todayMenu && (
          <div className="claude-result">
            <MenuSection title="중식" items={todayMenu.lunch} />
            <MenuSection title="석식" items={todayMenu.dinner} />
          </div>
        )}

        {!isWeekendDay &&
          status === "done" &&
          !todayMenu &&
          !error && (
            <div className="lunch-empty">해당 요일의 메뉴 정보가 없습니다.</div>
          )}

        {cache?.imageUrl && status === "done" && (
          <button
            className="lunch-view-image-btn"
            onClick={() => setShowImage(true)}
          >
            메뉴 원본 이미지 보기
          </button>
        )}
      </div>

      {showImage && cache?.imageUrl && (
        <div className="image-overlay" onClick={() => setShowImage(false)}>
          <img
            src={cache.imageUrl}
            alt="메뉴 원본"
            className="image-overlay-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
