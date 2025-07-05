import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/server/api/client';
import { useOrganization } from '@/features/organization/hooks/useOrganization';

const AVAILABLE_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' },
  { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral' },
];

export function RouterOnboarding({ onComplete }: { onComplete: () => void }) {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState('100');
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-3.5-turbo', 'gpt-4']);

  const handleModelToggle = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleSetup = async () => {
    if (!organization) return;

    setLoading(true);
    try {
      // Initialize Router for the organization
      await api.post(`/api/router-integration/organizations/${organization.id}/initialize`, {
        name: organization.name,
        allowedModels: selectedModels,
        monthlyBudget: parseFloat(monthlyBudget),
      });

      // Create first API key for the user
      const keyResponse = await api.post('/api/router-integration/keys', {
        organizationId: organization.id,
        userId: organization.currentUserId,
        keyAlias: 'Default API Key',
        permissions: {
          models: selectedModels,
        },
      });

      toast({
        title: 'Router Setup Complete',
        description: 'Your Hanzo Router is ready to use!',
      });

      // Store the API key securely for the user
      localStorage.setItem('hanzo-router-key', keyResponse.data.key);
      
      onComplete();
    } catch (error) {
      toast({
        title: 'Setup Failed',
        description: 'Failed to initialize Router. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Set Up Hanzo Router</CardTitle>
        <CardDescription>
          Configure your AI router to access 100+ LLM providers through a single API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-3">
          <Label>Select Models</Label>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_MODELS.map(model => (
              <div key={model.id} className="flex items-center space-x-2">
                <Checkbox
                  id={model.id}
                  checked={selectedModels.includes(model.id)}
                  onCheckedChange={() => handleModelToggle(model.id)}
                />
                <label
                  htmlFor={model.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {model.name}
                  <span className="text-xs text-muted-foreground ml-1">({model.provider})</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Configuration */}
        <div className="space-y-2">
          <Label htmlFor="budget">Monthly Budget (USD)</Label>
          <Input
            id="budget"
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            placeholder="100"
            min="0"
            step="10"
          />
          <p className="text-xs text-muted-foreground">
            Set a monthly spending limit for API usage
          </p>
        </div>

        {/* Features */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">Included Features</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Automatic observability with Langfuse</li>
            <li>✓ Usage tracking per API key</li>
            <li>✓ Load balancing & fallbacks</li>
            <li>✓ MCP (Model Context Protocol) support</li>
            <li>✓ Real-time cost monitoring</li>
          </ul>
        </div>

        <Button
          onClick={handleSetup}
          disabled={loading || selectedModels.length === 0}
          className="w-full"
        >
          {loading ? 'Setting up...' : 'Complete Setup'}
        </Button>
      </CardContent>
    </Card>
  );
}