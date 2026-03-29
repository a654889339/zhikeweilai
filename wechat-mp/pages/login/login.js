const app = getApp();

Page({
  data: {
    logging: false,
    saving: false,
    isLoggedIn: false,
    showProfile: false,
    tempAvatarUrl: '',
    tempNickname: '',
    headerLogoDesc: '',
    companyName: '智科未来',
  },

  onLoad() {
    this.setData({ companyName: app.globalData.companyName || '智科未来' });
    app.request({ url: '/home-config' }).then(res => {
      const list = res.data || [];
      const headerLogo = list.find(i => i.section === 'headerLogo' && i.status === 'active');
      if (headerLogo && headerLogo.desc) {
        this.setData({ headerLogoDesc: headerLogo.desc });
      }
    }).catch(() => {});
  },

  wxLogin() {
    this.setData({ logging: true });
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.showToast({ title: '获取登录凭证失败', icon: 'none' });
          this.setData({ logging: false });
          return;
        }
        app.request({
          method: 'POST',
          url: '/auth/wx-login',
          data: { code: loginRes.code },
        })
          .then((res) => {
            const { token, user, isNew } = res.data;
            app.setToken(token);
            app.globalData.userInfo = user;
            if (isNew) {
              this.setData({ isLoggedIn: true, showProfile: true, logging: false });
            } else {
              this.setData({ logging: false });
              this.goBack();
            }
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '登录失败', icon: 'none' });
            this.setData({ logging: false });
          });
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        this.setData({ logging: false });
      },
    });
  },

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (url) {
      this.setData({ tempAvatarUrl: url });
    }
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  saveProfile() {
    const { tempAvatarUrl, tempNickname } = this.data;
    this.setData({ saving: true });

    const doSave = (avatarServerUrl) => {
      const updateData = {};
      if (tempNickname.trim()) updateData.nickname = tempNickname.trim();
      if (avatarServerUrl) updateData.avatar = avatarServerUrl;

      if (!Object.keys(updateData).length) {
        this.setData({ saving: false });
        this.goBack();
        return;
      }

      app.request({
        method: 'PUT',
        url: '/auth/profile',
        data: updateData,
      })
        .then((res) => {
          app.globalData.userInfo = res.data;
          this.setData({ saving: false });
          wx.showToast({ title: '设置成功', icon: 'success' });
          setTimeout(() => this.goBack(), 800);
        })
        .catch(() => {
          this.setData({ saving: false });
          this.goBack();
        });
    };

    if (tempAvatarUrl && tempAvatarUrl.startsWith('http')) {
      doSave(tempAvatarUrl);
    } else if (tempAvatarUrl) {
      wx.uploadFile({
        url: app.globalData.baseUrl + '/auth/upload-avatar',
        filePath: tempAvatarUrl,
        name: 'avatar',
        header: {
          Authorization: 'Bearer ' + app.globalData.token,
        },
        success: (uploadRes) => {
          try {
            const data = JSON.parse(uploadRes.data);
            if (data.code === 0) {
              doSave(data.data.url);
            } else {
              doSave('');
            }
          } catch {
            doSave('');
          }
        },
        fail: () => doSave(''),
      });
    } else {
      doSave('');
    }
  },

  skipProfile() {
    this.goBack();
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },
});
