/**
 * 侧栏：多二级折叠、一级与二级联动高亮（产品页 / 课程页共用）
 */

/**
 * 选中项对应要展开的一级 id（仅多二级时需要折叠；合并单行/仅一级时返回该一级 id）
 */
export function findExpandedL1IdFromTree(tree, selectedCategoryId) {
  if (selectedCategoryId == null || selectedCategoryId === '') return null;
  const sid = Number(selectedCategoryId);
  if (Number.isNaN(sid)) return null;
  const arr = Array.isArray(tree) ? tree : [];
  for (const p of arr) {
    if (Number(p.id) === sid) return Number(p.id);
    const ch = p.children || [];
    for (const c of ch) {
      if (Number(c.id) === sid) return Number(p.id);
    }
  }
  return null;
}

/**
 * 非当前展开一级下的「二级」行不展示
 */
export function filterVisibleSidebarItems(items, expandedL1Id) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.filter((item) => {
    if (item.depth === 1 && !item.isHeader) {
      if (expandedL1Id == null) return false;
      return Number(item.parentL1Id) === Number(expandedL1Id);
    }
    return true;
  });
}

/**
 * 侧栏行高亮：一级在选中其下任一二级时与二级同为 active
 */
export function isSidebarRowActive(item, selectedCategoryId, expandedL1Id) {
  const sel = selectedCategoryId != null && selectedCategoryId !== '' ? Number(selectedCategoryId) : null;
  if (sel == null || Number.isNaN(sel)) return false;
  if (item.isHeader) {
    return expandedL1Id != null && Number(expandedL1Id) === Number(item.id);
  }
  return Number(item.id) === sel;
}
