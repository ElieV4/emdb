/**
 * Script pour appliquer les objets SQL "hors Prisma" (triggers, fonctions, vues matérialisées)
 * à exécuter après `prisma migrate deploy` en production.
 * 
 * Source : packages/db/sql/db_init.sql (extrait des objets non gérés par Prisma)
 * 
 * Usage :
 *   npm run apply:raw-sql
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Chemin vers le fichier SQL source
const SQL_FILE_PATH = path.resolve(__dirname, '../sql/db_init.sql');

// Liste des mots-clés pour identifier les objets hors-Prisma
const RAW_OBJECT_KEYWORDS = [
  'CREATE TRIGGER',
  'CREATE OR REPLACE FUNCTION',
  'CREATE MATERIALIZED VIEW',
];

/**
 * Extrait les commandes SQL pour les objets hors-Prisma (triggers, fonctions, vues)
 * depuis le fichier db_init.sql complet.
 */
function extractRawSqlObjects(sqlContent: string): string[] {
  const lines = sqlContent.split('\n');
  const rawObjects: string[] = [];
  let currentObject: string[] = [];
  let inRawObject = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Vérifier si on commence un objet hors-Prisma
    const isRawObjectStart = RAW_OBJECT_KEYWORDS.some(keyword => 
      trimmedLine.startsWith(keyword)
    );

    if (isRawObjectStart) {
      inRawObject = true;
      currentObject = [line];
    } else if (inRawObject) {
      currentObject.push(line);
      
      // Terminer l'objet sur un point-virgule suivi d'une ligne vide ou d'un commentaire
      if (trimmedLine.endsWith(';') && 
          (lines.indexOf(line) === lines.length - 1 || 
           lines[lines.indexOf(line) + 1]?.trim() === '' ||
           lines[lines.indexOf(line) + 1]?.trim().startsWith('--'))) {
        rawObjects.push(currentObject.join('\n'));
        currentObject = [];
        inRawObject = false;
      }
    }
  }

  return rawObjects;
}

/**
 * Lit le contenu du fichier SQL
 */
function readSqlFile(): string {
  try {
    return fs.readFileSync(SQL_FILE_PATH, 'utf-8');
  } catch (error) {
    throw new Error(`Impossible de lire le fichier SQL : ${SQL_FILE_PATH}\n${error}`);
  }
}

/**
 * Applique une commande SQL via Prisma
 * Idempotent : ignore les erreurs "already exists"
 */
async function executeRawSql(sql: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('  ✓ SQL exécuté avec succès');
  } catch (error) {
    const errorMessage = String(error);
    // Ignorer les erreurs "already exists" (code PostgreSQL 42710)
    if (errorMessage.includes('already exists') || 
        errorMessage.includes('42710') ||
        errorMessage.includes('42P07')) { // 42P07 = duplicate_table
      console.log('  - Déjà existant, ignoré');
    } else {
      console.error(`  ✗ Échec de l'exécution SQL : ${error}`);
      throw error;
    }
  }
}

async function main() {
  console.log('[apply-raw-sql] Début de l\'application des objets SQL hors-Prisma...');

  try {
    // Lire le fichier SQL
    const sqlContent = readSqlFile();

    // Extraire les objets hors-Prisma
    const rawObjects = extractRawSqlObjects(sqlContent);

    if (rawObjects.length === 0) {
      console.log('[apply-raw-sql] ⚠ Aucune objet hors-Prisma trouvé dans le fichier SQL.');
      return;
    }

    console.log(`[apply-raw-sql] → ${rawObjects.length} objets à appliquer...`);

    // Appliquer chaque objet
    for (let i = 0; i < rawObjects.length; i++) {
      const sql = rawObjects[i];
      console.log(`  [${i + 1}/${rawObjects.length}] Application...`);
      
      // Afficher la première ligne pour identifier l'objet
      const firstLine = sql.split('\n')[0].trim();
      const objectNameMatch = firstLine.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(\w+)\s+(\w+)/i);
      const objectDesc = objectNameMatch ? 
        `${objectNameMatch[1]} ${objectNameMatch[2]}` : 
        firstLine.substring(0, 50);
      
      console.log(`     → ${objectDesc}...`);
      
      await executeRawSql(sql);
    }

    console.log('[apply-raw-sql] ✓ Tous les objets SQL appliqués avec succès.');
    
  } catch (error) {
    console.error('[apply-raw-sql] Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
