const app = getApp();

Page({
  data: {
    loading: true,
    lines: [],
    totalPrice: 0,
    totalPoints: 0,
  },

  onShow() {
    this.loadCart();
  },

  loadCart() {
    if (!app.isLoggedIn()) {
      this.setData({ loading: false, lines: [] });
      wx.showModal({
        title: '未登录',
        content: '请先登录后查看购物车',
        confirmText: '去登录',
        success: (r) => {
          if (r.confirm) wx.navigateTo({ url: '/pages/login/login' });
        },
      });
      return;
    }
    this.setData({ loading: true });
    app
      .request({ url: '/auth/cart' })
      .then((res) => {
        const d = res.data || {};
        this.setData({
          lines: Array.isArray(d.items) ? d.items : [],
          totalPrice: d.totalPrice || 0,
          totalPoints: d.totalPoints || 0,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false, lines: [] }));
  },

  goProducts() {
    wx.switchTab({ url: '/pages/products/products' });
  },

  goCheckout() {
    if (!(this.data.lines || []).length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },

  onQtyInput(e) {
    const id = Number(e.currentTarget.dataset.id);
    let v = parseInt(e.detail.value, 10);
    if (Number.isNaN(v) || v < 1) v = 1;
    if (v > 9999) v = 9999;
    const lines = (this.data.lines || []).map((row) =>
      Number(row.guideId) === id ? { ...row, qty: v } : row
    );
    this.setData({ lines });
    this.syncCartDebounced();
  },

  syncTimer: null,
  syncCartDebounced() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncCart(), 300);
  },

  syncCart() {
    const items = (this.data.lines || []).map((x) => ({
      guideId: Number(x.guideId),
      qty: Number(x.qty) || 1,
    }));
    app
      .request({ url: '/auth/cart', method: 'PUT', data: { items } })
      .then((res) => {
        const d = res.data || {};
        this.setData({
          lines: Array.isArray(d.items) ? d.items : [],
          totalPrice: d.totalPrice || 0,
          totalPoints: d.totalPoints || 0,
        });
      })
      .catch((err) => wx.showToast({ title: err.message || '更新失败', icon: 'none' }));
  },
});
