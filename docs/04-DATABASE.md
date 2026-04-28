# 04. 데이터베이스 (Firestore) 스키마

## 1. 컬렉션 구조 개요

```
firestore/
├── users/{uid}                              사용자 프로필
│   ├── accounts/{accountId}                 외부 계정 (암호화)
│   ├── devices/{deviceId}                   신뢰 디바이스
│   ├── searchHistory/{historyId}            검색 이력
│   └── bookmarks/{bookmarkId}               북마크
├── searches/{searchId}                      진행중·완료된 검색 잡
├── searchCache/{cacheKey}                   검색 결과 캐시
└── audit/{auditId}                          감사 로그 (보안 이벤트)
```

## 2. 컬렉션 상세 스키마

### `users/{uid}`

```typescript
interface User {
  uid: string;                    // Firebase Auth UID
  email: string;
  displayName: string | null;
  phoneNumber: string;            // E.164 형식, 본인인증 완료
  
  // 사용자 분류
  role: 'teacher' | 'admin';
  schoolType: 'elementary' | 'middle' | 'high' | 'special';
  grade: number | null;           // 담임 학년 (1~6, 중1~3, 고1~3)
  subject: string | null;         // 주 담당 과목
  
  // OTP 설정
  otpMethod: 'sms' | 'totp' | 'both';
  totpSecret: string | null;      // TOTP secret (암호화)
  
  // 통계
  searchCount: number;            // 누적 검색 횟수
  lastSearchAt: Timestamp | null;
  
  // 메타
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'suspended' | 'deleted';
}
```

### `users/{uid}/accounts/{accountId}`

외부 사이트 자격증명. **이 컬렉션이 가장 민감합니다.**

```typescript
interface ExternalAccount {
  accountId: string;              // auto-generated
  site: 'indischool' | 'iscream' | 'teacherville' | 'tsherpa' | 'edunet';
  
  // 암호화된 자격증명 (envelope encryption)
  encryptedDek: string;           // KMS로 암호화된 DEK (base64)
  encryptedUsername: string;      // DEK로 암호화된 username
  encryptedPassword: string;      // DEK로 암호화된 password
  iv: string;                     // 초기화 벡터 (base64)
  authTag: string;                // GCM 인증 태그 (base64)
  
  // 메타 (평문)
  displayName: string;            // 사용자가 식별용으로 입력 (선택)
  status: 'active' | 'invalid' | 'requires_reauth';
  lastLoginAt: Timestamp | null;
  lastSuccessAt: Timestamp | null;
  failureCount: number;           // 연속 실패 카운트
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `users/{uid}/devices/{deviceId}`

OTP 면제용 신뢰 디바이스.

```typescript
interface Device {
  deviceId: string;               // 클라이언트 fingerprint hash
  fingerprint: string;            // user-agent + screen + timezone hash
  ipAddress: string;
  userAgent: string;
  
  trusted: boolean;
  trustedUntil: Timestamp;        // 30일 후 만료
  
  lastUsedAt: Timestamp;
  createdAt: Timestamp;
}
```

### `users/{uid}/searchHistory/{historyId}`

```typescript
interface SearchHistory {
  historyId: string;
  query: string;
  filters: {
    grade?: number | string;
    subject?: string;
    materialType?: string;
    dateRange?: 'week' | 'month' | 'year' | 'all';
  };
  
  resultCount: number;
  searchedAt: Timestamp;
  
  // 사이트별 응답 통계
  siteStats: {
    [site: string]: {
      success: boolean;
      responseTimeMs: number;
      itemCount: number;
    };
  };
}
```

### `users/{uid}/bookmarks/{bookmarkId}`

```typescript
interface Bookmark {
  bookmarkId: string;
  
  // 북마크된 자료의 메타데이터 (본문 저장 안 함)
  source: string;                 // 사이트
  title: string;
  summary: string;
  url: string;                    // 원본 URL
  publishedAt: Timestamp | null;
  
  grade: string | null;
  subject: string | null;
  materialType: string | null;
  tags: string[];
  
  // 사용자 메모
  note: string | null;
  
  createdAt: Timestamp;
}
```

### `searches/{searchId}`

진행중인 검색 잡 상태.

```typescript
interface SearchJob {
  searchId: string;
  uid: string;
  
  query: string;
  filters: object;
  
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // 사이트별 진행 상태
  siteStatus: {
    [site: string]: {
      status: 'pending' | 'running' | 'completed' | 'failed';
      itemCount: number;
      error: string | null;
    };
  };
  
  results: SearchResultItem[];    // 통합 결과 (완료 후만)
  
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  
  // TTL: 24시간 후 자동 삭제 (Firestore TTL 정책)
  expiresAt: Timestamp;
}

interface SearchResultItem {
  source: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  grade: string | null;
  subject: string | null;
  materialType: string | null;
  tags: string[];
  
  // 표시용
  iconUrl: string;                // 사이트 아이콘
  likeCount: number | null;       // 사이트가 제공하는 경우
}
```

### `searchCache/{cacheKey}`

여러 사용자가 동일 검색어를 조회할 때 재사용 (단, 사이트별 자료가 사용자마다 다를 수 있어 사용자별 격리도 고려 필요).

```typescript
// cacheKey = sha256(uid + query + filters) — 사용자별 격리
interface SearchCache {
  cacheKey: string;
  uid: string;
  query: string;
  filters: object;
  
  results: SearchResultItem[];
  
  cachedAt: Timestamp;
  expiresAt: Timestamp;           // TTL 1시간
}
```

### `audit/{auditId}`

보안 감사 로그 (1년 보관).

```typescript
interface AuditLog {
  auditId: string;
  uid: string;
  
  action: 'login' | 'otp_request' | 'otp_verify' 
        | 'account_add' | 'account_delete' 
        | 'password_change' | 'device_trust'
        | 'credential_decrypt' | 'failed_login';
  
  result: 'success' | 'failure';
  reason: string | null;
  
  ipAddress: string;
  userAgent: string;
  
  metadata: object;               // 액션별 추가 정보
  
  timestamp: Timestamp;
}
```

## 3. 인덱스 설계

`firestore.indexes.json`에 등록.

```json
{
  "indexes": [
    {
      "collectionGroup": "searchHistory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "searchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "bookmarks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "searches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "startedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "audit",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "action", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 4. Firestore 보안 규칙

`firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // 본인 데이터만 읽기·쓰기 가능
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }
    
    // 인증된 사용자
    function isAuthed() {
      return request.auth != null;
    }
    
    // === users ===
    match /users/{uid} {
      allow read: if isOwner(uid);
      allow update: if isOwner(uid) 
        && !('uid' in request.resource.data.diff(resource.data).affectedKeys())
        && !('createdAt' in request.resource.data.diff(resource.data).affectedKeys());
      allow create: if isOwner(uid);
      // delete는 서버(admin SDK)에서만 처리
      allow delete: if false;
      
      // === 자격증명: 서버에서만 읽기·쓰기 ===
      match /accounts/{accountId} {
        allow read, write: if false;  // admin SDK 전용
      }
      
      // === 디바이스 ===
      match /devices/{deviceId} {
        allow read: if isOwner(uid);
        allow create, update, delete: if isOwner(uid);
      }
      
      // === 검색 이력 ===
      match /searchHistory/{historyId} {
        allow read: if isOwner(uid);
        allow create: if isOwner(uid);
        allow delete: if isOwner(uid);
        allow update: if false;
      }
      
      // === 북마크 ===
      match /bookmarks/{bookmarkId} {
        allow read, write: if isOwner(uid);
      }
    }
    
    // === 검색 잡 ===
    match /searches/{searchId} {
      allow read: if isAuthed() && request.auth.uid == resource.data.uid;
      // 생성·업데이트는 서버에서만
      allow create, update, delete: if false;
    }
    
    // === 검색 캐시 ===
    match /searchCache/{cacheKey} {
      allow read, write: if false;  // 서버 전용
    }
    
    // === 감사 로그 ===
    match /audit/{auditId} {
      allow read: if isAuthed() && request.auth.uid == resource.data.uid;
      allow write: if false;  // 서버 전용
    }
  }
}
```

## 5. 데이터 보관 정책

| 컬렉션 | 보관 기간 | 정책 |
|---|---|---|
| `users` | 영구 | 사용자 삭제 시 즉시 |
| `accounts` | 영구 | 사용자 삭제 시 즉시 폐기 |
| `devices` | 30일 | trustedUntil TTL 자동 |
| `searchHistory` | 90일 | TTL 정책 |
| `bookmarks` | 영구 | 사용자 삭제 |
| `searches` | 24시간 | TTL 정책 |
| `searchCache` | 1시간 | TTL 정책 |
| `audit` | 1년 | TTL 정책 |

Firestore TTL 정책 활성화:
```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=searches \
  --enable-ttl
```

## 6. 주요 쿼리 예시

### 사용자의 활성 외부 계정 조회 (서버)
```typescript
const accountsRef = adminDb
  .collection('users').doc(uid)
  .collection('accounts')
  .where('status', '==', 'active');
const snapshot = await accountsRef.get();
```

### 최근 검색 이력 (클라이언트)
```typescript
const historyRef = collection(db, 'users', uid, 'searchHistory');
const q = query(historyRef, orderBy('searchedAt', 'desc'), limit(20));
const snapshot = await getDocs(q);
```

### 검색 잡 실시간 구독 (클라이언트, 결과 스트리밍 보조)
```typescript
const searchRef = doc(db, 'searches', searchId);
const unsubscribe = onSnapshot(searchRef, (snap) => {
  const data = snap.data() as SearchJob;
  setResults(data.results);
  setSiteStatus(data.siteStatus);
});
```

## 7. 비용 추정 (참고)

Firestore 가격 정책은 변경 가능 — MVP 출시 시점에 [공식 가격표](https://firebase.google.com/pricing) 확인 필수.

대략적 산정:
- MVP (1,000 사용자, 일 평균 5건 검색)
- 일일 읽기: ~5만 회 / 쓰기: ~2만 회
- 무료 할당 내 운영 가능 (Spark plan or 저비용 Blaze)
