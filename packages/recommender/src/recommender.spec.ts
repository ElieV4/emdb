/**
 * eMDB Recommender - Unit Tests
 * Phase 5.1: Tests unitaires pour l'algorithme de recommandation
 */

import {
  jaccardSimilarity,
  hasCommonElement,
  hasCommonGenre,
} from './jaccard';

describe('Jaccard Similarity Utilities', () => {
  describe('jaccardSimilarity', () => {
    it('should return 1 for identical sets', () => {
      const setA = new Set<string>(['action', 'adventure']);
      const setB = new Set<string>(['action', 'adventure']);
      expect(jaccardSimilarity(setA, setB)).toBe(1);
    });

    it('should return 0 for disjoint sets', () => {
      const setA = new Set<string>(['action', 'adventure']);
      const setB = new Set<string>(['comedy', 'romance']);
      expect(jaccardSimilarity(setA, setB)).toBe(0);
    });

    it('should return correct value for partial intersection', () => {
      const setA = new Set<string>(['action', 'adventure', 'comedy']);
      const setB = new Set<string>(['action', 'comedy', 'drama']);
      // Intersection: action, comedy (2)
      // Union: action, adventure, comedy, drama (4)
      // Jaccard = 2/4 = 0.5
      expect(jaccardSimilarity(setA, setB)).toBe(0.5);
    });

    it('should return 0 when one set is empty', () => {
      const setA = new Set<string>(['action']);
      const setB = new Set<string>();
      expect(jaccardSimilarity(setA, setB)).toBe(0);
    });

    it('should return 0 when both sets are empty', () => {
      const setA = new Set<string>();
      const setB = new Set<string>();
      expect(jaccardSimilarity(setA, setB)).toBe(0);
    });

    it('should return correct value for subset', () => {
      const setA = new Set<string>(['action', 'adventure']);
      const setB = new Set<string>(['action', 'adventure', 'comedy']);
      // Intersection: action, adventure (2)
      // Union: action, adventure, comedy (3)
      // Jaccard = 2/3 ≈ 0.6667
      expect(jaccardSimilarity(setA, setB)).toBeCloseTo(2 / 3);
    });
  });

  describe('hasCommonElement', () => {
    it('should return true for sets with intersection', () => {
      const setA = new Set<string>(['action', 'adventure']);
      const setB = new Set<string>(['action', 'comedy']);
      expect(hasCommonElement(setA, setB)).toBe(true);
    });

    it('should return false for disjoint sets', () => {
      const setA = new Set<string>(['action', 'adventure']);
      const setB = new Set<string>(['comedy', 'drama']);
      expect(hasCommonElement(setA, setB)).toBe(false);
    });

    it('should return false when one set is empty', () => {
      const setA = new Set<string>(['action']);
      const setB = new Set<string>();
      expect(hasCommonElement(setA, setB)).toBe(false);
    });

    it('should return false when both sets are empty', () => {
      const setA = new Set<string>();
      const setB = new Set<string>();
      expect(hasCommonElement(setA, setB)).toBe(false);
    });
  });

  describe('hasCommonGenre', () => {
    it('should return true for sets with common genre', () => {
      const genresA = new Set<string>(['genre-1', 'genre-2']);
      const genresB = new Set<string>(['genre-1', 'genre-3']);
      expect(hasCommonGenre(genresA, genresB)).toBe(true);
    });

    it('should return false for sets with no common genre', () => {
      const genresA = new Set<string>(['genre-1', 'genre-2']);
      const genresB = new Set<string>(['genre-3', 'genre-4']);
      expect(hasCommonGenre(genresA, genresB)).toBe(false);
    });
  });
});
