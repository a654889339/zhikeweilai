const app = getApp();

Page({
  data: {
    headerLogoUrl: '',
    heroBgUrl: '',
    heroBgList: [],
    myProductsTitle: '我的实验材料',
    navLgItems: [],
    navSmItems: [],
    myProducts: [],
    hotServices: [],
    recommends: [],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.loadHomeConfig();
    this.loadMyProducts();
  },

  loadMyProducts() {
    if (!(getApp().globalData.token || wx.getStorageSync('vino_token'))) {
      this.setData({ myProducts: [] });
      return;
    }
    getApp().request({ url: '/auth/my-products' })
      .then(res => {
        const list = res.data || [];
        const base = (getApp().globalData.baseUrl || '').replace(/\/api\/?$/, '') || 'http://106.54.50.88:5302';
        const toFull = (u) => {
          if (!u || typeof u !== 'string') return u || '';
          const t = String(u).trim();
          if (t.startsWith('http')) return t;
          return base + (t.startsWith('/') ? t : '/' + t);
        };
        const myProducts = list.map(item => ({
          ...item,
          iconUrl: item.iconUrl ? toFull(item.iconUrl) : '',
          iconUrlThumb: item.iconUrlThumb ? toFull(item.iconUrlThumb) : '',
        }));
        this.setData({ myProducts });
      })
      .catch(() => this.setData({ myProducts: [] }));
  },

  goMyProducts() {
    wx.navigateTo({ url: '/pages/my-products/my-products' });
  },

  goMyProductGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      wx.showToast({ title: '暂无产品指南', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  loadHomeConfig() {
    const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '') || 'http://106.54.50.88:5302';
    const toFull = (u) => {
      if (!u || typeof u !== 'string') return u || '';
      const t = u.trim();
      if (t.startsWith('http://') || t.startsWith('https://')) return t;
      return base + (t.startsWith('/') ? t : '/' + t);
    };
    app.request({ url: '/home-config?all=1' })
      .then(res => {
        const items = res.data || [];
        const headerLogo = items.find(i => i.section === 'headerLogo' && i.status === 'active');
        const homeBgItems = items.filter(i => i.section === 'homeBg' && i.status === 'active');
        const homeBgList = homeBgItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map(i => {
            const url = toFull(i.imageUrl);
            const thumb = (i.imageUrlThumb && i.imageUrlThumb.trim()) ? toFull(i.imageUrlThumb.trim()) : '';
            // 轮播必须使用原图：推导/缺失的缩略图在 COS 上常 404，会导致整页空白
            const displayUrl = url;
            return { url, thumb, displayUrl };
          })
          .filter(i => i.url);
        const singleBg = homeBgList[0] ? homeBgList[0].displayUrl : '';
        const myProductsTitleItem = items.find(i => i.section === 'myProducts' && i.status === 'active');
        this.setData({
          headerLogoUrl: headerLogo ? toFull(headerLogo.imageUrl) : '',
          heroBgUrl: singleBg,
          heroBgList: homeBgList,
          myProductsTitle: (myProductsTitleItem && myProductsTitleItem.title) ? myProductsTitleItem.title.trim() : '我的实验材料',
          navSectionTitle: '',
          hotServiceTitle: '',
          recommendTitle: '',
          navLgItems: [],
          navSmItems: [],
          hotServices: [],
          recommends: [],
        });
      })
      .catch(() => {});
  },

  /** 缩略图/轮播图加载失败时回退原图（避免 404 导致空白） */
  onHeroBgError(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = this.data.heroBgList || [];
    if (!list[idx] || !list[idx].url) return;
    if (list[idx].displayUrl === list[idx].url) return;
    list[idx] = { ...list[idx], displayUrl: list[idx].url };
    this.setData({ heroBgList: list });
  },

  /** 后台配置的 H5 路径转为小程序 tab 页或非 tab 页路径 */
  webPathToMpTabOrPage(webPath) {
    const p = (webPath && String(webPath).trim()) || '';
    if (!p) return '/pages/products/products';
    if (p.startsWith('/pages/')) {
      if (p.indexOf('/service') !== -1) return '/pages/products/products';
      return p;
    }
    if (p === '/products' || p.startsWith('/products?')) return '/pages/products/products';
    if (p.startsWith('/guide/')) {
      const slug = p.replace(/^\/guide\//, '').split('/')[0];
      if (slug) return `/pages/guide-detail/guide-detail?id=${encodeURIComponent(slug)}`;
    }
    if (p.startsWith('/service/') || p.startsWith('/services')) return '/pages/products/products';
    return '/pages/products/products';
  },

  // getFallbackHotServices 已不再需要（已移除自助服务/服务产品板块）

  goPath(e) {
    const path = e.currentTarget.dataset.path || '';
    if (path) {
      wx.navigateTo({ url: path, fail() { wx.switchTab({ url: path }); } });
    }
  },

  goService() { wx.switchTab({ url: '/pages/products/products' }); },
  goServiceList() { wx.switchTab({ url: '/pages/products/products' }); },
});
