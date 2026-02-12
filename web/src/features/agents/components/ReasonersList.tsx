import React from 'react';
import type { ReasonerDefinition } from '../types/agents';
import { Badge } from '@/src/features/agents/components/ui/badge';
import { WatsonxAi } from '@/src/features/agents/components/ui/icon-bridge';

interface ReasonersListProps {
  reasoners: ReasonerDefinition[];
}

const ReasonersList: React.FC<ReasonersListProps> = ({ reasoners }) => {
  if (!reasoners || reasoners.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <WatsonxAi className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Reasoners (0)</h4>
        </div>
        <p className="text-body-small">No reasoners available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <WatsonxAi className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Reasoners ({reasoners.length})</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {reasoners.map((reasoner) => (
          <div
            key={reasoner.id}
            className="min-w-[140px] rounded-lg border border-border-secondary bg-card px-3 py-2"
          >
            <div className="text-xs font-medium text-text-primary">
              {reasoner.id}
            </div>
            {reasoner.tags && reasoner.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {reasoner.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={`${reasoner.id}-${tag}`}
                    variant="outline"
                    className="text-[10px] bg-background text-text-tertiary border-border-secondary"
                  >
                    #{tag}
                  </Badge>
                ))}
                {reasoner.tags.length > 3 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-background text-text-quaternary border-border-secondary"
                  >
                    +{reasoner.tags.length - 3}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-text-tertiary">No tags</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReasonersList;
