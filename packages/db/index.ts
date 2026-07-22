import { PrismaClient } from '@prisma/client';

// Singleton : évite d'ouvrir une nouvelle pool de connexions Postgres
// à chaque import de @emdb/db dans apps/api ou apps/worker.
export const prisma = new PrismaClient();

// Réexporte les types générés par Prisma (Title, User, etc.) pour que
// apps/api et apps/worker puissent les importer directement depuis @emdb/db.
export * from '@prisma/client';

// Fonctions PL/pgSQL (Phase 1.3) — à exposer côté API
// Ces fonctions appellent les fonctions PostgreSQL définies dans packages/db/sql/db_init.sql
export * from './src/functions';
