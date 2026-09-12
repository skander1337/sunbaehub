# 한국어 전체 기능 시연

`scripts/record-demo.mjs`는 실제 브라우저에서 가상 계정으로 회원가입, 로그인, 선배 인증, 예약, 상담, 리뷰, 환불과 출금을 시연합니다. 한국어 화면과 자막을 사용하며 음성은 포함하지 않습니다.

심사용 재녹화는 한글을 한 글자씩 입력하고, 단어와 문장 사이에 잠시 멈춥니다. 커서 이동과 클릭을 표시하고, 각 영역을 천천히 스크롤한 뒤 4–8초 동안 읽을 시간을 둡니다. 장면은 최소 16초이며 결과 화면은 최소 5.5초 유지합니다. 실제 녹화 속도로 내보내며, `typingEvents`에 입력 길이와 소요 시간을 남겨 속도를 확인할 수 있습니다. 이전 영상은 보존하고 새 출력 폴더를 사용하세요.

녹화는 데이터베이스를 변경합니다. 원본 프로젝트의 `dev.db`를 사용하지 말고, 별도의 프로젝트 복사본에서 새 데이터베이스를 준비하세요. 서버를 실행하기 전에 그 복사본에서 `npm run setup`을 실행한 뒤 `npm run dev -- --port 3107`로 시작합니다. 녹화 중에는 소스 코드를 수정하거나 데이터베이스를 초기화하지 마세요.

복사본 디렉터리에서 실행합니다. 출력 경로는 실제 절대 경로로 지정합니다.

```sh
RECORDING_DATABASE_IS_DISPOSABLE=1 BASE_URL=http://localhost:3107 RECORDING_OUTPUT=/absolute/path/to/recordings/full-demo node scripts/record-demo.mjs
python3 scripts/recording/render.py /absolute/path/to/recordings/full-demo/manifest.json
```

필요한 도구: 프로젝트 의존성, Google Chrome, Playwright의 녹화용 FFmpeg, 시스템 `ffmpeg`와 `ffprobe`, Python Pillow, macOS의 Apple SD Gothic Neo 글꼴.

완성 파일은 `SunbaeHub-full-demo.mp4`입니다. 별도의 SRT 자막, 장면별 목차, 화면 확인용 이미지와 `validation.json`도 함께 생성합니다. `manifest.json`의 `errors`가 비어 있고 마지막 장면까지 기록되었는지 확인한 후 영상을 렌더링하세요. 원본 녹화와 장면별 자막은 다시 편집할 수 있도록 보관됩니다.
