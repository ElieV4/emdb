/**
 * Recommender Module - DTOs
 * Phase 5.2: Module API recommandations + BullMQ
 *
 * DTOs pour les endpoints admin de recommandations.
 */
import { IsEnum, IsOptional } from 'class-validator';

/** Mode de calcul des recommandations */
export type RecomputeMode = 'titles' | 'people' | 'all';

/**
 * DTO pour POST /admin/compute-recommendations
 *
 * Lance le calcul des recommandations via un job BullMQ.
 * Le mode détermine quelles recommandations calculer.
 */
export class ComputeRecsDto {
  @IsOptional()
  @IsEnum(['titles', 'people', 'all'])
  mode?: RecomputeMode = 'all';
}
