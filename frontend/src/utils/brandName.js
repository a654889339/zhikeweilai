/** 后台 home-config 可能仍为旧文案，统一在前台展示为「科必学」 */
export function normalizeBrandText(input) {
  if (input == null) return '';
  let s = String(input);
  s = s.split('科与学').join('科必学');
  return s;
}
