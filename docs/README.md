# 쌤서치 (SsamSearch)

> 선생님 자료, 5개 사이트를 한 번에. 수업 준비 시간을 30분에서 5분으로.

## 프로젝트 개요

**쌤서치**는 교사들이 자주 사용하는 5개 자료 사이트(인디스쿨, 아이스크림, 티쳐빌, T셀파, 에듀넷)를 ID/PW 한 번 등록으로 묶어, 한 번의 검색으로 통합 결과를 받아볼 수 있는 **교사 전용 메타 검색 서비스**입니다.

- 메타데이터만 처리하고 본문은 저장하지 않음
- 클릭 시 원본 사이트로 이동 → 저작권·트래픽 모두 원작자에게 환원
- AES-256 암호화 + 2단계 OTP 인증 + 디바이스 신뢰

## 기술 스택 요약

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| 백엔드 API | Next.js API Routes (Vercel Serverless) |
| 데이터베이스 | Firebase Firestore |
| 인증 | Firebase Auth + 자체 OTP (SMS / TOTP) |
| 스크래핑 워커 | Playwright + Node.js (Fly.io 컨테이너) |
| 큐 | Upstash Redis (BullMQ) |
| 캐시 | Upstash Redis |
| AI | Google Gemini 2.0 Flash Lite |
| 키 관리 | Google Cloud KMS |
| 호스팅 | Vercel (웹) + Fly.io (워커) |

## 문서 인덱스

> ⚠️ **반드시 [CLAUDE.md](./CLAUDE.md)를 가장 먼저 읽으세요.**
> 이 문서는 프로젝트의 헌법입니다. 모든 결정·코드·디자인은 CLAUDE.md를 따릅니다.
> 개발 중 막히면 가장 먼저 펼치는 문서이기도 합니다.

읽는 순서:

0. **[CLAUDE.md](./CLAUDE.md)** ⭐ — **필독.** 프로젝트의 본질, 절대 원칙, 의사결정 기준
1. **[01-PRD.md](./01-PRD.md)** — 제품 요구사항 정의
2. **[02-ARCHITECTURE.md](./02-ARCHITECTURE.md)** — 시스템 아키텍처
3. **[03-TECH_STACK.md](./03-TECH_STACK.md)** — 기술 스택 상세
4. **[04-DATABASE.md](./04-DATABASE.md)** — Firestore 스키마 설계
5. **[05-API.md](./05-API.md)** — API 명세
6. **[06-SECURITY.md](./06-SECURITY.md)** — 보안 설계
7. **[07-SCRAPER.md](./07-SCRAPER.md)** — 스크래퍼 어댑터 가이드
8. **[08-DESIGN_SYSTEM.md](./08-DESIGN_SYSTEM.md)** — UI 디자인 시스템
9. **[09-DEPLOYMENT.md](./09-DEPLOYMENT.md)** — 배포 가이드
10. **[10-DEVELOPMENT.md](./10-DEVELOPMENT.md)** — 로컬 개발 환경
11. **[11-ROADMAP.md](./11-ROADMAP.md)** — 6주 MVP 로드맵

## 빠른 시작

```bash
# 1. 저장소 클론
git clone https://github.com/funjeju/ssamsearch.git
cd ssamsearch

# 2. 의존성 설치
pnpm install

# 3. 환경 변수 설정 (DEVELOPMENT.md 참고)
cp .env.example .env.local

# 4. Firebase 에뮬레이터 시작
pnpm firebase:emulator

# 5. 개발 서버 실행
pnpm dev
```

자세한 설정은 [10-DEVELOPMENT.md](./10-DEVELOPMENT.md) 참고.

## 디렉토리 구조

```
ssamsearch/
├── apps/
│   ├── web/              # Next.js 14 웹 앱 (Vercel 배포)
│   └── worker/           # Playwright 스크래핑 워커 (Fly.io 배포)
├── packages/
│   ├── shared/           # 공통 타입·유틸
│   ├── adapters/         # 사이트별 스크래퍼 어댑터
│   └── crypto/           # 암호화 유틸
├── docs/                 # 본 문서
├── firebase.json         # Firebase 설정
├── firestore.rules       # Firestore 보안 규칙
└── pnpm-workspace.yaml
```

## 라이선스 및 운영 주체

- 운영: ㈜펀제주
- 문의: contact@teacherhub.kr (가안)
