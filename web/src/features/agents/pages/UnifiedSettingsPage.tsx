import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "../adapters";
import { ObservabilityWebhookSettingsPage } from "./ObservabilityWebhookSettingsPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/features/agents/components/ui/tabs";
import { Button } from "@/src/features/agents/components/ui/button";
import { Input } from "@/src/features/agents/components/ui/input";
import { Label } from "@/src/features/agents/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/features/agents/components/ui/card";
import { CheckCircle, Terminal, Cloud, Settings, Copy } from "@/src/features/agents/components/ui/icon-bridge";

/**
 * Gateway tab — the connect-to-local-bot flow.
 * Primary action: run locally + tunnel, with connection URL input.
 */
function GatewayTab() {
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!gatewayUrl.trim()) return;
    setConnecting(true);
    // Simulate connection attempt
    setTimeout(() => {
      setConnected(true);
      setConnecting(false);
    }, 1500);
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
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connect via URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Connect Gateway
            </CardTitle>
            <CardDescription>Enter your bot gateway tunnel URL to connect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gateway-url">Gateway URL</Label>
              <Input
                id="gateway-url"
                type="url"
                placeholder="https://your-bot.trycloudflare.com"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Use a Cloudflare tunnel URL or your custom domain</p>
            </div>

            <Button onClick={handleConnect} disabled={!gatewayUrl.trim() || connecting} className="w-full">
              {connecting ? (
                "Connecting..."
              ) : connected ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Connected
                </>
              ) : (
                "Connect"
              )}
            </Button>

            {connected && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <p className="text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Gateway connected successfully
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CLI Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Run Locally
            </CardTitle>
            <CardDescription>Install the CLI and run a bot gateway on your machine</CardDescription>
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
            <p className="text-xs text-muted-foreground pt-2">
              After running, your bot will automatically connect to this dashboard via a Cloudflare tunnel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Space tab — placeholder for space-level settings.
 */
function SpaceTab() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Space Configuration</CardTitle>
            <CardDescription>Manage your workspace settings, members, and platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="space-name">Space Name</Label>
              <Input id="space-name" placeholder="My Workspace" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="space-description">Description</Label>
              <Input id="space-description" placeholder="Optional description" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage who has access to this space</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No members added yet. Invite team members to collaborate.</p>
            <Button variant="outline" className="mt-4">
              Invite Members
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Unified Settings Page with tabbed navigation.
 * Three tabs: Gateway | Space | Webhooks
 * Default: Gateway tab (most common action).
 */
export function UnifiedSettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial tab from URL
  const getTabFromPath = (pathname: string) => {
    if (pathname.includes("/settings/webhooks") || pathname.includes("/settings/observability-webhook")) {
      return "webhooks";
    }
    if (pathname.includes("/settings/space")) {
      return "space";
    }
    return "gateway";
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    switch (value) {
      case "gateway":
        navigate("/settings", { replace: true });
        break;
      case "space":
        navigate("/settings/space", { replace: true });
        break;
      case "webhooks":
        navigate("/settings/webhooks", { replace: true });
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Gateway connection, space configuration, and webhooks</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList variant="underline">
          <TabsTrigger value="gateway" variant="underline">
            Gateway
          </TabsTrigger>
          <TabsTrigger value="space" variant="underline">
            Space
          </TabsTrigger>
          <TabsTrigger value="webhooks" variant="underline">
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gateway">
          <GatewayTab />
        </TabsContent>

        <TabsContent value="space">
          <SpaceTab />
        </TabsContent>

        <TabsContent value="webhooks">
          <ObservabilityWebhookSettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
