# Windows 개발 및 빌드

## 필요한 도구

- Windows 10/11 x64
- Node.js 20 이상과 npm
- Rust stable의 `x86_64-pc-windows-msvc` 툴체인
- Visual Studio 2022 Build Tools의 **Desktop development with C++** 구성요소, MSVC x64 컴파일러 및 Windows SDK
- WebView2 Runtime

이 프로젝트에서 마지막으로 확인한 개발환경은 Node.js `v24.14.1`, npm `11.11.0`, Rust/Cargo `1.99.0`, Tauri CLI `2.12.1`, Visual Studio Build Tools `2022 17.14.41`입니다. package.json은 일부 버전을 범위로 지정하므로 `npm ci`는 package-lock.json에 고정된 JS 의존성을 설치합니다. Rust 의존성은 `src-tauri/Cargo.lock`에 고정됩니다.

공식 설치 안내: [Node.js](https://nodejs.org/), [Rust 설치](https://www.rust-lang.org/tools/install), [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## 최초 설정

1. 저장소를 작업 폴더에 내려받고 PowerShell에서 해당 폴더로 이동합니다.
2. Visual Studio 설치 관리자의 **Desktop development with C++** workload와 Windows SDK를 설치합니다.
3. Rust 설치 프로그램에서 MSVC 기본 툴체인을 설치합니다. 필요한 경우 다음 명령으로 확인/설정할 수 있습니다.

```powershell
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
```

4. x64 Native Tools Command Prompt for VS 2022를 열고 프로젝트 폴더로 이동합니다.
5. JS 의존성을 설치하고 웹 검사를 실행합니다.

```powershell
npm ci
npm run build
```

## Spotify 앱 설정 (개발자 1회)

앱 사용자가 아니라 배포 담당자가 Spotify Developer Dashboard에서 앱을 준비합니다.

1. Spotify 앱의 Redirect URI에 `http://127.0.0.1:43821`을 등록합니다. Spotify는 loopback URI에 명시적인 IP와 포트를 요구하며, Melo도 이 포트를 사용합니다.
2. 저장소 루트의 `.env.local`에 공개 Client ID를 지정합니다.

```dotenv
VITE_SPOTIFY_CLIENT_ID=여기에_Spotify_앱_Client_ID
```

3. 이 설정이 포함된 앱을 빌드해 배포합니다. `.env.local`은 Git에 포함되지 않으며 `.env.example`을 참고할 수 있습니다. Client ID는 데스크톱 PKCE 앱에서 사용하는 공개 식별자입니다. Client Secret은 만들거나 앱에 넣지 않습니다.

Spotify 개발 모드는 테스트 계정 허용 목록과 사용자 수 제한, 앱 소유자의 Premium 요건이 적용됩니다. 더 넓은 배포에는 Spotify의 확장 접근 승인이 필요할 수 있습니다. 이는 앱 코드만으로 우회할 수 없는 Spotify 플랫폼 정책입니다.

## 개발 실행

x64 Native Tools Command Prompt에서:

```powershell
npm run tauri -- dev
```

명령 하나가 Vite 개발 서버를 켜고 Tauri 창을 엽니다. 종료할 때는 터미널에서 `Ctrl+C`를 누릅니다.

브라우저에서 UI만 확인하려면 다음 명령을 쓰고 <http://127.0.0.1:14200>에 접속합니다.

```powershell
npm run dev
```

브라우저 서버는 `Ctrl+C`로 종료합니다. 브라우저 모드에는 일부 OS 전용 기능이 없으며 선택 음악 파일은 새로고침 후 유지되지 않습니다. 자세한 내용은 [사용자 가이드](USER_GUIDE.md)를 참고하세요.

## Windows EXE 빌드

EXE만 만들려면:

```powershell
npm run tauri -- build --no-bundle
```

빌드가 끝나면 다음 파일을 실행할 수 있습니다.

```text
src-tauri/target/release/maehwa-melo.exe
```

현재 개발 세션에서 위 EXE 생성 및 실행까지 확인했습니다. 빌드 캐시는 `src-tauri/target/`에 놓이며 `.gitignore`에 포함되어 있습니다. EXE를 배포할 때는 별도 설치 프로그램 또는 압축 파일을 만들어 전달하세요. PC에 WebView2 Runtime이 필요할 수 있습니다.

## 설치 패키지 빌드

`src-tauri/tauri.conf.json`에는 NSIS와 MSI 대상이 설정되어 있습니다. NSIS 언어는 한국어로 고정됩니다. 앱·설치 프로그램 아이콘은 `src-tauri/icons/maehwa-melo.ico`를 사용합니다. 설치·제거 마법사에는 사용자 지정 사이드 이미지와 헤더 이미지를 표시하지 않습니다. 두 설치 패키지를 만들려면:

```powershell
npm run tauri -- build
```

Tauri bundler가 설치 도구를 찾을 수 있어야 합니다. 예상 출력 디렉터리는 다음과 같습니다.

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

NSIS 설치 파일 이름에는 현재 앱 버전이 포함됩니다. 예를 들어 `0.5.5`의 파일명은 다음과 같습니다.

```text
src-tauri/target/release/bundle/nsis/MaeHwa Melo_0.5.5_x64-setup.exe
```

GitHub Actions에서 0.5.5 NSIS 및 MSI 패키지 생성을 확인했고, NSIS 설치 후 앱 내 0.5.5 업데이트까지 확인했습니다. MSI 패키지도 생성되지만 별도 설치 검증은 하지 않았습니다. Windows SmartScreen 경고는 새 앱의 평판이 충분히 쌓이기 전에 나타날 수 있습니다.

## GitHub Releases 및 앱 자동 업데이트

`.github/workflows/release.yml`은 `v*` 버전 태그가 푸시되면 Windows 설치 패키지와 Tauri 서명 파일을 만들고, GitHub Release와 `latest.json`을 게시합니다. 앱은 `latest.json`을 확인해 새 버전을 찾습니다. 일반적인 다음 배포는 아래 예시의 `0.5.6`을 실제 다음 버전으로 바꿔 진행합니다.

### 최초 1회 GitHub 설정

1. **Settings → Secrets and variables → Actions → Secrets**에 `TAURI_SIGNING_PRIVATE_KEY`를 등록합니다. Tauri signer가 만든 개인 키 파일의 전체 내용을 넣습니다. 키에 암호를 설정했다면 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`도 Secret으로 등록합니다.
2. **Settings → Secrets and variables → Actions → Variables**에 `VITE_SPOTIFY_CLIENT_ID`를 등록합니다. Spotify 앱의 Client ID를 넣습니다. 이것은 앱 빌드에 포함되는 공개 식별자이므로 Secret이 아닌 Variable입니다.
3. 개인 키는 저장소에 커밋하거나 앱에 넣지 말고 별도로 안전하게 백업합니다. 앱 검증용 공개키는 `src-tauri/tauri.conf.json`에서 관리합니다.

### 새 버전 배포 순서

1. **버전 번호를 정합니다.** 예: `0.5.5` 다음은 `0.5.6`. 먼저 `CHANGELOG.md` 맨 위에 새 버전의 날짜와 실제 변경 사항을 적습니다.
2. **버전을 올립니다.** `npm version patch --no-git-tag-version` 명령은 `package.json`과 `package-lock.json`을 함께 올립니다. 같은 새 버전을 `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src/features/pages/renderers.ts`의 설정 화면 표기, `README.md`에도 반영합니다.
3. **빌드 버전과 코드를 확인합니다.** `cargo check --manifest-path src-tauri/Cargo.toml`로 Cargo 잠금 파일을 갱신하고, `npm run build`와 `cargo check --manifest-path src-tauri/Cargo.toml`가 통과하는지 확인합니다. 변경 파일과 버전 번호가 모두 맞는지 확인합니다.
4. **의도한 파일만 커밋하고 main에 푸시합니다.** 예: `git add -u`, 필요한 새 파일은 경로를 지정해 추가한 다음 `git status --short`로 스테이징 목록을 확인합니다. 이어서 `git commit -m "Release v0.5.6"`와 `git push origin main`을 실행합니다. `git add -A`는 백업, 로그, 로컬 설정 파일을 실수로 포함할 수 있으므로 피합니다.
5. **태그를 만들고 푸시합니다.** 커밋한 버전과 정확히 같은 태그를 사용합니다.

   ```powershell
   git tag -a v0.5.6 -m "MaeHwa Melo v0.5.6"
   git push origin v0.5.6
   ```

6. **Actions와 Release를 확인합니다.** 저장소의 **Actions → Release MaeHwa Melo**에서 작업이 성공해야 합니다. 성공한 Release에는 `latest.json`, NSIS `.exe` 설치 파일, MSI 설치 파일과 각각의 `.sig` 서명 파일이 있어야 합니다. Spotify Client ID 변수가 없으면 사전 검사에서 빌드를 중단합니다.
7. **앱에서 업데이트를 확인합니다.** 설치된 앱의 설정에서 **앱 업데이트 → 업데이트 확인**을 누르면 새 버전을 설치할 수 있습니다. 새 버전을 아직 미루지 않았다면 앱 시작 시 안내창이 나타날 수도 있습니다.

0.5.3 이하 설치본은 Updater가 포함되지 않아 0.5.4를 한 번 수동 설치해야 합니다. 0.5.4부터 앱 안에서 업데이트할 수 있습니다. 개인 키 암호 Secret은 키에 암호를 설정한 경우에만 필요합니다. Windows SmartScreen이 새 설치 파일을 경고할 수 있으므로 공식 GitHub Release에서 받은 파일인지 확인합니다.

### 배포 문제 확인

- Actions가 `VITE_SPOTIFY_CLIENT_ID` 검사에서 멈추면 저장소 **Variables**에 변수 이름과 Client ID 값이 정확히 등록됐는지 확인합니다.
- 서명 오류가 나면 `TAURI_SIGNING_PRIVATE_KEY`와 등록된 공개키가 같은 키 쌍인지 확인합니다. 개인키나 암호를 로그, 저장소, 앱 파일에 넣지 않습니다.
- Actions가 성공했는데 앱에서 버전을 찾지 못하면 GitHub Release에 `latest.json`과 Windows 업데이터 아티팩트가 모두 게시됐는지 확인합니다.

## 유용한 프로젝트 명령

| 명령 | 설명 |
| --- | --- |
| `npm ci` | lock 파일 기준 프런트엔드 의존성 설치 |
| `npm run build` | TypeScript 검사 후 Vite 프로덕션 파일 생성 |
| `npm run dev` | 브라우저 미리보기 서버 시작 (`127.0.0.1:14200`) |
| `npm run tauri -- dev` | Windows Tauri 개발 앱 시작 |
| `npm run tauri -- build --no-bundle` | 직접 실행할 Windows EXE 생성 |
| `npm run tauri -- build` | 설정된 Windows 설치 패키지 빌드 시도 |

테스트 전용 npm 스크립트는 아직 정의되어 있지 않습니다. 현재 검증은 `npm run build` 및 개발 세션의 Tauri EXE 빌드를 기준으로 기록합니다.

## 소스 구성

- `src/main.ts`: 페이지 렌더링, 탐색, 라이브러리/재생 이벤트
- `src/redesign.css`, `src/styles.css`, `src/album.css`: 기본 및 MaeHwa Melo 화면 스타일
- `src/player/LocalPlayer.ts`: HTML Audio 어댑터와 재생 상태
- `src/services/library.ts`: 폴더/파일 대화상자 및 브라우저용 가져오기
- `src/services/spotify.ts`: Spotify PKCE OAuth, Web API, Web Playback SDK
- `src-tauri/src/lib.rs`: Rust 오디오 파일 검색, Lofty 태그/커버 판독, OAuth loopback 콜백
- `src-tauri/tauri.conf.json`: 제품 표시 이름, 창, CSP, 빌드/번들 설정

## 저장 데이터와 보안 메모

음악 파일은 복사하거나 업로드하지 않습니다. 앱은 선택된 경로를 사용해 로컬 파일을 읽으며, 경로/곡 메타데이터, 즐겨찾기, 최근 재생, 일부 재생 상태와 Spotify 인증 정보를 로컬 WebView 저장소에 기록합니다. 선택한 음악 폴더는 앱 실행 시 다시 검색합니다. 폴더를 이동하거나 드라이브를 연결하지 못한 경우 해당 곡은 사용할 수 없음으로 표시될 수 있습니다.

Spotify 통신은 Spotify 계정/API로 직접 이루어집니다. Client Secret은 앱에 저장하지 않습니다. Client ID는 빌드 시 환경 변수에서 앱에 포함되며, Spotify 연결을 끊으면 저장된 토큰을 제거합니다.
