import { z } from "zod/v4";

// ── Secrets ──────────────────────────────────────────────────────────

export const KmsSecretSchema = z.object({
  id: z.string(),
  version: z.number(),
  secretKey: z.string(),
  secretValue: z.string(),
  secretComment: z.string().optional(),
  environment: z.string(),
  type: z.string().default("shared"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type KmsSecret = z.infer<typeof KmsSecretSchema>;

export const CreateKmsSecretInput = z.object({
  projectId: z.string(),
  environment: z.string(),
  secretPath: z.string().default("/"),
  secretName: z.string().min(1),
  secretValue: z.string(),
  secretComment: z.string().optional(),
  type: z.string().default("shared"),
});
export type CreateKmsSecretInput = z.infer<typeof CreateKmsSecretInput>;

export const UpdateKmsSecretInput = z.object({
  projectId: z.string(),
  environment: z.string(),
  secretPath: z.string().default("/"),
  secretName: z.string().min(1),
  secretValue: z.string(),
  secretComment: z.string().optional(),
});
export type UpdateKmsSecretInput = z.infer<typeof UpdateKmsSecretInput>;

export const DeleteKmsSecretInput = z.object({
  projectId: z.string(),
  environment: z.string(),
  secretPath: z.string().default("/"),
  secretName: z.string().min(1),
});
export type DeleteKmsSecretInput = z.infer<typeof DeleteKmsSecretInput>;

// ── Environments ─────────────────────────────────────────────────────

export const KmsEnvironmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type KmsEnvironment = z.infer<typeof KmsEnvironmentSchema>;

// ── Encryption Keys (CMEK) ──────────────────────────────────────────

export const KmsKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isDisabled: z.boolean().default(false),
  encryptionAlgorithm: z.string(),
  keyUsage: z.string(),
  version: z.number().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type KmsKey = z.infer<typeof KmsKeySchema>;

export const CreateKmsKeyInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  encryptionAlgorithm: z.enum(["aes-256-gcm", "aes-128-gcm"]),
  keyUsage: z.enum(["encrypt-decrypt", "sign-verify"]),
});
export type CreateKmsKeyInput = z.infer<typeof CreateKmsKeyInput>;

export const UpdateKmsKeyInput = z.object({
  projectId: z.string(),
  keyId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isDisabled: z.boolean().optional(),
});
export type UpdateKmsKeyInput = z.infer<typeof UpdateKmsKeyInput>;

export const DeleteKmsKeyInput = z.object({
  projectId: z.string(),
  keyId: z.string(),
});
export type DeleteKmsKeyInput = z.infer<typeof DeleteKmsKeyInput>;

export const EncryptInput = z.object({
  projectId: z.string(),
  keyId: z.string(),
  plaintext: z.string(), // base64
});
export type EncryptInput = z.infer<typeof EncryptInput>;

export const DecryptInput = z.object({
  projectId: z.string(),
  keyId: z.string(),
  ciphertext: z.string(), // base64
});
export type DecryptInput = z.infer<typeof DecryptInput>;
