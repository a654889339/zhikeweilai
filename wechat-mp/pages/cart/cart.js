const app = getApp();

Page({
  data: {
    loading: true,
    lines: [],
    totalPrice: 0,
    totalPoints: 0,
    checkoutShow: false,
    submitting: false,
    contactName: '',
    contactPhone: '',
    address: '',
    remark: '',
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

  onQtyInput(e) {
    const id = e.currentTarget.dataset.id;
    let v = parseInt(e.detail.value, 10);
    if (Number.isNaN(v) || v < 1) v = 1;
    if (v > 9999) v = 9999;
    const lines = (this.data.lines || []).map((row) =>
      row.guideId === id ? { ...row, qty: v } : row
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
    const items = (this.data.lines || []).map((x) => ({ guideId: x.guideId, qty: x.qty }));
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

  openCheckout() {
    this.setData({ checkoutShow: true });
  },

  closeCheckout() {
    this.setData({ checkoutShow: false });
  },

  noop() {},

  onField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [k]: e.detail.value });
  },

  submitOrder() {
    const name = (this.data.contactName || '').trim();
    const phone = (this.data.contactPhone || '').trim();
    if (!name || !phone) {
      wx.showToast({ title: '请填写联系人和电话', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    app
      .request({
        url: '/orders/cart-checkout',
        method: 'POST',
        data: {
          contactName: name,
          contactPhone: phone,
          address: (this.data.address || '').trim(),
          remark: (this.data.remark || '').trim(),
        },
      })
      .then(() => {
        this.setData({ checkoutShow: false, submitting: false });
        wx.showToast({ title: '订单已创建' });
        wx.navigateTo({ url: '/pages/orders/orders' });
      })
      .catch((err) => {
        this.setData({ submitting: false });
        wx.showToast({ title: err.message || '下单失败', icon: 'none' });
      });
  },
});
