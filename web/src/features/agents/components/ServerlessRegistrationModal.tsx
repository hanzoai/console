import { useState } from 'react';
import { Button } from '@/src/features/agents/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/features/agents/components/ui/dialog';
import { Input } from '@/src/features/agents/components/ui/input';
import { Label } from '@/src/features/agents/components/ui/label';
import { Alert, AlertDescription } from '@/src/features/agents/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Server } from '@/src/features/agents/components/ui/icon-bridge';
import { registerServerlessAgent } from '@/src/features/agents/services/api';

interface ServerlessRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (nodeId: string) => void;
}

export function ServerlessRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
}: ServerlessRegistrationModalProps) {
  const [invocationUrl, setInvocationUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    nodeId: string;
    version: string;
    reasonersCount: number;
    skillsCount: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate URL
    if (!invocationUrl.trim()) {
      setError('Invocation URL is required');
      return;
    }

    // Basic URL validation
    try {
      new URL(invocationUrl);
    } catch {
      setError('Please enter a valid URL (e.g., https://xxx.lambda-url.us-east-1.on.aws)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await registerServerlessAgent(invocationUrl);

      if (response.success) {
        setSuccess({
          nodeId: response.node.id,
          version: response.node.version,
          reasonersCount: response.node.reasoners_count,
          skillsCount: response.node.skills_count,
        });

        // Call success callback after a short delay to show success message
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(response.node.id);
          }
          handleClose();
        }, 2000);
      } else {
        setError('Registration failed. Please check the URL and try again.');
      }
    } catch (err: any) {
      console.error('Failed to register serverless agent:', err);
      setError(err.message || 'Failed to register serverless agent. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setInvocationUrl('');
    setError(null);
    setSuccess(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Register Remote Agent
          </DialogTitle>
          <DialogDescription>
            Enter the URL where your agent is deployed. The system will automatically discover its capabilities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invocation-url">
                Invocation URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="invocation-url"
                type="url"
                placeholder="https://your-agent-url.com"
                value={invocationUrl}
                onChange={(e) => setInvocationUrl(e.target.value)}
                disabled={isLoading || !!success}
                className="font-mono text-sm"
              />
              <p className="text-body-small">
                The URL where your remote agent is deployed
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <div className="font-semibold mb-1">Successfully registered!</div>
                  <div className="text-sm space-y-1">
                    <div>Agent ID: <span className="font-mono">{success.nodeId}</span></div>
                    <div>Version: {success.version}</div>
                    <div>Reasoners: {success.reasonersCount} | Skills: {success.skillsCount}</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg bg-muted p-3 border">
              <div className="flex items-start gap-2">
                <Server className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-body-small">
                  <div className="font-semibold mb-1">Automatic Discovery</div>
                  <div>The system will call your agent's <code className="bg-muted-foreground/10 px-1 rounded">/discover</code> endpoint to automatically detect all reasoners and skills.</div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !!success}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discovering...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Registered
                </>
              ) : (
                <>
                  <Server className="mr-2 h-4 w-4" />
                  Register
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
