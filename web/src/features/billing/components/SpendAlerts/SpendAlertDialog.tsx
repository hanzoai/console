interface SpendAlertDialogProps {
  orgId: string;
  alert?: {
    id: string;
    title: string;
    threshold: { toString(): string };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SpendAlertDialog(_props: SpendAlertDialogProps) {
  return null;
}
