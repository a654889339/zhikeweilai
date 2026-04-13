const app = getApp();

function fullUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (s.startsWith('http')) return s;
  return app.globalData.baseUrl.replace('/api', '') + s;
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
    return ((a.sortOrder ?? 0) - (b.sortOrder ?? 0)) || ((a.id ?? 0) - (b.id ?? 0));
  });
  return list;
}

function pickThumb(c, p) {
  if (c && c.thumbnailUrl) return fullUrl(c.thumbnailUrl);
  if (p && p.thumbnailUrl) return fullUrl(p.thumbnailUrl);
  return '';
}

function guidesForL2(guides, l2Id) {
  return (guides || []).filter((g) => Number(g.categoryId) === Number(l2Id));
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
    if (item.isProduct) {
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

function rowActiveMp(item, selectedCategoryId, expandedL1Id, selectedGuideId) {
  if (item.isProduct) {
    const g = selectedGuideId != null && selectedGuideId !== '' ? Number(selectedGuideId) : null;
    if (g == null || Number.isNaN(g)) return false;
    return Number(item.guideId) === g;
  }
  const sel = selectedCategoryId != null && selectedCategoryId !== '' ? Number(selectedCategoryId) : null;
  if (sel == null || Number.isNaN(sel)) return false;
  if (item.isHeader) {
    return expandedL1Id != null && Number(expandedL1Id) === Number(item.id);
  }
  return Number(item.id) === sel;
}

function applyVisibleSidebarMp(items, expandedL1Id, expandedL2Id, selectedCategoryId, selectedGuideId) {
  return filterVisibleSidebarMp(items, expandedL1Id, expandedL2Id).map((it) => ({
    ...it,
    rowActive: rowActiveMp(it, selectedCategoryId, expandedL1Id, selectedGuideId),
  }));
}

function flattenSidebarForMp(tree, guides) {
  const out = [];
  const arr = Array.isArray(tree) ? tree : [];
  sortCategoriesForSidebar(arr).forEach((p) => {
    const ch = Array.isArray(p.children) ? sortCategoriesForSidebar(p.children) : [];
    const pushProducts = (l1, l2) => {
      guidesForL2(guides, l2).forEach((g) => {
        const thumb = g.iconUrlThumb || g.iconUrl ? fullUrl(String(g.iconUrlThumb || g.iconUrl)) : '';
        out.push({
          rowKey: `g-${g.id}`,
          id: g.id,
          guideId: g.id,
          parentL1Id: l1,
          parentL2Id: l2,
          name: g.name,
          isHeader: false,
          isSub: false,
          isProduct: true,
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
        isProduct: false,
        thumb: pickThumb(c0, p),
      });
      pushProducts(p.id, c0.id);
    } else if (ch.length > 1) {
      out.push({
        rowKey: `h-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        isHeader: true,
        firstChildId: ch[0].id,
        isSub: false,
        isProduct: false,
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
          isProduct: false,
          thumb: pickThumb(c, p),
        });
        pushProducts(p.id, c.id);
      });
    } else {
      out.push({
        rowKey: `p-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        isHeader: false,
        isSub: false,
        isProduct: false,
        thumb: pickThumb(null, p),
      });
    }
  });
  return out;
}

function firstGuideIdForL2(guides, l2Id) {
  const list = guidesForL2(guides, l2Id);
  return list.length ? list[0].id : null;
}

Page({
  data: {
    categories: [],
    allGuides: [],
    sidebarItems: [],
    visibleSidebarItems: [],
    expandedL1Id: null,
    expandedL2Id: null,
    selectedCategoryId: null,
    selectedGuideId: null,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    priceText: '0.00',
    pointsText: '—',
    loading: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!this.data.categories.length) this.loadCategories();
  },

  loadCategories() {
    Promise.all([app.request({ url: '/guides/categories' }), app.request({ url: '/guides' })])
      .then(([catRes, gRes]) => {
        const categories = catRes.data || [];
        const allGuides = gRes.data || [];
        const sidebarItems = flattenSidebarForMp(categories, allGuides);
        const first = sidebarItems.find((x) => !x.isHeader && !x.isProduct);
        const expandedL1Id = first ? findExpandedL1IdFromTree(categories, first.id) : null;
        const expandedL2Id = first && (first.mergedSingle || first.isSub) ? first.id : null;
        const selectedGuideId = expandedL2Id ? firstGuideIdForL2(allGuides, expandedL2Id) : null;
        const visibleSidebarItems = applyVisibleSidebarMp(
          sidebarItems,
          expandedL1Id,
          expandedL2Id,
          first ? first.id : null,
          selectedGuideId
        );
        this.setData({
          categories,
          allGuides,
          sidebarItems,
          expandedL1Id,
          expandedL2Id,
          selectedCategoryId: first ? first.id : null,
          selectedGuideId,
          visibleSidebarItems,
        });
        if (selectedGuideId) {
          this.loadDetail(selectedGuideId);
        }
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = (this.data.visibleSidebarItems || [])[idx];
    if (!item) return;
    if (item.isHeader && item.firstChildId) {
      const child = this.data.sidebarItems.find(
        (x) => Number(x.id) === Number(item.firstChildId) && !x.isHeader && !x.isProduct
      );
      if (child) {
        return this.selectCategoryByCat({
          id: child.id,
          mergedSingle: !!child.mergedSingle,
          isSub: !!child.isSub,
        });
      }
    }
    if (item.isProduct) {
      const expandedL1Id = findExpandedL1IdFromTree(this.data.categories, item.parentL2Id);
      const visibleSidebarItems = applyVisibleSidebarMp(
        this.data.sidebarItems,
        expandedL1Id,
        item.parentL2Id,
        item.parentL2Id,
        item.guideId
      );
      this.setData({
        selectedCategoryId: item.parentL2Id,
        expandedL1Id,
        expandedL2Id: item.parentL2Id,
        selectedGuideId: item.guideId,
        visibleSidebarItems,
      });
      this.loadDetail(item.guideId);
      return;
    }
    this.selectCategoryByCat({ id: item.id, mergedSingle: item.mergedSingle, isSub: item.isSub });
  },

  selectCategoryByCat(cat, skipExpandSync) {
    if (!cat || !cat.id) return;
    const categories = this.data.categories || [];
    const sidebarItems = this.data.sidebarItems || [];
    let expandedL1Id = this.data.expandedL1Id;
    if (!skipExpandSync) {
      expandedL1Id = findExpandedL1IdFromTree(categories, cat.id);
    }
    const expandedL2Id = cat.mergedSingle || cat.isSub ? cat.id : null;
    const selectedGuideId = expandedL2Id ? firstGuideIdForL2(this.data.allGuides, expandedL2Id) : null;
    const visibleSidebarItems = applyVisibleSidebarMp(
      sidebarItems,
      expandedL1Id,
      expandedL2Id,
      cat.id,
      selectedGuideId
    );
    this.setData({
      selectedCategoryId: cat.id,
      expandedL1Id,
      expandedL2Id,
      selectedGuideId,
      visibleSidebarItems,
      guide: {},
      loading: true,
    });
    if (selectedGuideId) {
      this.loadDetail(selectedGuideId);
    } else {
      this.setData({ loading: false });
    }
  },

  loadDetail(guideId) {
    const id = guideId;
    this.setData({ loading: true, selectedGuideId: id });
    const list = this.data.allGuides || [];
    const meta = list.find((g) => g.id === id) || {};
    const param = meta.slug || id;
    app.request({ url: `/guides/${param}` })
      .then((res) => {
        const g = res.data || {};
        const parse = (v) => {
          try {
            return Array.isArray(v) ? v : JSON.parse(v || '[]');
          } catch {
            return [];
          }
        };
        if (g.coverImage && !g.coverImage.startsWith('http')) {
          g.coverImage = app.globalData.baseUrl.replace('/api', '') + g.coverImage;
        }
        const mediaItems = parse(g.mediaItems).map((m) => {
          if (m.thumb && !m.thumb.startsWith('http')) m.thumb = app.globalData.baseUrl.replace('/api', '') + m.thumb;
          if (m.url && !m.url.startsWith('http')) m.url = app.globalData.baseUrl.replace('/api', '') + m.url;
          return m;
        });
        const helpItems = parse(g.helpItems);
        const sections = parse(g.sections);
        const lp = g.listPrice != null ? Number(g.listPrice) : 0;
        const pts =
          g.rewardPoints != null && Number(g.rewardPoints) > 0 ? String(g.rewardPoints) : '—';
        this.setData({
          guide: g,
          sections,
          mediaItems,
          helpItems,
          firstMediaTitle: mediaItems.length ? mediaItems[0].title || g.name : g.name,
          priceText: lp.toFixed(2),
          pointsText: pts,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  previewCover() {
    const url = this.data.guide.coverImage;
    if (url) wx.previewImage({ current: url, urls: [url] });
  },

  playShowcase() {
    const url = this.data.guide.showcaseVideo;
    if (url) wx.previewMedia({ sources: [{ url, type: 'video' }] });
  },

  openMedia(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    const mediaUrl = item.url || item.thumb;
    if (!mediaUrl) return;
    if (item.type === 'video') {
      wx.previewMedia({ sources: [{ url: mediaUrl, type: 'video' }] });
    } else {
      const images = this.data.mediaItems.filter((m) => m.type !== 'video').map((m) => m.url || m.thumb).filter(Boolean);
      wx.previewImage({ current: mediaUrl, urls: images.length ? images : [mediaUrl] });
    }
  },

  goManual() {
    const id = this.data.guide.id;
    wx.navigateTo({ url: `/pages/manual/manual?id=${id}` });
  },

  goMaintenance() {
    const id = this.data.guide.id;
    wx.navigateTo({ url: `/pages/maintenance/maintenance?id=${id}` });
  },

  goCart() {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  addToCart() {
    if (!app.checkLogin()) return;
    const gid = Number(this.data.guide.id);
    if (!gid) return;
    app
      .request({ url: '/auth/cart' })
      .then((res) => {
        const rows = (res.data && res.data.items) || [];
        const items = rows.map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
        const hit = items.find((x) => x.guideId === gid);
        if (hit) hit.qty += 1;
        else items.push({ guideId: gid, qty: 1 });
        return app.request({ url: '/auth/cart', method: 'PUT', data: { items } });
      })
      .then(() => wx.showToast({ title: '已加入购物车' }))
      .catch((e) => wx.showToast({ title: e.message || '失败', icon: 'none' }));
  },

  openBuy() {
    if (!app.checkLogin()) return;
    const gid = Number(this.data.guide.id);
    if (!gid) return;
    app
      .request({ url: '/auth/cart' })
      .then((res) => {
        const rows = (res.data && res.data.items) || [];
        const items = rows.map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
        const hit = items.find((x) => x.guideId === gid);
        if (hit) hit.qty += 1;
        else items.push({ guideId: gid, qty: 1 });
        return app.request({ url: '/auth/cart', method: 'PUT', data: { items } });
      })
      .then(() => wx.navigateTo({ url: '/pages/checkout/checkout' }))
      .catch((e) => wx.showToast({ title: e.message || '失败', icon: 'none' }));
  },
});
