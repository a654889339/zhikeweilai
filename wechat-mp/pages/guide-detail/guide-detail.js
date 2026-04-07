const app = getApp();

Page({
  data: {
    loading: true,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    priceText: '0.00',
    pointsText: '—',
    buyShow: false,
    buyName: '',
    buyPhone: '',
    buyAddr: '',
  },

  onLoad(options) {
    if (options.id) this.loadGuide(options.id);
    else this.setData({ loading: false });
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        wx.setNavigationBarTitle({ title: g.name || '设备指南' });
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        const base = app.globalData.baseUrl.replace('/api', '');
        const fix = u => (u && !u.startsWith('http') ? base + u : u);
        if (g.coverImage) g.coverImage = fix(g.coverImage);
        if (g.coverImageThumb) g.coverImageThumb = fix(g.coverImageThumb);
        if (g.iconUrl) g.iconUrl = fix(g.iconUrl);
        if (g.iconUrlThumb) g.iconUrlThumb = fix(g.iconUrlThumb);
        g.displayCoverUrl = g.coverImageThumb || g.coverImage;
        g.displayIconUrl = g.iconUrlThumb || g.iconUrl;
        const mediaItems = parse(g.mediaItems).map(m => {
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
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.name) : g.name,
          priceText: lp.toFixed(2),
          pointsText: pts,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onCoverLoad() {
    const g = this.data.guide;
    if (g.coverImageThumb && g.displayCoverUrl === g.coverImageThumb) {
      this.setData({ 'guide.displayCoverUrl': g.coverImage });
    }
  },
  onIconLoad() {
    const g = this.data.guide;
    if (g.iconUrlThumb && g.displayIconUrl === g.iconUrlThumb) {
      this.setData({ 'guide.displayIconUrl': g.iconUrl });
    }
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
      const images = this.data.mediaItems
        .filter(m => m.type !== 'video')
        .map(m => m.url || m.thumb)
        .filter(Boolean);
      const idx = images.indexOf(mediaUrl);
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

  goCart() {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  noop() {},

  addToCart() {
    if (!app.checkLogin()) return;
    const gid = this.data.guide.id;
    if (!gid) return;
    app
      .request({ url: '/auth/cart' })
      .then((res) => {
        const rows = (res.data && res.data.items) || [];
        const items = rows.map((x) => ({ guideId: x.guideId, qty: x.qty }));
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
    this.setData({ buyShow: true });
  },

  closeBuy() {
    this.setData({ buyShow: false });
  },

  onBuyField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [k]: e.detail.value });
  },

  submitBuy() {
    const name = (this.data.buyName || '').trim();
    const phone = (this.data.buyPhone || '').trim();
    if (!name || !phone) {
      wx.showToast({ title: '请填写联系人和电话', icon: 'none' });
      return;
    }
    const g = this.data.guide;
    const price = g.listPrice != null ? Number(g.listPrice) : 0;
    app
      .request({
        url: '/orders',
        method: 'POST',
        data: {
          serviceTitle: g.name || '商品',
          serviceIcon: g.icon || 'shopping-cart-o',
          price,
          contactName: name,
          contactPhone: phone,
          address: (this.data.buyAddr || '').trim(),
          guideId: g.id,
        },
      })
      .then(() => {
        this.setData({ buyShow: false });
        wx.showToast({ title: '下单成功' });
        wx.navigateTo({ url: '/pages/orders/orders' });
      })
      .catch((e) => wx.showToast({ title: e.message || '下单失败', icon: 'none' }));
  },
});
