// Band score lookup — maps raw scores to official IELTS/TOEFL bands
// using the non-linear lookup table seeded in migration 041.

import type { Env } from '../types';

/**
 * Convert raw score (correct count out of total) to official band.
 * Falls back to linear estimation if no lookup row found.
 */
export async function rawToBand(
  env: Env,
  testType: string,
  section: string,
  rawScore: number,
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT band FROM band_score_lookup
      WHERE test_type = ? AND section = ? AND ? >= raw_min AND ? <= raw_max
      LIMIT 1`,
  ).bind(testType, section, rawScore, rawScore).first<{ band: number }>();

  if (row) return row.band;

  // Fallback: linear estimation
  if (testType === 'IELTS') {
    return Math.min(9, Math.max(1, Math.round((rawScore / 40) * 9 * 2) / 2));
  }
  // TOEFL iBT: section scores 0-30
  return Math.min(30, Math.max(0, rawScore));
}

/**
 * Compute overall IELTS band from 4 section bands.
 * Official rule: average of 4, rounded to nearest 0.5.
 */
export function ieltsOverallBand(
  reading: number,
  listening: number,
  writing: number,
  speaking: number,
): number {
  const avg = (reading + listening + writing + speaking) / 4;
  return Math.round(avg * 2) / 2;
}

/**
 * TOEFL iBT total: sum of 4 sections (each 0-30, total 0-120).
 */
export function toeflTotal(
  reading: number,
  listening: number,
  speaking: number,
  writing: number,
): number {
  return reading + listening + speaking + writing;
}
