import type { ReasonerStatus } from '../../types/reasoners';

interface StatusIndicatorProps {
  status: ReasonerStatus;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ status, showText = true, size = 'md' }: StatusIndicatorProps) {
  const getStatusConfig = (status: ReasonerStatus) => {
    switch (status) {
      case 'online':
        return {
          label: 'Online',
          dot: 'bg-status-success',
          text: 'text-status-success-light',
          chip: 'bg-status-success-bg border-status-success-border'
        };
      case 'degraded':
        return {
          label: 'Limited',
          dot: 'bg-status-warning',
          text: 'text-status-warning-light',
          chip: 'bg-status-warning-bg border-status-warning-border'
        };
      case 'offline':
        return {
          label: 'Offline',
          dot: 'bg-status-neutral',
          text: 'text-status-neutral-light',
          chip: 'bg-status-neutral-bg border-status-neutral-border'
        };
      case 'unknown':
      default:
        return {
          label: 'Unknown',
          dot: 'bg-status-neutral',
          text: 'text-status-neutral-light',
          chip: 'bg-status-neutral-bg border-status-neutral-border'
        };
    }
  };

  const getSizeConfig = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return {
          dot: 'w-2 h-2',
          text: 'text-xs',
          gap: 'gap-1.5'
        };
      case 'lg':
        return {
          dot: 'w-3 h-3',
          text: 'text-sm',
          gap: 'gap-2'
        };
      case 'md':
      default:
        return {
          dot: 'w-2.5 h-2.5',
          text: 'text-xs',
          gap: 'gap-2'
        };
    }
  };

  const statusConfig = getStatusConfig(status);
  const sizeConfig = getSizeConfig(size);

  if (!showText) {
    return (
      <div className={`${sizeConfig.dot} ${statusConfig.dot} rounded-full flex-shrink-0`} />
    );
  }

  return (
    <div className={`inline-flex items-center ${sizeConfig.gap} px-2 py-1 rounded-full border ${statusConfig.chip}`}>
      <div className={`${sizeConfig.dot} ${statusConfig.dot} rounded-full flex-shrink-0`} />
      <span className={`${sizeConfig.text} font-medium ${statusConfig.text}`}>
        {statusConfig.label}
      </span>
    </div>
  );
}
