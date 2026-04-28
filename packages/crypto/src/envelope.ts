import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface EncryptedRecord {
  encryptedDek: string;  // base64, KMS로 암호화된 DEK
  encryptedData: string; // base64, DEK로 암호화된 데이터
  iv: string;            // base64
  authTag: string;       // base64
}

// KMS 클라이언트는 환경에 따라 주입받는 구조
export interface KmsClient {
  encrypt(plaintext: Buffer): Promise<Buffer>;
  decrypt(ciphertext: Buffer): Promise<Buffer>;
}

// 운영: Google Cloud KMS 클라이언트
export function createKmsClient(config: {
  projectId: string;
  location: string;
  keyring: string;
  key: string;
  credentials?: Record<string, unknown>;
}): KmsClient {
  const { KeyManagementServiceClient } = require('@google-cloud/kms');
  const kms = new KeyManagementServiceClient(
    config.credentials ? { credentials: config.credentials } : undefined
  );
  const keyName = `projects/${config.projectId}/locations/${config.location}/keyRings/${config.keyring}/cryptoKeys/${config.key}`;

  return {
    async encrypt(plaintext: Buffer): Promise<Buffer> {
      const [resp] = await kms.encrypt({ name: keyName, plaintext });
      return Buffer.from(resp.ciphertext as Uint8Array);
    },
    async decrypt(ciphertext: Buffer): Promise<Buffer> {
      const [resp] = await kms.decrypt({ name: keyName, ciphertext });
      return Buffer.from(resp.plaintext as Uint8Array);
    },
  };
}

// 개발/테스트: KMS mock (환경변수 KMS_MOCK_KEY 사용)
export function createMockKmsClient(mockKey?: string): KmsClient {
  const key = mockKey ?? process.env['KMS_MOCK_KEY'] ?? 'this-is-a-32-byte-mock-key-for-dev!';
  const keyBuf = Buffer.from(key.padEnd(32).slice(0, 32));

  return {
    async encrypt(plaintext: Buffer): Promise<Buffer> {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
      const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Buffer.concat([iv, tag, enc]);
    },
    async decrypt(ciphertext: Buffer): Promise<Buffer> {
      const iv = ciphertext.subarray(0, 12);
      const tag = ciphertext.subarray(12, 28);
      const enc = ciphertext.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]);
    },
  };
}

// 단일 텍스트 암호화 (외부 계정 ID 또는 PW 각각)
export async function encryptText(kms: KmsClient, plaintext: string): Promise<EncryptedRecord> {
  const dek = randomBytes(32);

  const encryptedDekBuf = await kms.encrypt(dek);
  const encryptedDek = encryptedDekBuf.toString('base64');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  dek.fill(0);

  return {
    encryptedDek,
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

// 단일 텍스트 복호화
export async function decryptText(kms: KmsClient, record: EncryptedRecord): Promise<string> {
  const dekBuf = await kms.decrypt(Buffer.from(record.encryptedDek, 'base64'));

  const decipher = createDecipheriv(
    'aes-256-gcm',
    dekBuf,
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedData, 'base64')),
    decipher.final(),
  ]);

  dekBuf.fill(0);

  return decrypted.toString('utf8');
}

// 외부 계정의 username + password를 각각의 DEK로 암호화
export interface EncryptedCredentials {
  encryptedDek: string;
  encryptedUsername: string;
  encryptedPassword: string;
  iv: string;
  authTag: string;
}

export async function encryptCredentials(
  kms: KmsClient,
  username: string,
  password: string
): Promise<EncryptedCredentials> {
  const dek = randomBytes(32);

  const encryptedDekBuf = await kms.encrypt(dek);
  const encryptedDek = encryptedDekBuf.toString('base64');

  function encryptWithDek(plaintext: string): { data: string; iv: string; tag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      data: enc.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  const encUser = encryptWithDek(username);
  const encPass = encryptWithDek(password);

  dek.fill(0);

  // iv/authTag는 username 암호화 기준으로 저장 (password는 내부에 포함)
  return {
    encryptedDek,
    encryptedUsername: encUser.data,
    encryptedPassword: `${encPass.iv}:${encPass.tag}:${encPass.data}`,
    iv: encUser.iv,
    authTag: encUser.tag,
  };
}

export async function decryptCredentials(
  kms: KmsClient,
  record: EncryptedCredentials
): Promise<{ username: string; password: string }> {
  const dekBuf = await kms.decrypt(Buffer.from(record.encryptedDek, 'base64'));

  function decryptWithDek(data: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      dekBuf,
      Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  }

  const username = decryptWithDek(record.encryptedUsername, record.iv, record.authTag);

  const [passIv, passTag, passData] = record.encryptedPassword.split(':');
  if (!passIv || !passTag || !passData) throw new Error('Invalid encrypted password format');
  const password = decryptWithDek(passData, passIv, passTag);

  dekBuf.fill(0);

  return { username, password };
}
