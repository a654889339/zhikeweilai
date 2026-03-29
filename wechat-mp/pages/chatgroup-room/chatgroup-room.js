const app = getApp();

Page({
  data: {
    groupId: null,
    mineId: 0,
    messages: [],
    inputText: '',
    scrollTo: '',
    loading: true,
  },
  pollTimer: null,

  onLoad(options) {
    const id = parseInt(options.id, 10);
    if (!id) {
      wx.showToast({ title: '无效群组', icon: 'none' });
      return;
    }
    this.setData({ groupId: id });
  },

  onShow() {
    const info = app.globalData.userInfo || {};
    this.setData({ mineId: info.id || 0 });
    if (this.data.groupId) {
      this.loadMessages();
      this.startPoll();
    }
  },

  onHide() {
    this.stopPoll();
  },

  onUnload() {
    this.stopPoll();
  },

  startPoll() {
    this.stopPoll();
    this.pollTimer = setInterval(() => this.loadMessages(true), 6000);
  },

  stopPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  loadMessages(silent) {
    const id = this.data.groupId;
    if (!id || !app.isLoggedIn()) return;
    if (!silent) this.setData({ loading: true });
    app.request({ url: '/chat-groups/' + id + '/messages', data: { limit: 80 } })
      .then((res) => {
        const raw = res.data || [];
        const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '');
        const messages = raw.map((m) => {
          const o = { ...m };
          if (o.type === 'image' && o.content && !String(o.content).startsWith('http')) {
            o.content = base + (String(o.content).startsWith('/') ? '' : '/') + o.content;
          }
          return o;
        });
        this.setData({ messages, loading: false, scrollTo: 'b' + (messages.length ? messages[messages.length - 1].id : 0) });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  send() {
    const text = (this.data.inputText || '').trim();
    const id = this.data.groupId;
    if (!text || !id) return;
    app.request({ url: '/chat-groups/' + id + '/messages', method: 'POST', data: { content: text, type: 'text' } })
      .then(() => {
        this.setData({ inputText: '' });
        this.loadMessages(true);
      })
      .catch(() => wx.showToast({ title: '发送失败', icon: 'none' }));
  },

  chooseImage() {
    const id = this.data.groupId;
    if (!id) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath;
        const token = app.globalData.token || wx.getStorageSync('vino_token');
        const url = (app.globalData.baseUrl || '').replace(/\/$/, '') + '/chat-groups/' + id + '/upload-image';
        wx.uploadFile({
          url,
          filePath: path,
          name: 'image',
          header: token ? { Authorization: 'Bearer ' + token } : {},
          success: (up) => {
            try {
              const data = JSON.parse(up.data);
              if (data.code === 0) this.loadMessages(true);
              else wx.showToast({ title: data.message || '上传失败', icon: 'none' });
            } catch {
              wx.showToast({ title: '上传失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
        });
      },
    });
  },

  previewImg(e) {
    const u = e.currentTarget.dataset.url;
    if (u) wx.previewImage({ urls: [u], current: u });
  },
});
