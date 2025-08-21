import { Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const themes = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
    },
    {
      value: "dark", 
      label: "Dark",
      icon: Moon,
    },
    {
      value: "system",
      label: "System",
      icon: Monitor,
    },
  ] as const

  const currentThemeIcon = themes.find(t => t.value === theme)?.icon || Monitor

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          {currentThemeIcon === Sun && <Sun className="h-4 w-4" />}
          {currentThemeIcon === Moon && <Moon className="h-4 w-4" />}
          {currentThemeIcon === Monitor && <Monitor className="h-4 w-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>Choose theme</DialogTitle>
          <DialogDescription>
            Select the theme for the application.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon
            return (
              <Button
                key={themeOption.value}
                variant={theme === themeOption.value ? "default" : "ghost"}
                className="justify-start"
                onClick={() => {
                  setTheme(themeOption.value)
                  setOpen(false)
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {themeOption.label}
                {themeOption.value === "system" && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Auto
                  </span>
                )}
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
