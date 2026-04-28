import type { SiteId } from '@ssamsearch/shared';
import { IndischoolAdapter } from './indischool';
import { IscreamAdapter } from './iscream';
import { TeachervilleAdapter } from './teacherville';
import { TsherpaAdapter } from './tsherpa';
import { EdunetAdapter } from './edunet';
import type { SiteAdapter } from './types';

export * from './types';
export { IndischoolAdapter } from './indischool';
export { IscreamAdapter } from './iscream';
export { TeachervilleAdapter } from './teacherville';
export { TsherpaAdapter } from './tsherpa';
export { EdunetAdapter } from './edunet';

export const adapters: Record<SiteId, SiteAdapter> = {
  indischool: new IndischoolAdapter(),
  iscream: new IscreamAdapter(),
  teacherville: new TeachervilleAdapter(),
  tsherpa: new TsherpaAdapter(),
  edunet: new EdunetAdapter(),
};
