/**
 * Credit Management Service - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

export enum CreditTransactionType {
  PURCHASE = "PURCHASE",
  USAGE = "USAGE",
  REFUND = "REFUND",
  ADJUSTMENT = "ADJUSTMENT",
  EXPIRATION = "EXPIRATION",
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
    _organizationId: string,
    _amount: number,
    _type: CreditTransactionType,
    _description?: string,
    _metadata?: Record<string, any>,
  ): Promise<CreditOperationResult> {
    return {
      success: false,
      newBalance: 0,
      transactionId: "",
      message: "Credit management is not available in community edition",
    };
  }

  async deductCredits(
    _organizationId: string,
    _amount: number,
    _description?: string,
    _metadata?: Record<string, any>,
  ): Promise<CreditOperationResult> {
    return {
      success: false,
      newBalance: 0,
      transactionId: "",
      message: "Credit management is not available in community edition",
    };
  }

  async getBalance(_organizationId: string): Promise<number> {
    return 0;
  }

  async getTransactionHistory(_organizationId: string, _limit: number = 10, _offset: number = 0) {
    return [];
  }
}
