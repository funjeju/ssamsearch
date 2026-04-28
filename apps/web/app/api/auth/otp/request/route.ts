import { z } from 'zod';
import { requestSmsOtp } from '@/lib/otp/sms';
import { apiSuccess, apiError } from '@/lib/utils';

const Schema = z.object({
  phoneNumber: z.string(),
  purpose: z.enum(['signup', 'login', 'account_add', 'sensitive_action']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', '입력값이 올바르지 않습니다.', 400);
    }

    const { otpId, expiresIn } = await requestSmsOtp(
      parsed.data.phoneNumber,
      parsed.data.purpose
    );

    const masked = parsed.data.phoneNumber.replace(
      /(\+82\d{2})(\d+)(\d{4})/,
      (_, a, b, c) => `${a}${'*'.repeat(b.length)}${c}`
    );

    return apiSuccess({ otpId, expiresIn, maskedPhone: masked });
  } catch (err: unknown) {
    const message = (err as Error).message;
    if (message === 'RATE_LIMITED') {
      return apiError('RATE_LIMITED', '잠시 후 다시 시도해주세요.', 429);
    }
    return apiError('INTERNAL_ERROR', '서버 오류가 발생했습니다.', 500);
  }
}
