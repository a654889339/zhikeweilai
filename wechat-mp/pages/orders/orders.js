const app = getApp();

const statusMap = {
  pending: { text: '待支付', type: 'warning' },
  paid: { text: '已支付', type: 'primary' },
  processing: { text: '进行中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'default' },
};

Page({
  data: {
    isLoggedIn: false,
    activeTab: 0,
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'pending', name: '待支付' },
      { key: 'paid', name: '已支付' },
      { key: 'processing', name: '进行中' },
      { key: 'completed', name: '已完成' },
      { key: 'cancelled', name: '已取消' },
    ],
    orders: [],
    loading: true,
    statusMap,
  },

  onLoad(options) {
    if (options.status) {
      const idx = this.data.tabs.findIndex((t) => t.key === options.status);
      if (idx >= 0) {
        this.setData({ activeTab: idx });
      }
    }
  },

  onShow() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadOrders() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn });
    if (!isLoggedIn) {
      this.setData({ orders: [], loading: false });
      return Promise.resolve();
    }
    const status = this.data.tabs[this.data.activeTab].key;
    const url = status === 'all' ? '/orders/mine' : `/orders/mine?status=${status}`;
    this.setData({ loading: true });
    return app
      .request({ url })
      .then(res => {
        const raw = res.data || {};
        const arr = raw.list || raw;
        const data = (Array.isArray(arr) ? arr : []).map(o => ({
          ...o,
          statusText: (statusMap[o.status] || {}).text || o.status,
          statusType: (statusMap[o.status] || {}).type || 'default',
          timeText: this.formatTime(o.createdAt),
        }));
        this.setData({ orders: data, loading: false });
      })
      .catch(err => {
        this.setData({ loading: false, orders: [] });
        if (err.message === '请先登录') {
          wx.showToast({ title: '请先登录', icon: 'none' });
        }
      });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({ activeTab: index });
    this.loadOrders();
  },

  formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  payOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    app
      .request({ method: 'POST', url: `/orders/${id}/pay-wechat` })
      .then((res) => {
        const p = res.data || {};
        wx.requestPayment({
          timeStamp: p.timeStamp,
          nonceStr: p.nonceStr,
          package: p.package,
          signType: p.signType || 'RSA',
          paySign: p.paySign,
          success: () => {
            wx.showToast({ title: '支付成功', icon: 'success' });
            this.loadOrders();
          },
          fail: (err) => {
            const msg = (err && err.errMsg) || '';
            if (msg.indexOf('cancel') !== -1) return;
            wx.showToast({ title: '支付未完成', icon: 'none' });
          },
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '无法发起支付', icon: 'none' });
      });
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: res => {
        if (res.confirm) {
          app
            .request({ method: 'PUT', url: `/orders/${id}/cancel` })
            .then(() => {
              wx.showToast({ title: '订单已取消', icon: 'success' });
              this.loadOrders();
            })
            .catch(err => {
              wx.showToast({ title: err.message || '取消失败', icon: 'none' });
            });
        }
      },
    });
  },
});
