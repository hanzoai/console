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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useCreateKey } from "@/src/features/kms/hooks";
import { PlusIcon } from "lucide-react";

export function CreateKeyDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [algorithm, setAlgorithm] = useState<"aes-256-gcm" | "aes-128-gcm">(
    "aes-256-gcm",
  );
  const [usage, setUsage] = useState<"encrypt-decrypt" | "sign-verify">(
    "encrypt-decrypt",
  );

  const createKey = useCreateKey();

  const handleSubmit = () => {
    createKey.mutate(
      {
        projectId,
        name,
        description: description || undefined,
        encryptionAlgorithm: algorithm,
        keyUsage: usage,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
          setAlgorithm("aes-256-gcm");
          setUsage("encrypt-decrypt");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          Create Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Encryption Key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="my-encryption-key"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Description (optional)
            </label>
            <Textarea
              placeholder="Key description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Algorithm</label>
            <Select
              value={algorithm}
              onValueChange={(v) =>
                setAlgorithm(v as "aes-256-gcm" | "aes-128-gcm")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aes-256-gcm">AES-256-GCM</SelectItem>
                <SelectItem value="aes-128-gcm">AES-128-GCM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Key Usage</label>
            <Select
              value={usage}
              onValueChange={(v) =>
                setUsage(v as "encrypt-decrypt" | "sign-verify")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encrypt-decrypt">
                  Encrypt / Decrypt
                </SelectItem>
                <SelectItem value="sign-verify">Sign / Verify</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!name || createKey.isPending}
          >
            {createKey.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
