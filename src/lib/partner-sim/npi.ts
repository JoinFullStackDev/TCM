/**
 * NPI check digits (CMS "NPI Check Digit" rule): the 10th digit is a Luhn check digit
 * computed over the first nine digits prefixed with the card-issuer prefix 80840.
 * A Luhn-valid NPI isn't necessarily a *registered* NPI; FullStackRx may also look it
 * up in NPPES, which is why reusing a saved prescriber matters for the happy path.
 */

export type Rng = () => number;

/** Luhn check digit for a digit string (the digit that would be appended). */
export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  // Walk right to left; the rightmost payload digit gets doubled, because the check
  // digit will sit to its right.
  for (let i = digits.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** The NPI check digit for the first nine digits of an NPI. */
export function npiCheckDigit(firstNine: string): number {
  if (!/^\d{9}$/.test(firstNine)) throw new Error('npiCheckDigit needs exactly 9 digits');
  return luhnCheckDigit(`80840${firstNine}`);
}

export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  return npiCheckDigit(npi.slice(0, 9)) === Number(npi[9]);
}

/** A random, check-digit-valid individual NPI (individual NPIs start with 1). */
export function generateNpi(rng: Rng = Math.random): string {
  let firstNine = '1';
  for (let i = 0; i < 8; i++) firstNine += String(Math.floor(rng() * 10));
  return firstNine + String(npiCheckDigit(firstNine));
}

/** A 10-digit NPI whose check digit is deliberately wrong (for the 422 invalid_npi preset). */
export function generateInvalidNpi(rng: Rng = Math.random): string {
  const valid = generateNpi(rng);
  const good = Number(valid[9]);
  const bad = (good + 1 + Math.floor(rng() * 9)) % 10; // any digit but the right one
  return valid.slice(0, 9) + String(bad);
}
