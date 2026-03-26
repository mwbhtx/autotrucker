/**
 * Trailer type categories — each maps to one or more order trailer codes.
 *
 * Flat trailer mapping rule:
 *   - Any raw code containing "flat" (case-insensitive) WITHOUT "53" → Flat 48
 *   - Any raw code containing "flat" (case-insensitive) WITH "53" → Flat 53
 */
export const TRAILER_CATEGORIES = [
  { label: "Flat 48", codes: ["F - FLAT", "F48 - FLAT, 48'", "FLAT - FLAT", "FD - FLAT OR DROP", "F/D - FLAT OR DROP", "F/SD - FLAT OR STEP"] },
] as const;

// Combo/multi-type codes mapped to which categories they satisfy
const COMBO_CODES: Record<string, string[]> = {};

/**
 * Given selected category labels, return all matching order trailer codes.
 */
export function expandTrailerCodes(selectedLabels: string[]): string[] {
  const codes: string[] = [];
  for (const cat of TRAILER_CATEGORIES) {
    if (selectedLabels.includes(cat.label)) {
      codes.push(...cat.codes);
    }
  }
  for (const [code, labels] of Object.entries(COMBO_CODES)) {
    if (labels.some((l) => selectedLabels.includes(l))) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Reverse-map stored trailer codes to category labels.
 */
export function codesToLabels(storedCodes: string[]): string[] {
  const labels = new Set<string>();
  for (const cat of TRAILER_CATEGORIES) {
    if (cat.codes.some((c) => storedCodes.includes(c))) {
      labels.add(cat.label);
    }
  }
  // Also check combo codes in case user has those stored
  for (const [code, catLabels] of Object.entries(COMBO_CODES)) {
    if (storedCodes.includes(code)) {
      for (const l of catLabels) labels.add(l);
    }
  }
  return Array.from(labels);
}
