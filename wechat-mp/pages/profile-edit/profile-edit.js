const app = getApp();

Page({
  data: {
    userInfo: null,
    avatarUrl: '',
    nickname: '',
    userPhone: '',
    maskedPhone: '',
    bindPhone: '',
    bindCode: '',
    smsCountdown: 0,
    sendingSmsCode: false,
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.loadUser();
  },

  loadUser() {
    const user = app.globalData.userInfo;
    if (user) {
      this.applyUser(user);
      return;
    }
    app.request({ url: '/auth/profile' }).then(res => {
      const u = res.data || {};
      app.globalData.userInfo = u;
      this.applyUser(u);
    }).catch(() => {
      wx.navigateTo({ url: '/pages/login/login' });
    });
  },

  applyUser(user) {
    const avatarUrl = user.avatar || '';
    const nickname = user.nickname || user.username || '';
    const userPhone = user.phone || '';
    const maskedPhone = userPhone ? userPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    this.setData({
      userInfo: user,
      avatarUrl,
      nickname,
      userPhone,
      maskedPhone,
    });
  },

  onBindPhoneInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, field === 'bindCode' ? 6 : 11);
    this.setData({ [field]: value });
  },

  onSendBindCode() {
    const phone = (this.data.bindPhone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    this.setData({ sendingSmsCode: true });
    app.request({
      method: 'POST',
      url: '/auth/send-sms-code',
      data: { phone },
    })
      .then(() => {
        wx.showToast({ title: '验证码已发送', icon: 'success' });
        this.setData({ smsCountdown: 60, sendingSmsCode: false });
        const t = setInterval(() => {
          const n = this.data.smsCountdown - 1;
          this.setData({ smsCountdown: n });
          if (n <= 0) clearInterval(t);
        }, 1000);
      })
      .catch((err) => {
        this.setData({ sendingSmsCode: false });
        wx.showToast({ title: err.message || '发送失败', icon: 'none' });
      });
  },

  onSubmitBindPhone() {
    const { bindPhone, bindCode } = this.data;
    if (!/^1\d{10}$/.test(bindPhone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!bindCode || bindCode.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' });
      return;
    }
    app.request({
      method: 'POST',
      url: '/auth/bind-phone',
      data: { phone: bindPhone, code: bindCode },
    })
      .then((res) => {
        const user = res.data || {};
        app.globalData.userInfo = user;
        const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
        this.setData({
          userInfo: user,
          userPhone: user.phone || '',
          maskedPhone,
          bindPhone: '',
          bindCode: '',
        });
        wx.showToast({ title: '绑定成功', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '绑定失败', icon: 'none' });
      });
  },

  onChangePhoneTap() {
    this.setData({
      bindPhone: '',
      bindCode: '',
      userPhone: '',
      maskedPhone: '',
    });
  },

  onUpdateAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    if (!tempUrl) return;
    wx.showLoading({ title: '上传中...' });
    wx.uploadFile({
      url: app.globalData.baseUrl + '/auth/upload-avatar',
      filePath: tempUrl,
      name: 'avatar',
      header: { Authorization: 'Bearer ' + app.globalData.token },
      success: (uploadRes) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(uploadRes.data);
          if (data.code === 0) {
            const cosUrl = data.data.url;
            if (app.globalData.userInfo) app.globalData.userInfo.avatar = cosUrl;
            this.setData({ avatarUrl: cosUrl });
            wx.showToast({ title: '头像已更新', icon: 'success' });
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
    });
  },

  onUpdateNickname(e) {
    const nickname = (e.detail.value || '').trim();
    if (!nickname || nickname === (this.data.userInfo && this.data.userInfo.nickname)) return;
    app.request({
      method: 'PUT',
      url: '/auth/profile',
      data: { nickname },
    }).then(res => {
      const user = res.data || {};
      app.globalData.userInfo = user;
      this.setData({ nickname: user.nickname || user.username || '' });
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },
});
