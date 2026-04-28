'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AccountList } from './AccountList';
import { AddAccountDialog } from './AddAccountDialog';
import type { ExternalAccountPublic } from '@ssamsearch/shared';

const SITES = [
  { id: 'indischool', name: '인디스쿨', desc: '초등 교사 최대 커뮤니티' },
  { id: 'iscream', name: '아이스크림', desc: '교수학습 자료 플랫폼' },
  { id: 'teacherville', name: '티쳐빌', desc: '원격 연수·자료 포털' },
  { id: 'tsherpa', name: 'T셀파', desc: '교원 지식 공유 서비스' },
  { id: 'edunet', name: '에듀넷', desc: '국가 교육자료 포털' },
];

export function AccountsPageClient() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === 'true';

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

  const connectedIds = new Set(accounts.map((a) => a.site));

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">

      {/* 첫 로그인 웰컴 배너 */}
      {isWelcome && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👋</span>
            <h2 className="text-lg font-bold">쌤서치에 오신 걸 환영해요!</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            아래 사이트 계정을 연결하면 <strong>한 번의 검색</strong>으로 모든 곳을 동시에 조회할 수 있어요.
            계정 정보는 <strong>AES-256 암호화</strong>로 안전하게 보호됩니다.
          </p>

          {/* 사이트 연결 현황 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {SITES.map((site) => {
              const connected = connectedIds.has(site.id as ExternalAccountPublic['site']);
              return (
                <div
                  key={site.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    connected
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-border bg-background'
                  }`}
                >
                  <div>
                    <span className="font-medium">{site.name}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">{site.desc}</span>
                  </div>
                  {connected ? (
                    <span className="text-xs font-medium text-green-600">✓ 연결됨</span>
                  ) : (
                    <AddAccountDialog
                      onSuccess={fetchAccounts}
                      defaultSite={site.id}
                      trigger={
                        <button className="text-xs font-medium text-primary hover:underline">
                          연결하기
                        </button>
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  );
}
