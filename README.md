# MaeHwa Melo

MaeHwa Melo는 Windows 10/11용 데스크톱 음악 플레이어입니다. 컴퓨터의 로컬 음악 폴더나 선택한 음악 파일을 재생하고, 선택적으로 Spotify Premium 계정을 연결할 수 있습니다. 음악 원본은 이동하거나 복사하지 않습니다.

> 현재 버전: `0.6.2` — 강조 색상 팔레트 설치 앱 표시 수정

## 빠르게 실행하기

### 설치된 Windows 앱

이제 로컬 Windows 환경에서 직접 설치 앱을 실행할 수 있습니다. 최종 사용자용 설치 파일은 Tauri Release 빌드 기준으로 생성되며, `Vite dev server` 없이도 UI가 정상적으로 뜹니다.

```text
src-tauri/target/release/
src-tauri/target/release/bundle/
```

설치형 앱을 실행하거나, 빌드 결과물에서 생성된 `.exe` 또는 `.msi`/`.exe` 설치 파일을 사용하세요.

### 실제 배포용 실행법

개발용 실행과 배포용 실행은 다릅니다.

- 개발용: `npm run dev` 또는 `npm run dev:tauri`
- 배포용: `npm run build:release` 후 생성된 설치 파일 실행

```powershell
npm ci
npm run build:release
```

빌드가 완료되면 보통 아래 위치에 설치 파일이 생성됩니다.

```text
src-tauri/target/release/bundle/nsis/
```

예시:

```text
MaeHwa Melo_0.2.4_x64-setup.exe
```

이 설치 파일을 실행하면 앱이 설치되고, 설치 완료 후 앱은 Vite 서버 없이 바로 실행됩니다. 사용자는 개발 서버를 직접 켜지 않고도 앱 UI를 확인할 수 있습니다.

### 브라우저 미리보기

Node.js와 npm을 설치한 뒤 프로젝트 폴더에서 실행합니다.

```powershell
npm ci
npm run dev
```

브라우저에서 <http://127.0.0.1:14200>을 엽니다. 이 모드는 UI 확인용이며, 데스크톱 앱에 비해 일부 파일 접근/재생 동작이 제한될 수 있습니다.

## 기본 사용법

1. **곡 파일 추가**를 눌러 한 개 이상의 오디오 파일을 선택하거나, **폴더 추가**를 눌러 폴더 전체를 불러옵니다.
2. 라이브러리에서 곡을 선택하면 재생됩니다.
3. **Spotify 연결**을 클릭하면 브라우저에서 Spotify 인증 페이지가 열리고, 승인 후 앱으로 자동 복귀합니다.
4. 연결된 Spotify 계정으로 저장한 곡, 플레이리스트, 검색, Premium Web Playback을 사용할 수 있습니다.
5. 하단 오른쪽의 **가사** 버튼을 누르면 재생 중 패널과 LRCLIB 가사 카드를 엽니다. 싱크 가사 줄/단어를 누르면 그 부분부터 재생합니다.

자세한 조작 방법과 Spotify 설정은 [사용자 가이드](docs/USER_GUIDE.md)를 참고하세요.

## 개발 및 빌드

데스크톱 앱을 개발하거나 Windows EXE를 빌드하려면 Node.js, Rust MSVC 툴체인, Visual Studio C++ Build Tools가 필요합니다. 설치 및 명령어는 [Windows 개발·빌드 가이드](docs/BUILD_WINDOWS.md)에 정리했습니다.

새 Windows 버전을 GitHub Releases에 배포하는 순서와 자동 업데이트 설정은 [GitHub Releases 및 앱 자동 업데이트 가이드](docs/BUILD_WINDOWS.md)를 참고하세요.

핵심 명령은 다음과 같습니다.

```powershell
npm ci
npm run build
npm run dev:tauri
npm run build:release
```

- `npm run build`: TypeScript 검사와 웹 프런트엔드 프로덕션 빌드
- `npm run dev:tauri`: Tauri 데스크톱 개발 앱 실행
- `npm run build:release`: 프런트엔드 빌드 후 Tauri Release EXE/설치 패키지 생성

Release EXE와 설치 패키지는 Tauri 빌드 결과물에 생성됩니다. `cargo build --release`만으로는 UI 로딩 검증을 끝내지 않으며, 실제 사용자용 앱은 Tauri 프로덕션 빌드 결과물을 사용해야 합니다.

## 기능 및 제한

- 로컬 음악 파일의 태그와 앨범 이미지를 읽고 플레이어에서 재생합니다.
- 폴더 검색 시 embedded cover를 우선 적용하고, 없으면 `cover.*`, `folder.*`, `front.*` 또는 관련 이름의 이미지를 찾습니다.
- Spotify는 PKCE Authorization Code flow를 사용하며 Client Secret은 사용하지 않습니다.
- Spotify 연결은 앱 내부의 Client ID를 사용하며 사용자가 직접 Client ID를 입력할 필요가 없습니다.
- Spotify 재생은 Premium 계정이 필요하며, Spotify 개발 모드 및 API 정책을 따릅니다.
- Spotify 플레이리스트를 화면에서 정렬하고, 공개/비공개 새 플레이리스트를 만들고, 검색 곡을 추가할 수 있습니다.
- 오른쪽 지금 재생 패널의 크기를 조절할 수 있으며 한 곡 미리보기, 링크 복사, 크레딧 및 대기 항목을 표시합니다.
- LRCLIB에서 제공되는 범위에 따라 일반 가사, 문장 싱크 또는 단어 싱크를 표시합니다. 단어 싱크가 있을 때 카드 우측 상단에서 문장/단어 표시를 전환할 수 있습니다.

## 프로젝트 구조

```text
src/
  main.ts
  styles.css
  redesign.css
  album.css
  player/LocalPlayer.ts
  services/library.ts
  services/lrclib.ts
  services/spotify.ts
src-tauri/
  src/lib.rs
  tauri.conf.json
  icons/maehwa-melo.ico
docs/
  USER_GUIDE.md
  BUILD_WINDOWS.md
```

## 변경 이력

- [CHANGELOG.md](CHANGELOG.md)
