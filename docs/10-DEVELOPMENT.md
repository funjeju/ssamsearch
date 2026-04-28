# 10. 로컬 개발 환경

## 1. 사전 요구사항

| 도구 | 버전 |
|---|---|
| Node.js | 20.x LTS |
| pnpm | 9.x |
| Docker Desktop | 최신 (워커 로컬 실행용) |
| Firebase CLI | 13.x |
| Git | 2.x |

```bash
# Node 버전 관리는 fnm 또는 nvm 권장
fnm use 20

# pnpm 활성화
corepack enable
corepack prepare pnpm@9 --activate
```

## 2. 모노레포 구조

```
ssamsearch/
├── apps/
│   ├── web/              Next.js 14 웹 앱
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── package.json
│   │   └── next.config.js
│   └── worker/           Playwright 워커
│       ├── src/
│       ├── Dockerfile
│       ├── fly.toml
│       └── package.json
├── packages/
│   ├── shared/           공통 타입·유틸
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   └── package.json
│   ├── adapters/         사이트별 스크래퍼
│   │   ├── src/
│   │   │   ├── indischool/
│   │   │   ├── iscream/
│   │   │   ├── teacherville/
│   │   │   ├── tsherpa/
│   │   │   ├── edunet/
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── crypto/           암호화 유틸
│       ├── src/
│       │   └── envelope.ts
│       └── package.json
├── docs/                 본 문서
├── .github/workflows/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`package.json` (루트):
```json
{
  "name": "ssamsearch",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter './apps/*' dev",
    "build": "pnpm --filter './apps/*' build",
    "test": "pnpm --recursive test",
    "lint": "pnpm --recursive lint",
    "typecheck": "pnpm --recursive typecheck",
    "firebase:emulator": "firebase emulators:start --only auth,firestore",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "prettier": "^3.3.0",
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

## 3. 초기 셋업

```bash
# 1. 클론
git clone https://github.com/funjeju/ssamsearch.git
cd ssamsearch

# 2. 의존성 설치
pnpm install

# 3. Playwright 브라우저 다운로드 (워커 로컬 실행 시)
cd apps/worker
pnpm exec playwright install chromium
cd ../..

# 4. 환경변수 복사
cp apps/web/.env.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env

# 5. Firebase 에뮬레이터 초기 설정
firebase init emulators
# Auth, Firestore 선택, 기본 포트 사용
```

## 4. 환경변수 (`.env.local`)

`apps/web/.env.example`:
```bash
# === Firebase (클라이언트) ===
NEXT_PUBLIC_FIREBASE_API_KEY=fake-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ssamsearch-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# 에뮬레이터 사용
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true

# === Firebase Admin (서버) ===
FIREBASE_ADMIN_PROJECT_ID=ssamsearch-dev
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# === Upstash Redis (개발) ===
# 방법 1: 실제 Upstash 무료 인스턴스
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# 방법 2: 로컬 Redis (도커)
# REDIS_URL=redis://localhost:6379

# === KMS (개발은 mock 사용) ===
USE_KMS_MOCK=true
KMS_MOCK_KEY=this-is-a-32-byte-mock-key-for-dev!

# === SMS OTP ===
# 개발은 콘솔 출력 모드
SMS_PROVIDER=console
# 운영
# SMS_PROVIDER=nhn
# NHN_CLOUD_APP_KEY=
# NHN_CLOUD_SECRET_KEY=
# NHN_CLOUD_SENDER_PHONE=

# === Gemini ===
GEMINI_API_KEY=  # 실제 키 사용 (무료 티어)

# === 워커 ===
WORKER_URL=http://localhost:8080
WORKER_INTERNAL_TOKEN=local-dev-token
```

`apps/worker/.env.example`:
```bash
PORT=8080
NODE_ENV=development

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=ssamsearch-dev
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# KMS
USE_KMS_MOCK=true
KMS_MOCK_KEY=this-is-a-32-byte-mock-key-for-dev!

# Gemini
GEMINI_API_KEY=

# 내부 인증
WORKER_INTERNAL_TOKEN=local-dev-token

# 테스트 계정 (절대 커밋 금지)
TEST_INDISCHOOL_USER=
TEST_INDISCHOOL_PASS=
TEST_ISCREAM_USER=
TEST_ISCREAM_PASS=
# ...
```

## 5. 일상 개발 흐름

### 새 터미널 세션 시작
```bash
# 터미널 1: Firebase 에뮬레이터
pnpm firebase:emulator

# 터미널 2: 웹 앱
pnpm --filter web dev
# → http://localhost:3000

# 터미널 3: 워커
pnpm --filter worker dev
# → http://localhost:8080
```

### 단축 명령
루트에서:
```bash
pnpm dev   # 웹+워커 동시 실행
```

## 6. 코딩 컨벤션

### TypeScript
- `strict: true` 강제
- `noUncheckedIndexedAccess: true`
- 모든 외부 API 응답은 zod 검증

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "jsx": "preserve",
    "isolatedModules": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@ssamsearch/shared": ["packages/shared/src"],
      "@ssamsearch/adapters": ["packages/adapters/src"],
      "@ssamsearch/crypto": ["packages/crypto/src"]
    }
  }
}
```

### ESLint + Prettier
```bash
pnpm add -D -w eslint prettier eslint-config-next
```

`.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

### 네이밍 규칙
- 파일: `kebab-case.ts` (컴포넌트는 `PascalCase.tsx`)
- 함수·변수: `camelCase`
- 타입·인터페이스: `PascalCase`
- 상수: `SCREAMING_SNAKE_CASE`
- React 컴포넌트: `PascalCase`

### 폴더 구조 (apps/web)
```
apps/web/
├── app/                       Next.js App Router
│   ├── (auth)/                인증 그룹
│   ├── (app)/                 보호된 영역
│   ├── api/                   API Routes
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                    shadcn/ui
│   ├── search/                검색 컴포넌트
│   ├── accounts/              계정 컴포넌트
│   └── shared/                범용
├── lib/
│   ├── firebase/
│   │   ├── client.ts
│   │   └── admin.ts
│   ├── redis.ts
│   ├── kms.ts
│   ├── otp/
│   ├── api/                   API 클라이언트 헬퍼
│   └── utils.ts
├── hooks/                     React 커스텀 훅
├── types/                     글로벌 타입
└── public/
```

## 7. Git 워크플로우

### 브랜치 전략
- `main`: 운영 (보호됨, PR로만 머지)
- `develop`: 통합 개발
- `feature/{issue-id}-{description}`: 기능
- `fix/{issue-id}-{description}`: 버그 수정

### 커밋 메시지 (Conventional Commits)
```
feat(search): add SSE streaming for search results
fix(auth): handle OTP expiration correctly
docs(readme): update setup instructions
chore(deps): bump playwright to 1.45
```

### PR 체크리스트
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm lint` 통과
- [ ] 새 기능에 테스트 추가
- [ ] 환경변수 추가 시 `.env.example` 업데이트
- [ ] DB 스키마 변경 시 `04-DATABASE.md` 업데이트

## 8. 테스트

### 단위 테스트 (Vitest)
```typescript
// packages/crypto/src/__tests__/envelope.test.ts
import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from '../envelope';

describe('envelope encryption', () => {
  it('should encrypt and decrypt correctly', async () => {
    const original = 'my-secret-password';
    const encrypted = await encryptCredential(original);
    const decrypted = await decryptCredential(encrypted);
    expect(decrypted).toBe(original);
  });
});
```

```bash
pnpm --filter crypto test
pnpm test  # 전체
```

### 어댑터 테스트 (실 사이트)
```bash
# 실제 테스트 계정 필요
TEST_INDISCHOOL_USER=... pnpm --filter adapters test
```

CI에서는 실 사이트 테스트는 nightly로만 실행 (사이트 변경 감지용).

### E2E 테스트 (Playwright)
```typescript
// apps/web/e2e/search.spec.ts
import { test, expect } from '@playwright/test';

test('user can search and see results', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'TestPass123!');
  await page.click('button[type=submit]');
  
  await page.waitForURL('/search');
  await page.fill('[name=query]', '5학년 사회');
  await page.click('button:has-text("검색")');
  
  await expect(page.locator('.result-card').first()).toBeVisible({ timeout: 10000 });
});
```

## 9. 자주 쓰는 디버깅 명령

```bash
# Firebase 에뮬레이터 데이터 확인
# → http://localhost:4000

# Firestore 데이터 export/import
firebase emulators:export ./emulator-data
firebase emulators:start --import ./emulator-data

# 워커 로그 보기
pnpm --filter worker dev | tee worker.log

# Redis 데이터 확인 (Upstash 사용 시)
# → Upstash Console에서 직접 또는
curl -X POST $UPSTASH_REDIS_REST_URL/get/some-key \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"

# 타입 에러만 빠르게
pnpm typecheck
```

## 10. 자주 만나는 문제

### Firebase 에뮬레이터 연결 안 됨
- `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` 확인
- 클라이언트 초기화 코드:
```typescript
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const db = getFirestore(app, '(default)');  // ← 명시 필수
const auth = getAuth(app);

if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

### Playwright 한국어 폰트 깨짐
- 시스템에 Noto Sans CJK 설치
```bash
brew tap homebrew/cask-fonts
brew install --cask font-noto-sans-cjk-kr  # macOS
```

### 워커가 로컬에서 너무 느림
- Playwright headless 모드 확인
- Chromium 인스턴스 재사용 (브라우저 1개 → 컨텍스트 다중)

### 환경변수 줄바꿈 문제
- `FIREBASE_ADMIN_PRIVATE_KEY`는 `\n`이 그대로 문자열에 들어감
- 로드 시 `.replace(/\\n/g, '\n')` 처리

## 11. VS Code 권장 확장

`.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "vitest.explorer",
    "firebase.firebase-explorer"
  ]
}
```

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```
