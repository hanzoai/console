import { useTheme } from "next-themes"

import { Button } from "@/src/features/agents/components/ui/button"
import { Icon } from "@/src/features/agents/components/ui/icon"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon
        name="sun"
        size={18}
        className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
      />
      <Icon
        name="moon"
        size={18}
        className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
