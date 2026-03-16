# yuri

카카오톡 내보내기 txt를 업로드해서 날짜/시간 기준으로 필터링하고, 결과를 `이름 : 채팅` 형식의 txt로 다시 내려받는 웹앱입니다.

배포 주소(설정 후): <https://yuriluv.github.io/yuri/>

## 기능

- 카카오톡 txt 업로드
- 드래그앤드롭 업로드
- 두 가지 형식 파싱 지원
  - `yyyy년 mm월 dd일 오전/오후 hh:mm, 이름 : 채팅`
  - `yyyy년 mm월 dd일 요일` + `이름 [오전/오후 h:mm] 채팅`
- 시스템 메시지 처리
  - `님이 들어왔습니다.`, `님이 나갔습니다.` 같은 타임스탬프형 시스템 줄도 분리 처리
- 멀티라인 메시지 지원
- 시작 날짜/시간 필수, 종료 날짜/시간 선택
- 결과를 `이름 : 채팅` 형식으로 정제
- txt 다운로드
- 마지막으로 포함된 원본 날짜/시간 표시

## 실행

```bash
npm install
npm run dev
```

브라우저에서 기본적으로 Vite가 출력하는 주소를 열면 됩니다.

## 빌드

```bash
npm run build
```

## GitHub Pages 배포

main 브랜치에 push 하면 GitHub Actions가 자동으로 Pages에 배포합니다.

- workflow: `.github/workflows/deploy-pages.yml`
- repo settings에서 **Pages**가 GitHub Actions 소스를 사용하도록 한 번만 켜주면 됩니다.

## 메모

- 브라우저에서만 처리하므로 업로드한 txt를 서버로 보내지 않습니다.
- 결과 텍스트는 원본 메시지의 줄바꿈을 유지합니다.
- 업로드한 샘플 txt 기준으로 파싱 테스트를 진행했습니다.
