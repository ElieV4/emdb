/**
 * Page 404 globale.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-4">
      <h2 className="text-2xl font-semibold">Page introuvable</h2>
      <p className="text-muted-foreground">
        La page que vous cherchez n&apos;existe pas.
      </p>
      <Link href="/" className="underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
