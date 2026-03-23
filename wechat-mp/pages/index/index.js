const app = getApp();

Page({
  data: {
    headerLogoUrl: '',
    heroBgUrl: '',
    heroBgList: [],
    navSectionTitle: '自助预约',
    myProductsTitle: '我的商品',
    hotServiceTitle: '热门服务',
    recommendTitle: '为你推荐',
    navLgItems: [],
    navSmItems: [],
    myProducts: [],
    hotServices: [],
    recommends: [
      { id: 1, title: '会员权益', desc: '专属折扣', emoji: '🏅', bg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
      { id: 2, title: '服务保障', desc: '无忧售后', emoji: '🛡️', bg: 'linear-gradient(135deg, #10B981, #059669)' },
      { id: 3, title: '积分商城', desc: '好礼兑换', emoji: '🎁', bg: 'linear-gradient(135deg, #EC4899, #DB2777)' },
      { id: 4, title: '邀请有礼', desc: '分享得佣金', emoji: '👥', bg: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.loadHomeConfig();
    this.loadHotServices();
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
        const navSectionTitleItem = items.find(i => i.section === 'navSectionTitle' && i.status === 'active');
        const hotServiceTitleItem = items.find(i => i.section === 'hotServiceTitle' && i.status === 'active');
        const recommendTitleItem = items.find(i => i.section === 'recommendTitle' && i.status === 'active');
        const myProductsTitleItem = items.find(i => i.section === 'myProducts' && i.status === 'active');
        const navLg = items.filter(i => i.section === 'navLg' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => ({ id: i.id, title: i.title, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb || '', icon: i.icon, path: i.path || '/pages/service/service', color: i.color }));
        const navSm = items.filter(i => i.section === 'navSm' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => ({ id: i.id, title: i.title, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb || '', icon: i.icon, path: i.path || '/pages/service/service', color: i.color }));
        this.setData({
          headerLogoUrl: headerLogo ? toFull(headerLogo.imageUrl) : '',
          heroBgUrl: singleBg,
          heroBgList: homeBgList,
          navSectionTitle: (navSectionTitleItem && navSectionTitleItem.title) ? navSectionTitleItem.title.trim() : '自助预约',
          hotServiceTitle: (hotServiceTitleItem && hotServiceTitleItem.title) ? hotServiceTitleItem.title.trim() : '热门服务',
          recommendTitle: (recommendTitleItem && recommendTitleItem.title) ? recommendTitleItem.title.trim() : '为你推荐',
          myProductsTitle: (myProductsTitleItem && myProductsTitleItem.title) ? myProductsTitleItem.title.trim() : '我的商品',
          navLgItems: navLg,
          navSmItems: navSm,
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

  loadHotServices() {
    app.request({ url: '/services' })
      .then(res => {
        const data = (res.data || []).slice(0, 8);
        const hotServices = data.map(s => ({
          id: s.id, title: s.title || '服务', desc: s.description || '专业服务',
          price: s.price || 0, emoji: '🔧', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)',
        }));
        this.setData({ hotServices: hotServices.length ? hotServices : this.getFallbackHotServices() });
      })
      .catch(() => this.setData({ hotServices: this.getFallbackHotServices() }));
  },

  getFallbackHotServices() {
    return [
      { id: 1, title: '设备维修', desc: '专业工程师', price: '99', emoji: '🔧', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
      { id: 2, title: '深度清洁', desc: '全方位保养', price: '149', emoji: '✨', bg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
      { id: 3, title: '系统检测', desc: '全面评估', price: '49', emoji: '🔍', bg: 'linear-gradient(135deg, #059669, #047857)' },
      { id: 4, title: '数据恢复', desc: '专业找回', price: '199', emoji: '💾', bg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
    ];
  },

  goPath(e) {
    const path = e.currentTarget.dataset.path || '';
    if (path) {
      wx.navigateTo({ url: path, fail() { wx.switchTab({ url: path }); } });
    }
  },

  goService() { wx.switchTab({ url: '/pages/service/service' }); },
  goServiceList() { wx.switchTab({ url: '/pages/service/service' }); },

  goServiceDetail(e) {
    wx.navigateTo({ url: '/pages/service-detail/service-detail?id=' + e.currentTarget.dataset.id });
  },
});
