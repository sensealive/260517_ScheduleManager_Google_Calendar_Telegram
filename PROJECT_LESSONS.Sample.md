# [260525_GoogleSheets_CodexCLI_Telegram_Works] Project Lessons 기록

## 2026-05-25 작업 회고

### 오늘의 목표

Google Sheet의 `Jobs` 시트에서 작업을 읽고, 로컬 Python 작업 관리자가 Codex CLI를 non-interactive 방식으로 실행한 뒤 결과를 Google Sheet와 Telegram에 기록하는 자동화 루프를 만든다.

검증 작업은 단순했다. `Works` 폴더에 `260525_test.txt` 파일을 만들고, 파일 안에 구구단 내용을 기록하는 것이었다. 개별 작업만 보면 Google Sheets 조회, Codex CLI 실행, 텍스트 파일 생성, Telegram 메시지 발송은 모두 작은 작업이다. 그러나 실제로는 Windows, Codex CLI, subprocess, Google Sheet 상태 전이, Telegram 설정, 산출물 검증이 맞물리며 여러 번 실패했다.

이 문서는 같은 시행착오를 반복하지 않기 위한 재발 방지 기록이다.

## 실패와 원인

### 1. `.env`의 service account 경로가 실제 JSON 파일을 가리키지 않음

초기 실행은 Google service account JSON 파일을 찾지 못해 실패했다. `.env`의 `GOOGLE_SERVICE_ACCOUNT_JSON` 값이 실제 파일 경로가 아니라 파일명 일부처럼 보이는 값이었다.

재발 방지:

- 실행 전 `GOOGLE_SERVICE_ACCOUNT_JSON`이 실제 존재하는 파일인지 검증한다.
- 인증 JSON 내용은 출력하지 않고, 존재 여부와 파일명만 확인한다.
- 설정 오류는 Codex 재시도로 해결되지 않으므로 `F` 또는 `H`로 분류한다.

### 2. Windows `strftime("%-m/%-d")` 미지원

Linux/macOS 스타일의 `%-m`, `%-d` 포맷을 Windows Python에서 사용해 `ValueError`가 발생했다. 이 오류가 작업 선점 이후 발생해 `R` 상태 고착으로 이어질 수 있었다.

재발 방지:

- 날짜 포맷은 플랫폼별 `strftime` 플래그에 의존하지 않는다.
- `datetime.now()` 값을 직접 `f"{month}/{day} {hour:02d}:{minute:02d}"`처럼 조합한다.
- 작업 선점 이후 발생하는 모든 예외는 Work Log와 Remark에 남겨야 한다.

### 3. `codex`는 설치되어 있었지만 Python subprocess가 직접 실행하지 못함

Windows에서 `where codex`는 `codex`와 `codex.cmd`를 찾았지만, Python 3.7의 `subprocess.run(["codex", ...])`는 `[WinError 2]`로 실패했다. `shutil.which("codex")`가 반환한 `codex.CMD`를 직접 실행하면 정상 동작했다.

재발 방지:

- Codex 실행 전 `shutil.which()`로 실제 실행 파일 경로를 해석한다.
- Work Log에 실제 실행된 Codex command를 남긴다.
- `codex --version` 또는 `codex exec --help`를 먼저 확인한다.

### 4. Codex CLI의 git repo check

프로젝트는 GitHub와 무관한 로컬 자동화였지만, Codex CLI는 기본적으로 git repository 안에서 실행 중인지 확인했다. Project Path가 현재 프로젝트 내부의 `Works` 폴더여도 `.git`이 없으면 `Not inside a trusted directory and --skip-git-repo-check was not specified.` 오류가 발생했다.

재발 방지:

- 자동화 실행에서는 `.env`에 `CODEX_ARGS=exec --skip-git-repo-check`를 둔다.
- 이 체크는 GitHub 연동이 아니라 Codex CLI의 안전장치임을 기억한다.
- git repo가 아닌 로컬 작업 폴더를 처리할 때는 해당 옵션이 필수다.

### 5. subprocess stdin 대기와 프롬프트 전달 방식

처음에는 프롬프트를 Codex CLI의 명령 인자로 넘기고 `input=""`으로 stdin을 닫았다. 이 방식에서 Codex 로그에는 `Reading additional input from stdin...`이 보였고, 때로 래퍼 PowerShell만 남아 있는 고착 상태처럼 보였다. 이후 Codex CLI 도움말을 확인해 `codex exec ... -` 형태로 stdin에서 프롬프트를 읽게 바꾸었다.

재발 방지:

- 긴 지시사항과 줄바꿈이 포함된 프롬프트는 명령 인자가 아니라 stdin으로 전달한다.
- Codex command는 `codex exec --skip-git-repo-check -` 형태가 되도록 구성한다.
- `subprocess.run(..., input=prompt, encoding="utf-8", errors="replace", timeout=...)`를 사용한다.

### 6. Windows 기본 인코딩 `cp949`로 Codex 출력 디코딩 실패

Codex 출력에는 UTF-8 문자가 포함될 수 있다. Python subprocess가 Windows 기본 인코딩인 cp949로 stdout/stderr를 읽다가 `UnicodeDecodeError`가 발생했고, 이 오류가 `IndexError`처럼 부정확하게 짧게 기록되었다.

재발 방지:

- `subprocess.run`에는 `encoding="utf-8", errors="replace"`를 명시한다.
- 예외 발생 시 `str(error)`만 기록하지 말고 traceback을 Work Log에 남긴다.
- Windows 로컬 실행에서 CLI 출력은 항상 UTF-8 가능성을 전제로 처리한다.

### 7. Codex가 성공 종료했지만 실제 파일은 비어 있음

가장 중요한 실패였다. Codex는 파일을 만들었다고 보고했고, 프로세스 return code도 0이었다. 그러나 `Works/260525_test.txt`는 비어 있었다. 초기 구현은 Codex return code만 보고 `D`로 처리했기 때문에 잘못된 성공 판정을 했다.

재발 방지:

- `D` 상태는 Codex return code가 아니라 실제 산출물 검증 후에만 기록한다.
- `Expected Output`의 핵심 라인이 Project Path 안의 텍스트 파일에 실제로 존재하는지 확인한다.
- 산출물이 비어 있거나 Expected Output이 없으면 `F`와 `output_validation_failed`로 기록한다.
- 단순 파일 생성 작업도 반드시 파일 크기와 내용 일부를 검증한다.

### 8. Telegram Bot Token은 정상이나 Chat ID가 틀림

Telegram `getMe`는 성공했지만 `getChat`이 `Bad Request: chat not found`를 반환했다. 원인은 `TELEGRAM_CHAT_ID`에 잘못된 부호가 들어간 것이었다.

재발 방지:

- Telegram 설정 검증은 `getMe`, `getChat`, `sendMessage` 순서로 한다.
- Bot Token 값은 출력하지 않는다.
- Chat ID 수정 후 테스트 메시지를 보내 실제 수신을 확인한다.

### 9. G: 비공개 백업 단계를 git push 후 빠뜨림

사용자 규칙상 git push 요청에는 `.gitignore` 대상 중 실제 존재하는 파일을 `G:\내 드라이브\Private_for_AI_Project\Cursor_Project\<프로젝트명>`으로 복사하는 단계가 포함된다. 첫 push 때 이 단계를 빠뜨렸다가 나중에 보완했다.

재발 방지:

- git push 전후 체크리스트에 G: 백업을 명시한다.
- `.env`, service account JSON, `Works/`, 기타 `.gitignore` 대상 실제 파일을 G: 동일 상대 경로로 복사한다.
- G: 백업 폴더 정리 후보는 삭제 전 목록만 보여준다.

## 확정된 실행 규칙

- `.env`는 git에 올리지 않는다.
- Google service account JSON은 git에 올리지 않는다.
- `Works/` 산출물은 git에 올리지 않는다.
- Codex CLI는 Windows에서 `shutil.which()`로 실제 `.CMD` 경로를 해석한다.
- Codex CLI 인자는 기본적으로 `exec --skip-git-repo-check`를 사용한다.
- Codex 프롬프트는 stdin으로 전달한다.
- Codex 출력은 UTF-8로 읽고 깨지는 문자는 replacement 처리한다.
- `D` 판정 전에는 산출물 검증을 수행한다.
- Telegram은 `getChat`과 `sendMessage`까지 검증한다.
- 모든 실패는 `G`열 Work Log와 `H`열 Remark에 원인 추적이 가능하게 남긴다.

## 다음 작업 전 체크리스트

- [ ] `.env`가 존재하고 필수 값이 모두 채워져 있는가?
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` 파일이 실제로 존재하는가?
- [ ] Google Sheet가 service account 이메일에 공유되어 있는가?
- [ ] `TELEGRAM_BOT_TOKEN`의 `getMe`가 성공하는가?
- [ ] `TELEGRAM_CHAT_ID`의 `getChat`과 `sendMessage`가 성공하는가?
- [ ] `codex --version`이 실행되는가?
- [ ] `codex exec --help`에서 필요한 옵션이 확인되는가?
- [ ] `.env`의 `CODEX_ARGS`에 `exec --skip-git-repo-check`가 들어 있는가?
- [ ] Project Path가 존재하고 작업 파일을 쓸 수 있는가?
- [ ] Expected Output이 비어 있지 않고 검증 가능한 형태인가?
- [ ] 실패 시 traceback과 Work Log가 충분히 기록되는가?
- [ ] 작업 완료 후 실제 산출물 내용이 검증되는가?

## 오늘의 결론

구구단 파일 생성은 어려운 일이 아니었다. 오래 걸린 이유는 작은 실행 전제들이 검증 없이 한꺼번에 얽혀 있었기 때문이다. 앞으로는 “Codex가 성공했다고 말함”을 성공으로 보지 말고, 환경 검증과 산출물 검증을 자동화 루프의 일부로 취급한다.
