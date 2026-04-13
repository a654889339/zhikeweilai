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
    thumbnailUrl: n.thumbnailUrl || '',
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

function coursesForL2(all, l2Id) {
  return (all || []).filter((c) => Number(c.courseCategoryId) === Number(l2Id));
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

function filterVisibleSidebarMp(items, expandedL1Id, expandedL2Id) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.filter((item) => {
    if (item.isCourse) {
      if (expandedL2Id == null) return false;
      return Number(item.parentL2Id) === Number(expandedL2Id);
    }
    if (item.isSub) {
      if (expandedL1Id == null) return false;
      return Number(item.parentL1Id) === Number(expandedL1Id);
    }
    return true;
  });
}

function rowActiveMp(item, selectedCategoryId, expandedL1Id, selectedCourseId) {
  if (item.isCourse) {
    const c = selectedCourseId != null && selectedCourseId !== '' ? Number(selectedCourseId) : null;
    if (c == null || Number.isNaN(c)) return false;
    return Number(item.courseId) === c;
  }
  const sel = selectedCategoryId != null && selectedCategoryId !== '' ? Number(selectedCategoryId) : null;
  if (sel == null || Number.isNaN(sel)) return false;
  if (item.isHeader) {
    return expandedL1Id != null && Number(expandedL1Id) === Number(item.id);
  }
  return Number(item.id) === sel;
}

function applyVisibleSidebarMp(items, expandedL1Id, expandedL2Id, selectedCategoryId, selectedCourseId) {
  return filterVisibleSidebarMp(items, expandedL1Id, expandedL2Id).map((it) => ({
    ...it,
    rowActive: rowActiveMp(it, selectedCategoryId, expandedL1Id, selectedCourseId),
  }));
}

function flattenSidebarForCourses(tree, allCourses) {
  const out = [];
  const arr = Array.isArray(tree) ? tree : [];
  sortCategoriesForSidebar(arr).forEach((p) => {
    const ch = Array.isArray(p.children) ? sortCategoriesForSidebar(p.children) : [];
    const pushCourses = (l1, l2) => {
      coursesForL2(allCourses, l2).forEach((c) => {
        const thumb = c.coverImage ? fullUrl(String(c.coverImage)) : '';
        out.push({
          rowKey: `co-${c.id}`,
          id: c.id,
          courseId: c.id,
          parentL1Id: l1,
          parentL2Id: l2,
          name: c.name,
          isHeader: false,
          isSub: false,
          isCourse: true,
          thumb,
        });
      });
    };
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
        isCourse: false,
        thumb: pickThumb(c0, p),
      });
      pushCourses(p.id, c0.id);
    } else if (ch.length > 1) {
      out.push({
        rowKey: `h-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        isHeader: true,
        firstChildId: ch[0].id,
        isSub: false,
        isCourse: false,
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
          isCourse: false,
          thumb: pickThumb(c, p),
        });
        pushCourses(p.id, c.id);
      });
    } else {
      out.push({
        rowKey: `p-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        isHeader: false,
        isSub: false,
        isCourse: false,
        thumb: pickThumb(null, p),
      });
    }
  });
  return out;
}

function firstCourseIdForL2(all, l2Id) {
  const list = coursesForL2(all, l2Id);
  return list.length ? list[0].id : null;
}

Page({
  data: {
    categories: [],
    allCourses: [],
    sidebarItems: [],
    visibleSidebarItems: [],
    expandedL1Id: null,
    expandedL2Id: null,
    selectedCategoryId: null,
    selectedCourseId: null,
    course: {},
    videos: [],
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
    this.setData({ searchKeyword: e.detail.value || '' });
  },

  loadCategories() {
    Promise.all([app.request({ url: '/course-categories' }), app.request({ url: '/courses' })])
      .then(([catRes, courseRes]) => {
        const categories = mapCourseTree(catRes.data || []);
        const allCourses = courseRes.data || [];
        const sidebarItems = flattenSidebarForCourses(categories, allCourses);
        const first = sidebarItems.find((x) => !x.isHeader && !x.isCourse);
        const expandedL1Id = first ? findExpandedL1IdFromTree(categories, first.id) : null;
        const expandedL2Id = first && (first.mergedSingle || first.isSub) ? first.id : null;
        const selectedCourseId = expandedL2Id ? firstCourseIdForL2(allCourses, expandedL2Id) : null;
        const visibleSidebarItems = applyVisibleSidebarMp(
          sidebarItems,
          expandedL1Id,
          expandedL2Id,
          first ? first.id : null,
          selectedCourseId
        );
        this.setData({
          categories,
          allCourses,
          sidebarItems,
          expandedL1Id,
          expandedL2Id,
          selectedCategoryId: first ? first.id : null,
          selectedCourseId,
          visibleSidebarItems,
        });
        if (selectedCourseId) this.loadCourseDetail(selectedCourseId);
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = (this.data.visibleSidebarItems || [])[idx];
    if (!item) return;
    if (item.isHeader && item.firstChildId) {
      const child = this.data.sidebarItems.find(
        (x) => Number(x.id) === Number(item.firstChildId) && !x.isHeader && !x.isCourse
      );
      if (child) {
        return this.selectCategoryByCat({
          id: child.id,
          mergedSingle: !!child.mergedSingle,
          isSub: !!child.isSub,
        });
      }
    }
    if (item.isCourse) {
      const expandedL1Id = findExpandedL1IdFromTree(this.data.categories, item.parentL2Id);
      const visibleSidebarItems = applyVisibleSidebarMp(
        this.data.sidebarItems,
        expandedL1Id,
        item.parentL2Id,
        item.parentL2Id,
        item.courseId
      );
      this.setData({
        selectedCategoryId: item.parentL2Id,
        expandedL1Id,
        expandedL2Id: item.parentL2Id,
        selectedCourseId: item.courseId,
        visibleSidebarItems,
      });
      this.loadCourseDetail(item.courseId);
      return;
    }
    this.selectCategoryByCat({ id: item.id, mergedSingle: item.mergedSingle, isSub: item.isSub });
  },

  selectCategoryByCat(cat) {
    if (!cat || !cat.id) return;
    const categories = this.data.categories || [];
    const sidebarItems = this.data.sidebarItems || [];
    const expandedL1Id = findExpandedL1IdFromTree(categories, cat.id);
    const expandedL2Id = cat.mergedSingle || cat.isSub ? cat.id : null;
    const selectedCourseId = expandedL2Id ? firstCourseIdForL2(this.data.allCourses, expandedL2Id) : null;
    const visibleSidebarItems = applyVisibleSidebarMp(
      sidebarItems,
      expandedL1Id,
      expandedL2Id,
      cat.id,
      selectedCourseId
    );
    this.setData({
      selectedCategoryId: cat.id,
      expandedL1Id,
      expandedL2Id,
      selectedCourseId,
      visibleSidebarItems,
      course: {},
      videos: [],
      loading: true,
    });
    if (selectedCourseId) {
      this.loadCourseDetail(selectedCourseId);
    } else {
      this.setData({ loading: false });
    }
  },

  loadCourseDetail(courseId) {
    const id = courseId;
    this.setData({ loading: true, selectedCourseId: id });
    const meta = (this.data.allCourses || []).find((c) => c.id === id) || {};
    const param = meta.slug || id;
    app
      .request({ url: '/courses/' + encodeURIComponent(param) })
      .then((res) => {
        const c = res.data || {};
        const videos = Array.isArray(c.videos) ? c.videos.map((u) => fullUrl(u)) : [];
        this.setData({
          course: {
            ...c,
            coverFull: c.coverImage ? fullUrl(c.coverImage) : '',
          },
          videos,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },
});
