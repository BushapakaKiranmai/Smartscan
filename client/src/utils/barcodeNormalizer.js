/**
 * Barcode Normalizer Utility
 * Ensures barcode strings preserve leading zeros, trims whitespace,
 * and standardizes formatting for reliable MongoDB lookups.
 */

export const normalizeBarcode = (rawInput) => {
  if (rawInput === null || rawInput === undefined) return '';

  // CRITICAL: Always cast to string, NEVER Number, to preserve leading zeroes (e.g., "0123456789012")
  let code = String(rawInput).trim();

  // Strip invisible control chars, carriage returns, or tabs that scanners might inject
  code = code.replace(/[\u0000-\u001F\u007F-\u009F\r\n\t]/g, '');

  return code;
};

export default normalizeBarcode;
