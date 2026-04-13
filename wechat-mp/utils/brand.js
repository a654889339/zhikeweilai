/** 与前台 normalizeBrandText 一致：后台可能仍为「科与学」 */
function normalizeBrandText(input) {
  if (input == null) return '';
  return String(input).split('科与学').join('科必学');
}

module.exports = { normalizeBrandText };
