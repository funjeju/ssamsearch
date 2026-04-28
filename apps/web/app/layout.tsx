import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: '쌤서치 - 선생님 자료, 5개 사이트를 한 번에',
  description: '한 번의 검색으로 수업 준비 시간을 1/6로 줄여드립니다.',
  openGraph: {
    title: '쌤서치',
    description: '교사 전용 통합 검색 서비스',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
