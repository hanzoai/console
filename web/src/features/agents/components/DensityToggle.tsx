import { Button } from '@/src/features/agents/components/ui/button';
import { View } from '@/src/features/agents/components/ui/icon-bridge';

export type DensityMode = 'compact' | 'comfortable' | 'spacious';

interface DensityToggleProps {
  density: DensityMode;
  onChange: (density: DensityMode) => void;
  className?: string;
}

export function DensityToggle({ density, onChange, className }: DensityToggleProps) {
  const densityOptions: { value: DensityMode; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <View size={16} className="text-muted-foreground" />
      <div className="flex items-center gap-1">
        {densityOptions.map((option) => (
          <Button
            key={option.value}
            variant={density === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(option.value)}
            className="h-7 px-2 text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
