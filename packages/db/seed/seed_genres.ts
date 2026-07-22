/**
 * Seed script pour les genres TMDB
 * Récupère la liste dynamiquement depuis l'API TMDB (avec fallback statique)
 * Idempotent : ne duplique pas les genres existants (basé sur tmdb_id)
 */

import { PrismaClient } from '@prisma/client';

// Configuration TMDB (lue depuis les variables d'environnement)
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

// Liste statique de fallback (au cas où l'API échoue ou si TMDB_API_KEY n'est pas configuré)
const FALLBACK_GENRES = [
  // Genres films TMDB
  { tmdb_id: 28, nom: 'Action' },
  { tmdb_id: 12, nom: 'Aventure' },
  { tmdb_id: 16, nom: 'Animation' },
  { tmdb_id: 35, nom: 'Comédie' },
  { tmdb_id: 80, nom: 'Crime' },
  { tmdb_id: 99, nom: 'Documentaire' },
  { tmdb_id: 18, nom: 'Drame' },
  { tmdb_id: 10751, nom: 'Famille' },
  { tmdb_id: 14, nom: 'Fantastique' },
  { tmdb_id: 36, nom: 'Histoire' },
  { tmdb_id: 27, nom: 'Horreur' },
  { tmdb_id: 10402, nom: 'Musique' },
  { tmdb_id: 9648, nom: 'Mystère' },
  { tmdb_id: 10749, nom: 'Romance' },
  { tmdb_id: 878, nom: 'Science-Fiction' },
  { tmdb_id: 10770, nom: 'Téléfilm' },
  { tmdb_id: 53, nom: 'Thriller' },
  { tmdb_id: 10752, nom: 'Guerre' },
  { tmdb_id: 37, nom: 'Western' },
  // Genres séries TMDB spécifiques
  { tmdb_id: 10759, nom: 'Action & Aventure' },
  { tmdb_id: 10762, nom: 'Jeunesse' },
  { tmdb_id: 10763, nom: 'Journal télévisé' },
  { tmdb_id: 10764, nom: 'Télé-réalité' },
  { tmdb_id: 10765, nom: 'Science-Fiction & Fantastique' },
  { tmdb_id: 10766, nom: 'Soap' },
  { tmdb_id: 10767, nom: 'Talk Show' },
  { tmdb_id: 10768, nom: 'Guerre & Politique' },
];

// Type pour les genres TMDB
interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbGenreList {
  genres: TmdbGenre[];
}

// Fonction pour récupérer les genres depuis l'API TMDB
async function fetchTmdbGenres(type: 'movie' | 'tv'): Promise<TmdbGenre[]> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY non définie dans les variables d'environnement");
  }

  const url = `${TMDB_BASE_URL}/genre/${type}/list?language=fr-FR&api_key=${TMDB_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Échec de la récupération des genres ${type}: ${response.status} ${response.statusText}\n${JSON.stringify(errorData)}`,
    );
  }

  const data: TmdbGenreList = await response.json();
  return data.genres;
}

async function main() {
  console.log('[seed_genres] Début du seed des genres...');

  const prisma = new PrismaClient();
  let allGenres: Array<{ tmdb_id: number; nom: string }> = [];

  try {
    // Récupérer les genres depuis l'API TMDB
    console.log('[seed_genres] → Récupération depuis API TMDB...');
    const movieGenres = await fetchTmdbGenres('movie');
    const tvGenres = await fetchTmdbGenres('tv');

    // Fusionner et dédupliquer par tmdb_id (certains genres existent pour films ET séries)
    const mergedGenres = [...movieGenres, ...tvGenres];
    const seenIds = new Set<number>();
    allGenres = mergedGenres
      .filter((genre) => {
        if (seenIds.has(genre.id)) {
          return false;
        }
        seenIds.add(genre.id);
        return true;
      })
      .map((g) => ({ tmdb_id: g.id, nom: g.name }));

    console.log(`  ✓ ${allGenres.length} genres récupérés depuis l'API TMDB.`);
  } catch (error) {
    console.warn(`  ⚠ Impossible de récupérer les genres depuis TMDB: ${error}`);
    console.log('  → Utilisation de la liste de fallback...');
    // Utiliser la liste statique comme fallback
    allGenres = FALLBACK_GENRES.map((g) => ({ tmdb_id: g.tmdb_id, nom: g.nom }));
  }

  try {
    // Insertion idempotente en base
    let insertedCount = 0;
    let skippedCount = 0;

    for (const genre of allGenres) {
      const existing = await prisma.genres.findUnique({
        where: { tmdb_id: genre.tmdb_id },
      });

      if (!existing) {
        await prisma.genres.create({
          data: {
            id: crypto.randomUUID(),
            nom: genre.nom,
            tmdb_id: genre.tmdb_id,
          },
        });
        insertedCount++;
        console.log(`  + ${genre.nom} (tmdb_id: ${genre.tmdb_id})`);
      } else {
        skippedCount++;
      }
    }

    console.log(
      `[seed_genres] Terminé: ${insertedCount} genres insérés, ${skippedCount} déjà présents.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('[seed_genres] Erreur:', e);
  process.exit(1);
});
