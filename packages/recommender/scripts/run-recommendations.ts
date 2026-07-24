#!/usr/bin/env node
/**
 * eMDB Recommender - CLI Script
 * Phase 5.1: Script exécutable pour le calcul des recommandations
 *
 * Usage:
 *   npm run start -- --mode=all --batch=100
 *   npm run start -- --mode=titles --batch=50
 *   npm run start -- --mode=people
 *   npm run start -- --title-id=xxx
 *
 * Options:
 *   --mode=all|titles|people   Mode de calcul (par défaut: all)
 *   --batch=N                Taille du batch pour les titres (par défaut: 100)
 *   --title-id=xxx          Calculer pour un seul titre
 */

import {
  computeTitleRecommendations,
  computePersonRecommendations,
  computeAllRecommendations,
  computeRecommendationsForTitle,
} from '../src/recommender';

interface CLIOptions {
  mode: 'all' | 'titles' | 'people';
  batch: number;
  titleId?: string;
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    mode: 'all',
    batch: 100,
  };

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1];
      if (mode === 'all' || mode === 'titles' || mode === 'people') {
        options.mode = mode;
      } else {
        console.error('Invalid mode. Use: all, titles, or people');
        process.exit(1);
      }
    } else if (arg.startsWith('--batch=')) {
      const batch = parseInt(arg.split('=')[1]);
      if (isNaN(batch) || batch <= 0) {
        console.error('Invalid batch size. Must be a positive number');
        process.exit(1);
      }
      options.batch = batch;
    } else if (arg.startsWith('--title-id=')) {
      options.titleId = arg.split('=')[1];
      if (!options.titleId) {
        console.error('Title ID is required');
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Affiche l'aide
 */
function printHelp(): void {
  console.log(`
eMDB Recommender CLI - Phase 5.1

Usage: node run-recommendations.ts [options]

Options:
  --mode=all|titles|people   Mode de calcul (default: all)
                           - all: calculer titres + personnes
                           - titles: calculer seulement les titres
                           - people: calculer seulement les personnes
  --batch=N                Taille du batch pour les titres (default: 100)
  --title-id=xxx          Calculer pour un seul titre (mode dev)
  --help, -h              Affiche cette aide

Examples:
  node run-recommendations.ts --mode=all --batch=100
  node run-recommendations.ts --mode=titles --batch=50
  node run-recommendations.ts --title-id=550

Notes:
  - Le calcul peut prendre plusieurs minutes pour un grand dataset
  - Utilisez --title-id pour tester avec un seul titre
  - Les recommandations existantes sont remplacées
`);
}

/**
 * Affiche les résultats sous forme de tableau
 */
function printResultsTable(
  title: string,
  results: Array<{ id: string; score: number }>,
  limit: number = 3,
): void {
  if (results.length === 0) {
    console.log(`\n${title}: aucune recommandation trouvée`);
    return;
  }

  const displayResults = results.slice(0, limit);
  console.log(`\n${title}: Top ${displayResults.length} recommandations`);
  console.table(
    displayResults.map((r, i) => ({
      rank: i + 1,
      recommended_id: r.id,
      score: r.score.toFixed(4),
    })),
  );
}

/**
 * Fonction principale
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('eMDB Recommender - Phase 5.1');
  console.log('=============================\n');

  // Mode single title (dev)
  if (options.titleId) {
    console.log(`Calcul des recommandations pour le titre: ${options.titleId}`);
    try {
      const recommendations = await computeRecommendationsForTitle(options.titleId);
      printResultsTable('Recommandations', recommendations);
      console.log(`\nTotal: ${recommendations.length} recommandations calculées`);
      process.exit(0);
    } catch (error) {
      console.error('Erreur lors du calcul:', error);
      process.exit(1);
    }
  }

  // Mode batch
  switch (options.mode) {
    case 'titles':
      console.log(`Calcul des recommandations de titres (batch: ${options.batch})`);
      try {
        const count = await computeTitleRecommendations(options.batch);
        console.log(`\n✅ ${count} recommandations de titres insérées`);
        process.exit(0);
      } catch (error) {
        console.error('Erreur lors du calcul des titres:', error);
        process.exit(1);
      }

    case 'people':
      console.log('Calcul des recommandations de personnes');
      try {
        const count = await computePersonRecommendations();
        console.log(`\n✅ ${count} recommandations de personnes insérées`);
        process.exit(0);
      } catch (error) {
        console.error('Erreur lors du calcul des personnes:', error);
        process.exit(1);
      }

    case 'all':
    default:
      console.log(`Calcul de toutes les recommandations (batch: ${options.batch})`);
      try {
        const startTime = Date.now();
        const stats = await computeAllRecommendations(options.batch);
        const duration = Date.now() - startTime;

        console.log(`\n✅ Calcul terminé en ${(duration / 1000).toFixed(2)} secondes`);
        console.log(`   - Titres: ${stats.titlesComputed} recommandations`);
        console.log(`   - Personnes: ${stats.peopleComputed} recommandations`);
        process.exit(0);
      } catch (error) {
        console.error('Erreur lors du calcul:', error);
        process.exit(1);
      }
  }
}

main().catch((error) => {
  console.error('Erreur inattendue:', error);
  process.exit(1);
});
