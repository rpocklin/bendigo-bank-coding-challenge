/** Groups the integer part and copies the fractional digits, so the scale is preserved. */
export function displayDecimal(canonical: string, locale: string): string {
  const [whole = "0", fraction] = canonical.split(".");
  const grouped = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(BigInt(whole));
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
