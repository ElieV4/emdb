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

  onModuleDestroy() {
    return prisma.$disconnect();
  }
}
