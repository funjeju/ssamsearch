import { Heart, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { SearchResultItem } from '@ssamsearch/shared';
import { SITE_DISPLAY_NAMES } from '@ssamsearch/shared';

interface Props {
  item: SearchResultItem;
}

export function ResultCard({ item }: Props) {
  const siteName = SITE_DISPLAY_NAMES[item.source] ?? item.source;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">{siteName}</span>
            {item.publishedAt && (
              <span className="text-xs text-muted-foreground">· {formatDate(item.publishedAt)}</span>
            )}
            {item.grade && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {item.grade}학년
              </Badge>
            )}
            {item.subject && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {item.subject}
              </Badge>
            )}
            {item.materialType && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {item.materialType}
              </Badge>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-base leading-tight line-clamp-2">{item.title}</h3>
            {item.summary && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {item.likeCount != null ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3 w-3 fill-current text-red-400" />
                {item.likeCount.toLocaleString()}
              </div>
            ) : (
              <div />
            )}

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              원문 보기
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
