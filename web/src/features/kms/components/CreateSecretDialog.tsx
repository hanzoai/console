import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { useCreateSecret } from "@/src/features/kms/hooks";
import { PlusIcon } from "lucide-react";

export function CreateSecretDialog({
  projectId,
  environment,
  secretPath = "/",
}: {
  projectId: string;
  environment: string;
  secretPath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [secretComment, setSecretComment] = useState("");

  const createSecret = useCreateSecret();

  const handleSubmit = () => {
    createSecret.mutate(
      {
        projectId,
        environment,
        secretPath,
        secretName,
        secretValue,
        secretComment: secretComment || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setSecretName("");
          setSecretValue("");
          setSecretComment("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          Add Secret
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Secret</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Key</label>
            <Input
              placeholder="SECRET_NAME"
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Value</label>
            <Textarea
              placeholder="secret value"
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
              placeholder="description"
              value={secretComment}
              onChange={(e) => setSecretComment(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!secretName || !secretValue || createSecret.isPending}
          >
            {createSecret.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
