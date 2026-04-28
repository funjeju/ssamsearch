import { z } from 'zod';
import { verifyOtp } from '@/lib/otp/sms';
import { apiSuccess, apiError } from '@/lib/utils';

const Schema = z.object({
  otpId: z.string(),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', '입력값이 올바르지 않습니다.', 400);
    }

    await verifyOtp(parsed.data.otpId, parsed.data.code);
    return apiSuccess({ verified: true });
  } catch (err: unknown) {
    const message = (err as Error).message;
    if (message === 'OTP_EXPIRED') return apiError('OTP_EXPIRED', 'OTP가 만료되었습니다.', 400);
    if (message === 'INVALID_OTP') return apiError('INVALID_OTP', 'OTP가 올바르지 않습니다.', 400);
    if (message === 'OTP_TOO_MANY_ATTEMPTS')
      return apiError('OTP_TOO_MANY_ATTEMPTS', '시도 횟수를 초과했습니다.', 400);
    return apiError('INTERNAL_ERROR', '서버 오류가 발생했습니다.', 500);
  }
}
