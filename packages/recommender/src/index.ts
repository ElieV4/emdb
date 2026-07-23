/**
 * eMDB Recommender Package
 * Phase 5.1: Algorithme de similarité pour recommandations
 * 
 * Package pour le calcul des recommandations de titres et personnes
 * basées sur la similarité Jaccard pondérée.
 */

export {
  jaccardSimilarity,
  hasCommonElement,
  hasCommonGenre,
} from './jaccard';

export {
  computeTitleRecommendations,
  computePersonRecommendations,
  computeAllRecommendations,
  computeRecommendationsForTitle,
} from './recommender';
