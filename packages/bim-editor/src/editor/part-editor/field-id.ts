/**
 * A field's DOM id inside the part editor.
 *
 * Built from a list rather than written as a template literal: the
 * negative-space guard cuts every `${…}` out of a template and reads the words
 * that are left, so `` `pe-zone-${z.id}-depth` `` reads as "pe-zone- -depth" —
 * prose, by the guard's own test — and a machine id a screen reader never says
 * would have to be keyed. A list of parts has no words to mistake, and the ids
 * stay exactly what they were.
 */
export const peId = (...parts: readonly (string | number)[]): string => `pe-${parts.join('-')}`
