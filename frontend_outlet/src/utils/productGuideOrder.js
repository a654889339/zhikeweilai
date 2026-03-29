/** 空调 / 除湿机下列表展示顺序（与前台设计稿一致） */
export const AC_ORDER = [
  '织风空调',
  '织风空调（光面）',
  '1.5-1PH 壁挂式分体机',
  '1.5-3PH 壁挂式分体机',
];

export const DEHUMIDIFIER_ORDER = [
  '智能除湿机 16L',
  '智能除湿机 16L 旋钮款',
  '智能除湿机 20L',
  '智能除湿机 20L 导风板',
  '智能除湿机 30L',
  '智能变频除湿机 30L',
  '智能除湿机 40L',
  '智能变频除湿机 40L',
  '中央除湿机 70L',
  '中央除湿机 90L',
];

function pickOrderList(categoryName) {
  const n = (categoryName || '').trim();
  if (n.includes('除湿')) return DEHUMIDIFIER_ORDER;
  if (n.includes('空调')) return AC_ORDER;
  return null;
}

function sortKeyForGuide(g, orderList) {
  const nm = (g.name || '').trim();
  const exact = orderList.indexOf(nm);
  if (exact >= 0) return exact;
  for (let i = 0; i < orderList.length; i++) {
    const t = orderList[i];
    if (nm.includes(t) || t.includes(nm)) return i;
  }
  return 1000 + (g.sortOrder ?? 0) * 0.001 + (g.id ?? 0) * 1e-6;
}

export function sortGuidesByDisplayOrder(guides, categoryName) {
  const orderList = pickOrderList(categoryName);
  if (!orderList) {
    return [...guides].sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0)
    );
  }
  return [...guides].sort((a, b) => {
    const da = sortKeyForGuide(a, orderList);
    const db = sortKeyForGuide(b, orderList);
    if (da !== db) return da - db;
    return (
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0)
    );
  });
}

export function sortCategoriesForSidebar(categories) {
  const list = [...categories];
  const rank = (name) => {
    const n = (name || '').trim();
    if (n === '空调') return 0;
    if (n === '除湿机' || n.includes('除湿')) return 1;
    return 2;
  };
  list.sort((a, b) => {
    const ra = rank(a.name);
    const rb = rank(b.name);
    if (ra !== rb) return ra - rb;
    return (
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0)
    );
  });
  return list;
}
