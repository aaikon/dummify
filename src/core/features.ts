/**
 * Features that exist in settings but aren't shipped yet. UI for a disabled feature stays hidden, so users
 * never see a switch that does nothing.
 */
export interface Features {
  /** Generic heuristics (T-009). */
  readonly heuristics: boolean;
}

export const FEATURES: Features = { heuristics: true };
