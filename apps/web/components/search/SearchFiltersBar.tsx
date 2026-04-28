'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SearchFilters } from '@ssamsearch/shared';

interface Props {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  disabled?: boolean;
}

const GRADES = ['1', '2', '3', '4', '5', '6', '중1', '중2', '중3', '고1', '고2', '고3'];
const SUBJECTS = ['국어', '수학', '사회', '과학', '영어', '음악', '미술', '체육', '실과', '기타'];
const TYPES = ['PPT', '학습지', '영상', '평가지', '활동지', '지도안'];

export function SearchFiltersBar({ filters, onChange, disabled }: Props) {
  function update(key: keyof SearchFilters, value: string | undefined) {
    onChange({ ...filters, [key]: value ?? undefined });
  }

  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
      <Select
        value={filters.grade?.toString()}
        onValueChange={(v) => update('grade', v === 'all' ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px] shrink-0">
          <SelectValue placeholder="학년" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 학년</SelectItem>
          {GRADES.map((g) => (
            <SelectItem key={g} value={g}>{g}학년</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.subject}
        onValueChange={(v) => update('subject', v === 'all' ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px] shrink-0">
          <SelectValue placeholder="과목" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 과목</SelectItem>
          {SUBJECTS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.materialType}
        onValueChange={(v) => update('materialType', v === 'all' ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] shrink-0">
          <SelectValue placeholder="자료유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.dateRange ?? 'all'}
        onValueChange={(v) => update('dateRange', v === 'all' ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue placeholder="기간" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 기간</SelectItem>
          <SelectItem value="week">최근 1주</SelectItem>
          <SelectItem value="month">최근 1개월</SelectItem>
          <SelectItem value="year">최근 1년</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
