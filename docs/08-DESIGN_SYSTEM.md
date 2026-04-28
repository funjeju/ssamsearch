# 08. 디자인 시스템 (shadcn/ui)

## 1. 디자인 원칙

업로드된 시안 기준으로 핵심 원칙은 다음과 같음.

1. **검색이 중심** — 메인 페이지 화면의 70%가 검색창과 결과
2. **사이트 식별이 명확** — 결과 카드마다 사이트 아이콘·라벨로 즉시 구분
3. **작업 흐름이 1열** — 좌→우, 위→아래 단방향 흐름. 사이드바 없음
4. **신뢰감 있는 보안 강조** — 상단·하단·결과 페이지에 보안 요소 노출
5. **모바일 우선** — 모든 페이지가 모바일에서 동등하게 작동

## 2. 컬러 팔레트

`tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        // === 브랜드 ===
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#2C7BE5',  // 메인 (시안의 파란색)
          600: '#1E63CC',
          700: '#1A4FA8',
        },
        
        // === shadcn/ui 표준 (CSS 변수 매핑) ===
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        
        // === 사이트별 식별 색상 ===
        site: {
          indischool:   '#FF6B6B',  // 빨강 계열
          iscream:      '#FF9D5C',  // 주황
          teacherville: '#4ECDC4',  // 청록
          tsherpa:      '#9B59B6',  // 보라
          edunet:       '#3498DB',  // 파랑
        },
      },
    },
  },
} satisfies Config;
```

`globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --primary: 217 79% 53%;          /* brand-500 */
    --primary-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 217 79% 53%;
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;
    --primary: 217 79% 53%;
    /* ... */
  }
}
```

## 3. 타이포그래피

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Menlo', 'monospace'],
},
```

```html
<!-- _document에 추가 -->
<link rel="stylesheet" 
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
```

타이포 스케일:
- `text-xs` 12px — 보조 텍스트
- `text-sm` 14px — 본문 보조
- `text-base` 16px — 본문 기본
- `text-lg` 18px — 강조 본문
- `text-xl` 20px — 카드 제목
- `text-2xl` 24px — 페이지 부제
- `text-3xl` 30px — 페이지 제목
- `text-4xl` 36px — 랜딩 헤드라인

## 4. shadcn/ui 컴포넌트 설치

```bash
# 초기화
npx shadcn-ui@latest init

# 필수 컴포넌트
npx shadcn-ui@latest add button input label card form
npx shadcn-ui@latest add dialog alert-dialog sheet toast
npx shadcn-ui@latest add select dropdown-menu tabs
npx shadcn-ui@latest add badge separator skeleton spinner
npx shadcn-ui@latest add avatar switch checkbox radio-group
npx shadcn-ui@latest add command popover tooltip
```

## 5. 페이지별 컴포넌트 구성

### 5.1 메인 검색 페이지 (`/search`)

```tsx
// app/(app)/search/page.tsx
import { SearchHero } from '@/components/search/SearchHero';
import { ConnectedSites } from '@/components/search/ConnectedSites';
import { SearchResults } from '@/components/search/SearchResults';

export default function SearchPage() {
  return (
    <main className="container max-w-5xl py-8 space-y-8">
      <SearchHero />
      <ConnectedSites />
      <SearchResults />
    </main>
  );
}
```

```tsx
// components/search/SearchHero.tsx
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { SearchFilters } from './SearchFilters';

export function SearchHero() {
  const [query, setQuery] = useState('');
  
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold text-center">
        선생님 자료, 5개 사이트를 한 번에
      </h1>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예) 5학년 사회 조선시대 PPT"
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button size="lg" className="px-8">검색</Button>
      </div>
      
      <SearchFilters />
    </section>
  );
}
```

```tsx
// components/search/SearchFilters.tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function SearchFilters() {
  return (
    <div className="flex flex-wrap gap-2">
      <Select>
        <SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger>
        <SelectContent>
          {[1,2,3,4,5,6].map(g => <SelectItem key={g} value={String(g)}>{g}학년</SelectItem>)}
          <SelectItem value="중1">중1</SelectItem>
          <SelectItem value="중2">중2</SelectItem>
          <SelectItem value="중3">중3</SelectItem>
        </SelectContent>
      </Select>
      
      <Select>
        <SelectTrigger className="w-[120px]"><SelectValue placeholder="과목" /></SelectTrigger>
        <SelectContent>
          {['국어','수학','사회','과학','영어','음악','미술','체육','기타'].map(s =>
            <SelectItem key={s} value={s}>{s}</SelectItem>
          )}
        </SelectContent>
      </Select>
      
      <Select>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="자료유형" /></SelectTrigger>
        <SelectContent>
          {['PPT','학습지','영상','평가지','활동지','지도안'].map(t =>
            <SelectItem key={t} value={t}>{t}</SelectItem>
          )}
        </SelectContent>
      </Select>
      
      <Select defaultValue="year">
        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="week">최근 1주</SelectItem>
          <SelectItem value="month">최근 1개월</SelectItem>
          <SelectItem value="year">최근 1년</SelectItem>
          <SelectItem value="all">전체 기간</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

```tsx
// components/search/ConnectedSites.tsx
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const SITES = [
  { id: 'indischool',   name: '인디스쿨' },
  { id: 'iscream',      name: '아이스크림' },
  { id: 'teacherville', name: '티쳐빌' },
  { id: 'tsherpa',      name: 'T셀파' },
  { id: 'edunet',       name: '에듀넷' },
] as const;

export function ConnectedSites({ accounts }: { accounts: Account[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">연결된 사이트:</span>
      {SITES.map(site => {
        const account = accounts.find(a => a.site === site.id);
        const isConnected = account?.status === 'active';
        
        return (
          <Badge
            key={site.id}
            variant={isConnected ? 'default' : 'outline'}
            className={isConnected ? `bg-site-${site.id}/10 text-site-${site.id}` : ''}
          >
            {isConnected ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <AlertCircle className="mr-1 h-3 w-3" />
            )}
            {site.name}
          </Badge>
        );
      })}
    </div>
  );
}
```

```tsx
// components/search/ResultCard.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Heart, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface Props {
  item: SearchResultItem;
}

export function ResultCard({ item }: Props) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Image
            src={`/icons/${item.source}.svg`}
            alt={item.source}
            width={40}
            height={40}
            className="rounded-md flex-shrink-0"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span className="font-medium">{getSiteName(item.source)}</span>
              {item.publishedAt && (
                <>
                  <span>·</span>
                  <span>{item.publishedAt}</span>
                </>
              )}
              {item.grade && (
                <>
                  <span>·</span>
                  <span>{item.grade}학년 {item.subject}</span>
                </>
              )}
              {item.materialType && (
                <>
                  <span>·</span>
                  <span>{item.materialType}</span>
                </>
              )}
            </div>
            
            <h3 className="font-semibold text-base mb-1 truncate">
              {item.title}
            </h3>
            
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.summary}
            </p>
            
            <div className="flex items-center justify-between mt-3">
              {item.likeCount != null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Heart className="h-3 w-3 fill-current text-red-400" />
                  {item.likeCount}
                </div>
              )}
              
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                원문 보기
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 5.2 외부 계정 관리 페이지 (`/accounts`)

```tsx
// app/(app)/accounts/page.tsx
import { AccountList } from '@/components/accounts/AccountList';
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog';

export default async function AccountsPage() {
  return (
    <main className="container max-w-3xl py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">연결된 계정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            계정을 등록하면 한 번의 검색으로 모든 사이트를 한 번에 조회할 수 있어요.
          </p>
        </div>
        <AddAccountDialog />
      </header>
      
      <AccountList />
    </main>
  );
}
```

### 5.3 계정 추가 다이얼로그 (OTP 흐름 포함)

```tsx
// components/accounts/AddAccountDialog.tsx
'use client';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function AddAccountDialog() {
  const [step, setStep] = useState<'form' | 'otp' | 'testing' | 'done'>('form');
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ 계정 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>외부 사이트 계정 연결</DialogTitle>
        </DialogHeader>
        
        {step === 'form' && <AccountForm onNext={() => setStep('otp')} />}
        {step === 'otp' && <OtpVerify onNext={() => setStep('testing')} />}
        {step === 'testing' && <LoginTesting onNext={() => setStep('done')} />}
        {step === 'done' && <SuccessMessage />}
      </DialogContent>
    </Dialog>
  );
}
```

## 6. 모바일 반응형

```tsx
// 데스크톱 결과 그리드 vs 모바일 단일 컬럼
<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
  {results.map(item => <ResultCard key={item.url} item={item} />)}
</div>
```

```tsx
// 모바일에서는 사이트 칩이 가로 스크롤
<div className="flex gap-2 overflow-x-auto md:flex-wrap pb-2 -mx-4 px-4">
  {/* ... */}
</div>
```

## 7. 로딩·스트리밍 UI

```tsx
// 사이트별 도착 상태 표시
<div className="space-y-2">
  {SITES.map(site => {
    const status = siteStatus[site.id];
    return (
      <div key={site.id} className="flex items-center gap-2 text-sm">
        {status === 'pending' && <Spinner className="h-4 w-4" />}
        {status === 'completed' && <Check className="h-4 w-4 text-green-500" />}
        {status === 'failed' && <X className="h-4 w-4 text-destructive" />}
        <span>{site.name}</span>
        {status === 'completed' && (
          <span className="text-muted-foreground">{itemCount}건</span>
        )}
      </div>
    );
  })}
</div>
```

```tsx
// Skeleton (결과 도착 전)
<Card>
  <CardContent className="p-5">
    <Skeleton className="h-4 w-1/3 mb-2" />
    <Skeleton className="h-5 w-3/4 mb-2" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </CardContent>
</Card>
```

## 8. Toast (알림) 사용

```tsx
import { toast } from 'sonner';

// 성공
toast.success('계정이 연결되었습니다.');

// 에러
toast.error('로그인 실패: 비밀번호를 확인해주세요.');

// OTP 발송
toast.info('인증번호가 발송되었습니다. (3분 유효)');
```

## 9. 다크 모드 (v2)

shadcn/ui 기본 지원. `next-themes` 패키지 추가 후 toggle만 구현.

## 10. 접근성 체크리스트

- [ ] 모든 폼 input에 `<label>` 연결
- [ ] 색상만으로 상태 구분 안 함 (아이콘·텍스트 병기)
- [ ] 대비비 WCAG AA 이상 (4.5:1)
- [ ] 키보드 탐색 가능 (Tab 순서 자연스럽게)
- [ ] focus-visible 스타일 명확히
- [ ] 스크린리더용 `aria-label` 추가
- [ ] 자동재생·움직임 최소화

## 11. 파비콘·OG 이미지

```
public/
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── og-image.png         (1200x630)
└── icons/
    ├── indischool.svg
    ├── iscream.svg
    ├── teacherville.svg
    ├── tsherpa.svg
    └── edunet.svg
```

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: '쌤서치 - 선생님 자료, 5개 사이트를 한 번에',
  description: '한 번의 검색으로 수업 준비 시간을 1/6로 줄여드립니다.',
  openGraph: {
    title: '쌤서치',
    description: '교사 전용 통합 검색 서비스',
    images: ['/og-image.png'],
    locale: 'ko_KR',
    type: 'website',
  },
};
```
