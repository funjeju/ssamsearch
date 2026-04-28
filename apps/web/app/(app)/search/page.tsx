import { redirect } from 'next/navigation';

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q;
  redirect(q ? `/?q=${encodeURIComponent(q)}` : '/');
}
