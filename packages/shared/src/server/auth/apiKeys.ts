import { PrismaClient, ApiKeyScope } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { randomUUID } from "crypto";
import * as crypto from "crypto";
import { env } from "../../env";
import { logger } from "../index";

export function getDisplaySecretKey(secretKey: string) {
  return secretKey.slice(0, 6) + "..." + secretKey.slice(-4);
}

export async function hashSecretKey(key: string) {
  // legacy, uses bcrypt, transformed into hashed key upon first use
  const hashedKey = await hash(key, 11);
  return hashedKey;
}

async function generateKeySet() {
  return {
    pk: `pk-hz-${randomUUID()}`,
    sk: `sk-hz-${randomUUID()}`,
  };
}

export async function verifySecretKey(key: string, hashedKey: string) {
  const isValid = await compare(key, hashedKey);
  return isValid;
}

export function createShaHash(privateKey: string, salt: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(privateKey)
    .update(crypto.createHash("sha256").update(salt, "utf8").digest("hex"))
    .digest("hex");

  return hash;
}

async function registerKeyWithLLM(publicKey: string, secretKey: string, projectId: string, orgId?: string) {
  const llmApiUrl = process.env.LLM_API_URL;
  const llmApiKey = process.env.LLM_ADMIN_KEY;

  if (!llmApiUrl || !llmApiKey) {
    logger.warn("LLM_API_URL or LLM_ADMIN_KEY not set, skipping LLM registration");
    return;
  }

  try {
    const response = await fetch(`${llmApiUrl}/api/register-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmApiKey}`
      },
      body: JSON.stringify({
        publicKey,
        secretKey,
        projectId,
        orgId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to register key with LLM API: ${response.statusText}`);
    }

    logger.info(`Successfully registered API key with LLM API for project ${projectId}`);
    return await response.json();
  } catch (error) {
    logger.error(`Error registering key with LLM API: ${error instanceof Error ? error.message : String(error)}`);
    // Non-blocking - we still want to create the key even if LLM registration fails
  }
}

export async function unregisterKeyFromLLM(publicKey: string) {
  const llmApiUrl = process.env.LLM_API_URL;
  const llmApiKey = process.env.LLM_ADMIN_KEY;

  if (!llmApiUrl || !llmApiKey) {
    logger.warn("LLM_API_URL or LLM_ADMIN_KEY not set, skipping LLM unregistration");
    return;
  }

  try {
    const response = await fetch(`${llmApiUrl}/api/unregister-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmApiKey}`
      },
      body: JSON.stringify({
        publicKey
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to unregister key from LLM API: ${response.statusText}`);
    }

    logger.info(`Successfully unregistered API key from LLM API`);
    return await response.json();
  } catch (error) {
    logger.error(`Error unregistering key from LLM API: ${error instanceof Error ? error.message : String(error)}`);
    // Non-blocking
  }
}

export async function createAndAddApiKeysToDb(p: {
  prisma: PrismaClient;
  entityId: string;
  scope: ApiKeyScope;
  note?: string;
  predefinedKeys?: {
    secretKey: string;
    publicKey: string;
  };
}) {
  const salt = env.SALT;
  if (!salt) {
    throw new Error("SALT is not set");
  }

  const { pk, sk } = p.predefinedKeys
    ? { pk: p.predefinedKeys.publicKey, sk: p.predefinedKeys.secretKey }
    : await generateKeySet();

  const hashedSk = await hashSecretKey(sk);
  const displaySk = getDisplaySecretKey(sk);

  const hashFromProvidedKey = createShaHash(sk, salt);

  const entity =
    p.scope === "PROJECT" ? { projectId: p.entityId } : { orgId: p.entityId };

  const apiKey = await p.prisma.apiKey.create({
    data: {
      ...entity,
      publicKey: pk,
      hashedSecretKey: hashedSk,
      displaySecretKey: displaySk,
      fastHashedSecretKey: hashFromProvidedKey,
      note: p.note,
      scope: p.scope,
    },
    include: {
      project: {
        include: {
          organization: true
        }
      }
    }
  });

  // Register with LLM API
  await registerKeyWithLLM(pk, sk, p.projectId, apiKey.project.orgId);

  return {
    id: apiKey.id,
    createdAt: apiKey.createdAt,
    note: apiKey.note,
    publicKey: apiKey.publicKey,
    secretKey: sk,
    displaySecretKey: displaySk,
  };
}
