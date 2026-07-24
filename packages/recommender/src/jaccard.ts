/**
 * eMDB Recommender - Jaccard Similarity Utilities
 * Phase 5.1: Algorithme de similarité
 *
 * Utilitaires pour le calcul de similarité Jaccard entre sets
 */

/**
 * Calcule la similarité Jaccard entre deux ensembles
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param setA - Premier ensemble
 * @param setB - Deuxième ensemble
 * @returns Score de similarité entre 0 et 1
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Vérifie si deux ensembles ont au moins un élément en commun
 * Optimisation : itère sur le plus petit ensemble
 *
 * @param setA - Premier ensemble
 * @param setB - Deuxième ensemble
 * @returns true si intersection non vide, false sinon
 */
export function hasCommonElement(setA: Set<string>, setB: Set<string>): boolean {
  if (setA.size === 0 || setB.size === 0) return false;
  // Itérer sur le plus petit set pour optimiser
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) return true;
  }
  return false;
}

/**
 * Vérifie si deux ensembles ont des genres en commun
 * Alias de hasCommonElement pour plus de clarté dans le contexte métier
 *
 * @param genresA - Ensemble de genre_ids du premier titre
 * @param genresB - Ensemble de genre_ids du deuxième titre
 * @returns true si au moins un genre en commun
 */
export function hasCommonGenre(genresA: Set<string>, genresB: Set<string>): boolean {
  return hasCommonElement(genresA, genresB);
}
