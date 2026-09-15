# 시간 신청 · Time Slot Request

월(건설) · 화(연구) · 목(훈련) 이벤트의 30분 단위 시간 신청과 자동 배정 웹앱입니다.
한국어 / English 전환을 지원하며, 한국어 화면은 KST 기준, 영어 화면은 UTC 기준으로 시간을 표시합니다.

- 신청자: 닉네임 → 요일별 1~5순위 시간 + 보유 자원 입력 → 저장 (같은 닉네임으로 재수정 가능)
- 관리자(관리자 코드 입력): 자동 배정 실행, 누락자 직접 배정, 요일별 결과 공개, 시간대당 인원 설정, 텍스트 복사
- 배정 우선순위: 월 = 정련순금 → 순금 → 건설 가속 / 화 = 순금 가루 → 연구 가속 / 목 = 훈련 가속

## 1. Supabase 설정

1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. **SQL Editor** 에 `supabase/schema.sql` 내용을 붙여넣고 실행합니다. (테이블 · RLS 정책 · 관리자 함수 · 기본 관리자 코드가 만들어집니다. 여러 번 실행해도 됩니다.)
3. **Project Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사합니다.

관리자 접속은 **관리자 코드 하나**만 입력합니다. (아이디·이메일 없음)
- 기본 코드: `1234` → 로그인 후 관리자 화면 하단 "설정 → 관리자 코드 변경"에서 바꾸세요.
- SQL로 바꾸려면: `update public.admin_access set code_hash = public.code_hash('새코드') where id = 1;`
- `schema.sql` 을 다시 실행하면 코드가 `1234` 로 초기화됩니다.

권한 구조: 누구나 신청을 읽고/쓰고/수정할 수 있습니다. 삭제 · 배정 결과 저장 · 공개 설정 · 초기화는 서버 쪽 함수가 로그인 토큰을 확인한 뒤에만 실행되므로, 링크를 공개해도 관리자가 아닌 사람은 바꿀 수 없습니다.

## 2. 로컬 실행

```bash
npm install
cp .env.example .env      # URL과 anon key 입력
npm run dev
```

## 3. GitHub → Vercel 배포

1. 이 폴더를 GitHub 저장소에 올립니다. (`.env` 는 `.gitignore` 에 있어 올라가지 않습니다)
2. Vercel → **Add New Project** → 저장소 선택. Framework는 Vite로 자동 인식됩니다.
3. **Environment Variables** 에 아래 두 개를 추가합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. 이후 GitHub에 push 할 때마다 자동 재배포됩니다.

## 파일 구조

```
index.html
src/
  App.jsx                 화면 흐름 (신청 / 결과 / 관리자 로그인)
  i18n.js                 한국어·영어 문구
  styles.css
  lib/logic.js            슬롯 계산, 우선순위 정렬, 자동 배정
  lib/supabase.js         Supabase 읽기/쓰기, 관리자 로그인(함수 호출)
  components/SlotPicker.jsx
  components/NumField.jsx
  components/AdminPanel.jsx
supabase/schema.sql       테이블 · RLS 정책 · 관리자 함수
```

## 데이터 형식

`applicants.days`
```json
{
  "mon": { "ranks": [0, 5, 12], "build": "30", "refined": "120", "gold": "800" },
  "tue": { "ranks": [3], "dust": "5000", "research": "40" },
  "thu": { "ranks": [], "train": "25" }
}
```
`ranks` 는 슬롯 번호(0~47)이며 0 = UTC 00:00 = KST 09:00, 이후 30분씩 증가합니다. 비어 있으면 그 요일은 불참입니다.

`settings.data` 에는 `capacity`, `published`, `assignments`, `manual`, `unassigned` 가 들어 있습니다.
