const app = getApp();

Page({
  data: {
    addresses: [],
    loading: false,
  },

  onShow() {
    this.loadAddresses();
  },

  loadAddresses() {
    this.setData({ loading: true });
    app.request({ url: '/addresses' })
      .then(res => {
        const list = (res.data || []).map(a => ({
          ...a,
          fullAddress: [a.country === '其他' ? a.customCountry : a.country, a.province, a.city, a.district, a.detailAddress].filter(Boolean).join(' '),
        }));
        this.setData({ addresses: list, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  addAddr() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  editAddr(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/address-edit/address-edit?id=' + id });
  },

  setDefault(e) {
    const id = e.currentTarget.dataset.id;
    app.request({ url: '/addresses/' + id + '/default', method: 'PUT' })
      .then(() => this.loadAddresses())
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));
  },

  deleteAddr(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: res => {
        if (res.confirm) {
          app.request({ url: '/addresses/' + id, method: 'DELETE' })
            .then(() => this.loadAddresses())
            .catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
        }
      },
    });
  },
});
