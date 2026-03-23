const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    loading: false,
    isLoggedIn: false,
    userInitial: '我',
    scrollToId: '',
  },

  pollTimer: null,

  onLoad(options) {
    const autoMsg = decodeURIComponent(options.autoMsg || '');
    this.autoMsg = autoMsg;
  },

  onShow() {
    const loggedIn = app.isLoggedIn();
    const info = app.globalData.userInfo || {};
    const initial = (info.nickname || info.username || '我')[0];
    this.setData({ isLoggedIn: loggedIn, userInitial: initial });
    this.loadMessages();
  },

  onHide() {
    this.stopPoll();
  },

  onUnload() {
    this.stopPoll();
  },

  startPoll() {
    this.stopPoll();
    this.pollTimer = setInterval(() => this.refreshMessages(), 3000);
  },

  stopPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const time = hh + ':' + mm;
    return isToday ? time : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + time;
  },

  loadMessages() {
    if (!this.data.isLoggedIn) return;
    this.setData({ loading: true });
    app.request({ url: '/messages/mine' })
      .then(res => {
        const msgs = (res.data || []).map(m => ({
          ...m,
          timeStr: this.formatTime(m.createdAt),
        }));
        this.setData({ messages: msgs, loading: false });
        this.scrollBottom();
        this.startPoll();
        if (this.autoMsg) {
          const msg = this.autoMsg;
          this.autoMsg = '';
          this.setData({ inputText: msg });
          setTimeout(() => this.sendMessage(), 300);
        }
      })
      .catch(() => {
        this.setData({ loading: false });
        this.startPoll();
      });
  },

  refreshMessages() {
    if (!this.data.isLoggedIn) return;
    app.request({ url: '/messages/mine' })
      .then(res => {
        const msgs = (res.data || []).map(m => ({
          ...m,
          timeStr: this.formatTime(m.createdAt),
        }));
        if (msgs.length !== this.data.messages.length) {
          this.setData({ messages: msgs });
          this.scrollBottom();
        }
      })
      .catch(() => {});
  },

  scrollBottom() {
    setTimeout(() => {
      this.setData({ scrollToId: 'chat-bottom' });
    }, 100);
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: [url] });
  },

  chooseImage() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        wx.showLoading({ title: '发送中...' });
        wx.uploadFile({
          url: app.globalData.baseUrl + '/messages/upload-image',
          filePath: file.tempFilePath,
          name: 'image',
          header: { Authorization: 'Bearer ' + (wx.getStorageSync('vino_token') || '') },
          success: (uploadRes) => {
            try {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 0 && data.data && data.data.url) {
                app.request({
                  method: 'POST',
                  url: '/messages/send',
                  data: { content: data.data.url, type: 'image' },
                }).then(sendRes => {
                  if (sendRes.code === 0 && sendRes.data) {
                    const msg = { ...sendRes.data, timeStr: this.formatTime(sendRes.data.createdAt) };
                    this.setData({ messages: this.data.messages.concat([msg]) });
                    this.scrollBottom();
                  }
                });
              } else {
                wx.showToast({ title: '发送失败', icon: 'none' });
              }
            } catch {
              wx.showToast({ title: '发送失败', icon: 'none' });
            }
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'none' });
          },
          complete: () => {
            wx.hideLoading();
          },
        });
      },
    });
  },

  sendMessage() {
    const content = (this.data.inputText || '').trim();
    if (!content || !this.data.isLoggedIn) return;
    this.setData({ inputText: '' });
    app.request({
      method: 'POST',
      url: '/messages/send',
      data: { content },
    })
      .then(res => {
        if (res.code === 0 && res.data) {
          const msg = { ...res.data, timeStr: this.formatTime(res.data.createdAt) };
          const messages = this.data.messages.concat([msg]);
          this.setData({ messages });
          this.scrollBottom();
        } else {
          wx.showToast({ title: res.message || '发送失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.showToast({ title: '发送失败', icon: 'none' });
      });
  },
});
