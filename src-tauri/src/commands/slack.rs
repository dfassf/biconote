use base64::Engine;
use chrono::{Datelike, FixedOffset, Utc};
use serde::{Deserialize, Serialize};

const SLACK_USERS_API: &str = "https://slack.com/api/users.list";
const SLACK_SEARCH_API: &str = "https://slack.com/api/search.messages";
const KST_OFFSET_SECONDS: i32 = 9 * 3600;

#[derive(Serialize, Clone)]
pub struct LunchImage {
    pub url: String,
    pub filename: String,
    pub timestamp: String,
    pub message_text: String,
}

// ── Slack search.messages 응답 타입 ──

#[derive(Deserialize)]
struct SearchResponse {
    ok: bool,
    error: Option<String>,
    messages: Option<SearchMessages>,
}

#[derive(Deserialize)]
struct SearchMessages {
    matches: Option<Vec<SearchMatch>>,
}

#[derive(Deserialize)]
struct SearchMatch {
    text: Option<String>,
    ts: Option<String>,
    #[allow(dead_code)]
    username: Option<String>,
    files: Option<Vec<SlackFile>>,
}

#[derive(Deserialize)]
struct SlackFile {
    url_private: Option<String>,
    mimetype: Option<String>,
    name: Option<String>,
    thumb_720: Option<String>,
    thumb_1024: Option<String>,
    thumb_480: Option<String>,
}

// ── display name → Slack username 변환 ──

async fn resolve_username(
    client: &reqwest::Client,
    token: &str,
    display_name: &str,
) -> Result<String, String> {
    if display_name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-')
    {
        return Ok(display_name.to_string());
    }

    let mut cursor = String::new();
    loop {
        let mut params = vec![("limit", "200")];
        if !cursor.is_empty() {
            params.push(("cursor", cursor.as_str()));
        }

        let res = client
            .get(SLACK_USERS_API)
            .header("Authorization", format!("Bearer {}", token))
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("users.list 요청 실패: {}", e))?;

        let data: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("users.list 파싱 실패: {}", e))?;

        if !data["ok"].as_bool().unwrap_or(false) {
            return Err(format!(
                "users.list 오류: {}",
                data["error"].as_str().unwrap_or("unknown")
            ));
        }

        if let Some(members) = data["members"].as_array() {
            for member in members {
                let real_name = member["real_name"].as_str().unwrap_or("");
                let dn = member["profile"]["display_name"].as_str().unwrap_or("");
                if real_name == display_name || dn == display_name {
                    if let Some(name) = member["name"].as_str() {
                        return Ok(name.to_string());
                    }
                }
            }
        }

        let next = data["response_metadata"]["next_cursor"]
            .as_str()
            .unwrap_or("");
        if next.is_empty() {
            break;
        }
        cursor = next.to_string();
    }

    Ok(display_name.to_string())
}

fn week_label_by_day(day: u32) -> &'static str {
    let week_num = ((day.saturating_sub(1)) / 7) + 1;
    match week_num {
        1 => "첫째주",
        2 => "둘째주",
        3 => "셋째주",
        4 => "넷째주",
        _ => "다섯째주",
    }
}

fn build_week_key(month: u32, day: u32) -> String {
    format!("{}월 {}", month, week_label_by_day(day))
}

// ── KST 현재 주차 키 ("N월 N째주") ──
fn get_current_week_key() -> String {
    let kst = FixedOffset::east_opt(KST_OFFSET_SECONDS).expect("KST offset should be valid");
    let now_kst = Utc::now().with_timezone(&kst);
    build_week_key(now_kst.month(), now_kst.day())
}

fn build_search_query(slack_username: &str, channel_name: &str) -> String {
    let week_key = get_current_week_key();
    build_search_query_for_week(slack_username, channel_name, &week_key)
}

fn build_search_query_for_week(slack_username: &str, channel_name: &str, week_key: &str) -> String {
    format!(
        "from:@{} in:{} \"{}\" BICO TABLE",
        slack_username, channel_name, week_key
    )
}

async fn search_messages(
    client: &reqwest::Client,
    token: &str,
    query: &str,
    count: u8,
) -> Result<Vec<SearchMatch>, String> {
    let count_s = count.to_string();
    let res = client
        .get(SLACK_SEARCH_API)
        .header("Authorization", format!("Bearer {}", token))
        .query(&[
            ("query", query),
            ("count", count_s.as_str()),
            ("sort", "timestamp"),
            ("sort_dir", "desc"),
        ])
        .send()
        .await
        .map_err(|e| format!("HTTP 요청 실패: {}", e))?;

    let data: SearchResponse = res
        .json()
        .await
        .map_err(|e| format!("JSON 파싱 실패: {}", e))?;

    if !data.ok {
        return Err(format!(
            "Slack API 오류: {}",
            data.error.unwrap_or_default()
        ));
    }

    Ok(data.messages.and_then(|m| m.matches).unwrap_or_default())
}

// ── 최신 메시지 ts만 확인 (캐시 유효성 체크용, 경량) ──

#[tauri::command]
pub async fn check_lunch_message_ts(
    token: String,
    channel_name: String,
    username: String,
) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let slack_username = resolve_username(&client, &token, &username).await?;
    let week_key = get_current_week_key();
    let query = build_search_query(&slack_username, &channel_name);
    let matches = search_messages(&client, &token, &query, 1).await?;

    let ts = matches
        .into_iter()
        .find(|msg| {
            msg.text
                .as_deref()
                .map(|t| t.contains(&week_key))
                .unwrap_or(false)
        })
        .and_then(|msg| msg.ts);

    Ok(ts)
}

// ── 점심 이미지 검색 ──

#[tauri::command]
pub async fn fetch_lunch_images(
    token: String,
    channel_name: String,
    username: String,
) -> Result<Vec<LunchImage>, String> {
    let client = reqwest::Client::new();
    let slack_username = resolve_username(&client, &token, &username).await?;
    let query = build_search_query(&slack_username, &channel_name);
    let matches = search_messages(&client, &token, &query, 5).await?;
    let week_key = get_current_week_key();

    let mut images = Vec::new();
    for msg in matches {
        // 메시지 본문에 현재 주차 키워드가 없으면 스킵
        let msg_text = msg.text.unwrap_or_default();
        if !msg_text.contains(&week_key) {
            continue;
        }
        let msg_ts = msg.ts.unwrap_or_default();
        if let Some(files) = msg.files {
            for file in files {
                let is_image = file
                    .mimetype
                    .as_deref()
                    .map(|m| m.starts_with("image/"))
                    .unwrap_or(false);

                if !is_image {
                    continue;
                }

                let url = file
                    .url_private
                    .as_deref()
                    .or(file.thumb_1024.as_deref())
                    .or(file.thumb_720.as_deref())
                    .or(file.thumb_480.as_deref())
                    .unwrap_or("");

                if url.is_empty() {
                    continue;
                }

                let img_res = client
                    .get(url)
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await;

                let mut data_url = String::new();
                if let Ok(response) = img_res {
                    if response.status().is_success() {
                        if let Ok(bytes) = response.bytes().await {
                            if bytes.len() > 100 {
                                let mime = file.mimetype.as_deref().unwrap_or("image/png");
                                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                                data_url = format!("data:{};base64,{}", mime, b64);
                            }
                        }
                    }
                }

                if data_url.is_empty() {
                    continue;
                }

                images.push(LunchImage {
                    url: data_url,
                    filename: file.name.unwrap_or_default(),
                    timestamp: msg_ts.clone(),
                    message_text: msg_text.clone(),
                });
            }
        }
    }

    Ok(images)
}

#[cfg(test)]
#[path = "slack_tests.rs"]
mod slack_tests;
