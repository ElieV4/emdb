/**
 * Footer minimal de l’application.
 */

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} eMDB — Tous droits réservés
      </div>
    </footer>
  );
}
