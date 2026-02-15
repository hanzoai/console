import { useState } from "react";
import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

import {
  BOT_CHANNELS,
  BOT_REGIONS,
  BOT_PLATFORM_PRICING,
  BOT_MODELS,
  type BotChannel,
  type BotPlatform,
} from "../types";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BotCreateDialog({ projectId, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<BotPlatform>("linux");
  const [region, setRegion] = useState("us-east-1");
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [step, setStep] = useState<"config" | "review">("config");

  const utils = api.useUtils();
  const createMut = api.bots.create.useMutation({
    onSuccess: () => {
      utils.bots.list.invalidate();
      resetAndClose();
    },
  });

  function resetAndClose() {
    setName("");
    setPlatform("linux");
    setRegion("us-east-1");
    setChannels([]);
    setModels([]);
    setStep("config");
    onOpenChange(false);
  }

  function toggleChannel(ch: BotChannel) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  function toggleModel(m: string) {
    setModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  const monthlyCost = BOT_PLATFORM_PRICING[platform].price;
  const canProceed =
    name.trim().length > 0 && channels.length > 0 && models.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "config" ? "Create Bot" : "Review & Confirm"}
          </DialogTitle>
          <DialogDescription>
            {step === "config"
              ? "Configure your new bot instance."
              : "Review the configuration before provisioning."}
          </DialogDescription>
        </DialogHeader>

        {step === "config" ? (
          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="bot-name">Name</Label>
              <Input
                id="bot-name"
                data-testid="bot-create-name"
                placeholder="My Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
              />
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as BotPlatform)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(BOT_PLATFORM_PRICING) as [
                      BotPlatform,
                      { label: string; price: number },
                    ][]
                  ).map(([key, { label, price }]) => (
                    <SelectItem key={key} value={key}>
                      {label} - ${price}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOT_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channels */}
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="grid grid-cols-2 gap-2">
                {BOT_CHANNELS.map((ch) => (
                  <label
                    key={ch}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm capitalize cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={channels.includes(ch)}
                      onCheckedChange={() => toggleChannel(ch)}
                    />
                    {ch}
                  </label>
                ))}
              </div>
            </div>

            {/* Models */}
            <div className="space-y-2">
              <Label>Models</Label>
              <div className="grid grid-cols-2 gap-2">
                {BOT_MODELS.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm font-mono cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={models.includes(m)}
                      onCheckedChange={() => toggleModel(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{name}</span>

              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium capitalize">{platform}</span>

              <span className="text-muted-foreground">Region</span>
              <span className="font-mono">{region}</span>

              <span className="text-muted-foreground">Channels</span>
              <span className="capitalize">
                {channels.join(", ")}
              </span>

              <span className="text-muted-foreground">Models</span>
              <span className="font-mono text-xs">
                {models.join(", ")}
              </span>
            </div>
            <div className="rounded-md border p-3 bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="font-medium">Estimated Monthly Cost</span>
                <span className="text-lg font-bold">${monthlyCost}/mo</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Base platform cost. Usage-based charges (messages, tokens) billed separately.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "review" && (
            <Button variant="outline" onClick={() => setStep("config")}>
              Back
            </Button>
          )}
          {step === "config" ? (
            <Button data-testid="btn-review-bot" disabled={!canProceed} onClick={() => setStep("review")}>
              Review
            </Button>
          ) : (
            <Button
              data-testid="btn-confirm-create-bot"
              disabled={createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  projectId,
                  name: name.trim(),
                  platform,
                  region,
                  channels,
                  modelsEnabled: models,
                })
              }
            >
              {createMut.isPending ? "Provisioning..." : "Create Bot"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
