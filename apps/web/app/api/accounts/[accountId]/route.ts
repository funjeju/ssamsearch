import { adminDb } from '@/lib/firebase/admin';
import { verifyToken, auditLog } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

// DELETE /api/accounts/[accountId]
export async function DELETE(req: Request, { params }: { params: { accountId: string } }) {
  try {
    const uid = await verifyToken(req);
    const { accountId } = params;

    const docRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('accounts')
      .doc(accountId);

    const snap = await docRef.get();
    if (!snap.exists) {
      return apiError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
    }

    await docRef.delete();
    await auditLog(uid, 'account_delete', 'success', req, { accountId });

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);
    }
    return apiError('INTERNAL_ERROR', '서버 오류', 500);
  }
}
