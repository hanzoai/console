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
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useCreateZtIdentity } from "@/src/features/zt/hooks";
import { PlusIcon } from "lucide-react";

export function CreateIdentityDialog({
  projectId,
}: {
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"Device" | "User" | "Service" | "Router">(
    "Device",
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleAttributesRaw, setRoleAttributesRaw] = useState("");

  const createIdentity = useCreateZtIdentity();

  const handleSubmit = () => {
    const roleAttributes = roleAttributesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    createIdentity.mutate(
      {
        projectId,
        name,
        type,
        isAdmin,
        roleAttributes: roleAttributes.length > 0 ? roleAttributes : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setType("Device");
          setIsAdmin(false);
          setRoleAttributesRaw("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          Add Identity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Identity</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="my-identity"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Device">Device</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="Router">Router</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isAdmin"
              checked={isAdmin}
              onCheckedChange={(checked) => setIsAdmin(checked === true)}
            />
            <label htmlFor="isAdmin" className="text-sm font-medium">
              Admin
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Role Attributes (comma separated)
            </label>
            <Input
              placeholder="edge, web-servers"
              value={roleAttributesRaw}
              onChange={(e) => setRoleAttributesRaw(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!name || createIdentity.isPending}
          >
            {createIdentity.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
