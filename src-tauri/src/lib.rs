use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::{picture::{MimeType, Picture, PictureType}, prelude::*};
use lofty::probe::Probe;
use serde::Serialize;
use tauri::Manager;
use std::{io::{Read, Write}, net::TcpListener, path::{Path, PathBuf}, sync::Mutex, time::{Duration, Instant}};
use walkdir::WalkDir;
use rayon::prelude::*;

#[derive(Default)]
struct OAuthReceivers(Mutex<std::collections::HashMap<u16, std::sync::mpsc::Receiver<String>>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalTrack {
    id: String, source: String, title: String, artist: String, album: String,
    album_artist: String, duration: Option<u64>, local_path: String, artwork: Option<String>,
    track_number: Option<u32>, disc_number: Option<u32>, year: Option<u32>, genre: Option<String>,
    release_date: Option<String>, music_brainz_release_id: Option<String>,
    music_brainz_recording_id: Option<String>, music_brainz_artist_id: Option<String>,
    music_brainz_release_artist_id: Option<String>, music_brainz_release_group_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MetadataCandidate {
    recording_mbid: String,
    release_mbid: String,
    release_group_mbid: Option<String>,
    artist_mbid: Option<String>,
    release_artist_mbid: Option<String>,
    title: String,
    artist: String,
    album_artist: String,
    album: String,
    release_date: Option<String>,
    score: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverArtPreview { data_url: String, mime_type: String }

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MetadataApply {
    path: String,
    title: String,
    artist: String,
    album_artist: String,
    album: String,
    release_date: Option<String>,
    release_mbid: String,
    recording_mbid: String,
    artist_mbid: Option<String>,
    release_artist_mbid: Option<String>,
    release_group_mbid: Option<String>,
    cover_data: Option<String>,
    cover_mime: Option<String>,
}

static MUSICBRAINZ_NEXT_REQUEST: Mutex<Option<Instant>> = Mutex::new(None);

async fn wait_for_musicbrainz_slot() {
    let wait = {
        let now = Instant::now();
        let mut next = MUSICBRAINZ_NEXT_REQUEST.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let scheduled = next.map(|last| (last + Duration::from_secs(1)).max(now)).unwrap_or(now);
        *next = Some(scheduled);
        scheduled.saturating_duration_since(now)
    };
    if !wait.is_zero() { tokio::time::sleep(wait).await; }
}

fn supported(path: &Path) -> bool {
    matches!(path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str(), "mp3" | "flac" | "wav" | "m4a" | "aac" | "ogg" | "opus" | "aiff" | "ape" | "wv")
}

fn sidecar_art(path: &Path) -> Option<String> {
    let folder = path.parent()?;
    let names = ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp", "folder.jpg", "folder.jpeg", "folder.png", "folder.webp", "front.jpg", "front.png", "front.webp"];
    let preferred = names.iter().map(|name| folder.join(name)).find(|candidate| candidate.is_file());
    let candidate = preferred.or_else(|| std::fs::read_dir(folder).ok()?.filter_map(Result::ok).map(|entry| entry.path())
        .filter(|candidate| candidate.is_file() && matches!(candidate.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "png" | "webp"))
        .find(|candidate| candidate.file_stem().and_then(|s| s.to_str()).map(|s| { let name = s.to_ascii_lowercase(); name.contains("cover") || name.contains("album") || name.contains("front") || name.contains("artwork") }).unwrap_or(false)));
    candidate.and_then(|file| {
        let ext = file.extension()?.to_str()?.to_ascii_lowercase();
        let mime = match ext.as_str() { "jpg" | "jpeg" => "image/jpeg", "png" => "image/png", "webp" => "image/webp", _ => return None };
        std::fs::read(file).ok().map(|bytes| format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
    })
}

fn parse_track(path: &Path) -> Option<LocalTrack> {
    let tagged = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    let props = tagged.properties();
    let picture = tag.and_then(|value| value.pictures().iter().find(|pic| pic.pic_type() == PictureType::CoverFront).or_else(|| value.pictures().first())).map(|pic| {
        let mime = pic.mime_type().map(|m| m.to_string()).unwrap_or_else(|| "image/jpeg".into());
        format!("data:{mime};base64,{}", STANDARD.encode(pic.data()))
    });
    let field = |key: lofty::tag::ItemKey| tag.and_then(|t| t.get_string(&key)).unwrap_or("").to_string();
    let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown track").to_string();
    let title = field(ItemKey::TrackTitle);
    let artist = field(ItemKey::TrackArtist);
    let album_artist = field(ItemKey::AlbumArtist);
    let release_date = tag.and_then(|t| t.get_string(&ItemKey::RecordingDate).or_else(|| t.get_string(&ItemKey::Year))).map(str::to_string);
    Some(LocalTrack {
        id: format!("local:{}", path.to_string_lossy()), source: "local".into(),
        title: if title.is_empty() { file_name } else { title }, artist: artist.clone(),
        album: field(ItemKey::AlbumTitle), album_artist: if album_artist.is_empty() { artist } else { album_artist },
        duration: Some(props.duration().as_secs()), local_path: path.to_string_lossy().into_owned(),
        artwork: picture.or_else(|| sidecar_art(path)),
        track_number: tag.and_then(|t| t.get_string(&ItemKey::TrackNumber)?.parse().ok()),
        disc_number: tag.and_then(|t| t.get_string(&ItemKey::DiscNumber)?.parse().ok()),
        year: tag.and_then(|t| t.get_string(&ItemKey::Year).or_else(|| t.get_string(&ItemKey::RecordingDate))?.get(..4)?.parse().ok()),
        genre: { let v = field(ItemKey::Genre); (!v.is_empty()).then_some(v) },
        release_date,
        music_brainz_release_id: tag.and_then(|t| t.get_string(&ItemKey::MusicBrainzReleaseId)).map(str::to_string),
        music_brainz_recording_id: tag.and_then(|t| t.get_string(&ItemKey::MusicBrainzRecordingId)).map(str::to_string),
        music_brainz_artist_id: tag.and_then(|t| t.get_string(&ItemKey::MusicBrainzArtistId)).map(str::to_string),
        music_brainz_release_artist_id: tag.and_then(|t| t.get_string(&ItemKey::MusicBrainzReleaseArtistId)).map(str::to_string),
        music_brainz_release_group_id: tag.and_then(|t| t.get_string(&ItemKey::MusicBrainzReleaseGroupId)).map(str::to_string),
    })
}

fn log_file_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            paths.push(dir.join("melo.log"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("melo.log"));
    }
    paths.sort();
    paths.dedup();
    paths
}

fn write_log_line(message: &str) {
    let line = format!("[{timestamp}] {message}\n", timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
    for path in log_file_paths() {
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = file.write_all(line.as_bytes()).ok();
        }
    }
}

fn log_debug(message: impl AsRef<str>) {
    let text = message.as_ref().to_string();
    write_log_line(&text);
    eprintln!("{}", text);
}

#[tauri::command]
fn write_debug_log(message: String) -> Result<(), String> {
    log_debug(message);
    Ok(())
}

#[tauri::command]
fn start_spotify_callback(state: tauri::State<'_, OAuthReceivers>) -> Result<u16, String> {
    log_debug("[Spotify OAuth] start_spotify_callback() called");
    let port = 43821u16;
    let bind_result = TcpListener::bind(("127.0.0.1", port));
    match &bind_result {
        Ok(_) => log_debug(&format!("[Spotify OAuth] bind success: 127.0.0.1:{port}")),
        Err(error) => {
            let os_code = error.raw_os_error().map(|code| code.to_string()).unwrap_or_else(|| "unknown".into());
            log_debug(&format!("[Spotify OAuth] bind failed on 127.0.0.1:{port}, os_error={os_code}, error={error}"));
            return Err(format!("Spotify 인증용 localhost callback port를 열 수 없습니다: 127.0.0.1:{port}. {error}"));
        }
    }

    let listener = bind_result.unwrap();
    log_debug(&format!("[Spotify OAuth] final selected port: {port}"));
    let (sender, receiver) = std::sync::mpsc::channel();
    state.0.lock().map_err(|_| "OAuth callback state is unavailable".to_string())?.insert(port, receiver);
    std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            log_debug(&format!("[Spotify OAuth] callback connection accepted on 127.0.0.1:{port}"));
            let mut buffer = [0_u8; 8192];
            if let Ok(size) = stream.read(&mut buffer) {
                let request = String::from_utf8_lossy(&buffer[..size]);
                let query = request.lines().next().and_then(|line| line.split_whitespace().nth(1)).and_then(|path| path.split_once('?').map(|(_, query)| query)).unwrap_or("");
                let result = query.split('&').find_map(|item| item.strip_prefix("code=").map(|code| code.to_string()))
                    .or_else(|| query.split('&').find_map(|item| item.strip_prefix("error=").map(|error| format!("error:{error}"))))
                    .unwrap_or_else(|| "error:Spotify did not return an authorization code".into());
                let returned_state = query.split('&').find_map(|item| item.strip_prefix("state=")).unwrap_or("");
                let _ = sender.send(format!("{result}\t{returned_state}"));
                let body = "<!doctype html><meta charset=utf-8><title>MaeHwa Melo</title><body style='font:16px system-ui;background:#111;color:#f4f0e8;display:grid;place-items:center;height:90vh'><main><h1>MaeHwa Melo</h1><p>Spotify 인증이 완료되었습니다. 이 창을 닫고 앱으로 돌아가세요.</p></main></body>";
                let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                let _ = stream.write_all(response.as_bytes());
            }
        } else {
            log_debug(&format!("[Spotify OAuth] callback listener accept failed on 127.0.0.1:{port}"));
        }
    });
    Ok(port)
}

#[tauri::command]
async fn wait_spotify_callback(port: u16, state: tauri::State<'_, OAuthReceivers>, app: tauri::AppHandle) -> Result<String, String> {
    log_debug(&format!("[Spotify OAuth] wait_spotify_callback() started for port {port}"));
    let receiver = state.0.lock().map_err(|_| "OAuth callback state is unavailable".to_string())?.remove(&port).ok_or_else(|| "OAuth callback was not initialized".to_string())?;
    let response = tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(Duration::from_secs(180)).map_err(|error| error.to_string()))
        .await.map_err(|error| error.to_string())?;
    match &response {
        Ok(value) => log_debug(&format!("[Spotify OAuth] callback response received on port {port}: {value}")),
        Err(error) => log_debug(&format!("[Spotify OAuth] callback response timeout/error on port {port}: {error}")),
    }
    let response = response?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(response)
}

#[tauri::command]
async fn scan_music_folder(path: String, app: tauri::AppHandle) -> Result<Vec<LocalTrack>, String> {
    let folder = PathBuf::from(path);
    if !folder.is_dir() { return Err("선택한 폴더를 찾을 수 없습니다.".into()); }
    app.asset_protocol_scope().allow_directory(&folder, true).map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || WalkDir::new(folder).follow_links(false).into_iter()
        .filter_map(Result::ok).filter(|e| e.file_type().is_file() && supported(e.path()))
        .map(|entry| entry.path().to_path_buf())
        .collect::<Vec<_>>()
        .par_iter()  // 병렬 처리
        .filter_map(|path| parse_track(path))
        .collect())
        .await.map_err(|error| error.to_string())
}

#[tauri::command]
async fn scan_music_files(paths: Vec<String>, app: tauri::AppHandle) -> Result<Vec<LocalTrack>, String> {
    let files: Vec<PathBuf> = paths.into_iter().map(PathBuf::from)
        .filter(|path| path.is_file() && supported(path)).collect();
    for path in &files {
        app.asset_protocol_scope().allow_file(path).map_err(|error| error.to_string())?;
    }
    tauri::async_runtime::spawn_blocking(move || 
        files.par_iter()  // 병렬 처리
            .filter_map(|path| parse_track(path))
            .collect())
        .await.map_err(|error| error.to_string())
}

#[tauri::command]
async fn read_track(path: String) -> Result<LocalTrack, String> {
    tauri::async_runtime::spawn_blocking(move || parse_track(Path::new(&path)).ok_or_else(|| "오디오 파일의 메타데이터를 읽을 수 없습니다.".into()))
        .await.map_err(|error| error.to_string())?
}

fn mb_credit(value: &serde_json::Value) -> String {
    value.as_array().map(|items| items.iter().filter_map(|item| {
        item.get("name").and_then(serde_json::Value::as_str)
            .or_else(|| item.get("artist").and_then(|artist| artist.get("name")).and_then(serde_json::Value::as_str))
    }).collect::<Vec<_>>().join(" & ")).unwrap_or_default()
}

fn escape_mb_query(value: &str) -> String {
    value.chars().flat_map(|ch| if r#"+-!(){}[]^\"~*?:\\/"#.contains(ch) { vec!['\\', ch] } else { vec![ch] }).collect()
}

fn url_encode(value: &str) -> String {
    value.as_bytes().iter().map(|byte| {
        if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'_' | b'.' | b'~') { (*byte as char).to_string() }
        else { format!("%{byte:02X}") }
    }).collect()
}

/// YouTube/스트리밍 배포 제목에서 검색에 방해가 되는 장식 텍스트를 제거합니다.
/// 예: "맨정신 [가사_Lyrics]" -> "맨정신", "Pretender【Official Video】" -> "Pretender"
fn normalize_search_title(title: &str) -> String {
    // 1. 전각 괄호 안의 내용 제거: 【】 〈〉 《》 『』 「」
    let mut result = String::with_capacity(title.len());
    let mut depth: u32 = 0;
    for ch in title.chars() {
        match ch {
            '\u{3010}' | '\u{3008}' | '\u{300A}' | '\u{300C}' | '\u{300E}' => { depth += 1; }
            '\u{3011}' | '\u{3009}' | '\u{300B}' | '\u{300D}' | '\u{300F}' => { depth = depth.saturating_sub(1); }
            _ if depth > 0 => {}
            _ => result.push(ch),
        }
    }
    let mut cleaned = result.trim().to_string();

    // 2. ASCII/한글 괄호 안의 흔한 장식 키워드 제거
    let noise_keywords: &[&str] = &[
        "official video", "official audio", "official music video", "official mv",
        "music video", "lyric video", "lyrics video", "lyric", "lyrics", "audio",
        "official", "mv", "m/v", "visualizer", "live version", "live", "special clip",
        "acoustic", "instrumental", "karaoke", "feat.", "ft.", "featuring", "color coded",
        "가사", "교차편집", "응원법", "mr제거", "자막", "노래", "뮤비", "풀버전", "음원", "라이브",
    ];

    for &(open_ch, close_ch) in &[('(', ')'), ('[', ']'), ('{', '}')] {
        loop {
            let Some(start) = cleaned.find(open_ch) else { break };
            let Some(rel_end) = cleaned[start..].find(close_ch) else { break };
            let end = start + rel_end;
            let inner = cleaned[start + 1..end].trim().to_ascii_lowercase();
            // 언더바/하이픈/공백 치환해서 노이즈 여부 검사 (예: 가사_lyrics)
            let inner_flat = inner.replace(['_', '-', '/'], " ");
            let is_noise = noise_keywords.iter().any(|kw| inner_flat.contains(kw));
            if is_noise {
                cleaned.drain(start..=end);
                cleaned = cleaned.trim().to_string();
            } else {
                break;
            }
        }
    }

    // 3. 괄호 밖 끝부분에 붙은 단독 키워드 제거 (예: "'늘 (EVER)' Official MV" -> "'늘 (EVER)'")
    let trailing_keywords: &[&str] = &[
        "official video", "official music video", "official mv", "official audio", "official",
        "music video", "mv", "m/v", "visualizer", "audio", "lyrics", "lyric",
        "가사", "뮤비", "교차편집", "응원법", "라이브", "음원",
    ];

    loop {
        let mut trimmed_any = false;
        let lower = cleaned.to_lowercase();
        for kw in trailing_keywords {
            if lower.ends_with(kw) {
                let cut_len = cleaned.len() - kw.len();
                cleaned.truncate(cut_len);
                cleaned = cleaned.trim_end_matches(&[' ', '-', '_', '~', '/', '|'][..]).trim().to_string();
                trimmed_any = true;
                break;
            }
        }
        if !trimmed_any { break; }
    }

    // 4. 앞뒤를 감싸고 있는 따옴표 제거 (예: "'늘 (EVER)'" -> "늘 (EVER)")
    let quote_chars = ['\'', '"', '“', '”', '‘', '’'];
    cleaned = cleaned.trim_matches(&quote_chars[..]).trim().to_string();

    let normalized: String = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() { title.trim().to_string() } else { normalized }
}

/// 아티스트 이름에서 피처링 및 불필요한 번역 괄호 표기를 정리합니다.
/// 예: "BIGBANG(빅뱅)" -> "BIGBANG", "IU (아이유)" -> "IU"
fn normalize_search_artist(artist: &str) -> String {
    let mut result = artist.trim().to_string();

    // 1. feat. / ft. 이후 자르기
    let separators = [" feat.", " ft.", " featuring", " Feat.", " Ft."];
    for sep in &separators {
        if let Some(pos) = result.to_ascii_lowercase().find(&sep.to_ascii_lowercase()) {
            result = result[..pos].trim().to_string();
        }
    }

    // 2. 아티스트명 괄호 병기 처리: 예 "BIGBANG(빅뱅)", "IU (아이유)", "태연 (TAEYEON)"
    // 괄호 앞부분이 2글자 이상 의미있는 문자열이면 괄호 제거
    if let Some(start) = result.find('(') {
        if let Some(end) = result.rfind(')') {
            let before = result[..start].trim();
            if before.len() >= 2 {
                result = before.to_string();
            } else {
                // 앞부분이 너무 짧으면 괄호 안을 메인으로 사용
                let inner = result[start + 1..end].trim();
                if !inner.is_empty() {
                    result = inner.to_string();
                }
            }
        }
    }

    result
}

/// "Artist – Title" 또는 "Artist - Title" 패턴에서 아티스트와 곡명을 분리합니다.
/// 아티스트 필드가 비어 있을 때만 사용합니다.
fn split_artist_title(title: &str) -> Option<(String, String)> {
    // em dash (–), en dash (—), 반각 하이픈 둘러싼 공백( - ) 순으로 시도
    for sep in &[" \u{2013} ", " \u{2014} ", " - "] {
        if let Some(pos) = title.find(sep) {
            let artist_part = title[..pos].trim().to_string();
            let title_part = title[pos + sep.len()..].trim().to_string();
            if !artist_part.is_empty() && !title_part.is_empty() {
                return Some((artist_part, title_part));
            }
        }
    }
    None
}

async fn do_mb_search(client: &reqwest::Client, query: &str) -> Result<serde_json::Value, String> {
    let request_url = format!(
        "https://musicbrainz.org/ws/2/recording/?query={}&fmt=json&limit=25&inc=releases%2Bartist-credits%2Brelease-groups",
        url_encode(query)
    );
    client
        .get(request_url)
        .header(reqwest::header::ACCEPT, "application/json")
        .send().await.map_err(|e| format!("MusicBrainz에 연결하지 못했습니다: {e}"))?
        .error_for_status().map_err(|e| format!("MusicBrainz 조회에 실패했습니다: {e}"))?
        .json::<serde_json::Value>().await.map_err(|e| format!("MusicBrainz 응답을 읽지 못했습니다: {e}"))
}

fn parse_mb_response(response: &serde_json::Value, fallback_title: &str, preferred_artist: &str, preferred_album: Option<&str>) -> Vec<MetadataCandidate> {
    let mut candidates = Vec::new();
    let mut seen = std::collections::HashSet::new();

    if let Some(recordings) = response.get("recordings").and_then(serde_json::Value::as_array) {
        for recording in recordings {
            let Some(recording_mbid) = recording.get("id").and_then(serde_json::Value::as_str) else { continue };
            let track_title = recording.get("title").and_then(serde_json::Value::as_str).unwrap_or(fallback_title).to_string();
            let track_artist = mb_credit(recording.get("artist-credit").unwrap_or(&serde_json::Value::Null));
            let artist_mbid = recording.get("artist-credit").and_then(serde_json::Value::as_array)
                .and_then(|items| items.first()).and_then(|item| item.get("artist"))
                .and_then(|item| item.get("id")).and_then(serde_json::Value::as_str).map(str::to_string);
            let mb_score = recording.get("score").and_then(serde_json::Value::as_u64).unwrap_or(0) as u32;

            if let Some(releases) = recording.get("releases").and_then(serde_json::Value::as_array) {
                for release in releases {
                    let Some(release_mbid) = release.get("id").and_then(serde_json::Value::as_str) else { continue };
                    if !seen.insert(release_mbid.to_string()) { continue; }

                    let release_title = release.get("title").and_then(serde_json::Value::as_str).unwrap_or("").to_string();
                    let release_artist = mb_credit(release.get("artist-credit").unwrap_or(&serde_json::Value::Null));
                    let release_artist_mbid = release.get("artist-credit").and_then(serde_json::Value::as_array)
                        .and_then(|items| items.first()).and_then(|item| item.get("artist"))
                        .and_then(|item| item.get("id")).and_then(serde_json::Value::as_str).map(str::to_string);
                    let release_date = release.get("date").and_then(serde_json::Value::as_str).filter(|d| !d.is_empty()).map(str::to_string);
                    
                    let release_group = release.get("release-group");
                    let release_group_mbid = release_group.and_then(|g| g.get("id"))
                        .and_then(serde_json::Value::as_str).map(str::to_string);
                    let primary_type = release_group.and_then(|g| g.get("primary-type")).and_then(serde_json::Value::as_str).unwrap_or("");
                    let secondary_types: Vec<String> = release_group
                        .and_then(|g| g.get("secondary-types"))
                        .and_then(serde_json::Value::as_array)
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();
                    let status = release.get("status").and_then(serde_json::Value::as_str).unwrap_or("");

                    // 품질 점수 계산 (기본 100점 시작)
                    let mut rank_score: i32 = mb_score as i32 * 10;

                    let final_album_artist = if release_artist.is_empty() { track_artist.clone() } else { release_artist.clone() };

                    // 1. 앨범 아티스트가 Various Artists/모음집인 경우 대폭 감점
                    let lower_artist = final_album_artist.to_lowercase();
                    if lower_artist.contains("various artists") || lower_artist.contains("v.a.") || lower_artist.contains("soundtrack") {
                        rank_score -= 350;
                    }

                    // 2. 검색 대상 아티스트와 일치할 경우 큰 가산점
                    let clean_pref_artist = preferred_artist.trim().to_lowercase();
                    if !clean_pref_artist.is_empty() {
                        if lower_artist == clean_pref_artist || lower_artist.contains(&clean_pref_artist) {
                            rank_score += 200;
                        }
                    }

                    // 3. 앨범 유형 가산점 (Album > Single > EP > 기타)
                    match primary_type {
                        "Album" => rank_score += 150,
                        "Single" => rank_score += 130,
                        "EP" => rank_score += 120,
                        _ => {}
                    }

                    // 4. 컴필레이션, 사운드트랙, 리믹스 모음집 등 감점
                    for st in &secondary_types {
                        match st.as_str() {
                            "Compilation" => rank_score -= 250,
                            "Soundtrack" => rank_score -= 200,
                            "Remix" => rank_score -= 100,
                            "DJ-mix" | "Mixtape/Street" => rank_score -= 150,
                            _ => {}
                        }
                    }

                    // 5. 공식 릴리즈(Official) 여부
                    if status == "Official" {
                        rank_score += 50;
                    }

                    // 6. 앨범명이 곡명과 같거나(싱글), 타이틀곡일 경우 보너스
                    let lower_rel_title = release_title.to_lowercase();
                    let lower_track_title = track_title.to_lowercase();
                    if lower_rel_title == lower_track_title {
                        rank_score += 80;
                    }

                    // 7. 사용자가 기존에 가지고 있던 앨범명과 일치하는 경우 우선순위
                    if let Some(wanted_album) = preferred_album {
                        let wanted = wanted_album.trim().to_lowercase();
                        if !wanted.is_empty() && (lower_rel_title == wanted || lower_rel_title.contains(&wanted)) {
                            rank_score += 400;
                        }
                    }

                    // 8. 발매일이 정확히 기록된 것 우선
                    if release_date.is_some() {
                        rank_score += 20;
                    }

                    candidates.push((rank_score, MetadataCandidate {
                        recording_mbid: recording_mbid.to_string(),
                        release_mbid: release_mbid.to_string(),
                        release_group_mbid,
                        artist_mbid: artist_mbid.clone(),
                        release_artist_mbid,
                        title: track_title.clone(),
                        artist: track_artist.clone(),
                        album_artist: final_album_artist,
                        album: release_title,
                        release_date,
                        score: mb_score,
                    }));
                }
            }
        }
    }

    // rank_score 높은 순으로 정렬 후 상위 15개 반환
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().take(15).map(|(_, item)| item).collect()
}

#[tauri::command]
async fn search_musicbrainz_metadata(title: String, artist: String, album: Option<String>) -> Result<Vec<MetadataCandidate>, String> {
    wait_for_musicbrainz_slot().await;

    let clean_title = normalize_search_title(&title);
    let clean_artist = normalize_search_artist(&artist);

    // 아티스트가 비어 있고 제목에 "Artist – Title" 패턴이 있으면 분리
    let (search_title, search_artist) = if clean_artist.trim().is_empty() {
        if let Some((split_artist, split_title)) = split_artist_title(&clean_title) {
            (normalize_search_title(&split_title), split_artist)
        } else {
            (clean_title.clone(), clean_artist.clone())
        }
    } else {
        (clean_title.clone(), clean_artist.clone())
    };

    let client = reqwest::Client::builder().user_agent("MaeHwaMelo/0.4.0").build()
        .map_err(|e| format!("MusicBrainz 연결을 준비하지 못했습니다: {e}"))?;

    // 1차 시도: 정확 검색 (따옴표 쿼리)
    let exact_query = if search_artist.trim().is_empty() {
        format!("recording:\"{}\"", escape_mb_query(&search_title))
    } else {
        format!("recording:\"{}\" AND artist:\"{}\"", escape_mb_query(&search_title), escape_mb_query(&search_artist))
    };
    let response = do_mb_search(&client, &exact_query).await?;
    let mut candidates = parse_mb_response(&response, &title, &search_artist, album.as_deref());

    // 2차 시도: 결과가 없으면 따옴표 없이 fuzzy 검색
    if candidates.is_empty() {
        wait_for_musicbrainz_slot().await;
        let fuzzy_query = if search_artist.trim().is_empty() {
            format!("recording:{}", escape_mb_query(&search_title))
        } else {
            format!("recording:{} AND artist:{}", escape_mb_query(&search_title), escape_mb_query(&search_artist))
        };
        let fuzzy_response = do_mb_search(&client, &fuzzy_query).await?;
        candidates = parse_mb_response(&fuzzy_response, &title, &search_artist, album.as_deref());
    }

    // 3차 시도: 아티스트 조건 빼고 제목만으로 fuzzy 검색
    if candidates.is_empty() && !search_artist.trim().is_empty() {
        wait_for_musicbrainz_slot().await;
        let title_only_query = format!("recording:{}", escape_mb_query(&search_title));
        let title_response = do_mb_search(&client, &title_only_query).await?;
        candidates = parse_mb_response(&title_response, &title, &search_artist, album.as_deref());
    }

    Ok(candidates)
}

#[tauri::command]
async fn fetch_cover_art_preview(release_mbid: String) -> Result<CoverArtPreview, String> {
    if release_mbid.len() != 36 || !release_mbid.chars().all(|ch| ch.is_ascii_hexdigit() || ch == '-') {
        return Err("MusicBrainz 발매 ID 형식이 올바르지 않습니다.".into());
    }
    let client = reqwest::Client::builder().user_agent("MaeHwaMelo/0.4.0").build()
        .map_err(|error| format!("Cover Art Archive 연결을 준비하지 못했습니다: {error}"))?;
    let response = client.get(format!("https://coverartarchive.org/release/{release_mbid}/front-500")).send().await
        .map_err(|error| format!("Cover Art Archive에 연결하지 못했습니다: {error}"))?
        .error_for_status().map_err(|error| format!("이 발매의 커버를 찾지 못했습니다: {error}"))?;
    let mime_type = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|value| value.to_str().ok())
        .unwrap_or("image/jpeg").split(';').next().unwrap_or("image/jpeg").to_string();
    if !matches!(mime_type.as_str(), "image/jpeg" | "image/png") { return Err("지원하지 않는 커버 이미지 형식입니다.".into()); }
    let bytes = response.bytes().await.map_err(|error| format!("커버 이미지를 읽지 못했습니다: {error}"))?;
    if bytes.len() > 12 * 1024 * 1024 { return Err("커버 이미지가 너무 큽니다.".into()); }
    Ok(CoverArtPreview { data_url: format!("data:{mime_type};base64,{}", STANDARD.encode(bytes)), mime_type })
}

#[tauri::command]
async fn apply_local_metadata(update: MetadataApply) -> Result<LocalTrack, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&update.path);
        if !path.is_file() || !supported(&path) { return Err("수정할 수 있는 로컬 오디오 파일이 아닙니다.".to_string()); }
        let mut tagged = Probe::open(&path).map_err(|error| error.to_string())?.read().map_err(|error| error.to_string())?;
        let tag_type = tagged.primary_tag_type();
        if !tagged.file_type().supports_tag_type(tag_type) { return Err("이 파일 형식은 메타데이터 기록을 지원하지 않습니다.".into()); }
        let mut cover = None;
        if let Some(data_url) = update.cover_data.as_deref() {
            let encoded = data_url.split_once(',').map(|(_, data)| data).unwrap_or(data_url);
            let bytes = STANDARD.decode(encoded).map_err(|_| "커버 이미지 데이터를 읽을 수 없습니다.".to_string())?;
            if bytes.len() > 12 * 1024 * 1024 { return Err("커버 이미지가 너무 큽니다.".into()); }
            let detected = if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) { MimeType::Png }
                else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) { MimeType::Jpeg }
                else { return Err("이미지 파일이 손상되었거나 지원되지 않습니다.".into()); };
            let declared = update.cover_mime.as_deref().map(MimeType::from_str).unwrap_or_else(|| detected.clone());
            if declared != detected { return Err("커버 이미지 형식이 일치하지 않습니다.".into()); }
            cover = Some(Picture::new_unchecked(PictureType::CoverFront, Some(detected), None, bytes));
        }
        if tagged.tag(tag_type).is_none() { tagged.insert_tag(lofty::tag::Tag::new(tag_type)); }
        let tag = tagged.tag_mut(tag_type).ok_or_else(|| "파일의 태그를 준비하지 못했습니다.".to_string())?;
        for (key, value) in [
            (ItemKey::TrackTitle, update.title), (ItemKey::TrackArtist, update.artist),
            (ItemKey::AlbumTitle, update.album), (ItemKey::AlbumArtist, update.album_artist),
            (ItemKey::MusicBrainzReleaseId, update.release_mbid), (ItemKey::MusicBrainzRecordingId, update.recording_mbid),
        ] { if !value.trim().is_empty() { tag.insert_text(key, value); } }
        if let Some(artist_id) = update.artist_mbid.filter(|id| !id.is_empty()) { tag.insert_text(ItemKey::MusicBrainzArtistId, artist_id); }
        if let Some(artist_id) = update.release_artist_mbid.filter(|id| !id.is_empty()) { tag.insert_text(ItemKey::MusicBrainzReleaseArtistId, artist_id); }
        if let Some(group_id) = update.release_group_mbid.filter(|id| !id.is_empty()) { tag.insert_text(ItemKey::MusicBrainzReleaseGroupId, group_id); }
        if let Some(date) = update.release_date.filter(|date| !date.is_empty()) {
            tag.insert_text(ItemKey::RecordingDate, date.clone());
            if let Some(year) = date.get(..4).filter(|value| value.chars().all(|ch| ch.is_ascii_digit())) { tag.insert_text(ItemKey::Year, year.to_string()); }
        }
        if let Some(picture) = cover {
            while !tag.pictures().is_empty() {
                tag.remove_picture(0);
            }
            tag.push_picture(picture);
        }
        tagged.save_to_path(&path, lofty::config::WriteOptions::default()).map_err(|error| format!("태그를 파일에 기록하지 못했습니다: {error}"))?;
        parse_track(&path).ok_or_else(|| "저장한 파일을 다시 읽지 못했습니다.".into())
    }).await.map_err(|error| error.to_string())?
}

pub fn run() {
    log_debug("[App] MaeHwa Melo startup; melo.log created");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(OAuthReceivers::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![scan_music_folder, scan_music_files, read_track, search_musicbrainz_metadata, fetch_cover_art_preview, apply_local_metadata, start_spotify_callback, wait_spotify_callback, write_debug_log])
        .run(tauri::generate_context!())
        .expect("MaeHwa Melo failed to start");
}
