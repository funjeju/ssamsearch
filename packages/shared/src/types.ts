// Firestore Timestamp 최소 인터페이스 (firebase 패키지 의존성 제거)
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

// ===== 사이트 식별자 =====
export type SiteId = 'indischool' | 'iscream' | 'teacherville' | 'tsherpa' | 'edunet';

export const SITE_IDS: SiteId[] = ['indischool', 'iscream', 'teacherville', 'tsherpa', 'edunet'];

export const SITE_DISPLAY_NAMES: Record<SiteId, string> = {
  indischool: '인디스쿨',
  iscream: '아이스크림',
  teacherville: '티쳐빌',
  tsherpa: 'T셀파',
  edunet: '에듀넷',
};

export const SITE_COLORS: Record<SiteId, string> = {
  indischool: '#FF6B6B',
  iscream: '#FF9D5C',
  teacherville: '#4ECDC4',
  tsherpa: '#9B59B6',
  edunet: '#3498DB',
};

// ===== 검색 관련 타입 =====
export type Grade =
  | '1' | '2' | '3' | '4' | '5' | '6'
  | '중1' | '중2' | '중3'
  | '고1' | '고2' | '고3';

export type Subject =
  | '국어' | '수학' | '사회' | '과학' | '영어'
  | '음악' | '미술' | '체육' | '실과' | '기타';

export type MaterialType =
  | 'PPT' | '학습지' | '영상' | '평가지' | '활동지' | '지도안' | '기타';

export type DateRange = 'week' | 'month' | 'year' | 'all';

export interface SearchFilters {
  grade?: Grade | number;
  subject?: Subject;
  materialType?: MaterialType;
  dateRange?: DateRange;
}

export interface SearchResultItem {
  source: SiteId;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  grade: string | null;
  subject: string | null;
  materialType: string | null;
  tags: string[];
  likeCount: number | null;
  iconUrl?: string;
}

// ===== 검색 잡 상태 =====
export type SearchJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SiteStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SiteSearchStatus {
  status: SiteStatus;
  itemCount: number;
  error: string | null;
  responseTimeMs?: number;
}

export interface SearchJob {
  searchId: string;
  uid: string;
  query: string;
  filters: SearchFilters;
  sites: SiteId[];
  status: SearchJobStatus;
  siteStatus: Partial<Record<SiteId, SiteSearchStatus>>;
  results: SearchResultItem[];
  startedAt: FirestoreTimestamp;
  completedAt: FirestoreTimestamp | null;
  expiresAt: FirestoreTimestamp;
}

// ===== SSE 이벤트 타입 =====
export type SseEventType =
  | 'site_started'
  | 'site_result'
  | 'site_completed'
  | 'site_failed'
  | 'done'
  | 'error';

export interface SseEvent {
  type: SseEventType;
  site?: SiteId;
  items?: SearchResultItem[];
  itemCount?: number;
  responseTimeMs?: number;
  error?: string;
  totalItems?: number;
  totalTimeMs?: number;
}

// ===== 사용자 타입 =====
export type UserRole = 'teacher' | 'admin';
export type SchoolType = 'elementary' | 'middle' | 'high' | 'special';
export type OtpMethod = 'sms' | 'totp' | 'both';
export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  phoneNumber: string;
  role: UserRole;
  schoolType: SchoolType;
  grade: number | null;
  subject: string | null;
  otpMethod: OtpMethod;
  searchCount: number;
  lastSearchAt: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  status: UserStatus;
}

// ===== 외부 계정 타입 =====
export type AccountStatus = 'active' | 'invalid' | 'requires_reauth';

export interface ExternalAccount {
  accountId: string;
  site: SiteId;
  encryptedDek: string;
  encryptedUsername: string;
  encryptedPassword: string;
  iv: string;
  authTag: string;
  displayName: string;
  status: AccountStatus;
  lastLoginAt: FirestoreTimestamp | null;
  lastSuccessAt: FirestoreTimestamp | null;
  failureCount: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// 클라이언트에 노출되는 계정 정보 (자격증명 제외)
export interface ExternalAccountPublic {
  accountId: string;
  site: SiteId;
  displayName: string;
  status: AccountStatus;
  lastSuccessAt: string | null;
}

// ===== API 응답 타입 =====
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ===== 에러 코드 =====
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_LOGIN_FAILED: 'EXTERNAL_LOGIN_FAILED',
  SITE_UNAVAILABLE: 'SITE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
