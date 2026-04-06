const app = getApp();

Page({
  data: {
    groups: [],
    filtered: [],
    searchKw: '',
    loading: true,
    showCreate: false,
    newName: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login?from=chatgroup' });
      return;
    }
    this.loadMine();
  },

  onSearchInput(e) {
    const kw = (e.detail.value || '').trim().toLowerCase();
    const groups = this.data.groups || [];
    const filtered = !kw ? groups : groups.filter((g) => (g.name || '').toLowerCase().includes(kw));
    this.setData({ searchKw: e.detail.value, filtered });
  },

  loadMine() {
    this.setData({ loading: true });
    app.request({ url: '/chat-groups/mine' })
      .then((res) => {
        const groups = res.data || [];
        const kw = (this.data.searchKw || '').trim().toLowerCase();
        const filtered = !kw ? groups : groups.filter((g) => (g.name || '').toLowerCase().includes(kw));
        this.setData({ groups, filtered, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  openCreate() {
    this.setData({ showCreate: true, newName: '' });
  },

  cancelCreate() {
    this.setData({ showCreate: false });
  },

  onNewName(e) {
    this.setData({ newName: e.detail.value });
  },

  submitCreate() {
    const name = (this.data.newName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    app.request({ url: '/chat-groups', method: 'POST', data: { name } })
      .then((res) => {
        const g = res.data;
        this.setData({ showCreate: false, newName: '' });
        wx.showToast({ title: '已创建', icon: 'success' });
        this.loadMine();
        if (g && g.id) {
          wx.navigateTo({ url: '/pages/chatgroup-room/chatgroup-room?id=' + g.id });
        }
      })
      .catch(() => wx.showToast({ title: '创建失败', icon: 'none' }));
  },

  openRoom(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/chatgroup-room/chatgroup-room?id=' + id });
  },
});
