import { Suspense } from 'react';
import { AccountsPageClient } from '@/components/accounts/AccountsPageClient';

export const metadata = {
  title: '연결된 계정 | 쌤서치',
};

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">불러오는 중...</div>}>
      <AccountsPageClient />
    </Suspense>
  );
}
