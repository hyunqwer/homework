# 삼남매 영어 학습 관리

주말에 다음 주 계획을 정하고 평일에는 교재·클래스부스터·워크시트·아빠 복습을 체크하는 가족 영어 학습 관리페이지입니다.

## 주요 기능

- 아이별 교재 진도와 수업 기록 관리
- 복습 집중 / 새 진도 진행 모드와 요일별 학습량 설정
- 월~금 주간 계획 생성·수정·확정 및 오늘 할 일 체크
- 정기 수업일 태그 및 실제 수업에서 끝낸 권·차시 입력
- 실제 수업 종료 지점에 맞춘 이후 수업·수업 준비 복습 범위 갱신
- 교재 한 권 5차시(본문 4차시 + 복습 1차시) 반영
- JSON 백업 내보내기·불러오기

## 로컬 실행

별도 프런트엔드 빌드나 패키지 설치 없이 실행됩니다. Python 3가 설치된 환경에서 저장소 루트에서 다음 명령을 실행하세요.

```sh
python -m http.server 5183 --bind 127.0.0.1 --directory dist
```

브라우저에서 http://127.0.0.1:5183/ 를 엽니다. 같은 주소와 브라우저를 사용해야 기존 저장 기록을 이어서 볼 수 있습니다.

## 검증

Node.js 22 이상에서 실행합니다.

```sh
node --check dist/app.js
node check.cjs
```

검증 항목은 주간 날짜 경계, 복습 차시·권 전환, 학습 중지, 수업 예상 범위, 실제 수업 완료 후 기존 계획 갱신, 기록 수정 시 중복 방지 등입니다.

## 파일 구조

- `dist/index.html`: 관리페이지 구성
- `dist/style.css`: 기본 화면과 반응형 스타일
- `dist/class.css`: 수업 태그·수업 입력 화면 스타일
- `dist/app.js`: 학습 기록, 계획, 수업 범위 계산, 브라우저 저장
- `check.cjs`: 동작 검증

## 데이터 저장

웹 주소: https://homework-samgyosi.firebaseapp.com

Firebase Authentication의 Google 로그인과 Cloud Firestore를 사용합니다. 현재는 프로젝트 관리자 Google 계정으로만 가족 기록을 읽고 쓸 수 있습니다. PC·휴대폰에서 같은 계정으로 로그인하면 같은 기록을 불러옵니다.

처음 연결할 때 이 기기의 기록으로 시작하거나 기존 JSON 백업을 불러올 수 있습니다. 기존 로컬 페이지의 기록은 먼저 백업을 저장한 후 웹 사이트에서 불러오세요. 클라우드 기록을 처음 불러오기 전의 기기 데이터와 미전송 변경 내용도 localStorage에 보관합니다.

저장에는 문서 버전을 확인하는 Firestore 트랜잭션을 사용합니다. 두 기기에서 동시에 수정하면 이전 기록으로 덮어쓰는 대신 충돌 안내가 나타납니다. 기기 변경을 백업하고 최신 클라우드 기록을 불러온 뒤 필요한 변경을 다시 반영하세요. 연결 실패 시 저장 완료로 표시하지 않으며 다시 연결 버튼을 제공합니다.

현재 가족 기록은 `families/samnammae` 문서의 JSON payload로 저장하며 최대 약 780KB로 제한합니다. 문서 삭제는 클라이언트에서 허용하지 않습니다. 허용 계정은 Firestore의 비공개 `access/{Firebase Auth UID}` 문서에서 `allowed: true`로 관리합니다. 이 목록은 클라이언트에서 직접 읽거나 수정할 수 없으며, 관리자 콘솔 또는 IAM 권한이 있는 관리 도구로만 변경합니다. 개인 이메일과 UID는 공개 소스에 넣지 않습니다.

## Firebase 배포

```sh
node check.cjs
node check-sync.mjs
firebase deploy --only firestore:rules,hosting --project homework-samgyosi
```

Firestore 기본 데이터베이스는 서울 리전(`asia-northeast3`), Standard 에디션입니다. Google 로그인 제공업체는 Firebase Console에서 설정합니다. Firebase 웹 구성은 공개 식별 설정이며 비밀 키가 아닙니다. 서비스 계정 키와 로그인 토큰은 저장소에 넣지 않습니다.

초기 아이별 교재·수업 설정은 `dist/app.js`의 `seed`에 있습니다. 개인 백업 파일, 로컬 미리보기 이미지 및 Sites 호스팅 식별 정보는 Git 추적에서 제외합니다.

## 작업 저장소

https://github.com/hyunqwer/homework

로그인 상태가 교차 도메인 저장 제한의 영향을 받지 않도록 `firebaseapp.com`을 표준 접속 주소로 사용합니다. `web.app` 접속은 같은 프로젝트의 표준 주소로 이동합니다.
