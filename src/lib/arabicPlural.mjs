export function formatArabicCount(count, forms) {
  const value = Math.max(0, Math.trunc(Number(count) || 0));
  if (value === 0) return forms.zero;
  if (value === 1) return forms.one;
  if (value === 2) return forms.two;
  if (value <= 10) return `${value} ${forms.few}`;
  return `${value} ${forms.many}`;
}
