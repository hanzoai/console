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
import { useCreateIndex } from "@/src/features/search/hooks";
import { Plus } from "lucide-react";

export function CreateIndexDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [url, setUrl] = useState("");
  const createIndex = useCreateIndex();

  const handleSubmit = () => {
    if (!storeName.trim() || !url.trim()) return;

    createIndex.mutate(
      { projectId, storeName: storeName.trim(), url: url.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          setStoreName("");
          setUrl("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Index
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Search Index</DialogTitle>
          <DialogDescription>
            Provide a name for the index and the URL of the first site to scrape and index.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="store-name">Store Name</Label>
            <Input
              id="store-name"
              placeholder="my-docs"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="url">URL to Scrape</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://docs.example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!storeName.trim() || !url.trim() || createIndex.isPending}>
            {createIndex.isPending ? "Creating..." : "Create Index"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
