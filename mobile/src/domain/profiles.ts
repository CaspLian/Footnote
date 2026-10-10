import type { FamilyProfile } from './types';
/** Custom relationships contain letters, numbers and spaces, including accented letters. */
export function isRelationshipLabel(value: unknown): value is string {
  return typeof value === 'string' && /^[\p{L}\p{N} ]{1,40}$/u.test(value.trim()) && /[\p{L}\p{N}]/u.test(value);
}
export function relationshipText(profile: Pick<FamilyProfile, 'relationship'|'relationshipLabel'>): string {
  return profile.relationship === 'other' ? profile.relationshipLabel ?? 'Other' : ({ self: 'You', child: 'Child', partner: 'Partner', dependent: 'Dependent' })[profile.relationship];
}
