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

function sortCategoriesForSidebar(categories) {
  const list = [...(categories || [])];
  list.sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0)
  );
  return list;
}

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
        name: p.name,
        isHeader: false,
        isSub: false,
      });
    } else if (ch.length > 1) {
      out.push({
        rowKey: `h-${p.id}`,
        id: p.id,
        name: p.name,
        isHeader: true,
        firstChildId: ch[0].id,
        isSub: false,
      });
      ch.forEach((c) => {
        out.push({
          rowKey: `c-${c.id}`,
          id: c.id,
          name: c.name,
          isHeader: false,
          isSub: true,
        });
      });
    } else {
      out.push({
        rowKey: `p-${p.id}`,
        id: p.id,
        name: p.name,
        isHeader: false,
        isSub: false,
      });
    }
  });
  return out;
}

Page({
  data: {
    categories: [],
    sidebarItems: [],
    selectedCategoryId: null,
    courses: [],
    filteredCourses: [],
    loading: false,
    searchKeyword: '',
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
        this.setData({ categories, sidebarItems });
        const first = sidebarItems.find((x) => !x.isHeader);
        if (first) this.selectCategoryById(first.id);
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = (this.data.sidebarItems || [])[idx];
    if (!item) return;
    if (item.isHeader && item.firstChildId) {
      return this.selectCategoryById(item.firstChildId);
    }
    if (item.id === this.data.selectedCategoryId) return;
    this.selectCategoryById(item.id);
  },

  selectCategoryById(catId) {
    if (!catId) return;
    this.setData({
      selectedCategoryId: catId,
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

  openCourse(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    const param = item.slug || item.id;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${encodeURIComponent(param)}`,
    });
  },
});
