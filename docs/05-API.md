# 05. API 명세

## 1. 공통 사항

### Base URL
- 개발: `http://localhost:3000/api`
- 운영: `https://teacherhub.kr/api`

### 인증
모든 보호 API는 Authorization 헤더 필수.
```
Authorization: Bearer {firebase_id_token}
```

서버는 `firebase-admin` SDK의 `verifyIdToken()`으로 검증.

### 응답 포맷
```typescript
// 성공
{
  "success": true,
  "data": { ... }
}

// 실패
{
  "success": false,
  "error": {
    "code": "INVALID_OTP",
    "message": "OTP 코드가 올바르지 않습니다.",
    "details": { ... }  // 선택
  }
}
```

### 에러 코드 표준

| 코드 | HTTP | 설명 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 토큰 없음/만료 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `VALIDATION_ERROR` | 400 | 요청 형식 오류 |
| `INVALID_OTP` | 400 | OTP 코드 불일치 |
| `OTP_EXPIRED` | 400 | OTP 만료 |
| `RATE_LIMITED` | 429 | 호출 한도 초과 |
| `EXTERNAL_LOGIN_FAILED` | 422 | 외부 사이트 로그인 실패 |
| `SITE_UNAVAILABLE` | 503 | 외부 사이트 일시 장애 |
| `INTERNAL_ERROR` | 500 | 서버 오류 |

## 2. 인증 API

### `POST /api/auth/signup`
신규 가입.

**Request**
```json
{
  "email": "teacher@example.com",
  "password": "Strong1234!",
  "displayName": "김선생",
  "phoneNumber": "+821012345678",
  "schoolType": "elementary",
  "grade": 5,
  "subject": "사회"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "verificationRequired": true,
    "otpSent": true
  }
}
```

### `POST /api/auth/otp/request`
SMS OTP 발급.

**Request**
```json
{
  "phoneNumber": "+821012345678",
  "purpose": "signup" | "login" | "account_add" | "sensitive_action"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "otpId": "otp_xyz",
    "expiresIn": 180,
    "maskedPhone": "+8210****5678"
  }
}
```

**Rate limit**: 사용자당 1분에 1회, 1시간에 5회.

### `POST /api/auth/otp/verify`
OTP 검증.

**Request**
```json
{
  "otpId": "otp_xyz",
  "code": "123456",
  "trustDevice": true,           // 30일 디바이스 신뢰
  "deviceFingerprint": "fp_hash"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "deviceTrusted": true,
    "deviceTrustedUntil": "2026-05-28T00:00:00Z"
  }
}
```

### `POST /api/auth/totp/setup`
TOTP 등록 (QR 코드 시크릿 발급).

**Response 200**
```json
{
  "success": true,
  "data": {
    "secret": "BASE32SECRET",
    "qrCodeUrl": "otpauth://totp/SsamSearch:user@example.com?secret=...",
    "backupCodes": ["12345678", "87654321", ...]
  }
}
```

사용자가 OTP 앱으로 등록 후 `/api/auth/totp/verify-setup`에서 1회 코드 입력으로 확정.

### `POST /api/auth/login`
이메일·비번 로그인 (Firebase Auth는 클라이언트에서 직접 처리, 서버는 OTP만 관리).

신뢰 디바이스가 아니면 OTP 추가 발급.

## 3. 외부 계정 관리 API

### `GET /api/accounts`
연결된 외부 계정 목록.

**Response 200**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "accountId": "acc_001",
        "site": "indischool",
        "displayName": "김선생@인디스쿨",
        "status": "active",
        "lastSuccessAt": "2026-04-27T08:30:00Z"
      },
      {
        "accountId": "acc_002",
        "site": "iscream",
        "displayName": "kim123",
        "status": "requires_reauth",
        "lastSuccessAt": "2026-04-20T10:00:00Z"
      }
    ]
  }
}
```

### `POST /api/accounts`
신규 외부 계정 등록.

**Request**
```json
{
  "site": "indischool",
  "username": "kimteacher",
  "password": "indipass!@#",
  "displayName": "내 인디스쿨 계정",
  "otpCode": "123456"            // 민감 작업 OTP 검증
}
```

**처리 순서 (서버)**
1. OTP 검증
2. 워커에 자동 로그인 테스트 요청 (5초 타임아웃)
3. 성공 시 KMS로 자격증명 암호화 → Firestore 저장
4. 실패 시 `EXTERNAL_LOGIN_FAILED` 반환

**Response 200**
```json
{
  "success": true,
  "data": {
    "accountId": "acc_003",
    "loginTested": true,
    "site": "indischool"
  }
}
```

### `DELETE /api/accounts/{accountId}`
외부 계정 삭제. OTP 검증 필요.

**Request**
```json
{
  "otpCode": "123456"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### `POST /api/accounts/{accountId}/test`
연결 상태 재검증 (사용자가 직접 트리거).

**Response 200**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "responseTimeMs": 1240
  }
}
```

## 4. 검색 API

### `POST /api/search`
검색 요청 (잡 큐에 등록).

**Request**
```json
{
  "query": "5학년 사회 조선시대 PPT",
  "filters": {
    "grade": 5,
    "subject": "사회",
    "materialType": "PPT",
    "dateRange": "year"
  },
  "sites": ["indischool", "iscream", "edunet"]   // 선택, 미지정 시 전체
}
```

**Response 200 (즉시)**
```json
{
  "success": true,
  "data": {
    "searchId": "srch_abc123",
    "estimatedSeconds": 5,
    "streamUrl": "/api/search/stream?searchId=srch_abc123"
  }
}
```

### `GET /api/search/stream?searchId=...` (SSE)
검색 결과 실시간 스트리밍.

**Headers**
```
Accept: text/event-stream
Cache-Control: no-cache
Authorization: Bearer ...
```

**이벤트 형식**

```
event: site_started
data: {"site": "indischool"}

event: site_result
data: {
  "site": "indischool",
  "items": [
    {
      "title": "조선시대 한눈에 보기 PPT",
      "summary": "...",
      "url": "https://indischool.com/...",
      "publishedAt": "2024-03-15",
      "grade": "5",
      "subject": "사회",
      "materialType": "PPT",
      "likeCount": 342
    }
  ]
}

event: site_completed
data: {"site": "indischool", "itemCount": 12, "responseTimeMs": 3240}

event: site_failed
data: {"site": "tsherpa", "error": "TIMEOUT"}

event: done
data: {"totalItems": 47, "totalTimeMs": 5120}
```

### `GET /api/search/{searchId}`
검색 결과 한 번에 조회 (SSE 미지원 클라이언트용).

**Response 200**
```json
{
  "success": true,
  "data": {
    "searchId": "srch_abc123",
    "status": "completed",
    "query": "5학년 사회 조선시대 PPT",
    "results": [...],
    "siteStatus": {
      "indischool": { "status": "completed", "itemCount": 12 },
      "iscream": { "status": "completed", "itemCount": 8 },
      "tsherpa": { "status": "failed", "error": "TIMEOUT" }
    }
  }
}
```

### `GET /api/search/history`
사용자 검색 이력.

**Query**
- `limit`: 기본 20, 최대 100
- `cursor`: 페이지네이션

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "historyId": "hist_001",
        "query": "5학년 사회 조선시대",
        "searchedAt": "2026-04-28T05:00:00Z",
        "resultCount": 47
      }
    ],
    "nextCursor": "cur_xyz"
  }
}
```

## 5. 북마크 API

### `GET /api/bookmarks`
북마크 목록.

### `POST /api/bookmarks`
북마크 추가.

**Request**
```json
{
  "source": "indischool",
  "title": "조선시대 한눈에 보기 PPT",
  "summary": "...",
  "url": "https://indischool.com/...",
  "publishedAt": "2024-03-15",
  "grade": "5",
  "subject": "사회",
  "materialType": "PPT",
  "tags": ["조선시대", "PPT"],
  "note": "학예회용으로 좋을듯"
}
```

### `DELETE /api/bookmarks/{bookmarkId}`

## 6. 사용자 API

### `GET /api/users/me`
내 프로필.

### `PATCH /api/users/me`
프로필 수정 (이메일·전화번호는 별도 검증 흐름).

### `GET /api/users/me/devices`
신뢰 디바이스 목록.

### `DELETE /api/users/me/devices/{deviceId}`
디바이스 신뢰 해제.

### `DELETE /api/users/me`
계정 삭제. OTP 2회 검증 (현재 디바이스 + SMS).

## 7. 워커 ↔ Vercel 내부 API

### `POST /internal/scrape/login-test`
워커가 외부 사이트 로그인 검증 시 호출.

**Headers**
```
X-Internal-Token: {WORKER_INTERNAL_TOKEN}
```

**Request**
```json
{
  "site": "indischool",
  "username": "...",
  "password": "..."
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "loginSuccess": true,
    "responseTimeMs": 1850
  }
}
```

### `POST /internal/scrape/search`
검색 잡 처리 결과 콜백.

## 8. Rate Limiting

Upstash Redis 기반.

| 엔드포인트 | 제한 |
|---|---|
| `/api/auth/otp/request` | 사용자당 분당 1회, 시간당 5회 |
| `/api/auth/otp/verify` | 사용자당 분당 5회 |
| `/api/search` | 사용자당 분당 10회, 일 200회 |
| `/api/accounts` (POST) | 사용자당 시간당 5회 |
| 기타 | 사용자당 분당 60회 |

초과 시 `429 RATE_LIMITED` + `Retry-After` 헤더.

## 9. CORS 정책

- 운영: `https://teacherhub.kr`만 허용
- 개발: `http://localhost:3000` 허용
- API에서 `Access-Control-Allow-Credentials: true` 사용
