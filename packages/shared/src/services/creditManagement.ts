/**
 * Credit Management Service - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

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

export class CreditManagementService {
  constructor(private prisma: any) {}

  async addCredits(
    organizationId: string,
    amount: number,
    type: CreditTransactionType,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<CreditOperationResult> {
    return {
      success: false,
      newBalance: 0,
      transactionId: '',
      message: 'Credit management is not available in community edition'
    };
  }

  async deductCredits(
    organizationId: string,
    amount: number,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<CreditOperationResult> {
    return {
      success: false,
      newBalance: 0,
      transactionId: '',
      message: 'Credit management is not available in community edition'
    };
  }

  async getBalance(organizationId: string): Promise<number> {
    return 0;
  }

  async getTransactionHistory(
    organizationId: string,
    limit: number = 10,
    offset: number = 0
  ) {
    return [];
  }
}
