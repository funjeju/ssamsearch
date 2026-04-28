# 03. 기술 스택 상세

## 1. 전체 의존성 표

| 영역 | 기술 | 버전 | 선택 이유 |
|---|---|---|---|
| 런타임 | Node.js | 20.x LTS | Vercel·Fly.io 모두 안정 지원 |
| 패키지 매니저 | pnpm | 9.x | 모노레포 효율, workspace 내장 |
| 프레임워크 | Next.js | 14.2.x | App Router 안정화, Server Actions 활용 |
| UI 라이브러리 | React | 18.3.x | Next.js 14 권장 버전 |
| 스타일링 | Tailwind CSS | 3.4.x | shadcn/ui 호환 |
| 컴포넌트 | shadcn/ui | latest | 디자인 시안 일관성, 커스터마이징 자유 |
| 아이콘 | lucide-react | 0.400+ | shadcn/ui 기본 |
| 데이터베이스 | Firebase Firestore | 12.x | 기존 Next Curator 스택과 일치 |
| 인증 | Firebase Auth | 12.x | 이메일/비번 + 커스텀 토큰 |
| 캐시·큐 | Upstash Redis | - | Serverless 친화적 Redis |
| 큐 라이브러리 | BullMQ | 5.x | Redis 기반 잡 큐 |
| 스크래핑 | Playwright | 1.45+ | 다중 브라우저, 안정적인 셀렉터 |
| HTML 파싱 | Cheerio | 1.0+ | jQuery 문법, 가벼움 |
| AI | @google/generative-ai | latest | Gemini 2.0 Flash Lite |
| 키 관리 | @google-cloud/kms | 4.x | Firebase 동일 GCP 사용 |
| OTP (TOTP) | otplib | 12.x | RFC 6238 표준 |
| OTP (SMS) | NHN Cloud SMS | API | 한국 통신사 직결 |
| 암호화 | Node crypto (built-in) | - | AES-256-GCM 표준 구현 |
| 폼 검증 | zod | 3.23+ | 타입 안전 검증 |
| 폼 라이브러리 | react-hook-form | 7.x | shadcn/ui 권장 |
| 상태 관리 | Zustand | 4.x | 가벼움, Next.js 친화 |
| 데이터 페칭 | TanStack Query | 5.x | 캐싱·재시도·낙관적 업데이트 |
| 로깅 | Pino | 9.x | 빠르고 구조화 로그 |
| 테스트 | Vitest | 1.x | Vite 기반, ESM 친화 |
| E2E 테스트 | Playwright Test | 1.45+ | 스크래퍼와 동일 도구 재사용 |

## 2. 프론트엔드 스택 상세

### Next.js 14 App Router

**선택 이유**
- React Server Components로 초기 로드 최적화
- Streaming SSR로 검색 결과 즉시 표시 가능
- Vercel과 1급 통합

**주요 라우팅**
```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── verify/page.tsx        (OTP 검증)
├── (app)/
│   ├── search/page.tsx        (메인 검색)
│   ├── accounts/page.tsx      (외부 계정 관리)
│   └── settings/page.tsx
├── api/
│   ├── auth/[...]
│   ├── accounts/[...]
│   ├── search/route.ts
│   └── search/stream/route.ts (SSE)
└── layout.tsx
```

### shadcn/ui 컴포넌트 사용 목록

```bash
npx shadcn-ui@latest add button input label card
npx shadcn-ui@latest add form select dropdown-menu
npx shadcn-ui@latest add dialog alert-dialog toast
npx shadcn-ui@latest add badge separator skeleton
npx shadcn-ui@latest add tabs avatar switch
```

상세 컴포넌트 매핑은 [08-DESIGN_SYSTEM.md](./08-DESIGN_SYSTEM.md) 참조.

## 3. 백엔드 스택 상세

### Vercel Serverless Functions

**제약사항**
- Hobby: 함수 실행 10초 / Pro 플랜: 60초
- 메모리: 1GB / Pro: 3GB
- 함수 패키지 50MB (압축)

**처리 가능한 작업**
- 인증 (Firebase Auth verifyIdToken)
- Firestore 읽기·쓰기
- 외부 계정 등록 (자격증명 암호화 후 저장)
- 검색 잡 큐 등록 + searchId 발급
- SSE 스트리밍 (이건 Edge Runtime으로)

**처리 불가능 작업**
- Playwright 실행 → Fly.io 워커로 위임

### Fly.io 워커

**Dockerfile 핵심**
```dockerfile
FROM node:20-bookworm-slim

# Playwright 의존성 설치
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/worker.js"]
```

**리소스 권장**
- CPU: shared-cpu-2x (베타) → performance-2x (정식)
- 메모리: 1GB → 2GB
- 인스턴스: 2개 (zero-downtime 배포)

## 4. 데이터 계층

### Firebase Firestore

**Next Curator에서 검증된 패턴 재사용**
- Firebase SDK 12.x
- `getFirestore(app, '(default)')` — 데이터베이스 ID 명시 (이전 디버깅 이슈 회피)
- 클라이언트는 Firebase SDK 직접 사용 + 보안 규칙으로 보호
- 서버는 firebase-admin SDK 사용

**컬렉션 구조 요약** (상세는 [04-DATABASE.md](./04-DATABASE.md))
- `users/{uid}` - 사용자 프로필
- `users/{uid}/accounts/{accountId}` - 암호화된 외부 계정
- `users/{uid}/devices/{deviceId}` - 신뢰 디바이스
- `users/{uid}/searchHistory/{historyId}` - 검색 이력
- `searchCache/{cacheKey}` - 검색 결과 캐시 (메타데이터만)

### Upstash Redis

**용도**
1. BullMQ 잡 큐 (검색 요청)
2. 사이트별 세션 쿠키 캐시 (TTL 30분)
3. SSE 채널 Pub/Sub
4. 검색 결과 단기 캐시 (TTL 1시간)
5. Rate limiter (사용자별 분당 10회)

**비용** (가격은 변경 가능 → 도입 시점 재확인 필요)
- Free tier: 10,000 명령/일
- Pay-as-you-go: 트래픽 따라 과금
- MVP는 Free → Pro $10/월 정도 예상

## 5. AI 계층

### Google Gemini 2.0 Flash Lite

**용도**
- 검색 결과 HTML → 구조화 JSON 변환
- 학년·과목·자료유형 자동 분류

**프롬프트 구조 예시**
```typescript
const prompt = `
다음은 ${siteName}에서 검색한 결과 HTML 일부입니다.
각 자료를 다음 JSON 스키마로 추출하세요:

{
  "items": [
    {
      "title": "자료 제목",
      "summary": "100자 이내 요약",
      "url": "원문 URL",
      "publishedAt": "YYYY-MM-DD",
      "author": "작성자명 또는 null",
      "grade": "1|2|3|4|5|6|중1|중2|중3|고1|고2|고3|null",
      "subject": "국어|수학|사회|과학|영어|음악|미술|체육|기타|null",
      "materialType": "PPT|학습지|영상|평가지|활동지|기타",
      "tags": ["태그1", "태그2"]
    }
  ]
}

HTML:
${html}
`;
```

**비용 (참고치 — 최신 가격은 도입 시점에 [Gemini 가격표](https://ai.google.dev/gemini-api/docs/pricing) 확인)**
- 검색 1건 당 평균 5,000 토큰 입력 + 1,000 토큰 출력
- 1만 검색/월 시 매우 저렴한 수준

## 6. 보안 계층

### Google Cloud KMS
- Firebase와 동일 GCP 프로젝트 사용 → IAM 통합
- 키 링: `ssamsearch-keyring`
- 마스터 키: `user-credential-master-key`
- 키 회전: 90일 자동
- 액세스: Fly.io 워커 서비스 계정만

### 암호화 라이브러리
- Node 내장 `crypto.createCipheriv('aes-256-gcm', ...)`
- 외부 라이브러리 의존 없음 → 공급망 공격 위험 최소화

### OTP
- **SMS**: NHN Cloud SMS API (kt/SKT/LG 직결)
- **TOTP**: otplib (RFC 6238) → Google Authenticator, Authy 호환

## 7. 결제 (베타 이후)

- **토스페이먼츠** 또는 **포트원** (한국 시장)
- 월 4,900원 구독 모델 (가안)
- MVP에서는 미구현

## 8. 주요 환경 변수

```bash
# === Firebase ===
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# === Firebase Admin (서버 전용) ===
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# === Upstash Redis ===
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# === Google Cloud KMS ===
GCP_KMS_PROJECT_ID=
GCP_KMS_LOCATION=asia-northeast3
GCP_KMS_KEYRING=ssamsearch-keyring
GCP_KMS_KEY=user-credential-master-key
GCP_KMS_SERVICE_ACCOUNT_KEY=  # JSON 키 (워커만)

# === AI ===
GEMINI_API_KEY=

# === SMS OTP ===
NHN_CLOUD_APP_KEY=
NHN_CLOUD_SECRET_KEY=
NHN_CLOUD_SENDER_PHONE=

# === 워커 ===
WORKER_URL=https://ssamsearch-worker.fly.dev
WORKER_INTERNAL_TOKEN=  # 워커 ↔ Vercel 간 인증

# === 운영 ===
NODE_ENV=production
SENTRY_DSN=
```

`.env.example` 파일을 저장소에 두고 실제 값은 Vercel/Fly.io 시크릿 매니저에 저장.
