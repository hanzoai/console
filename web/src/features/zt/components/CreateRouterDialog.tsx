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
import { useCreateZtRouter } from "@/src/features/zt/hooks";
import { PlusIcon } from "lucide-react";

export function CreateRouterDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState(0);
  const [isTunnelerEnabled, setIsTunnelerEnabled] = useState(true);
  const [noTraversal, setNoTraversal] = useState(false);
  const [roleAttributes, setRoleAttributes] = useState("");

  const createRouter = useCreateZtRouter();

  const resetForm = () => {
    setName("");
    setCost(0);
    setIsTunnelerEnabled(true);
    setNoTraversal(false);
    setRoleAttributes("");
  };

  const handleSubmit = () => {
    const attrs = roleAttributes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    createRouter.mutate(
      {
        projectId,
        name,
        cost,
        isTunnelerEnabled,
        noTraversal,
        roleAttributes: attrs.length > 0 ? attrs : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          Add Router
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Router</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="edge-router-01"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Cost</label>
            <Input
              type="number"
              min={0}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tunneler"
              checked={isTunnelerEnabled}
              onCheckedChange={(checked) =>
                setIsTunnelerEnabled(checked === true)
              }
            />
            <label htmlFor="tunneler" className="text-sm font-medium">
              Tunneler Enabled
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="noTraversal"
              checked={noTraversal}
              onCheckedChange={(checked) => setNoTraversal(checked === true)}
            />
            <label htmlFor="noTraversal" className="text-sm font-medium">
              No Traversal
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Role Attributes (comma-separated)
            </label>
            <Input
              placeholder="public, us-east"
              value={roleAttributes}
              onChange={(e) => setRoleAttributes(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!name || createRouter.isPending}
          >
            {createRouter.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
