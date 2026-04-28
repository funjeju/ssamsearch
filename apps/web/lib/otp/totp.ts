import { authenticator } from 'otplib';

authenticator.options = {
  window: 1,
  digits: 6,
  step: 30,
};

export function generateTotpSecret(email: string): { secret: string; otpauth: string } {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, '쌤서치', secret);
  return { secret, otpauth };
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
