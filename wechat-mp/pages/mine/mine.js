const app = getApp();

const ORDER_SHORTCUTS = [
  { key: 'pending', badgeKey: 'pending', label: '待付款', iconChar: '付' },
  { key: 'paid', badgeKey: 'paid', label: '待发货', iconChar: '发' },
  { key: 'processing', badgeKey: 'processing', label: '待收货', iconChar: '收' },
  { key: 'completed', badgeKey: 'completed', label: '待评价', iconChar: '评' },
  { key: 'cancelled', badgeKey: 'cancelled', label: '退款/售后', iconChar: '退' },
];

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    avatarInitial: '用',
    avatarUrl: '',
    profileSubtitle: '',
    profileHeaderStyle: 'background: linear-gradient(135deg, #B91C1C, #7F1D1D);',
    assetPoints: '—',
    assetCoupons: '—',
    assetWallet: '—',
    orderShortcuts: ORDER_SHORTCUTS,
    orderStats: {
      pending: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
    },
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.checkLoginState();
    this.loadMineBg();
  },

  loadMineBg() {
    app.request({ url: '/home-config?all=1' }).then((res) => {
      const list = res.data || [];
      const mineBg = list.find((i) => i.section === 'mineBg' && i.status === 'active');
      const style = mineBg && mineBg.imageUrl
        ? 'background-image: url(' + mineBg.imageUrl + '); background-size: cover; background-position: center;'
        : 'background: linear-gradient(160deg, #1d1d1f 0%, #B91C1C 100%);';
      this.setData({ profileHeaderStyle: style });
    }).catch(() => {});
  },

  checkLoginState() {
    const isLoggedIn = app.isLoggedIn();
    if (isLoggedIn && !app.globalData.userInfo) {
      app
        .request({ url: '/auth/profile' })
        .then((res) => {
          const user = res.data || {};
          app.globalData.userInfo = user;
          this.applyUserData(user);
          this.loadOrderStats();
        })
        .catch(() => {
          app.clearToken();
          this.setData({
            userInfo: null,
            isLoggedIn: false,
            avatarUrl: '',
            avatarInitial: '用',
            profileSubtitle: '',
            orderStats: { pending: 0, paid: 0, processing: 0, completed: 0, cancelled: 0 },
          });
          this.resetAssets();
        });
    } else {
      const user = app.globalData.userInfo || null;
      if (user) {
        this.applyUserData(user);
        this.loadOrderStats();
      } else {
        this.setData({
          userInfo: null,
          isLoggedIn,
          avatarUrl: '',
          avatarInitial: '用',
          profileSubtitle: '',
          orderStats: { pending: 0, paid: 0, processing: 0, completed: 0, cancelled: 0 },
        });
        this.resetAssets();
      }
    }
  },

  resetAssets() {
    this.setData({ assetPoints: '—', assetCoupons: '—', assetWallet: '—' });
  },

  applyUserData(user) {
    const initial = (user.nickname || user.username || '用').charAt(0);
    const avatarUrl = user.avatar || '';
    let profileSubtitle = '未绑定手机';
    if (user.phone) {
      profileSubtitle = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    } else if (user.email) {
      profileSubtitle = user.email;
    }
    const points = user.points != null ? user.points : 0;
    const coupons = user.couponCount != null ? user.couponCount : 0;
    const w = user.walletBalance;
    const n = Number(w);
    const wallet = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    this.setData({
      userInfo: user,
      isLoggedIn: true,
      avatarInitial: initial,
      avatarUrl,
      profileSubtitle,
      assetPoints: points,
      assetCoupons: coupons,
      assetWallet: wallet,
    });
  },

  loadOrderStats() {
    if (!app.isLoggedIn()) return;
    app
      .request({ url: '/orders/mine/stats' })
      .then((res) => {
        const d = res.data || {};
        this.setData({
          orderStats: {
            pending: d.pending || 0,
            paid: d.paid || 0,
            processing: d.processing || 0,
            completed: d.completed || 0,
            cancelled: d.cancelled || 0,
          },
        });
      })
      .catch(() => {});
  },

  onProfileTap() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
    } else {
      wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
    }
  },

  onAssetTap(e) {
    const type = e.currentTarget.dataset.type;
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    if (type === 'coupon') {
      wx.showToast({ title: '购物券详情敬请期待', icon: 'none' });
    } else if (type === 'wallet') {
      wx.showToast({ title: '钱包功能敬请期待', icon: 'none' });
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goOrdersAll() {
    if (!app.isLoggedIn()) {
      this.goLogin();
      return;
    }
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  goOrderShortcut(e) {
    const key = e.currentTarget.dataset.key;
    if (!app.isLoggedIn()) {
      this.goLogin();
      return;
    }
    wx.navigateTo({ url: '/pages/orders/orders?status=' + key });
  },

  goProducts() {
    wx.switchTab({ url: '/pages/products/products' });
  },

  goService() {
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  goSecurity() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  },

  /** 我的班级 → 群组 tab（与 H5 /chatgroup 一致） */
  goMyClass() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.switchTab({ url: '/pages/chatgroup/chatgroup' });
  },

  goMyProducts() {
    wx.navigateTo({ url: '/pages/my-products/my-products' });
  },

  goAddress() {
    wx.navigateTo({ url: '/pages/address/address' });
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  goContact() {
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
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearToken();
          this.setData({
            userInfo: null,
            isLoggedIn: false,
            avatarUrl: '',
            avatarInitial: '用',
            profileSubtitle: '',
            orderStats: { pending: 0, paid: 0, processing: 0, completed: 0, cancelled: 0 },
          });
          this.resetAssets();
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      },
    });
  },
});
