# 06. 보안 설계

## 1. 보안 위협 모델

### 보호 대상 (자산)
1. **사용자의 외부 사이트 자격증명** (가장 민감)
2. 사용자 개인정보 (이메일, 전화번호)
3. 검색 이력
4. 우리 서비스 비밀번호

### 위협 시나리오
| ID | 위협 | 영향 | 대응 |
|---|---|---|---|
| T1 | DB 유출 | 자격증명 노출 | KMS envelope encryption |
| T2 | 서버 메모리 덤프 | 복호화된 비번 노출 | 사용 후 즉시 폐기 |
| T3 | 중간자 공격 | 통신 도청 | TLS 1.3 강제 |
| T4 | 사용자 비번 추측 | 무단 로그인 | OTP, rate limit |
| T5 | XSS / CSRF | 토큰 탈취 | CSP, SameSite cookie, CSRF token |
| T6 | 공급망 공격 | 라이브러리 백도어 | 의존성 최소화, lockfile, audit |
| T7 | 내부자 위협 | 운영자 자격증명 열람 | KMS IAM 분리, 감사 로그 |
| T8 | 로그 유출 | 비번이 로그에 | 평문 로깅 절대 금지 |

## 2. 자격증명 암호화 (Envelope Encryption)

### 구조

```
┌─────────────────────────────────────────────────────┐
│  Google Cloud KMS                                    │
│  Master Key (KEK: Key Encryption Key)                │
│  - 회전: 90일 자동                                   │
│  - 액세스: 워커 서비스 계정만                        │
└─────────────────┬───────────────────────────────────┘
                  │ encrypt/decrypt
                  ▼
┌─────────────────────────────────────────────────────┐
│  사용자별 DEK (Data Encryption Key)                  │
│  - 256비트 랜덤                                      │
│  - 외부 계정마다 별도 생성                           │
└─────────────────┬───────────────────────────────────┘
                  │ AES-256-GCM
                  ▼
┌─────────────────────────────────────────────────────┐
│  외부 사이트 ID/PW                                   │
└─────────────────────────────────────────────────────┘
```

### 암호화 흐름

```typescript
// crypto/envelope.ts
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const kms = new KeyManagementServiceClient();
const KEY_NAME = `projects/${PROJECT}/locations/${LOC}/keyRings/${RING}/cryptoKeys/${KEY}`;

export async function encryptCredential(plaintext: string) {
  // 1. 새 DEK 생성
  const dek = randomBytes(32);  // 256-bit
  
  // 2. KMS로 DEK 자체를 암호화
  const [encryptResp] = await kms.encrypt({
    name: KEY_NAME,
    plaintext: dek,
  });
  const encryptedDek = encryptResp.ciphertext;
  
  // 3. DEK로 자격증명 암호화 (AES-256-GCM)
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  
  // 4. DEK는 메모리에서 즉시 폐기
  dek.fill(0);
  
  return {
    encryptedDek: encryptedDek.toString('base64'),
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export async function decryptCredential(record: EncryptedRecord): Promise<string> {
  // 1. KMS로 DEK 복호화
  const [decryptResp] = await kms.decrypt({
    name: KEY_NAME,
    ciphertext: Buffer.from(record.encryptedDek, 'base64'),
  });
  const dek = Buffer.from(decryptResp.plaintext);
  
  // 2. DEK로 자격증명 복호화
  const decipher = createDecipheriv(
    'aes-256-gcm',
    dek,
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedData, 'base64')),
    decipher.final(),
  ]);
  
  // 3. DEK 즉시 폐기
  dek.fill(0);
  
  return decrypted.toString('utf8');
}
```

### 핵심 포인트
- **DB가 통째로 유출돼도** KMS 마스터 키 없이는 복호화 불가능
- KMS API 호출은 GCP IAM으로 보호되며 모든 호출이 감사 로그에 기록됨
- DEK는 메모리에 잠깐만 존재하고 즉시 폐기

## 3. 우리 서비스 비밀번호

Firebase Auth 사용 시 자체적으로 안전하게 해싱·저장 (scrypt 기반). 별도 처리 불필요.

**비밀번호 정책**
- 최소 10자
- 영문 대소문자 + 숫자 + 특수문자 중 3종 이상
- 클라이언트에서 zxcvbn으로 강도 측정 → 약함 시 가입 거부

## 4. OTP 시스템

### SMS OTP

```typescript
// lib/otp/sms.ts
import { redis } from '@/lib/redis';
import { sendSms } from '@/lib/nhn-cloud';

export async function requestSmsOtp(phoneNumber: string, purpose: string) {
  // Rate limit 체크
  const rateLimitKey = `otp:rate:${phoneNumber}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) await redis.expire(rateLimitKey, 60);  // 1분
  if (count > 1) throw new Error('RATE_LIMITED');
  
  // 6자리 코드 생성
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otpId = randomBytes(16).toString('hex');
  
  // Redis에 저장 (3분 TTL)
  await redis.set(
    `otp:${otpId}`,
    JSON.stringify({ phoneNumber, code, purpose, attempts: 0 }),
    { ex: 180 }
  );
  
  // SMS 발송
  await sendSms(phoneNumber, `[쌤서치] 인증번호: ${code} (3분 유효)`);
  
  return { otpId, expiresIn: 180 };
}

export async function verifyOtp(otpId: string, code: string) {
  const dataStr = await redis.get(`otp:${otpId}`);
  if (!dataStr) throw new Error('OTP_EXPIRED');
  
  const data = JSON.parse(dataStr);
  
  // 시도 횟수 제한
  if (data.attempts >= 5) {
    await redis.del(`otp:${otpId}`);
    throw new Error('OTP_TOO_MANY_ATTEMPTS');
  }
  
  if (data.code !== code) {
    data.attempts++;
    await redis.set(`otp:${otpId}`, JSON.stringify(data), { ex: 180 });
    throw new Error('INVALID_OTP');
  }
  
  // 검증 성공 → OTP 삭제 (1회용)
  await redis.del(`otp:${otpId}`);
  return true;
}
```

### TOTP

```typescript
// lib/otp/totp.ts
import { authenticator } from 'otplib';

authenticator.options = {
  window: 1,        // ±30초 허용
  digits: 6,
  step: 30,
};

export function generateTotpSecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'SsamSearch', secret);
  return { secret, otpauth };
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
```

## 5. 디바이스 신뢰

```typescript
// lib/security/device.ts
export function generateDeviceFingerprint(req: Request): string {
  const ua = req.headers.get('user-agent') || '';
  const acceptLang = req.headers.get('accept-language') || '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '';
  
  // 사용자 입력 (timezone, screen size 등) + 헤더 조합
  // 해시화하여 저장
  return sha256(`${ua}|${acceptLang}|${ip}`);
}

export async function isDeviceTrusted(uid: string, fingerprint: string) {
  const deviceRef = adminDb
    .collection('users').doc(uid)
    .collection('devices').doc(fingerprint);
  
  const snap = await deviceRef.get();
  if (!snap.exists) return false;
  
  const device = snap.data() as Device;
  return device.trusted && device.trustedUntil.toDate() > new Date();
}
```

## 6. 통신 보안

### TLS
- Vercel·Fly.io 모두 자동 TLS
- HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- TLS 1.3 강제

### CSP (Content Security Policy)
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://apis.google.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://*.googleapis.com https://*.upstash.io;
      frame-ancestors 'none';
    `.replace(/\s+/g, ' ').trim(),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
```

### CSRF
- API에 SameSite=Strict 쿠키
- POST/PATCH/DELETE에 CSRF 토큰 검증 (next-auth 또는 자체 구현)

## 7. 입력 검증

모든 API 입력은 zod 스키마로 검증.

```typescript
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  phoneNumber: z.string().regex(/^\+82\d{9,10}$/),
  schoolType: z.enum(['elementary', 'middle', 'high', 'special']),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', parsed.error.issues);
  }
  // ...
}
```

## 8. Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const searchRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),  // 분당 10회
  analytics: true,
});

// 사용
const { success, remaining } = await searchRateLimit.limit(`user:${uid}`);
if (!success) return errorResponse('RATE_LIMITED');
```

## 9. 로깅 정책

### 절대 로그에 남기지 않을 정보
- 우리 서비스 비밀번호
- 외부 사이트 비밀번호 (평문·암호화 모두)
- DEK·KMS 응답
- 사용자 OTP 코드
- 세션 쿠키 값
- 검색 결과 본문 (메타데이터만 가능)

### 안전한 로깅 (Pino)
```typescript
import pino from 'pino';

const logger = pino({
  redact: {
    paths: ['password', '*.password', 'cookie', 'authorization'],
    censor: '[REDACTED]',
  },
});

logger.info({ uid, action: 'search', query: '...' }, 'Search initiated');
```

## 10. 감사 로그

모든 민감 작업은 `audit` 컬렉션에 기록.

```typescript
async function audit(uid: string, action: string, result: string, meta = {}) {
  await adminDb.collection('audit').add({
    uid,
    action,
    result,
    metadata: meta,
    ipAddress: getClientIp(),
    userAgent: getClientUserAgent(),
    timestamp: FieldValue.serverTimestamp(),
  });
}

// 사용
await audit(uid, 'credential_decrypt', 'success', { site: 'indischool' });
```

## 11. 보안 체크리스트 (출시 전)

- [ ] Firestore 보안 규칙 검토 (admin 외 자격증명 접근 불가)
- [ ] KMS IAM 정책 검토 (워커 서비스 계정만)
- [ ] 모든 환경변수 시크릿 매니저 저장 (코드 하드코딩 금지)
- [ ] CSP·HSTS·X-Frame-Options 헤더 설정
- [ ] API rate limiting 적용
- [ ] zod 입력 검증 모든 엔드포인트
- [ ] 민감 정보 로그 redact
- [ ] 의존성 `pnpm audit` 결과 high·critical 0건
- [ ] OTP 5회 실패 시 잠금
- [ ] 비번 변경 시 모든 디바이스 신뢰 해제
- [ ] 계정 삭제 시 30일 유예 + 즉시 폐기 옵션
- [ ] 침해 사고 대응 절차 문서화

## 12. 사고 대응 절차

침해 의심 시:
1. 의심 사용자 토큰 즉시 무효화 (`revokeRefreshTokens(uid)`)
2. KMS 마스터 키 회전 (강제)
3. 모든 사용자에게 비번 변경 권고 알림
4. 감사 로그 분석으로 영향 범위 파악
5. 24시간 내 KISA 한국인터넷진흥원 신고 (개인정보 유출 시 의무)
