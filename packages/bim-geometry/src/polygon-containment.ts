/**
 * Which face a polygon best sits in, scored two ways instead of one.
 *
 * A single overlap number cannot tell "the face that holds this space" from
 * "the face this space happens to touch". The larger a face is, the more of any
 * subject it holds, so a single number picks whatever face is biggest — a
 * storey-sized loop beats the room the space actually is. Two numbers fix that:
 *
 * - **share** — how much of the subject the face holds (`subject ∩ face`
 *   over the subject). A face that holds all of it shares 1.
 * - **cover** — how much of the face the subject fills (`subject ∩ face` over
 *   the face). A face that is exactly the subject covers 1.
 *
 * A huge face containing everything has share 1 and cover near 0; a small face
 * the subject merely clips has cover near 1 and share near 0. Only a face that
 * both holds the subject and is about the subject's size scores near 1, so the
 * combined score below is the harmonic mean of the two: low when either is low,
 * and symmetric between them.
 *
 * Ported from Pascal Editor, <https://github.com/pascalorg/editor>: the share
 * and cover fit in `packages/core/src/lib/room-zone-adoption.ts`
 * (`zoneFaceFits`, `adoptableFace`) as used by
 * `packages/core/src/utils/room-zone-migration.ts`, MIT licence, Copyright (c)
 * Pascal Group Inc. The scoring and its thresholds are theirs; this
 * implementation is our own and takes polygons rather than rooms and faces, so
 * it names no room, wall or zone.
 *
 * Units: areas cancel in a ratio, so nothing here assumes a unit and nothing is
 * converted. Coordinates are the caller's, millimetres in MutinyBIM's kernel.
 */
import { overlapArea, polygonArea, type RegionInput } from "./polygon-measure";

/** How a candidate face sits around a subject, and the single number those two make. */
export interface FaceFit {
  /** The candidate's position in the list it was given in. */
  readonly index: number;
  /** The subject's area inside the candidate over the subject's own area. */
  readonly share: number;
  /** The subject's area inside the candidate over the candidate's own area. */
  readonly cover: number;
  /** Harmonic mean of share and cover: 1 when the two are the same polygon. */
  readonly score: number;
}

export interface EnclosingOptions {
  /** Below this share a candidate does not hold the subject and is not a fit. Default 0.5. */
  readonly minimumShare?: number;
  /** Below this cover a candidate is too large for the subject and is not a fit. Default 0. */
  readonly minimumCover?: number;
}

/** A face must hold more than half the subject to be the face the subject is in. */
export const ENCLOSING_SHARE = 0.5;

/** No cover floor by default: a face larger than its subject still holds it. */
export const ENCLOSING_COVER = 0;

/**
 * Every candidate that holds at least `minimumShare` of `subject`, with its fit
 * numbers, in the order the candidates were given.
 *
 * A subject with no area, or inside no candidate at all, has no fits: this
 * returns nothing rather than a fit of zeroes, since a zero share is the
 * absence of an answer and not a bad one.
 */
export function enclosingFits(subject: RegionInput, candidates: readonly RegionInput[], options: EnclosingOptions = {}): FaceFit[] {
  const subjectArea = polygonArea(subject);
  if (!(subjectArea > 0)) return [];
  const minimumShare = options.minimumShare ?? ENCLOSING_SHARE;
  const minimumCover = options.minimumCover ?? ENCLOSING_COVER;
  const fits: FaceFit[] = [];
  candidates.forEach((candidate, index) => {
    const shared = overlapArea(subject, candidate);
    if (!(shared > 0)) return;
    const faceArea = polygonArea(candidate);
    const share = shared / subjectArea;
    const cover = faceArea > 0 ? shared / faceArea : 0;
    const score = share + cover > 0 ? (2 * share * cover) / (share + cover) : 0;
    if (share < minimumShare || cover < minimumCover || !(score > 0)) return;
    fits.push({ index, share, cover, score });
  });
  return fits;
}

/**
 * The candidate `subject` best sits in, or nothing when it sits in none.
 *
 * Ranked by `score` (so a face about the subject's size beats a much larger one
 * that also holds it), then by share, then by cover, then by position. Two
 * candidates that score identically are ordered by index, so shuffling the list
 * changes only the index — never the numbers.
 */
export function bestEnclosingFace(subject: RegionInput, candidates: readonly RegionInput[], options: EnclosingOptions = {}): FaceFit | undefined {
  let best: FaceFit | undefined;
  for (const fit of enclosingFits(subject, candidates, options)) if (!best || outranks(fit, best)) best = fit;
  return best;
}

/** Score first, then the two numbers it hides, then position so ties stay stable. */
function outranks(candidate: FaceFit, best: FaceFit): boolean {
  if (candidate.score !== best.score) return candidate.score > best.score;
  if (candidate.share !== best.share) return candidate.share > best.share;
  if (candidate.cover !== best.cover) return candidate.cover > best.cover;
  return candidate.index < best.index;
}
