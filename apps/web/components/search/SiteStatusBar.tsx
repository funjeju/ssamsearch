import { Check, X, Loader2 } from 'lucide-react';
import type { SiteId, SiteSearchStatus } from '@ssamsearch/shared';
import { SITE_IDS, SITE_DISPLAY_NAMES } from '@ssamsearch/shared';

interface Props {
  siteStatus: Partial<Record<SiteId, SiteSearchStatus>>;
}

export function SiteStatusBar({ siteStatus }: Props) {
  return (
    <div className="flex flex-wrap gap-3 py-3 border-y">
      {SITE_IDS.map((siteId) => {
        const status = siteStatus[siteId];
        return (
          <div key={siteId} className="flex items-center gap-1.5 text-sm">
            {!status || status.status === 'pending' ? (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
            ) : status.status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : status.status === 'completed' ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
            <span className={status?.status === 'failed' ? 'text-muted-foreground line-through' : ''}>
              {SITE_DISPLAY_NAMES[siteId]}
            </span>
            {status?.status === 'completed' && (
              <span className="text-muted-foreground text-xs">{status.itemCount}건</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
