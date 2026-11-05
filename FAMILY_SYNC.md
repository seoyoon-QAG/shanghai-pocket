# 가족 동기화 운영 기록

## 소스와 배포

- 프런트 원본: 이 저장소의 index.html, family-sync.js, sw.js.
- 프런트 배포: main 커밋으로 기존 GitHub Pages가 갱신됨.
- 공용 API: https://shanghai-pocket-family-sync.seoyoon-gravity.chatgpt.site/api/
- 서버 Sites project_id: appgprj_6aec0bc773b08191a51e76e373027e57
- 서버는 Sites가 관리하는 별도 원본 저장소와 배포 이력을 사용한다. 이 저장소의 family-server는 핵심 구현의 참고 사본이며, 해당 폴더만 수정해도 운영 API가 자동 배포되지는 않는다.
- 서버 수정 시 Sites의 get_site / create_source_repository_write_credential로 같은 프로젝트를 열고, 원본 체크아웃 수정·검증·버전 저장·배포를 진행한다. 새 Site를 만들지 않는다. 변경 후 참고 사본도 맞춘다.

## 저장 계약

Cloudflare D1 DB에 가족 토큰의 SHA-256 해시와 키별 JSON 값/버전을 저장한다. Cloudflare R2 BUCKET은 가족 해시/사진 UUID 경로로 파일을 보관한다. 가족 토큰 원문은 서버 DB와 코드에 저장하지 않는다. 브라우저 연결 정보와 전송 대기는 localStorage에 보관한다.

초대 토큰은 32바이트 난수, 43자리 base64url이다. 링크 fragment로 전달하고 페이지에서 읽은 뒤 주소창에서 제거한다. API에는 Authorization Bearer 헤더로만 보낸다. 사진도 인증된 fetch 후 Blob URL로 표시하며 토큰을 이미지 URL에 붙이지 않는다. 관리자 비밀키나 GitHub 토큰을 브라우저에 넣지 않는다.

- POST /families: 현재 기기의 상태로 새 가족 수첩 생성. 초기화는 새 방에서만 이뤄진다.
- GET /family: 인증된 가족의 스냅샷.
- POST /sync: 최대 100개 키 변경, 각 baseVersion과 SQLite 조건부 갱신. 겹친 항목은 409와 현재값으로 반환하고 다른 키 변경은 유지.
- POST /photos: 2MB 이하 JPEG/PNG/WebP. 파일 시그니처 확인.
- GET /photos/:id: 같은 가족의 사진만 제공.
- GET /health: 상태 확인.

CORS는 운영 GitHub Pages origin, 같은 서버 origin, 개발용 terminal.local:4173만 허용한다. 가족 토큰이 없는 요청은 공개 데이터와 상태 확인 외에는 거절한다. 생성/요청 횟수 제한과 본문·항목 크기 제한을 적용한다. 사이트의 공개 접근은 API 연결을 허용하기 위한 것이며 가족 데이터 읽기·쓰기에는 별도 초대 토큰이 필요하다.

## 호환성

기존 localStorage 키 shanghai-pocket-v1을 유지한다. 이전 숫자 인덱스 완료 체크를 안정적인 default-N 체크리스트 ID로 옮긴다. 기존 브라우저의 저장 내용은 가족 수첩 생성 시 초기 공용 내용으로 포함한다. 초대받은 사용자의 기존 기기 목록은 덮어쓰기 전에 별도로 보관한다.

HTML·JSON 백업에 가족 토큰을 넣지 않는다. 서버 사진 원본은 JSON 백업에 포함되지 않는다. 연결된 가족을 유지한 상태에서 다른 JSON으로 전체 공용 상태를 덮어쓰는 동작은 차단했다.

## 검증

프런트: node --check family-sync.js / node tests/family-sync.cjs

서버 원본 체크아웃: node test-api.cjs, Sites build helper. test-api.cjs는 TypeScript와 node:sqlite로 실제 SQL 조건부 갱신·가족 격리·사진 인증·입력 검사를 확인한다. 로컬 DB와 운영 DB는 별개다. 마이그레이션은 기존 SQL을 수정하지 않고 새 파일을 추가한다.

운영 데이터는 GitHub 저장소에 커밋하지 않는다. 테스트 방·테스트 사진은 사용자의 실제 가족 방과 분리한다.
