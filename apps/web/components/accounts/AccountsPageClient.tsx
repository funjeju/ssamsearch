'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AccountList } from './AccountList';
import { AddAccountDialog } from './AddAccountDialog';
import type { ExternalAccountPublic } from '@ssamsearch/shared';

export function AccountsPageClient() {
  const { user, loading } = useAuth();
  const [accounts, setAccounts] = useState<ExternalAccountPublic[]>([]);
  const [fetching, setFetching] = useState(true);

  async function fetchAccounts() {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const { data } = await res.json();
      setAccounts(data.accounts ?? []);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (!loading) fetchAccounts();
  }, [user, loading]);

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">연결된 계정</h1>
            <p className="text-sm text-muted-foreground mt-1">
              계정을 등록하면 한 번의 검색으로 모든 사이트를 동시에 조회할 수 있어요.
            </p>
          </div>
          <AddAccountDialog onSuccess={fetchAccounts} />
        </header>

        <AccountList
          accounts={accounts}
          loading={fetching}
          onRefresh={fetchAccounts}
          user={user}
        />
      </div>
    </main>
  );
}
