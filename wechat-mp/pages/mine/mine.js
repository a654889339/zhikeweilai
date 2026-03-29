const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    avatarInitial: 'V',
    avatarUrl: '',
    maskedPhone: '',
    profileHeaderStyle: 'background: linear-gradient(135deg, #B91C1C, #7F1D1D);',
    stats: [
      { label: '待支付', value: 0 },
      { label: '进行中', value: 0 },
      { label: '待评价', value: 0 },
      { label: '售后', value: 0 },
    ],
    menus: [
      { title: '我的订单', icon: '/images/icons/mine-orders.svg', url: '/pages/orders/orders' },
      { title: '我的商品', icon: '/images/icons/mine-bag.svg', url: '/pages/my-products/my-products' },
      { title: '地址管理', icon: '/images/icons/mine-location.svg', url: '/pages/address/address' },
      { title: '优惠券', icon: '/images/icons/mine-bag.svg', url: '' },
      { title: '意见反馈', icon: '/images/icons/mine-comment.svg', url: '', chat: true },
      { title: '关于' + (getApp().globalData.companyName || '服务'), icon: '/images/icons/mine-info.svg', url: '', webUrl: 'www.vinotech.cn' },
      { title: '联系我们', icon: '/images/icons/mine-phone.svg', url: '', contact: true },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.checkLoginState();
    this.loadMineBg();
  },

  loadMineBg() {
    app.request({ url: '/home-config' }).then(res => {
      const list = res.data || [];
      const mineBg = list.find(i => i.section === 'mineBg' && i.status === 'active');
      const style = mineBg && mineBg.imageUrl
        ? 'background-image: url(' + mineBg.imageUrl + '); background-size: cover; background-position: center;'
        : 'background: linear-gradient(135deg, #B91C1C, #7F1D1D);';
      this.setData({ profileHeaderStyle: style });
    }).catch(() => {});
  },

  checkLoginState() {
    const isLoggedIn = app.isLoggedIn();
    if (isLoggedIn && !app.globalData.userInfo) {
      app
        .request({ url: '/auth/profile' })
        .then(res => {
          const user = res.data || {};
          app.globalData.userInfo = user;
          this.applyUserData(user);
        })
        .catch(() => {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
        });
    } else {
      const user = app.globalData.userInfo || null;
      if (user) {
        this.applyUserData(user);
      } else {
        this.setData({ userInfo: null, isLoggedIn: isLoggedIn, avatarUrl: '', avatarInitial: 'V' });
      }
    }
  },

  applyUserData(user) {
    const initial = (user.nickname || user.username || 'V').charAt(0);
    const avatarUrl = user.avatar || '';
    const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    this.setData({ userInfo: user, isLoggedIn: true, avatarInitial: initial, avatarUrl, maskedPhone });
  },

  onProfileTap() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
    } else {
      wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
    }
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.chat) {
      wx.navigateTo({ url: '/pages/chat/chat' });
    } else if (item.webUrl) {
      wx.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.contact) {
      wx.showModal({
        title: '联系我们',
        content: '客服电话：400-8030-683',
        cancelText: '复制',
        confirmText: '立刻拨打',
        success: (res) => {
          if (res.confirm) {
            wx.makePhoneCall({ phoneNumber: '4008030683' });
          } else {
            wx.setClipboardData({ data: '400-8030-683', success: () => wx.showToast({ title: '已复制' }) });
          }
        },
      });
    } else if (item.url) {
      wx.navigateTo({ url: item.url, fail() { wx.switchTab({ url: item.url }); } });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      },
    });
  },
});
