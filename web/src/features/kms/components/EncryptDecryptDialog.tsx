import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Textarea } from "@/src/components/ui/textarea";
import { api } from "@/src/utils/api";

export function EncryptDecryptDialog({
  projectId,
  keyId,
  keyName,
  open,
  onOpenChange,
}: {
  projectId: string;
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [plaintext, setPlaintext] = useState("");
  const [ciphertext, setCiphertext] = useState("");

  const encryptMutation = api.kms.encrypt.useMutation();
  const decryptMutation = api.kms.decrypt.useMutation();

  const handleEncrypt = () => {
    encryptMutation.mutate(
      {
        projectId,
        keyId,
        plaintext: btoa(plaintext),
      },
      {
        onSuccess: (data) => {
          setCiphertext(data.ciphertext);
        },
      },
    );
  };

  const handleDecrypt = () => {
    decryptMutation.mutate(
      {
        projectId,
        keyId,
        ciphertext,
      },
      {
        onSuccess: (data) => {
          setPlaintext(atob(data.plaintext));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Encrypt / Decrypt: {keyName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Plaintext</label>
            <Textarea
              placeholder="Enter plaintext..."
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={handleEncrypt}
              disabled={!plaintext || encryptMutation.isPending}
            >
              {encryptMutation.isPending ? "Encrypting..." : "Encrypt"}
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Ciphertext (base64)
            </label>
            <Textarea
              placeholder="Ciphertext will appear here..."
              value={ciphertext}
              onChange={(e) => setCiphertext(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={handleDecrypt}
              disabled={!ciphertext || decryptMutation.isPending}
            >
              {decryptMutation.isPending ? "Decrypting..." : "Decrypt"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
