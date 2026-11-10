/**
 * Ivorian mobile numbers: +225 then 10 digits starting with 01, 05 or 07.
 * Returns the E.164 form, or null when the input is not such a number.
 */
export function normalizeCiPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+225")) digits = digits.slice(4);
  else if (digits.startsWith("00225")) digits = digits.slice(5);
  return /^0[157]\d{8}$/.test(digits) ? `+225${digits}` : null;
}
