'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { SiteId } from '@ssamsearch/shared';
import { SITE_DISPLAY_NAMES } from '@ssamsearch/shared';

type Step = 'form' | 'testing' | 'done';

interface Props {
  onSuccess: () => void;
}

export function AddAccountDialog({ onSuccess }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [site, setSite] = useState<SiteId>('indischool');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep('form');
    setSite('indischool');
    setUsername('');
    setPassword('');
    setDisplayName('');
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setStep('testing');

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ site, username, password, displayName }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message ?? '계정 등록 실패');
      }

      setStep('done');
      toast.success(`${SITE_DISPLAY_NAMES[site]} 계정이 연결되었습니다.`);
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message);
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>+ 계정 추가</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>외부 사이트 계정 연결</DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>사이트</Label>
              <Select value={site} onValueChange={(v) => setSite(v as SiteId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['indischool', 'iscream', 'teacherville', 'tsherpa', 'edunet'] as SiteId[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {SITE_DISPLAY_NAMES[s]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">별칭 (선택)</Label>
              <Input
                id="displayName"
                placeholder="예) 내 인디스쿨"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground bg-muted rounded p-3">
              비밀번호는 AES-256 암호화 + KMS 키 분리로 안전하게 저장됩니다. 저장 즉시 로그인 테스트를
              진행합니다.
            </p>

            <Button type="submit" className="w-full" disabled={loading}>
              연결하기
            </Button>
          </form>
        )}

        {step === 'testing' && (
          <div className="py-8 text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">
              {SITE_DISPLAY_NAMES[site]}에 로그인을 테스트하고 있습니다...
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="font-medium">{SITE_DISPLAY_NAMES[site]} 연결 완료!</p>
            <Button onClick={() => setOpen(false)} className="w-full">
              닫기
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
