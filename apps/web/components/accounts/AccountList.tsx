'use client';

import type { User } from 'firebase/auth';
import { Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { ExternalAccountPublic, SiteId } from '@ssamsearch/shared';
import { SITE_DISPLAY_NAMES, SITE_COLORS } from '@ssamsearch/shared';

interface Props {
  accounts: ExternalAccountPublic[];
  loading: boolean;
  onRefresh: () => void;
  user: User | null;
}

const ALL_SITES: SiteId[] = ['indischool', 'iscream', 'teacherville', 'tsherpa', 'edunet'];

export function AccountList({ accounts, loading, onRefresh, user }: Props) {
  async function handleDelete(accountId: string) {
    if (!user) return;
    if (!confirm('이 계정 연결을 해제하시겠습니까?')) return;

    const idToken = await user.getIdToken();
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const data = await res.json();
    if (data.success) {
      toast.success('계정 연결이 해제되었습니다.');
      onRefresh();
    } else {
      toast.error('삭제 실패: ' + (data.error?.message ?? '오류가 발생했습니다.'));
    }
  }

  async function handleTest(accountId: string) {
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/accounts/${accountId}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    if (data.success) {
      toast.success('연결 정상 확인!');
      onRefresh();
    } else {
      toast.error('연결 실패: 비밀번호를 확인해주세요.');
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ALL_SITES.map((siteId) => {
        const account = accounts.find((a) => a.site === siteId);
        const color = SITE_COLORS[siteId];
        const name = SITE_DISPLAY_NAMES[siteId];

        return (
          <Card key={siteId}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {name[0]}
                </div>
                <div>
                  <div className="font-medium">{name}</div>
                  {account ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {account.status === 'active' ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-xs text-green-600">연결됨</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs text-amber-600">재인증 필요</span>
                        </>
                      )}
                      {account.lastSuccessAt && (
                        <span className="text-xs text-muted-foreground">
                          · 최근 {new Date(account.lastSuccessAt).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">연결되지 않음</span>
                  )}
                </div>
              </div>

              {account ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTest(account.accountId)}
                    title="연결 테스트"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(account.accountId)}
                    className="text-destructive hover:text-destructive"
                    title="연결 해제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="text-xs">
                  미연결
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
