import {
  createKmsClient,
  createMockKmsClient,
  encryptCredentials,
  decryptCredentials,
  type KmsClient,
  type EncryptedCredentials,
} from '@ssamsearch/crypto';

let kmsInstance: KmsClient | null = null;

export function getKmsClient(): KmsClient {
  if (!kmsInstance) {
    if (process.env.USE_KMS_MOCK === 'true') {
      kmsInstance = createMockKmsClient();
    } else {
      kmsInstance = createKmsClient({
        projectId: process.env.GCP_KMS_PROJECT_ID!,
        location: process.env.GCP_KMS_LOCATION ?? 'asia-northeast3',
        keyring: process.env.GCP_KMS_KEYRING ?? 'ssamsearch-keyring',
        key: process.env.GCP_KMS_KEY ?? 'user-credential-master-key',
      });
    }
  }
  return kmsInstance;
}

export async function encryptExternalCredentials(
  username: string,
  password: string
): Promise<EncryptedCredentials> {
  return encryptCredentials(getKmsClient(), username, password);
}

export async function decryptExternalCredentials(
  record: EncryptedCredentials
): Promise<{ username: string; password: string }> {
  return decryptCredentials(getKmsClient(), record);
}
