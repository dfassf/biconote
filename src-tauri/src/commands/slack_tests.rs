use super::{build_search_query_for_week, build_week_key, week_label_by_day};

#[test]
fn calculates_week_label_boundaries() {
    assert_eq!(week_label_by_day(1), "첫째주");
    assert_eq!(week_label_by_day(7), "첫째주");
    assert_eq!(week_label_by_day(8), "둘째주");
    assert_eq!(week_label_by_day(14), "둘째주");
    assert_eq!(week_label_by_day(15), "셋째주");
    assert_eq!(week_label_by_day(22), "넷째주");
    assert_eq!(week_label_by_day(29), "다섯째주");
    assert_eq!(week_label_by_day(31), "다섯째주");
}

#[test]
fn builds_week_key_from_month_and_day() {
    assert_eq!(build_week_key(3, 1), "3월 첫째주");
    assert_eq!(build_week_key(3, 12), "3월 둘째주");
    assert_eq!(build_week_key(12, 30), "12월 다섯째주");
}

#[test]
fn includes_required_filters_in_search_query() {
    let query = build_search_query_for_week("biobot", "전사-수다", "3월 둘째주");
    assert_eq!(query, "from:@biobot in:전사-수다 \"3월 둘째주\" BICO TABLE");
}
