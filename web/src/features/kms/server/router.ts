import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import {
  createTRPCRouter,
  protectedProjectProcedure,
  type ProjectAuthedContext,
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

/**
 * Resolve the KMS workspace/project ID for the current org.
 *
 * Multi-tenant: each org can store its own KMS project ID in
 * Organization.metadata.kmsProjectId.  Falls back to the global
 * KMS_PROJECT_ID env var (used in dev / single-tenant deploys).
 */
function resolveKmsProjectId(ctx: { session: ProjectAuthedContext["session"] }): string {
  // 1. Try org-specific KMS project from session metadata
  const org = ctx.session.user.organizations.find(
    (o) => o.id === ctx.session.orgId,
  );
  const orgKmsId =
    org?.metadata && typeof org.metadata === "object"
      ? (org.metadata as Record<string, unknown>).kmsProjectId
      : undefined;
  if (typeof orgKmsId === "string" && orgKmsId.length > 0) {
    return orgKmsId;
  }

  // 2. Fall back to global env var (dev / single-tenant)
  const globalId = env.KMS_PROJECT_ID;
  if (globalId) {
    return globalId;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "KMS is not configured for this organization. " +
      "Set kmsProjectId in org metadata or KMS_PROJECT_ID env var.",
  });
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
        workspaceId: resolveKmsProjectId(ctx),
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
        workspaceId: resolveKmsProjectId(ctx),
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
          workspaceId: resolveKmsProjectId(ctx),
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
          workspaceId: resolveKmsProjectId(ctx),
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
        `/api/v1/workspace/${resolveKmsProjectId(ctx)}/environments`,
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
        projectId: resolveKmsProjectId(ctx),
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
        projectId: resolveKmsProjectId(ctx),
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
