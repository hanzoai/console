import { Code, User } from '@/src/features/agents/components/ui/icon-bridge';
import { useMode } from '../contexts/ModeContext';

export function ModeToggle() {
  const { mode, toggleMode } = useMode();

  return (
    <div className="flex items-center gap-2">
      <span className="text-body hidden sm:inline">Mode:</span>
      <button
        onClick={toggleMode}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-secondary bg-bg-tertiary hover:bg-bg-elevated transition-colors duration-200"
        title={`Switch to ${mode === 'developer' ? 'user' : 'developer'} mode`}
      >
        {mode === 'developer' ? (
          <>
            <Code className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400 hidden sm:inline">Developer</span>
          </>
        ) : (
          <>
            <User className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium text-green-400 hidden sm:inline">User</span>
          </>
        )}
      </button>
    </div>
  );
}
