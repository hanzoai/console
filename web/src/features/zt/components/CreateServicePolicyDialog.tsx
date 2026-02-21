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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useCreateZtServicePolicy } from "@/src/features/zt/hooks";
import { PlusIcon } from "lucide-react";

function parseRoles(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CreateServicePolicyDialog({
  projectId,
}: {
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"Bind" | "Dial">("Dial");
  const [semantic, setSemantic] = useState<"AllOf" | "AnyOf">("AnyOf");
  const [identityRolesInput, setIdentityRolesInput] = useState("");
  const [serviceRolesInput, setServiceRolesInput] = useState("");

  const createPolicy = useCreateZtServicePolicy();

  const handleSubmit = () => {
    createPolicy.mutate(
      {
        projectId,
        name,
        type,
        semantic,
        identityRoles: parseRoles(identityRolesInput),
        serviceRoles: parseRoles(serviceRolesInput),
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setType("Dial");
          setSemantic("AnyOf");
          setIdentityRolesInput("");
          setServiceRolesInput("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          Create Service Policy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Service Policy</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="my-service-policy"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "Bind" | "Dial")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bind">Bind</SelectItem>
                <SelectItem value="Dial">Dial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Semantic</label>
            <Select
              value={semantic}
              onValueChange={(v) => setSemantic(v as "AllOf" | "AnyOf")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AnyOf">AnyOf</SelectItem>
                <SelectItem value="AllOf">AllOf</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Identity Roles
            </label>
            <Input
              placeholder="#role-attr, @identity-name"
              value={identityRolesInput}
              onChange={(e) => setIdentityRolesInput(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated. Prefix with # for role attributes, @ for identity
              names.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Service Roles
            </label>
            <Input
              placeholder="#role-attr, @service-name"
              value={serviceRolesInput}
              onChange={(e) => setServiceRolesInput(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated. Prefix with # for role attributes, @ for service
              names.
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!name || createPolicy.isPending}
          >
            {createPolicy.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
