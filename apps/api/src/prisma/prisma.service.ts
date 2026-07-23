import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@emdb/db';

/**
 * Service NestJS qui enveloppe le singleton Prisma partagé (@emdb/db).
 *
 * Le singleton `prisma` est réexporté depuis @emdb/db pour éviter d'ouvrir
 * plusieurs pools de connexions Postgres. Ce service expose le client Prisma
 * directement (via `this.prisma`) ainsi que les delegates model (ex: `this.users`)
 * pour un accès pratique dans les services métier.
 *
 * @see packages/db/index.ts
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  // Expose le client Prisma complet pour accéder à toutes les models
  // et aux méthodes $queryRaw / $executeRaw / $transaction.
  protected readonly prisma = prisma;

  // Delegates model pour un accès pratique (ex: this.prisma.users.findUnique)
  users = prisma.users;
  titles = prisma.titles;
  title_genres = prisma.title_genres;
  title_countries = prisma.title_countries;
  title_studios = prisma.title_studios;
  title_recommendations = prisma.title_recommendations;
  credits = prisma.credits;
  roles = prisma.roles;
  seasons = prisma.seasons;
  episodes = prisma.episodes;
  people = prisma.people;
  person_recommendations = prisma.person_recommendations;
  genres = prisma.genres;
  countries = prisma.countries;
  studios = prisma.studios;
  user_ratings = prisma.user_ratings;
  user_watches = prisma.user_watches;
  list_items = prisma.list_items;
  user_lists = prisma.user_lists;
  list_shares = prisma.list_shares;
  user_follows_serie = prisma.user_follows_serie;
  notifications = prisma.notifications;

  /**
   * Exécute une requête SQL brute via Prisma.
   * Utile pour les appels aux vues matérialisées, fonctions PL/pgSQL,
   * et tout ce qui n'est pas modélisé dans le schéma Prisma.
   *
   * @param sql - Requête SQL avec paramètres
   * @param params - Paramètres optionnels (préparés)
   * @returns Résultat de la requête
   */
  async $queryRawUnsafe<T = any>(sql: string, ...params: any[]): Promise<T> {
    return prisma.$queryRawUnsafe<T>(sql, ...params);
  }

  /**
   * Exécute une commande SQL brute (INSERT/UPDATE/DELETE) via Prisma.
   *
   * @param sql - Requête SQL avec paramètres
   * @param params - Paramètres optionnels
   * @returns Nombre de lignes affectées
   */
  async $executeRawUnsafe(sql: string, ...params: any[]): Promise<number> {
    return prisma.$executeRawUnsafe(sql, ...params);
  }

  /**
   * Exécute un tableau d'opérations dans une transaction Prisma.
   * Utile pour les mises à jour atomiques (ex: réordonnancement batch).
   *
   * @param operations - Tableau de promesses Prisma
   * @returns Les résultats des opérations
   */
  async $transaction(operations: any): Promise<any> {
    return prisma.$transaction(operations);
  }

  onModuleDestroy() {
    return prisma.$disconnect();
  }
}
