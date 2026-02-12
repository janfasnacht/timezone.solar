interface FooterProps {
  onOpenHelp: () => void
  onOpenAbout: () => void
  onOpenSettings: () => void
}

export function Footer({ onOpenHelp, onOpenAbout, onOpenSettings }: FooterProps) {
  return (
    <footer className="mt-auto w-full border-t border-border py-3">
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <button
          onClick={onOpenHelp}
          className="transition-colors hover:text-foreground"
        >
          Help
        </button>
        <button
          onClick={onOpenAbout}
          className="transition-colors hover:text-foreground"
        >
          About
        </button>
        <button
          onClick={onOpenSettings}
          className="transition-colors hover:text-foreground"
        >
          Settings
        </button>
      </div>
    </footer>
  )
}
