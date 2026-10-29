요약: MaeHwa Melo — Spotify 통합 현황

목적
- 현재 코드베이스에는 Spotify Web Playback SDK(재생 제어)와 Spotify Web API(폴링/메타데이터 조회)가 병행되어 구현되어 있습니다. 이 문서는 지금까지의 수정·조사 내용, 관련 파일, 동작 흐름, 리스크 및 다음 작업을 정리합니다.

핵심 결론
- 재생 제어(Active Device에서의 플레이/일시정지/탐색 등): Web Playback SDK(`SpotifyPlayer`)가 담당합니다.
  - 구현 파일: [src/services/spotify.ts](src/services/spotify.ts#L501-L575)
  - 주요 지점: SDK 로더(`loadSdk()`), `new Spotify.Player(...)`, `player_state_changed` 리스너
- 뷰어 모드(공식 앱에서 재생되는 소리를 미러링하여 UI만 동기화): Web API 폴링(`GET /v1/me/player`)을 사용합니다.
  - 구현 파일: [src/services/spotify.ts](src/services/spotify.ts#L676-L704) (`getLivePlaybackState()`)
  - 폴링 제어: [src/main.ts](src/main.ts#L550-L586) (`syncSpotifyViewerFromApi()`), [src/main.ts](src/main.ts#L600-L616) (`startLiveViewerMode()` / `stopLiveViewerMode()`)
- 플레이리스트/라이브러리 메타 조회: Web API 엔드포인트들을 사용
  - 관련 함수: `spotifyPlaylists`, `spotifyPlaylistTracks`, `spotifyLibrary` (모두 `src/services/spotify.ts` 내부)

OAuth / 권한
- SDK 제어: Spotify Premium 필요(디바이스 활성화 및 재생 제어)
- Web API(폴링/메타): `user-read-playback-state`, `playlist-read-private` 등 적절한 스코프 필요
- 플레이리스트 생성/곡 추가: 공개 범위에 따라 `playlist-modify-public` 또는 `playlist-modify-private` 권한을 사용합니다. 신규 생성 시 공개/비공개를 선택할 수 있으며, 기존 사용자는 권한 추가를 위해 Spotify 재인증이 필요할 수 있습니다.

현재 동작 요약
1. 앱 부팅 시
   - 로컬 라이브러리 초기화: `bootLibrary()` 실행
   - 자동 연결 시도: `autoConnectSpotifyOnBoot()` 호출(조건부)
   - `spotifyConnected()`가 true이면 `startLiveViewerMode()`를 호출해 폴링을 시작함(주기 500ms)
     - 참조: [src/main.ts](src/main.ts#L606-L616)
2. 사용자가 `Spotify 연결`을 누르거나 SDK 연결 조건을 만족하면
   - `connectSpotify()`에서 `spotifyPlayer.connect(...)` 호출 → Web Playback SDK 연결 시도
   - SDK가 준비되면 `player_state_changed` 이벤트와 내부 ticker로 UI/타이머 동기화
3. 공식 Spotify 앱에서 재생 중이지만 MaeHwa가 Active Device가 아닐 경우
   - `player_state_changed` 이벤트가 발생하지 않으므로 폴링(`GET /v1/me/player`)으로 상태를 가져와 UI를 갱신
   - 해당 폴링 함수: `getLivePlaybackState()` → `syncSpotifyViewerFromApi()` → `render()` / `patchProgress()` 적용

구현 주요 파일(빠른 링크)
- 서비스 및 SDK: [src/services/spotify.ts](src/services/spotify.ts)
- 앱 초기화·뷰어 폴링: [src/main.ts](src/main.ts)

리스크 및 권장 개선사항
- 폴링 간격(현재 500ms)은 응답성에 좋지만 API 호출량과 배터리/CPU 부담, Spotify rate limit 위험이 있음.
  - 권장: 재생 중일 때만 500ms, 일시정지/비활성 상태일 때는 1500ms 이상으로 느리게 전환하는 적응형 폴링 도입
- 토큰 만료 처리와 실패 재시도/백오프 로직 강화 필요
- UI 바인딩(폴링 결과 → `render()`로의 안정적 반영) 검증 필요

다음 작업(우선순위)
- UI에 폴링 결과 바인딩(진행 중인 `renderCurrentlyPlaying` 연결 확인)
- 토큰/스코프 확인(특히 `user-read-playback-state`)
- 폴링 적응형 로직 도입(현재: 500ms 고정)
- 배포 전 빌드·타입 체크 및 동작 확인

참고: 관련 코드 위치(일부 핵심 라인)
- `loadSdk()` / SDK 로더: [src/services/spotify.ts](src/services/spotify.ts#L440-L485)
- `SpotifyPlayer` 클래스: [src/services/spotify.ts](src/services/spotify.ts#L501-L575)
- `getLivePlaybackState()`: [src/services/spotify.ts](src/services/spotify.ts#L676-L704)
- `syncSpotifyViewerFromApi()` / `startLiveViewerMode()`: [src/main.ts](src/main.ts#L550-L616)

작성자 메모
- 변경 기록은 이미 일부 `CHANGELOG.md`에 반영되어 있으나, 필요하면 제가 요약 항목을 `CHANGELOG.md`에 추가해 드리겠습니다.

빠른 실행(개발)
```bash
# 의존 설치 후(프로젝트 루트)
npm install
# 개발 서버 + Tauri (Windows에서 실행 시)
npm run dev
# 또는 Tauri 윈도우 빌드/실행
npm run tauri dev
```

파일 위치: [docs/spotify-integration.md](docs/spotify-integration.md)

끝.
