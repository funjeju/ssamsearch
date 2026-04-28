import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifyToken, auditLog } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { FieldValue } from 'firebase-admin/firestore';

const SignupSchema = z.object({
  displayName: z.string().min(1).max(50),
  phoneNumber: z.string().optional().default(''),
  schoolType: z.enum(['elementary', 'middle', 'high', 'special']).default('elementary'),
  grade: z.number().int().min(1).max(6).optional(),
  subject: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const uid = await verifyToken(req);
    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', '입력값이 올바르지 않습니다.', 400, parsed.error.issues);
    }

    const { displayName, phoneNumber, schoolType, grade, subject } = parsed.data;

    const e164 = phoneNumber
      ? phoneNumber.replace(/^(\+82)?0?/, '+8210').replace(/\D/g, '')
      : '';

    await adminDb
      .collection('users')
      .doc(uid)
      .set({
        uid,
        displayName,
        phoneNumber: e164,
        schoolType,
        grade: grade ?? null,
        subject: subject ?? null,
        role: 'teacher',
        otpMethod: 'sms',
        totpSecret: null,
        searchCount: 0,
        lastSearchAt: null,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    await auditLog(uid, 'signup', 'success', req);

    return apiSuccess({ uid });
  } catch (err: unknown) {
    const message = (err as Error).message;
    if (message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);
    }
    return apiError('INTERNAL_ERROR', '서버 오류가 발생했습니다.', 500);
  }
}
