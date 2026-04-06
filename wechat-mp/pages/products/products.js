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

/** 与 H5 Products.vue 一致：单二级时合并一行；多二级时一级标题 + 子项 */
function flattenSidebarForMp(tree) {
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
        thumb: pickThumb(c0, p),
      });
    } else if (ch.length > 1) {
      out.push({
        rowKey: `h-${p.id}`,
        id: p.id,
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
        name: p.name,
        isHeader: false,
        isSub: false,
        thumb: pickThumb(null, p),
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
    deviceGuides: [],
    activeId: null,
    selectedProductLabel: '',
    productPickerIndex: 0,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    loading: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!this.data.categories.length) this.loadCategories();
  },

  loadCategories() {
    app.request({ url: '/guides/categories' })
      .then((res) => {
        const categories = res.data || [];
        const sidebarItems = flattenSidebarForMp(categories);
        this.setData({ categories, sidebarItems });
        const first = sidebarItems.find((x) => !x.isHeader);
        if (first) {
          this.selectCategoryByCat({ id: first.id });
        }
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = (this.data.sidebarItems || [])[idx];
    if (!item) return;
    if (item.isHeader && item.firstChildId) {
      return this.selectCategoryByCat({ id: item.firstChildId });
    }
    const id = item.id;
    if (id === this.data.selectedCategoryId) return;
    this.selectCategoryByCat({ id });
  },

  selectCategoryByCat(cat) {
    if (!cat || !cat.id) return;
    this.setData({ selectedCategoryId: cat.id, deviceGuides: [], activeId: null, guide: {}, loading: true });
    app.request({ url: '/guides', data: { categoryId: cat.id } })
      .then((res) => {
        const list = (res.data || []).map((g) => ({
          id: g.id,
          name: g.name,
          slug: g.slug || '',
        }));
        this.setData({ deviceGuides: list, loading: false });
        if (list.length) {
          this.loadDetail(list[0].slug || list[0].id, list[0].id, 0);
        }
      })
      .catch(() => this.setData({ loading: false }));
  },

  onProductPick(e) {
    const index = parseInt(e.detail.value, 10);
    const list = this.data.deviceGuides;
    const item = list[index];
    if (!item) return;
    this.loadDetail(item.slug || item.id, item.id, index);
  },

  loadDetail(param, id, pickerIndex) {
    this.setData({
      activeId: id,
      productPickerIndex: pickerIndex !== undefined ? pickerIndex : this.data.productPickerIndex,
      loading: true,
    });
    const guideName = (this.data.deviceGuides.find((g) => g.id === id) || {}).name || '';
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
        this.setData({
          guide: g,
          sections,
          mediaItems,
          helpItems,
          selectedProductLabel: guideName || g.name,
          firstMediaTitle: mediaItems.length ? mediaItems[0].title || g.name : g.name,
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

  goServices() {
    wx.switchTab({ url: '/pages/products/products' });
  },
});
