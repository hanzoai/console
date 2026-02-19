import { useState } from "react";
import { useNavigate } from "../adapters";
import { Button } from "@/src/features/agents/components/ui/button";
import { Input } from "@/src/features/agents/components/ui/input";
import { Label } from "@/src/features/agents/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/features/agents/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/features/agents/components/ui/collapsible";
import { Bot, Terminal, Cloud, CheckCircle, ChevronRight, Copy } from "@/src/features/agents/components/ui/icon-bridge";
import { cn } from "@/src/features/agents/lib/utils";

type Step = "welcome" | "create-workspace" | "connect-bot";

/**
 * 3-step guided onboarding flow for first-time users.
 * Renders full-screen (outside sidebar layout).
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [spaceName, setSpaceName] = useState("My Workspace");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!spaceName.trim()) return;
    setCreating(true);
    // In a real implementation, this would call spaceApi.create()
    // For now, simulate creation
    setTimeout(() => {
      setCreating(false);
      setStep("connect-bot");
    }, 1000);
  };

  const handleSkip = () => {
    navigate("/playground");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const cliCommands = [
    { label: "install", command: "npm i -g @hanzo/cli" },
    { label: "login", command: "hanzo login" },
    { label: "run", command: "hanzo bot run --space <space-id>" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["welcome", "create-workspace", "connect-bot"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                s === step ? "w-8 bg-primary" : "w-2 bg-muted-foreground/20",
                (["welcome", "create-workspace", "connect-bot"] as Step[]).indexOf(step) > i && "bg-primary/50",
              )}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === "welcome" && (
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                <Bot className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Welcome to Hanzo Bot</h1>
              <p className="text-muted-foreground text-lg">Deploy, monitor, and control AI agents from anywhere</p>
            </div>
            <Button size="lg" className="px-8" onClick={() => setStep("create-workspace")}>
              Get Started
            </Button>
          </div>
        )}

        {/* Step 2: Create workspace */}
        {step === "create-workspace" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Create your workspace</h2>
              <p className="text-muted-foreground">A workspace organizes your bots, executions, and settings</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="space-name">Workspace name</Label>
                  <Input
                    id="space-name"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    placeholder="My Workspace"
                    autoFocus
                  />
                </div>
                <Button className="w-full" onClick={handleCreateWorkspace} disabled={!spaceName.trim() || creating}>
                  {creating ? "Creating..." : "Create Workspace"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Connect your first bot */}
        {step === "connect-bot" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Connect your first bot</h2>
              <p className="text-muted-foreground">Run a bot locally and connect it via a tunnel</p>
            </div>

            {/* Primary path: CLI */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Run locally + tunnel
                </CardTitle>
                <CardDescription>Recommended — fastest way to get started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {cliCommands.map((cmd) => (
                  <div
                    key={cmd.label}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 font-mono text-sm"
                  >
                    <code className="text-foreground">{cmd.command}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => copyToClipboard(cmd.command, cmd.label)}
                    >
                      {copied === cmd.label ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  A Cloudflare tunnel will be created automatically. You can also configure a custom URL in{" "}
                  <button
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => navigate("/settings")}
                  >
                    Gateway Settings
                  </button>
                  .
                </p>
              </CardContent>
            </Card>

            {/* Secondary paths */}
            <Collapsible open={showSecondary} onOpenChange={setShowSecondary}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full">
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform duration-200", showSecondary && "rotate-90")}
                />
                Other deployment options
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      Deploy to cloud
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Deploy a managed bot instance. Coming soon.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      Connect existing node
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Already running a bot? Enter your gateway URL in{" "}
                      <button
                        className="text-primary underline-offset-4 hover:underline"
                        onClick={() => navigate("/settings")}
                      >
                        Settings
                      </button>
                      .
                    </p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* Skip */}
            <div className="text-center">
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                onClick={handleSkip}
              >
                I&apos;ll do this later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
