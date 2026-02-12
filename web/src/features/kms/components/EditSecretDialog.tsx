import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { useUpdateSecret } from "@/src/features/kms/hooks";

export function EditSecretDialog({
  projectId,
  environment,
  secretPath = "/",
  secret,
  open,
  onOpenChange,
}: {
  projectId: string;
  environment: string;
  secretPath?: string;
  secret: { secretKey: string; secretValue: string; secretComment?: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [secretValue, setSecretValue] = useState("");
  const [secretComment, setSecretComment] = useState("");

  const updateSecret = useUpdateSecret();

  useEffect(() => {
    if (secret) {
      setSecretValue(secret.secretValue);
      setSecretComment(secret.secretComment ?? "");
    }
  }, [secret]);

  const handleSubmit = () => {
    if (!secret) return;
    updateSecret.mutate(
      {
        projectId,
        environment,
        secretPath,
        secretName: secret.secretKey,
        secretValue,
        secretComment: secretComment || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  if (!secret) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Secret: {secret.secretKey}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Value</label>
            <Textarea
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Comment (optional)
            </label>
            <Input
              value={secretComment}
              onChange={(e) => setSecretComment(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!secretValue || updateSecret.isPending}
          >
            {updateSecret.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
