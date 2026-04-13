export function normalizeBrandText(input) {
  if (input == null) return '';
  let s = String(input);
  s = s.split('科与学').join('科必学');
  return s;
}
