const app = getApp();

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    if (!app.isLoggedIn()) {
      this.setData({ list: [], loading: false });
      return;
    }
    this.setData({ loading: true });
    app.request({ url: '/auth/my-products' })
      .then(res => {
        const list = (res.data || []).map(item => ({
          ...item,
          boundAtStr: formatTime(item.boundAt),
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },

  addProduct() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.showModal({
        title: '未登录',
        content: '请先登录后再添加商品',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        },
      });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        wx.showLoading({ title: '识别中...' });
        wx.uploadFile({
          url: app.globalData.baseUrl + '/auth/bind-by-qr-image',
          filePath: file.tempFilePath,
          name: 'image',
          header: { Authorization: 'Bearer ' + (app.globalData.token || wx.getStorageSync('vino_token') || '') },
          success: (uploadRes) => {
            try {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 0 && data.data) {
                wx.showToast({ title: '绑定成功', icon: 'success' });
                this.loadList();
                if (data.data.guideSlug) {
                  setTimeout(() => {
                    wx.navigateTo({ url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(data.data.guideSlug) });
                  }, 800);
                }
              } else {
                wx.showToast({ title: data.message || '绑定失败', icon: 'none' });
              }
            } catch {
              wx.showToast({ title: '绑定失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
          complete: () => wx.hideLoading(),
        });
      },
    });
  },
});
