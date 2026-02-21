import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { useCreateZtService } from "@/src/features/zt/hooks";
import { Plus } from "lucide-react";

export function CreateServiceDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [encryptionRequired, setEncryptionRequired] = useState(true);
  const [roleAttributesInput, setRoleAttributesInput] = useState("");

  const createMut = useCreateZtService();

  const resetForm = () => {
    setName("");
    setEncryptionRequired(true);
    setRoleAttributesInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const roleAttributes = roleAttributesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    createMut.mutate(
      {
        projectId,
        name: name.trim(),
        encryptionRequired,
        roleAttributes,
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Service
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Service</DialogTitle>
            <DialogDescription>
              Add a new ZT service to this project.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="service-name">Name</Label>
              <Input
                id="service-name"
                placeholder="my-service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="encryption-required"
                checked={encryptionRequired}
                onCheckedChange={(checked) =>
                  setEncryptionRequired(checked === true)
                }
              />
              <Label htmlFor="encryption-required">Encryption Required</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role-attributes">Role Attributes</Label>
              <Input
                id="role-attributes"
                placeholder="attr1, attr2, attr3"
                value={roleAttributesInput}
                onChange={(e) => setRoleAttributesInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of role attributes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending || !name.trim()}>
              {createMut.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
