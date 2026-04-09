const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function parseAllowlist(raw: string): Set<string> {
  const numbers = raw
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const valid = new Set<string>();

  for (const n of numbers) {
    if (E164_PATTERN.test(n)) {
      valid.add(n);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`ALLOWED_FROM_NUMBERS: "${n}" is not a valid E.164 number — skipping`);
    }
  }

  return valid;
}

export function isAllowed(from: string, allowedNumbers: Set<string>): boolean {
  return allowedNumbers.has(from);
}
