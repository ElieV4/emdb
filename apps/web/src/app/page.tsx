/**
 * Page d’accueil.
 * Suppose l’utilisateur connecté ; les pages d’auth existent déjà.
 * Les données métier seront ajoutées dans les phases suivantes.
 */

"use client";

import Link from "next/link";

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Bienvenue sur eMDB</h1>
      <p className="mt-2 text-muted-foreground">
        Suivi de films et séries, recommandations, dataviz et plus encore.
      </p>
      <div className="mt-6 flex gap-4">
        <Link href="/search" className="underline">
          Rechercher un titre
        </Link>
        <Link href="/calendar" className="underline">
          Mon calendrier
        </Link>
      </div>
    </div>
  );
}
