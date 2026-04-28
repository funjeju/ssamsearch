'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Search, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { href: '/search', label: '검색', icon: Search },
  { href: '/accounts', label: '내 계정', icon: BookOpen },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut(auth);
      await fetch('/api/auth/session', { method: 'DELETE' });
      router.replace('/login');
    } catch {
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/search" className="flex items-center gap-2 font-bold text-primary">
          <span className="text-lg">쌤서치</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                pathname === href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          <button
            onClick={handleSignOut}
            className={cn(
              'ml-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </nav>
      </div>
    </header>
  );
}
