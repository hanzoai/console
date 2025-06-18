{
  /* eslint-disable react/no-unescaped-entities */
}

import { Button } from "@/src/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { HelpCircle, User } from "lucide-react";

const UserExplanation = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 border-gray-800 bg-transparent text-neutral-400 hover:text-[var(--white)]"
        >
          <HelpCircle className="h-4 w-4" />
          What are users?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-gray-800 bg-gray-900 p-4 text-[var(--white)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-neutral-400" />
            <h4 className="text-lg font-medium">Platform Users</h4>
          </div>
          <p className="text-sm text-neutral-300">
            Users are individuals with login credentials to your platform. Each
            user can access the platform's features according to your plan. Team
            plans are billed per user with login access to your workspace.
          </p>
          <p className="text-xs text-neutral-400">
            Note: End-users of your applications don't count toward this limit
            unless they need direct access to the platform.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserExplanation;
