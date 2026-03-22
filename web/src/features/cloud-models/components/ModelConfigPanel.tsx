import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@hanzo/ui";
import { Slider } from "@/src/components/ui/slider";
import { Skeleton } from "@hanzo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { useModelConfig, useUpdateModelConfig, useCloudModels } from "../hooks";
import { type CloudModel } from "../types";

export function ModelConfigPanel({ projectId }: { projectId: string }) {
  const configQuery = useModelConfig(projectId);
  const modelsQuery = useCloudModels(projectId);
  const updateConfig = useUpdateModelConfig();

  const [defaultModel, setDefaultModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (configQuery.data) {
      setDefaultModel(configQuery.data.defaultModel);
      setTemperature(configQuery.data.temperature);
      setMaxTokens(configQuery.data.maxTokens);
      setIsDirty(false);
    }
  }, [configQuery.data]);

  const models: CloudModel[] = (modelsQuery.data as { data?: CloudModel[] })?.data ?? [];

  const handleSave = () => {
    updateConfig.mutate(
      {
        projectId,
        defaultModel,
        temperature,
        maxTokens,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
        },
      },
    );
  };

  const markDirty = () => setIsDirty(true);

  if (configQuery.isPending || modelsQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Configuration</CardTitle>
        <CardDescription>
          Configure the default model and generation parameters for this project. These settings apply to bot
          conversations and API calls that do not specify a model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Model */}
        <div className="space-y-2">
          <Label htmlFor="default-model">Default Model</Label>
          <Select
            value={defaultModel}
            onValueChange={(value) => {
              setDefaultModel(value);
              markDirty();
            }}
          >
            <SelectTrigger id="default-model">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-mono text-sm">{m.id}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({m.owned_by})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="temperature">Temperature</Label>
            <span className="text-sm text-muted-foreground">{temperature.toFixed(2)}</span>
          </div>
          <Slider
            id="temperature"
            min={0}
            max={2}
            step={0.01}
            value={[temperature]}
            onValueChange={([value]) => {
              if (value !== undefined) {
                setTemperature(value);
                markDirty();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Lower values produce more focused and deterministic output. Higher values produce more creative and varied
            output.
          </p>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <Label htmlFor="max-tokens">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            min={1}
            max={128000}
            value={maxTokens}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              if (!isNaN(parsed)) {
                setMaxTokens(Math.min(128000, Math.max(1, parsed)));
                markDirty();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of tokens to generate in each response (1 - 128,000).
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || updateConfig.isPending}>
            {updateConfig.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
