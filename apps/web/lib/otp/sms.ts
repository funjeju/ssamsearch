import { randomBytes } from 'crypto';
import { getRedis } from '@/lib/redis';

interface OtpData {
  phoneNumber: string;
  code: string;
  purpose: string;
  attempts: number;
}

export async function requestSmsOtp(
  phoneNumber: string,
  purpose: string
): Promise<{ otpId: string; expiresIn: number }> {
  const redis = getRedis();

  // Rate limit: 1분에 1회
  const rateLimitKey = `otp:rate:${phoneNumber}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) await redis.expire(rateLimitKey, 60);
  if (count > 1) throw new Error('RATE_LIMITED');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otpId = randomBytes(16).toString('hex');

  await redis.set(
    `otp:${otpId}`,
    JSON.stringify({ phoneNumber, code, purpose, attempts: 0 } satisfies OtpData),
    { ex: 180 }
  );

  // SMS 발송
  if (process.env.SMS_PROVIDER === 'nhn') {
    await sendNhnSms(phoneNumber, `[쌤서치] 인증번호: ${code} (3분 유효)`);
  } else {
    // 개발 모드: 콘솔 출력
    console.info(`[OTP] ${phoneNumber}: ${code}`);
  }

  return { otpId, expiresIn: 180 };
}

export async function verifyOtp(otpId: string, code: string): Promise<boolean> {
  const redis = getRedis();
  const raw = await redis.get<string>(`otp:${otpId}`);
  if (!raw) throw new Error('OTP_EXPIRED');

  const data: OtpData = typeof raw === 'string' ? JSON.parse(raw) : (raw as OtpData);

  if (data.attempts >= 5) {
    await redis.del(`otp:${otpId}`);
    throw new Error('OTP_TOO_MANY_ATTEMPTS');
  }

  if (data.code !== code) {
    data.attempts++;
    await redis.set(`otp:${otpId}`, JSON.stringify(data), { ex: 180 });
    throw new Error('INVALID_OTP');
  }

  await redis.del(`otp:${otpId}`);
  return true;
}

async function sendNhnSms(to: string, text: string): Promise<void> {
  const appKey = process.env.NHN_CLOUD_APP_KEY;
  const secretKey = process.env.NHN_CLOUD_SECRET_KEY;
  const sender = process.env.NHN_CLOUD_SENDER_PHONE;

  if (!appKey || !secretKey || !sender) {
    throw new Error('NHN Cloud SMS 환경변수 미설정');
  }

  const res = await fetch(
    `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${appKey}/sender/sms`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify({
        body: text,
        sendNo: sender,
        recipientList: [{ recipientNo: to.replace('+82', '0') }],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`SMS 발송 실패: ${res.status}`);
  }
}
