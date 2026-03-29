const app = getApp();

Page({
  data: {
    categories: [],
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
      .then(res => {
        const categories = res.data || [];
        this.setData({ categories });
        if (categories.length) {
          this.selectCategoryByCat(categories[0]);
        }
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.selectedCategoryId) return;
    const cat = this.data.categories.find(c => c.id === id);
    if (cat) this.selectCategoryByCat(cat);
  },

  selectCategoryByCat(cat) {
    this.setData({ selectedCategoryId: cat.id, deviceGuides: [], activeId: null, guide: {}, loading: true });
    app.request({ url: '/guides', data: { categoryId: cat.id } })
      .then(res => {
        const list = (res.data || []).map(g => ({
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
    this.setData({ activeId: id, productPickerIndex: pickerIndex !== undefined ? pickerIndex : this.data.productPickerIndex, loading: true });
    const guideName = (this.data.deviceGuides.find(g => g.id === id) || {}).name || '';
    app.request({ url: `/guides/${param}` })
      .then(res => {
        const g = res.data || {};
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        if (g.coverImage && !g.coverImage.startsWith('http')) {
          g.coverImage = app.globalData.baseUrl.replace('/api', '') + g.coverImage;
        }
        const mediaItems = parse(g.mediaItems).map(m => {
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
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.name) : g.name,
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
      const images = this.data.mediaItems.filter(m => m.type !== 'video').map(m => m.url || m.thumb).filter(Boolean);
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
