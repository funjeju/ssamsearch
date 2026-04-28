import { adminDb } from '@/lib/firebase/admin';
import { verifyToken } from '@/lib/auth';
import { decryptExternalCredentials } from '@/lib/kms';
import { apiSuccess, apiError } from '@/lib/utils';
import type { ExternalAccount } from '@ssamsearch/shared';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request, { params }: { params: { accountId: string } }) {
  try {
    const uid = await verifyToken(req);
    const { accountId } = params;

    const docRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('accounts')
      .doc(accountId);

    const snap = await docRef.get();
    if (!snap.exists) return apiError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);

    const account = snap.data() as ExternalAccount;
    const { username, password } = await decryptExternalCredentials(account);

    const workerUrl = process.env.WORKER_URL ?? 'http://localhost:8080';
    const start = Date.now();
    const testRes = await fetch(`${workerUrl}/internal/login-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.WORKER_INTERNAL_TOKEN ?? '',
      },
      body: JSON.stringify({ site: account.site, username, password }),
      signal: AbortSignal.timeout(15_000),
    });

    const responseTimeMs = Date.now() - start;
    const testData = await testRes.json();

    const newStatus = testData.loginSuccess ? 'active' : 'requires_reauth';
    await docRef.update({
      status: newStatus,
      ...(testData.loginSuccess ? { lastSuccessAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return apiSuccess({ status: newStatus, responseTimeMs });
  } catch (err: unknown) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);
    }
    return apiError('INTERNAL_ERROR', '서버 오류', 500);
  }
}
