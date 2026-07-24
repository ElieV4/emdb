import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { searchPerson, TmdbSearchResult } from '@emdb/tmdb-client';
import { importPersonByTmdbId, refreshPersonData, bootstrapPersonRecommendationsFromTmdb } from '@emdb/tmdb-sync';

/**
 * Interface pour le résultat fusionné d'une recherche TMDB + local.
 */
export interface PersonSearchResult {
  tmdb_id: number;
  nom: string;
  photo_url: string | null;
  local: boolean;
  local_id?: string;
}

/**
 * Service métier pour le module people (Phase 3.4).
 *
 * Gère la recherche (TMDB + local), l'import "get or import", le détail
 * complet d'une personne, sa filmographie, ses recommandations et le
 * rafraîchissement périodique depuis TMDB.
 */
@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sélection des champs publics pour une personne.
   */
  private readonly PERSON_PUBLIC_SELECT = {
    id: true,
    tmdb_id: true,
    nom: true,
    genre: true,
    date_naissance: true,
    pays_id: true,
    photo_url: true,
    bio: true,
    wiki_url: true,
    source: true,
    created_at: true,
    countries: {
      select: {
        id: true,
        code: true,
        nom: true,
      },
    },
  } as const;

  /**
   * Recherche une personne via TMDB + résultats locaux, fusionnés.
   *
   * Appelle tmdb-client.searchPerson, puis recherche localement (nom ILIKE).
   * Marque les résultats déjà présents localement via tmdb_id.
   *
   * @param query - Texte de recherche
   * @returns Liste fusionnée de résultats
   */
  async search(query: string): Promise<PersonSearchResult[]> {
    // 1. Appel TMDB
    let tmdbResults: TmdbSearchResult[] = [];
    try {
      tmdbResults = await searchPerson(query);
    } catch {
      // En cas d'échec TMDB (API key manquante, réseau…), on continue
      // avec les seuls résultats locaux.
    }

    // 2. Recherche locale (ILIKE sur nom)
    const localResults = await this.prisma.people.findMany({
      where: {
        nom: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        tmdb_id: true,
        nom: true,
        photo_url: true,
      },
    });

    // 3. Index local par tmdb_id pour le merge
    const localByTmdbId = new Map<number, (typeof localResults)[0]>();
    for (const local of localResults) {
      if (local.tmdb_id) {
        localByTmdbId.set(local.tmdb_id, local);
      }
    }

    // 4. Fusion
    const merged: PersonSearchResult[] = [];
    const seenTmdbIds = new Set<number>();
    const mergedLocalIds = new Set<string>();

    for (const tmdb of tmdbResults) {
      if (seenTmdbIds.has(tmdb.id)) continue;
      seenTmdbIds.add(tmdb.id);

      const local = localByTmdbId.get(tmdb.id);
      if (local) {
        mergedLocalIds.add(local.id);
      }

      merged.push({
        tmdb_id: tmdb.id,
        nom: tmdb.title ?? tmdb.name ?? '',
        photo_url: tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : null,
        local: !!local,
        local_id: local?.id,
      });
    }

    // 5. Ajouter les résultats locaux non encore mergés via TMDB
    // (ceux avec un tmdb_id mais qui n'étaient pas dans les résultats TMDB,
    //  et ceux sans tmdb_id importés manuellement)
    for (const local of localResults) {
      if (mergedLocalIds.has(local.id)) continue;

      merged.push({
        tmdb_id: local.tmdb_id ?? 0,
        nom: local.nom,
        photo_url: local.photo_url,
        local: true,
        local_id: local.id,
      });
    }

    return merged;
  }

  /**
   * "Get or import" : cherche une personne par tmdb_id, sinon déclenche l'import.
   *
   * @param tmdbId - ID TMDB de la personne
   * @returns La personne importée ou existante
   */
  async getOrImportByTmdbId(tmdbId: number) {
    // Validation
    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
      throw new BadRequestException('ID TMDB invalide.');
    }

    const existing = await this.prisma.people.findUnique({
      where: { tmdb_id: tmdbId },
      include: {
        countries: {
          select: { id: true, code: true, nom: true },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Déclenche l'import via tmdb-sync
    return importPersonByTmdbId(tmdbId);
  }

  /**
   * Détail complet d'une personne.
   *
   * @param id - UUID de la personne
   * @returns La personne avec son pays
   * @throws NotFoundException si la personne n'existe pas
   */
  async getById(id: string) {
    const person = await this.prisma.people.findUnique({
      where: { id },
      select: this.PERSON_PUBLIC_SELECT,
    });

    if (!person) {
      throw new NotFoundException('Personne introuvable.');
    }

    return person;
  }

  /**
   * Filmographie d'une personne : jointure credits → titles, groupée par rôle,
   * triée par date de sortie.
   *
   * @param id - UUID de la personne
   * @returns Liste des crédits groupés par rôle
   * @throws NotFoundException si la personne n'existe pas
   */
  async getFilmography(id: string) {
    const person = await this.prisma.people.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException('Personne introuvable.');
    }

    const credits = await this.prisma.credits.findMany({
      where: { person_id: id },
      include: {
        titles: {
          select: {
            id: true,
            tmdb_id: true,
            titre_vo: true,
            titre_vf: true,
            affiche_url: true,
            type: true,
            date_sortie: true,
            note_imdb: true,
          },
        },
        roles: {
          select: { code: true, libelle: true },
        },
      },
      orderBy: {
        ordre: 'asc',
      },
    });

    // Grouper par rôle
    const grouped: Record<string, any[]> = {};

    for (const credit of credits) {
      const roleKey = credit.roles?.libelle ?? 'Autre';

      if (!grouped[roleKey]) {
        grouped[roleKey] = [];
      }

      grouped[roleKey].push({
        id: credit.id,
        personnage: credit.personnage,
        ordre: credit.ordre,
        titre: credit.titles,
        episode_id: credit.episode_id,
      });
    }

    // Trier les titres de chaque groupe par date de sortie (desc)
    for (const role of Object.keys(grouped)) {
      grouped[role].sort((a: any, b: any) => {
        const dateA = a.titre?.date_sortie ? new Date(a.titre.date_sortie).getTime() : 0;
        const dateB = b.titre?.date_sortie ? new Date(b.titre.date_sortie).getTime() : 0;
        return dateB - dateA;
      });
    }

    return grouped;
  }

  /**
   * Recommandations d'une personne.
   *
   * Lit la table person_recommendations. Si aucune recommandation locale n'existe
   * et que la personne a un tmdb_id, déclenche un fallback TMDB via
   * bootstrapPersonRecommendationsFromTmdb.
   *
   * @param id - UUID de la personne
   * @returns Liste de personnes recommandées
   * @throws NotFoundException si la personne n'existe pas
   */
  async getRecommendations(id: string) {
    const person = await this.prisma.people.findUnique({
      where: { id },
      select: { id: true, tmdb_id: true },
    });

    if (!person) {
      throw new NotFoundException('Personne introuvable.');
    }

    // 1. Vérifier les recommandations locales
    const recs = await this.prisma.person_recommendations.findMany({
      where: { person_id: id },
      include: {
        people_person_recommendations_recommended_idTopeople: {
          select: {
            id: true,
            tmdb_id: true,
            nom: true,
            photo_url: true,
            genre: true,
            bio: true,
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    if (recs.length > 0) {
      return recs.map(
        (rec: { people_person_recommendations_recommended_idTopeople: any }) =>
          rec.people_person_recommendations_recommended_idTopeople,
      );
    }

    // 2. Fallback TMDB si pas de recommandations locales
    if (!person.tmdb_id) {
      return [];
    }

    try {
      await bootstrapPersonRecommendationsFromTmdb(id);
    } catch {
      return []; // Silencieux en cas d'échec TMDB
    }

    // 3. Re-lire les recommandations après bootstrap
    const newRecs = await this.prisma.person_recommendations.findMany({
      where: { person_id: id },
      include: {
        people_person_recommendations_recommended_idTopeople: {
          select: {
            id: true,
            tmdb_id: true,
            nom: true,
            photo_url: true,
            genre: true,
            bio: true,
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    return newRecs.map(
      (rec: { people_person_recommendations_recommended_idTopeople: any }) =>
        rec.people_person_recommendations_recommended_idTopeople,
    );
  }

  /**
   * Rafraîchit les données d'une personne depuis TMDB.
   *
   * Appelle tmdb-sync.refreshPersonData (bio, photo, wiki_url, etc.).
   *
   * @param id - UUID de la personne
   * @returns La personne mise à jour
   * @throws NotFoundException si la personne n'existe pas
   * @throws BadRequestException si la personne n'a pas de tmdb_id
   */
  async refresh(id: string) {
    const person = await this.prisma.people.findUnique({
      where: { id },
      select: { id: true, tmdb_id: true },
    });

    if (!person) {
      throw new NotFoundException('Personne introuvable.');
    }

    if (!person.tmdb_id) {
      throw new BadRequestException("La personne n'a pas de tmdb_id, impossible de rafraîchir.");
    }

    return refreshPersonData(id);
  }
}
