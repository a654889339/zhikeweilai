const app = getApp();

function fullUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (s.startsWith('http')) return s;
  return app.globalData.baseUrl.replace('/api', '') + s;
}

function mapCourseTree(nodes) {
  return (nodes || []).map((n) => ({
    ...n,
    name: n.title || n.name,
    children: mapCourseTree(n.children || []),
  }));
}

function pickThumb(c, p) {
  if (c && c.thumbnailUrl) return fullUrl(c.thumbnailUrl);
  if (p && p.thumbnailUrl) return fullUrl(p.thumbnailUrl);
  return '';
}

function sortCategoriesForSidebar(categories) {
  const list = [...(categories || [])];
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
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0);
  });
  return list;
}

function findExpandedL1IdFromTree(tree, selectedCategoryId) {
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

function filterVisibleSidebarMp(items, expandedL1Id) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.filter((item) => {
    if (item.isSub) {
      if (expandedL1Id == null) return false;
      return Number(item.parentL1Id) === Number(expandedL1Id);
    }
    return true;
  });
}

function rowActiveMp(item, selectedCategoryId, expandedL1Id) {
  const sel = selectedCategoryId != null && selectedCategoryId !== '' ? Number(selectedCategoryId) : null;
  if (sel == null || Number.isNaN(sel)) return false;
  if (item.isHeader) {
    return expandedL1Id != null && Number(expandedL1Id) === Number(item.id);
  }
  return Number(item.id) === sel;
}

function applyVisibleSidebarMp(items, expandedL1Id, selectedCategoryId) {
  return filterVisibleSidebarMp(items, expandedL1Id).map((it) => ({
    ...it,
    rowActive: rowActiveMp(it, selectedCategoryId, expandedL1Id),
  }));
}

/** 与 pages/products/products.js flattenSidebarForMp 一致：单二级合并一行；多二级时一级标题 + 子项 */
function flattenSidebarForCourses(tree) {
  const out = [];
  const arr = Array.isArray(tree) ? tree : [];
  sortCategoriesForSidebar(arr).forEach((p) => {
    const ch = Array.isArray(p.children) ? sortCategoriesForSidebar(p.children) : [];
    if (ch.length === 1) {
      const c0 = ch[0];
      out.push({
        rowKey: `sc-${p.id}-${c0.id}`,
        id: c0.id,
        parentL1Id: p.id,
        mergedSingle: true,
        name: p.name,
        isHeader: false,
        isSub: false,
        thumb: pickThumb(c0, p),
      });
    } else if (ch.length > 1) {
      out.push({
        rowKey: `h-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        isHeader: true,
        firstChildId: ch[0].id,
        isSub: false,
        thumb: pickThumb(null, p),
      });
      ch.forEach((c) => {
        out.push({
          rowKey: `c-${c.id}`,
          id: c.id,
          parentL1Id: p.id,
          name: c.name,
          isHeader: false,
          isSub: true,
          thumb: pickThumb(c, p),
        });
      });
    } else {
      out.push({
        rowKey: `p-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        isHeader: false,
        isSub: false,
        thumb: pickThumb(null, p),
      });
    }
  });
  return out;
}

function buildL2PickerState(categories, expandedL1Id, selectedCategoryId) {
  if (expandedL1Id == null) {
    return { l2PickerOptions: [], l2PickerIndex: 0, l2PickerLabel: '' };
  }
  const p = (categories || []).find((x) => Number(x.id) === Number(expandedL1Id));
  const ch = p && Array.isArray(p.children) ? sortCategoriesForSidebar(p.children) : [];
  if (ch.length <= 1) {
    return { l2PickerOptions: [], l2PickerIndex: 0, l2PickerLabel: '' };
  }
  const l2PickerOptions = ch.map((c) => ({ id: c.id, name: c.name || c.title || '' }));
  let idx = l2PickerOptions.findIndex((o) => Number(o.id) === Number(selectedCategoryId));
  if (idx < 0) idx = 0;
  const l2PickerLabel = (l2PickerOptions[idx] && l2PickerOptions[idx].name) || '';
  return { l2PickerOptions, l2PickerIndex: idx, l2PickerLabel };
}

Page({
  data: {
    categories: [],
    sidebarItems: [],
    visibleSidebarItems: [],
    expandedL1Id: null,
    selectedCategoryId: null,
    courses: [],
    filteredCourses: [],
    loading: false,
    searchKeyword: '',
    l2PickerOptions: [],
    l2PickerIndex: 0,
    l2PickerLabel: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    if (!this.data.categories.length) this.loadCategories();
  },

  onSearchInput(e) {
    const kw = (e.detail.value || '').trim().toLowerCase();
    const list = this.data.courses || [];
    const filtered = kw
      ? list.filter((d) => (d.name || '').toLowerCase().includes(kw))
      : list;
    this.setData({ searchKeyword: e.detail.value || '', filteredCourses: filtered });
  },

  loadCategories() {
    app
      .request({ url: '/course-categories' })
      .then((res) => {
        const categories = mapCourseTree(res.data || []);
        const sidebarItems = flattenSidebarForCourses(categories);
        const first = sidebarItems.find((x) => !x.isHeader);
        const expandedL1Id = first ? findExpandedL1IdFromTree(categories, first.id) : null;
        const visibleSidebarItems = applyVisibleSidebarMp(sidebarItems, expandedL1Id, first ? first.id : null);
        const pick = buildL2PickerState(categories, expandedL1Id, first ? first.id : null);
        this.setData({
          categories,
          sidebarItems,
          expandedL1Id,
          visibleSidebarItems,
          l2PickerOptions: pick.l2PickerOptions,
          l2PickerIndex: pick.l2PickerIndex,
          l2PickerLabel: pick.l2PickerLabel,
        });
        if (first) this.selectCategoryById(first.id, true);
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = (this.data.visibleSidebarItems || [])[idx];
    if (!item) return;
    if (item.isHeader && item.firstChildId) {
      return this.selectCategoryById(item.firstChildId);
    }
    if (item.id === this.data.selectedCategoryId) return;
    this.selectCategoryById(item.id);
  },

  selectCategoryById(catId, skipExpandSync) {
    if (!catId) return;
    const categories = this.data.categories || [];
    const sidebarItems = this.data.sidebarItems || [];
    let expandedL1Id = this.data.expandedL1Id;
    if (!skipExpandSync) {
      expandedL1Id = findExpandedL1IdFromTree(categories, catId);
    }
    const visibleSidebarItems = applyVisibleSidebarMp(sidebarItems, expandedL1Id, catId);
    const pick = buildL2PickerState(categories, expandedL1Id, catId);
    this.setData({
      selectedCategoryId: catId,
      expandedL1Id,
      visibleSidebarItems,
      l2PickerOptions: pick.l2PickerOptions,
      l2PickerIndex: pick.l2PickerIndex,
      l2PickerLabel: pick.l2PickerLabel,
      courses: [],
      filteredCourses: [],
      loading: true,
      searchKeyword: '',
    });
    app
      .request({ url: '/courses', data: { categoryId: catId } })
      .then((res) => {
        const list = (res.data || []).map((c) => ({
          ...c,
          coverImageFull: c.coverImage ? fullUrl(c.coverImage) : '',
        }));
        this.setData({ courses: list, filteredCourses: list, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onL2Pick(e) {
    const idx = parseInt(e.detail.value, 10);
    const opt = (this.data.l2PickerOptions || [])[idx];
    if (!opt) return;
    this.selectCategoryById(opt.id);
  },

  openCourse(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    const param = item.slug || item.id;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${encodeURIComponent(param)}`,
    });
  },
});
