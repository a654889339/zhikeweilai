const app = getApp();

Page({
  data: {
    loading: true,
    guideName: '',
    sections: [],
  },

  onLoad(options) {
    if (options.id) this.loadGuide(options.id);
    else this.setData({ loading: false });
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        this.setData({
          guideName: g.name || '',
          sections: parse(g.sections),
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },
});
