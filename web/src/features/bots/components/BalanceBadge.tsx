import { Badge } from "@/src/components/ui/badge";

interface Props {
  availableCents: number;
  loading?: boolean;
}

export function BalanceBadge({ availableCents, loading }: Props) {
  if (loading) {
    return (
      <Badge variant="outline" className="text-xs font-mono">
        ...
      </Badge>
    );
  }

  const hasCredit = availableCents > 0;
  const dollars = (availableCents / 100).toFixed(2);

  return (
    <Badge
      variant={hasCredit ? "outline" : "destructive"}
      className="text-xs font-mono"
    >
      {hasCredit ? `$${dollars} available` : "No credits"}
    </Badge>
  );
}
