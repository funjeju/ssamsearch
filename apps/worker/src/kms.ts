import {
  createKmsClient,
  createMockKmsClient,
  decryptCredentials,
  type KmsClient,
} from '@ssamsearch/crypto';

let kmsInstance: KmsClient | null = null;

export function getKmsClient(): KmsClient {
  if (!kmsInstance) {
    if (process.env['USE_KMS_MOCK'] === 'true') {
      kmsInstance = createMockKmsClient();
    } else {
      let credentials: Record<string, unknown> | undefined;
      const saKeyB64 = process.env['GCP_SA_KEY'];
      if (saKeyB64) {
        credentials = JSON.parse(Buffer.from(saKeyB64, 'base64').toString('utf-8'));
      }

      kmsInstance = createKmsClient({
        projectId: process.env['GCP_KMS_PROJECT_ID']!,
        location: process.env['GCP_KMS_LOCATION'] ?? 'asia-northeast3',
        keyring: process.env['GCP_KMS_KEYRING'] ?? 'ssamsearch-keyring',
        key: process.env['GCP_KMS_KEY'] ?? 'user-credential-master-key',
        credentials,
      });
    }
  }
  return kmsInstance;
}

import type { ExternalAccount } from '@ssamsearch/shared';

export async function decryptAccountCredentials(
  account: ExternalAccount
): Promise<{ username: string; password: string }> {
  const kms = getKmsClient();
  return decryptCredentials(kms, {
    encryptedDek: account.encryptedDek,
    encryptedUsername: account.encryptedUsername,
    encryptedPassword: account.encryptedPassword,
    iv: account.iv,
    authTag: account.authTag,
  });
}
