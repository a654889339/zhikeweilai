const app = getApp();

function formatAddr(addr) {
  if (!addr) return '';
  const parts = [];
  if (addr.country === '其他') parts.push(addr.customCountry || '其他');
  else if (addr.country) parts.push(addr.country);
  if (addr.country === '中国大陆') {
    if (addr.province) parts.push(addr.province);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);
  }
  if (addr.detailAddress) parts.push(addr.detailAddress);
  return parts.join(' ');
}

Page({
  data: {
    loading: true,
    lines: [],
    totalPrice: 0,
    totalPoints: 0,
    addresses: [],
    selectedId: null,
    contactName: '',
    contactPhone: '',
    address: '',
    remark: '',
    submitting: false,
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.showModal({
        title: '未登录',
        content: '请先登录',
        success: (r) => {
          if (r.confirm) wx.navigateTo({ url: '/pages/login/login' });
          else wx.navigateBack();
        },
      });
      return;
    }
    this.load();
  },

  load() {
    this.setData({ loading: true });
    Promise.all([
      app.request({ url: '/auth/cart' }),
      app.request({ url: '/auth/profile' }),
      app.request({ url: '/addresses' }),
    ])
      .then(([cartRes, profRes, addrRes]) => {
        const c = cartRes.data || {};
        const lines = Array.isArray(c.items) ? c.items : [];
        const profile = profRes.data || {};
        const raw = addrRes.data;
        const list = Array.isArray(raw) ? raw : [];
        const addresses = list.map((a) => ({ ...a, _fmt: formatAddr(a) }));
        const def = addresses.find((a) => a.isDefault) || addresses[0];
        let contactName = '';
        let contactPhone = '';
        let address = '';
        let selectedId = null;
        if (def) {
          selectedId = def.id;
          contactName = def.contactName || profile.nickname || '';
          contactPhone = def.contactPhone || profile.phone || '';
          address = formatAddr(def);
        } else {
          contactName = (profile.nickname || '').trim();
          contactPhone = (profile.phone || '').trim();
        }
        this.setData({
          lines,
          totalPrice: c.totalPrice || 0,
          totalPoints: c.totalPoints || 0,
          addresses,
          selectedId,
          contactName,
          contactPhone,
          address,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false, lines: [] }));
  },

  pickAddr(e) {
    const id = e.currentTarget.dataset.id;
    const addr = this.data.addresses.find((a) => a.id === id);
    if (!addr) return;
    this.setData({
      selectedId: id,
      contactName: addr.contactName || '',
      contactPhone: addr.contactPhone || '',
      address: formatAddr(addr),
    });
  },

  onField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [k]: e.detail.value });
  },

  goProducts() {
    wx.switchTab({ url: '/pages/products/products' });
  },

  submit() {
    const name = (this.data.contactName || '').trim();
    const phone = (this.data.contactPhone || '').trim();
    if (!name || !phone) {
      wx.showToast({ title: '请填写收货人和手机号', icon: 'none' });
      return;
    }
    if (!this.data.lines.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
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
        wx.showToast({ title: '订单已提交' });
        wx.redirectTo({ url: '/pages/orders/orders' });
      })
      .catch((e) => wx.showToast({ title: e.message || '失败', icon: 'none' }))
      .finally(() => this.setData({ submitting: false }));
  },
});
