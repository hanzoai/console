import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Copy, Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/server/api/client';
import { useOrganization } from '@/features/organization/hooks/useOrganization';

interface ApiKey {
  id: string;
  key: string;
  keyId: string;
  alias: string;
  createdAt: string;
  lastUsed?: string;
  userId: string;
  teamId?: string;
  status: 'active' | 'revoked';
}

export function ApiKeyManager() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyAlias, setNewKeyAlias] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, [organization]);

  const fetchKeys = async () => {
    if (!organization) return;
    
    try {
      const response = await api.get(`/api/organizations/${organization.id}/router-keys`);
      setKeys(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch API keys',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!organization || !newKeyAlias.trim()) return;

    setCreatingKey(true);
    try {
      const response = await api.post('/api/router-integration/keys', {
        organizationId: organization.id,
        userId: organization.currentUserId,
        keyAlias: newKeyAlias,
        permissions: {
          models: [], // Will inherit from organization settings
        },
      });

      const newKey: ApiKey = {
        id: response.data.keyId,
        key: response.data.key,
        keyId: response.data.keyId,
        alias: newKeyAlias,
        createdAt: new Date().toISOString(),
        userId: organization.currentUserId,
        status: 'active',
      };

      setKeys([...keys, newKey]);
      setCreateDialogOpen(false);
      setNewKeyAlias('');
      
      // Show the new key
      setShowKey(newKey.id);
      
      toast({
        title: 'API Key Created',
        description: 'Your new API key has been created successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await api.delete(`/api/router-integration/keys/${keyId}`);
      
      setKeys(keys.map(k => 
        k.keyId === keyId ? { ...k, status: 'revoked' as const } : k
      ));
      
      toast({
        title: 'API Key Revoked',
        description: 'The API key has been revoked successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage your Hanzo Router API keys. Each key is automatically linked to your organization.
          </CardDescription>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Key
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No API keys yet. Create your first key to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alias</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.alias}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm">
                        {showKey === key.id ? key.key : maskKey(key.key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                      >
                        {showKey === key.id ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(key.key)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                      {key.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRevokeKey(key.keyId)}
                      disabled={key.status === 'revoked'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for accessing Hanzo Router. This key will be automatically
              linked to your organization and tracked for usage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="alias">Key Alias</Label>
              <Input
                id="alias"
                value={newKeyAlias}
                onChange={(e) => setNewKeyAlias(e.target.value)}
                placeholder="e.g., Production Key"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>This key will have access to:</p>
              <ul className="mt-2 space-y-1">
                <li>• All models enabled for your organization</li>
                <li>• Automatic usage tracking and observability</li>
                <li>• Your organization's rate limits and budget</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyAlias.trim()}>
              {creatingKey ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}