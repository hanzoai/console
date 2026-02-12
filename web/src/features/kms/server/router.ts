import { z } from "zod/v4";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { env } from "@/src/env.mjs";
import { kmsGet, kmsPost, kmsPatch, kmsDelete } from "./kmsClient";
import {
  CreateKmsSecretInput,
  UpdateKmsSecretInput,
  DeleteKmsSecretInput,
  CreateKmsKeyInput,
  UpdateKmsKeyInput,
  DeleteKmsKeyInput,
  EncryptInput,
  DecryptInput,
} from "../types";

/** Map a console projectId to the KMS project ID. */
function kmsProjectId(): string {
  const id = env.KMS_PROJECT_ID;
  if (!id) {
    throw new Error("KMS_PROJECT_ID is not configured");
  }
  return id;
}

export const kmsRouter = createTRPCRouter({
  // ── Secrets ──────────────────────────────────────────────────────

  listSecrets: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        environment: z.string(),
        secretPath: z.string().default("/"),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsSecrets:read",
      });

      return kmsGet<{ secrets: unknown[] }>("/api/v3/secrets/raw", {
        workspaceId: kmsProjectId(),
        environment: input.environment,
        secretPath: input.secretPath,
      });
    }),

  createSecret: protectedProjectProcedure
    .input(CreateKmsSecretInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsSecrets:CUD",
      });

      return kmsPost("/api/v3/secrets/raw", {
        workspaceId: kmsProjectId(),
        environment: input.environment,
        secretPath: input.secretPath,
        secretName: input.secretName,
        secretValue: input.secretValue,
        secretComment: input.secretComment,
        type: input.type,
      });
    }),

  updateSecret: protectedProjectProcedure
    .input(UpdateKmsSecretInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsSecrets:CUD",
      });

      return kmsPatch(
        `/api/v3/secrets/raw/${encodeURIComponent(input.secretName)}`,
        {
          workspaceId: kmsProjectId(),
          environment: input.environment,
          secretPath: input.secretPath,
          secretValue: input.secretValue,
          secretComment: input.secretComment,
        },
      );
    }),

  deleteSecret: protectedProjectProcedure
    .input(DeleteKmsSecretInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsSecrets:CUD",
      });

      return kmsDelete(
        `/api/v3/secrets/raw/${encodeURIComponent(input.secretName)}`,
        {
          workspaceId: kmsProjectId(),
          environment: input.environment,
          secretPath: input.secretPath,
        },
      );
    }),

  // ── Environments ─────────────────────────────────────────────────

  listEnvironments: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsSecrets:read",
      });

      return kmsGet<{ environments: unknown[] }>(
        `/api/v1/workspace/${kmsProjectId()}/environments`,
      );
    }),

  // ── Encryption Keys (CMEK) ──────────────────────────────────────

  listKeys: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsKeys:read",
      });

      return kmsGet<{ keys: unknown[] }>("/api/v1/kms/keys", {
        projectId: kmsProjectId(),
      });
    }),

  createKey: protectedProjectProcedure
    .input(CreateKmsKeyInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsKeys:CUD",
      });

      return kmsPost("/api/v1/kms/keys", {
        projectId: kmsProjectId(),
        name: input.name,
        description: input.description,
        encryptionAlgorithm: input.encryptionAlgorithm,
        keyUsage: input.keyUsage,
      });
    }),

  updateKey: protectedProjectProcedure
    .input(UpdateKmsKeyInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsKeys:CUD",
      });

      return kmsPatch(`/api/v1/kms/keys/${encodeURIComponent(input.keyId)}`, {
        name: input.name,
        description: input.description,
        isDisabled: input.isDisabled,
      });
    }),

  deleteKey: protectedProjectProcedure
    .input(DeleteKmsKeyInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsKeys:CUD",
      });

      return kmsDelete(
        `/api/v1/kms/keys/${encodeURIComponent(input.keyId)}`,
      );
    }),

  encrypt: protectedProjectProcedure
    .input(EncryptInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsKeys:read",
      });

      return kmsPost<{ ciphertext: string }>(
        `/api/v1/kms/keys/${encodeURIComponent(input.keyId)}/encrypt`,
        { plaintext: input.plaintext },
      );
    }),

  decrypt: protectedProjectProcedure
    .input(DecryptInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "kmsKeys:read",
      });

      return kmsPost<{ plaintext: string }>(
        `/api/v1/kms/keys/${encodeURIComponent(input.keyId)}/decrypt`,
        { ciphertext: input.ciphertext },
      );
    }),
});
