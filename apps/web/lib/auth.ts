import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { UserProfile } from '@ssamsearch/shared';

export async function verifyToken(req: Request): Promise<string> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const idToken = authorization.slice(7);
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as UserProfile;
}

export async function auditLog(
  uid: string,
  action: string,
  result: 'success' | 'failure',
  req: Request,
  metadata: Record<string, unknown> = {}
) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const userAgent = req.headers.get('user-agent') ?? '';

  await adminDb.collection('audit').add({
    uid,
    action,
    result,
    ipAddress: ip,
    userAgent,
    metadata,
    timestamp: new Date(),
  });
}
