use super::{
    build_search_query_for_week, build_week_key, resolve_username_with_users_api,
    search_messages_with_api, week_label_by_day,
};
use mockito::{Matcher, Server};

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

#[tokio::test]
async fn returns_ascii_username_without_users_api_call() {
    let client = reqwest::Client::new();
    let resolved = resolve_username_with_users_api(
        &client,
        "token",
        "dev.user",
        "http://127.0.0.1:9/users.list",
    )
    .await
    .expect("ASCII username should bypass users.list lookup");

    assert_eq!(resolved, "dev.user");
}

#[tokio::test]
async fn resolves_display_name_with_mocked_users_api() {
    let mut server = Server::new_async().await;
    let users_api = format!("{}/users.list", server.url());
    let _mock = server
        .mock("GET", "/users.list")
        .match_header("authorization", "Bearer test-token")
        .match_query(Matcher::UrlEncoded("limit".into(), "200".into()))
        .with_status(200)
        .with_body(
            r#"{
  "ok": true,
  "members": [
    {
      "real_name": "홍길동",
      "profile": { "display_name": "길동" },
      "name": "hong"
    }
  ],
  "response_metadata": { "next_cursor": "" }
}"#,
        )
        .create_async()
        .await;

    let client = reqwest::Client::new();
    let resolved = resolve_username_with_users_api(&client, "test-token", "홍길동", &users_api)
        .await
        .expect("display name should resolve to Slack username");

    assert_eq!(resolved, "hong");
}

#[tokio::test]
async fn parses_search_messages_with_mocked_slack_api() {
    let mut server = Server::new_async().await;
    let search_api = format!("{}/search.messages", server.url());
    let query = "from:@biobot in:전사-수다 \"3월 둘째주\" BICO TABLE";
    let _mock = server
        .mock("GET", "/search.messages")
        .match_header("authorization", "Bearer token")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("query".into(), query.into()),
            Matcher::UrlEncoded("count".into(), "1".into()),
            Matcher::UrlEncoded("sort".into(), "timestamp".into()),
            Matcher::UrlEncoded("sort_dir".into(), "desc".into()),
        ]))
        .with_status(200)
        .with_body(
            r#"{
  "ok": true,
  "messages": {
    "matches": [
      {
        "text": "3월 둘째주 BICO TABLE",
        "ts": "123.45",
        "files": []
      }
    ]
  }
}"#,
        )
        .create_async()
        .await;

    let client = reqwest::Client::new();
    let matches = search_messages_with_api(&client, "token", query, 1, &search_api)
        .await
        .expect("search.messages response should parse");

    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].ts.as_deref(), Some("123.45"));
    assert_eq!(matches[0].text.as_deref(), Some("3월 둘째주 BICO TABLE"));
}

#[tokio::test]
async fn returns_error_when_slack_api_returns_not_ok() {
    let mut server = Server::new_async().await;
    let search_api = format!("{}/search.messages", server.url());
    let query = "q";
    let _mock = server
        .mock("GET", "/search.messages")
        .match_header("authorization", "Bearer token")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("query".into(), query.into()),
            Matcher::UrlEncoded("count".into(), "1".into()),
            Matcher::UrlEncoded("sort".into(), "timestamp".into()),
            Matcher::UrlEncoded("sort_dir".into(), "desc".into()),
        ]))
        .with_status(200)
        .with_body(r#"{"ok":false,"error":"invalid_auth"}"#)
        .create_async()
        .await;

    let client = reqwest::Client::new();
    let err = match search_messages_with_api(&client, "token", query, 1, &search_api).await {
        Ok(_) => panic!("ok=false response should be treated as error"),
        Err(err) => err,
    };

    assert!(err.contains("invalid_auth"));
}
