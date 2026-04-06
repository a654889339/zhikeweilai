const app = getApp();

function fullUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (s.startsWith('http')) return s;
  return app.globalData.baseUrl.replace('/api', '') + s;
}

Page({
  data: {
    loading: true,
    course: {},
    videos: [],
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      this.setData({ loading: false });
      return;
    }
    app
      .request({ url: '/courses/' + encodeURIComponent(id) })
      .then((res) => {
        const c = res.data || {};
        const videos = Array.isArray(c.videos) ? c.videos.map((u) => fullUrl(u)) : [];
        this.setData({
          course: {
            ...c,
            coverFull: c.coverImage ? fullUrl(c.coverImage) : '',
          },
          videos,
          loading: false,
        });
        wx.setNavigationBarTitle({ title: c.name || '课程详情' });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },
});
