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
import { Label } from "@hanzo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { useCreateCollection } from "@/src/features/vector/hooks";
import { Plus } from "lucide-react";

export function CreateCollectionDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dimension, setDimension] = useState("1536");
  const [distanceMetric, setDistanceMetric] = useState<"cosine" | "euclidean" | "dotProduct">("cosine");
  const createCollection = useCreateCollection();

  const handleSubmit = () => {
    if (!name.trim()) return;

    const dim = parseInt(dimension, 10);
    if (isNaN(dim) || dim < 1 || dim > 4096) return;

    createCollection.mutate(
      { projectId, name: name.trim(), dimension: dim, distanceMetric },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDimension("1536");
          setDistanceMetric("cosine");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Vector Collection</DialogTitle>
          <DialogDescription>Create a new collection to store vector embeddings.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="collection-name">Collection Name</Label>
            <Input
              id="collection-name"
              placeholder="my-embeddings"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dimension">Dimension</Label>
            <Input
              id="dimension"
              type="number"
              placeholder="1536"
              min={1}
              max={4096}
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must match your embedding model output (e.g., 1536 for OpenAI text-embedding-3-small).
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="distance-metric">Distance Metric</Label>
            <Select value={distanceMetric} onValueChange={(v) => setDistanceMetric(v as typeof distanceMetric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cosine">Cosine</SelectItem>
                <SelectItem value="euclidean">Euclidean</SelectItem>
                <SelectItem value="dotProduct">Dot Product</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createCollection.isPending}>
            {createCollection.isPending ? "Creating..." : "Create Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
