# 09. 배포 가이드

## 1. 배포 아키텍처 한눈에

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub: main 브랜치 push                                   │
└────────────────┬─────────────────────────┬──────────────────┘
                 │                         │
                 ▼                         ▼
       ┌─────────────────┐        ┌─────────────────┐
       │  Vercel         │        │  Fly.io         │
       │  apps/web       │        │  apps/worker    │
       │  자동 빌드·배포 │        │  GitHub Actions │
       └─────────────────┘        │  → fly deploy   │
                                  └─────────────────┘
```

- **웹**: Vercel이 GitHub와 연동되어 자동 배포
- **워커**: GitHub Actions에서 fly.io CLI로 배포

## 2. 사전 준비

### 필요 계정
- Vercel (Pro 플랜 권장 — 60초 함수 타임아웃)
- Fly.io (paid 플랜 — 256MB+ 메모리)
- Firebase 프로젝트 (Blaze 플랜 — KMS 사용)
- Upstash Redis (Free → Pro)
- NHN Cloud (SMS 서비스)
- 도메인 (예: teacherhub.kr)

### 필요 도구 설치
```bash
# Vercel CLI
pnpm add -g vercel

# Fly CLI
brew install flyctl  # macOS
curl -L https://fly.io/install.sh | sh  # Linux

# Firebase CLI
pnpm add -g firebase-tools

# Google Cloud CLI
brew install --cask google-cloud-sdk
```

## 3. Firebase 설정

### 3.1 프로젝트 생성
```bash
firebase login
firebase projects:create ssamsearch-prod
firebase use ssamsearch-prod
```

### 3.2 Firestore 활성화
- Firebase Console → Firestore Database → 데이터베이스 만들기
- 위치: `asia-northeast3` (서울)
- 모드: 프로덕션 모드

### 3.3 보안 규칙 배포
```bash
# 04-DATABASE.md의 firestore.rules 사용
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 3.4 Authentication 활성화
- Firebase Console → Authentication → 시작하기
- 이메일/비밀번호 활성화
- 승인된 도메인에 `teacherhub.kr` 추가

### 3.5 Service Account 생성 (서버용)
- Firebase Console → 프로젝트 설정 → 서비스 계정
- "새 비공개 키 생성" → JSON 다운로드
- `FIREBASE_ADMIN_*` 환경변수에 분할 저장 (private_key는 줄바꿈 escaping 주의)

## 4. Google Cloud KMS 설정

```bash
# 1. KMS API 활성화
gcloud services enable cloudkms.googleapis.com --project=ssamsearch-prod

# 2. 키 링 생성
gcloud kms keyrings create ssamsearch-keyring \
  --location=asia-northeast3 \
  --project=ssamsearch-prod

# 3. 마스터 키 생성
gcloud kms keys create user-credential-master-key \
  --location=asia-northeast3 \
  --keyring=ssamsearch-keyring \
  --purpose=encryption \
  --rotation-period=90d \
  --next-rotation-time=$(date -u -d '+90 days' '+%Y-%m-%dT%H:%M:%SZ') \
  --project=ssamsearch-prod

# 4. 워커용 서비스 계정 생성
gcloud iam service-accounts create ssamsearch-worker \
  --display-name="SsamSearch Worker" \
  --project=ssamsearch-prod

# 5. KMS 권한 부여
gcloud kms keys add-iam-policy-binding user-credential-master-key \
  --location=asia-northeast3 \
  --keyring=ssamsearch-keyring \
  --member="serviceAccount:ssamsearch-worker@ssamsearch-prod.iam.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=ssamsearch-prod

# 6. 서비스 계정 키 발급
gcloud iam service-accounts keys create worker-sa-key.json \
  --iam-account=ssamsearch-worker@ssamsearch-prod.iam.gserviceaccount.com
```

`worker-sa-key.json`을 Fly.io 시크릿으로 등록 (다음 섹션).

## 5. Upstash Redis 설정

1. https://upstash.com 가입
2. Database 생성
   - Name: `ssamsearch-prod`
   - Region: `Asia Pacific (Tokyo)` — 서울 가까운 곳
   - Type: Regional (글로벌 불필요)
3. REST URL과 Token 복사 → 환경변수

## 6. NHN Cloud SMS 설정

1. https://www.toast.com 가입
2. SMS 서비스 활성화
3. 발신번호 등록 (사업자 등록증 필요)
4. App Key, Secret Key 발급
5. 환경변수에 등록

## 7. Vercel 배포 (웹)

### 7.1 프로젝트 import
```bash
vercel link
# GitHub 저장소와 연결
```

또는 Vercel 대시보드에서 GitHub 저장소 import.

### 7.2 빌드 설정
`vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install --frozen-lockfile",
  "regions": ["icn1"],
  "functions": {
    "apps/web/app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### 7.3 환경변수 등록
Vercel Dashboard → Settings → Environment Variables.

```bash
# 또는 CLI
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
vercel env add FIREBASE_ADMIN_PRIVATE_KEY production
# ... (전체 목록은 03-TECH_STACK.md 참고)
```

### 7.4 도메인 연결
- Vercel Dashboard → Domains → `teacherhub.kr` 추가
- DNS A 레코드 또는 CNAME 등록 (Vercel이 안내)

### 7.5 자동 배포
- `main` 브랜치 push 시 production 자동 배포
- PR 생성 시 preview 환경 자동 발급

## 8. Fly.io 배포 (워커)

### 8.1 앱 생성
```bash
cd apps/worker
fly launch --name ssamsearch-worker --region nrt --no-deploy
```

`fly.toml`:
```toml
app = "ssamsearch-worker"
primary_region = "nrt"  # Tokyo (서울 가장 가까움)

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
  
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
  
  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 1024

[checks]
  [checks.health]
    type = "http"
    interval = "30s"
    timeout = "5s"
    grace_period = "30s"
    method = "GET"
    path = "/health"
```

### 8.2 Dockerfile (`apps/worker/Dockerfile`)
```dockerfile
FROM node:20-bookworm-slim

# Playwright 시스템 의존성
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libgbm1 \
    libxshmfence1 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN corepack enable

# 의존성 캐시
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# 소스 복사 및 빌드
COPY apps/worker ./apps/worker
RUN pnpm --filter worker build

EXPOSE 8080
CMD ["node", "apps/worker/dist/index.js"]
```

### 8.3 시크릿 등록
```bash
fly secrets set \
  FIREBASE_ADMIN_PROJECT_ID=ssamsearch-prod \
  FIREBASE_ADMIN_CLIENT_EMAIL=... \
  FIREBASE_ADMIN_PRIVATE_KEY=... \
  UPSTASH_REDIS_REST_URL=... \
  UPSTASH_REDIS_REST_TOKEN=... \
  GCP_KMS_PROJECT_ID=ssamsearch-prod \
  GCP_KMS_LOCATION=asia-northeast3 \
  GCP_KMS_KEYRING=ssamsearch-keyring \
  GCP_KMS_KEY=user-credential-master-key \
  GEMINI_API_KEY=... \
  WORKER_INTERNAL_TOKEN=...

# GCP 서비스 계정 키는 base64 인코딩하여 시크릿으로
fly secrets set GCP_SA_KEY="$(base64 -i worker-sa-key.json)"
```

### 8.4 첫 배포
```bash
fly deploy
```

### 8.5 GitHub Actions 자동 배포
`.github/workflows/deploy-worker.yml`:
```yaml
name: Deploy Worker

on:
  push:
    branches: [main]
    paths:
      - 'apps/worker/**'
      - 'packages/adapters/**'
      - 'packages/crypto/**'
      - 'packages/shared/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --config apps/worker/fly.toml
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

GitHub Settings → Secrets에 `FLY_API_TOKEN` 등록 (`fly auth token`으로 발급).

### 8.6 스케일 조정
```bash
# 인스턴스 수 늘리기
fly scale count 2

# 메모리 늘리기
fly scale memory 2048

# 모니터링
fly logs
fly status
```

## 9. 도메인 및 DNS

### 도메인 구조 (가안)
- `teacherhub.kr` → Vercel (메인 웹)
- `worker.teacherhub.kr` → Fly.io (내부 통신용, Vercel ↔ 워커)

### Vercel ↔ 워커 통신
- Vercel API에서 워커 호출 시 `WORKER_INTERNAL_TOKEN` 헤더로 인증
- 워커는 외부 트래픽 차단, Vercel IP만 허용 (선택)

## 10. 모니터링·로깅

### Vercel
- Vercel Dashboard에 기본 분석
- 추가: Logflare, Axiom 연동

### Fly.io
- `fly logs` 실시간 확인
- Grafana Cloud 연동:
  ```bash
  fly logs --json | grafana-cloud-loki-pusher
  ```

### Firebase
- Firestore 사용량 → Firebase Console
- 함수 호출 모니터링

### Sentry (에러 추적)
```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## 11. 무중단 배포

### Vercel
- 자동 zero-downtime, 별도 설정 불필요
- 신규 빌드 후 트래픽 자동 전환

### Fly.io
- `fly.toml`에 `min_machines_running = 1` 설정
- 롤링 업데이트로 1대씩 교체
```bash
fly deploy --strategy rolling
```

## 12. 백업·복구

### Firestore 백업
```bash
# 정기 백업 (Cloud Scheduler + Cloud Functions)
gcloud firestore export gs://ssamsearch-backups/$(date +%Y%m%d) \
  --project=ssamsearch-prod
```

매일 새벽 3시 자동 실행 권장.

### Redis 백업
- Upstash는 자동 백업 (Pro 플랜)

## 13. 운영 체크리스트

배포 직전:
- [ ] 환경변수 모두 등록
- [ ] Firestore 보안 규칙 검증 (시뮬레이터)
- [ ] KMS 키 권한 확인
- [ ] 도메인·SSL 정상 작동
- [ ] 헬스체크 엔드포인트 응답
- [ ] 5개 어댑터 실제 계정 테스트
- [ ] OTP SMS 발송 테스트
- [ ] Sentry 에러 수신 테스트
- [ ] rate limiting 동작 확인
- [ ] 로그에 비밀번호·토큰 redact 확인

배포 후 24시간:
- [ ] 사용자 가입 → 계정 등록 → 검색 end-to-end
- [ ] 사이트별 응답 시간 모니터링
- [ ] Sentry 에러 0건 또는 알려진 이슈만
- [ ] Firestore 비용 모니터링
- [ ] Fly.io 메모리·CPU 사용률
