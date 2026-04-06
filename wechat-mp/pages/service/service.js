const app = getApp();

Page({
  data: {
    activeTab: 0,
    tabs: [
      { key: 'repair', name: '维修' },
      { key: 'clean', name: '清洁' },
      { key: 'inspect', name: '检测' },
      { key: 'data', name: '数据' },
    ],
    services: [],
    loading: true,
  },

  onShow() {
    this.loadServices();
  },

  loadServices() {
    const tabs = this.data.tabs;
    const tab = tabs[this.data.activeTab] || tabs[0];
    const key = tab.key;
    const categoryNames = { repair: '维修', clean: '清洁', inspect: '检测', data: '数据' };
    const category = categoryNames[key] || '维修';
    this.setData({ loading: true });
    app.request({ url: `/services?category=${encodeURIComponent(category)}` })
      .then(res => {
        const data = (res.data || []).map(s => ({
          id: s.id,
          title: s.title || '服务',
          desc: s.description || '专业服务',
          price: s.price || 0,
          emoji: '🔧',
          bg: '#B91C1C',
        }));
        this.setData({ services: data.length ? data : this.getFallbackServices(key), loading: false });
      })
      .catch(() => {
        this.setData({ services: this.getFallbackServices(key), loading: false });
      });
  },

  getFallbackServices(key) {
    const all = {
      repair: [
        { id: 1, title: '设备维修', desc: '专业工程师', emoji: '🔧', price: '99', bg: '#B91C1C' },
        { id: 2, title: '上门维修', desc: '快速响应', emoji: '🏠', price: '149', bg: '#DC2626' },
        { id: 3, title: '远程支持', desc: '在线指导', emoji: '📞', price: '29', bg: '#EF4444' },
      ],
      clean: [
        { id: 4, title: '深度清洁', desc: '全方位保养', emoji: '✨', price: '149', bg: '#2563EB' },
        { id: 5, title: '日常清洁', desc: '基础维护', emoji: '🧹', price: '69', bg: '#3B82F6' },
      ],
      inspect: [
        { id: 6, title: '全面检测', desc: '系统评估', emoji: '🔍', price: '49', bg: '#059669' },
        { id: 7, title: '性能优化', desc: '提速升级', emoji: '🚀', price: '79', bg: '#10B981' },
      ],
      data: [
        { id: 8, title: '数据恢复', desc: '专业找回', emoji: '💾', price: '199', bg: '#7C3AED' },
        { id: 9, title: '数据备份', desc: '安全迁移', emoji: '📁', price: '59', bg: '#8B5CF6' },
      ],
    };
    return all[key] || all.repair;
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({ activeTab: index });
    this.loadServices();
  },

  goServiceDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/service-detail/service-detail?id=${id}` });
  },

});
