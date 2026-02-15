import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  CreditCard,
  Coins,
  Landmark,
  Plus,
  Star,
} from "lucide-react";
import type { BotTier, PaymentMethodType } from "../types";

const tierLabel: Record<BotTier, string> = {
  free: "Free",
  cloud: "Cloud",
  "cloud-pro": "Cloud Pro",
};

const tierBadgeColor: Record<BotTier, string> = {
  free: "bg-muted text-muted-foreground",
  cloud: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "cloud-pro": "bg-purple-500/15 text-purple-700 dark:text-purple-400",
};

const invoiceStatusColor: Record<string, string> = {
  paid: "bg-green-500/15 text-green-700 dark:text-green-400",
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  overdue: "bg-destructive/15 text-destructive",
};

const paymentMethodIcon: Record<PaymentMethodType, typeof CreditCard> = {
  card: CreditCard,
  crypto: Coins,
  wire: Landmark,
};

const paymentMethodLabel: Record<PaymentMethodType, string> = {
  card: "Card (via Square)",
  crypto: "Cryptocurrency",
  wire: "Wire Transfer",
};

interface Props {
  projectId: string;
  botId: string;
}

export function BotBilling({ projectId, botId }: Props) {
  const utils = api.useUtils();

  const { data: billing, isLoading } = api.bots.getBilling.useQuery(
    { projectId, botId },
    { enabled: !!projectId && !!botId },
  );

  const { data: paymentMethods = [] } = api.bots.listPaymentMethods.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const { data: credits } = api.bots.getCredits.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const upgradeMut = api.bots.upgradePlan.useMutation({
    onSuccess: () => {
      utils.bots.getBilling.invalidate();
      utils.bots.getById.invalidate();
      utils.bots.list.invalidate();
    },
  });

  const addPaymentMethodMut = api.bots.addPaymentMethod.useMutation({
    onSuccess: () => {
      utils.bots.listPaymentMethods.invalidate();
    },
  });

  if (isLoading || !billing) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const currentTier = billing.currentPlan as BotTier;
  const creditBalance = credits?.balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className={tierBadgeColor[currentTier]}
              >
                {tierLabel[currentTier]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Base: ${billing.monthlyBase}/mo
              </span>
            </div>
            <div className="flex gap-2">
              {currentTier !== "cloud" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={upgradeMut.isPending}
                  onClick={() =>
                    upgradeMut.mutate({ projectId, botId, tier: "cloud" })
                  }
                >
                  {currentTier === "cloud-pro" ? "Downgrade to" : "Upgrade to"}{" "}
                  Cloud
                </Button>
              )}
              {currentTier !== "cloud-pro" && (
                <Button
                  size="sm"
                  disabled={upgradeMut.isPending}
                  onClick={() =>
                    upgradeMut.mutate({
                      projectId,
                      botId,
                      tier: "cloud-pro",
                    })
                  }
                >
                  Upgrade to Cloud Pro
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods — Hanzo Commerce (Square, Crypto, Wire) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Methods</CardTitle>
          <CardDescription>
            Powered by Hanzo Commerce. Cards processed via Square.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment method on file. Add one to enable cloud plans.
              </p>
            ) : (
              paymentMethods.map((pm) => {
                const Icon = paymentMethodIcon[pm.type];
                return (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {paymentMethodLabel[pm.type]}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pm.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={addPaymentMethodMut.isPending}
                onClick={() =>
                  addPaymentMethodMut.mutate({ projectId, type: "card" })
                }
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Add Card
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={addPaymentMethodMut.isPending}
                onClick={() =>
                  addPaymentMethodMut.mutate({ projectId, type: "crypto" })
                }
              >
                <Coins className="mr-2 h-4 w-4" />
                Pay with Crypto
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={addPaymentMethodMut.isPending}
                onClick={() =>
                  addPaymentMethodMut.mutate({ projectId, type: "wire" })
                }
              >
                <Landmark className="mr-2 h-4 w-4" />
                Wire Transfer
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              We accept Visa, Mastercard, Amex, and Discover via Square. Crypto
              payments (BTC, ETH, SOL, USDC) are credited instantly. Wire
              transfers are processed manually within 1-2 business days.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">
                {billing.usage.messages.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Messages</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {billing.usage.tokens.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Tokens</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                ${billing.usage.cost.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Usage Cost</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billing.invoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No invoices yet.
                  </TableCell>
                </TableRow>
              ) : (
                billing.invoices.map((inv) => {
                  const methodType = (inv as { paymentMethod?: string }).paymentMethod ?? "card";
                  const MethodIcon = paymentMethodIcon[methodType as PaymentMethodType] ?? CreditCard;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(inv.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs capitalize text-muted-foreground">
                            {methodType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            invoiceStatusColor[inv.status] ?? ""
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${inv.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credits & Balance</CardTitle>
          <CardDescription>
            Credits from crypto payments, promotions, or referrals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">${creditBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                Available credit balance
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={addPaymentMethodMut.isPending}
              onClick={() =>
                addPaymentMethodMut.mutate({ projectId, type: "crypto" })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Credits
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
