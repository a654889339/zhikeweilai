Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
      { pagePath: '/pages/products/products', text: '产品', icon: '🏷' },
      { pagePath: '/pages/chatgroup/chatgroup', text: '群组', icon: '👥' },
      { pagePath: '/pages/orders/orders', text: '订单', icon: '📦' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '👤' },
    ],
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      wx.switchTab({
        url: this.data.list[index].pagePath,
      });
      this.setData({ selected: index });
    },
  },
});
