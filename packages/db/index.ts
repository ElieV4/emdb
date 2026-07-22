import { PrismaClient } from '@prisma/client';

// Singleton : évite d'ouvrir une nouvelle pool de connexions Postgres
// à chaque import de @emdb/db dans apps/api ou apps/worker.
export const prisma = new PrismaClient();

// Réexporte les types générés par Prisma (Title, User, etc.) pour que
// apps/api et apps/worker puissent les importer directement depuis @emdb/db.
export * from '@prisma/client';
