import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service métier pour le module seasons-episodes (Phase 3.5).
 *
 * Gère la lecture des saisons et épisodes (user-agnostic).
 * Les endpoints liés au progrès utilisateur (fn_progress_serie,
 * fn_episodes_non_vus) sont de la Phase 4 (module watches).
 */
@Injectable()
export class SeasonsEpisodesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des saisons d'un titre, triées par numero.
   *
   * @param titleId - UUID du titre
   * @returns Liste des saisons avec le nombre d'épisodes
   * @throws NotFoundException si le titre n'existe pas
   */
  async listSeasons(titleId: string) {
    const title = await this.prisma.titles.findUnique({
      where: { id: titleId },
      select: { id: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    const seasons = await this.prisma.seasons.findMany({
      where: { title_id: titleId },
      orderBy: { numero: 'asc' },
      include: {
        _count: {
          select: { episodes: true },
        },
      },
    });

    return seasons.map((season) => ({
      id: season.id,
      numero: season.numero,
      titre: season.titre,
      date_sortie: season.date_sortie,
      synopsis: season.synopsis,
      nombre_episodes: season._count.episodes,
    }));
  }

  /**
   * Détail d'une saison avec la liste de ses épisodes.
   *
   * @param titleId - UUID du titre
   * @param numero - Numéro de la saison
   * @returns La saison avec ses épisodes
   * @throws NotFoundException si le titre ou la saison n'existe pas
   */
  async getSeason(titleId: string, numero: number) {
    const title = await this.prisma.titles.findUnique({
      where: { id: titleId },
      select: { id: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    const season = await this.prisma.seasons.findUnique({
      where: {
        title_id_numero: { title_id: titleId, numero },
      },
      include: {
        episodes: {
          orderBy: { numero: 'asc' },
          select: {
            id: true,
            numero: true,
            titre: true,
            synopsis: true,
            date_sortie: true,
            duree_minutes: true,
            image_url: true,
          },
        },
      },
    });

    if (!season) {
      throw new NotFoundException('Saison introuvable.');
    }

    return season;
  }

  /**
   * Détail d'un épisode avec les informations de sa saison parente.
   *
   * @param episodeId - UUID de l'épisode
   * @returns L'épisode avec sa saison
   * @throws NotFoundException si l'épisode n'existe pas
   */
  async getEpisode(episodeId: string) {
    const episode = await this.prisma.episodes.findUnique({
      where: { id: episodeId },
      include: {
        seasons: {
          select: {
            id: true,
            numero: true,
            titre: true,
            title_id: true,
          },
        },
      },
    });

    if (!episode) {
      throw new NotFoundException('Épisode introuvable.');
    }

    return episode;
  }

  /**
   * Credits spécifiques à un épisode (guest stars, crew d'épisode).
   *
   * Lit la table credits filtrée par episode_id et les groupe par rôle.
   * Retourne un tableau vide si aucun credit d'épisode n'a été importé
   * (l'import des credits d'épisode est un job séparé, cf. Phase 2).
   *
   * @param episodeId - UUID de l'épisode
   * @returns Credits groupés par rôle
   * @throws NotFoundException si l'épisode n'existe pas
   */
  async getEpisodeCredits(episodeId: string) {
    const episode = await this.prisma.episodes.findUnique({
      where: { id: episodeId },
      select: { id: true },
    });

    if (!episode) {
      throw new NotFoundException('Épisode introuvable.');
    }

    const credits = await this.prisma.credits.findMany({
      where: { episode_id: episodeId },
      include: {
        people: {
          select: {
            id: true,
            tmdb_id: true,
            nom: true,
            photo_url: true,
          },
        },
        roles: {
          select: { code: true, libelle: true },
        },
      },
      orderBy: { ordre: 'asc' },
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
        personne: credit.people,
      });
    }

    return grouped;
  }
}
