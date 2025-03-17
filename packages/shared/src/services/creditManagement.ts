import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// Define CreditTransactionType enum since it's not yet generated
export enum CreditTransactionType {
  PURCHASE = 'PURCHASE',
  USAGE = 'USAGE',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  EXPIRATION = 'EXPIRATION'
}

export interface CreditOperationResult {
  success: boolean;
  newBalance: number;
  transactionId: string;
  message?: string;
}

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class CreditManagementService {
  constructor(private prisma: PrismaClient) {}

  async addCredits(
    organizationId: string,
    amount: number,
    type: CreditTransactionType,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<CreditOperationResult> {
    return await this.prisma.$transaction(async (prisma: TransactionClient) => {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { credits: true }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const newBalance = organization.credits + amount;
      
      // Update organization credits
      await prisma.organization.update({
        where: { id: organizationId },
        data: { credits: newBalance }
      });

      // Create transaction record
      const transaction = await (prisma as any).creditTransaction.create({
        data: {
          organizationId,
          amount,
          balance: newBalance,
          type,
          description,
          metadata
        }
      });

      return {
        success: true,
        newBalance,
        transactionId: transaction.id,
        message: `Successfully added ${amount} credits`
      };
    });
  }

  async deductCredits(
    organizationId: string,
    amount: number,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<CreditOperationResult> {
    return await this.prisma.$transaction(async (prisma: TransactionClient) => {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { credits: true }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.credits < amount) {
        throw new Error('Insufficient credits');
      }

      const newBalance = organization.credits - amount;
      
      // Update organization credits
      await prisma.organization.update({
        where: { id: organizationId },
        data: { credits: newBalance }
      });

      // Create transaction record
      const transaction = await (prisma as any).creditTransaction.create({
        data: {
          organizationId,
          amount: -amount,
          balance: newBalance,
          type: CreditTransactionType.USAGE,
          description,
          metadata
        }
      });

      return {
        success: true,
        newBalance,
        transactionId: transaction.id,
        message: `Successfully deducted ${amount} credits`
      };
    });
  }

  async getBalance(organizationId: string): Promise<number> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { credits: true }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    return organization.credits;
  }

  async getTransactionHistory(
    organizationId: string,
    limit: number = 10,
    offset: number = 0
  ) {
    return await (this.prisma as any).creditTransaction.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }
} 