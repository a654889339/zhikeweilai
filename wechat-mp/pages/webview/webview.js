Page({
  data: { url: '' },
  onLoad(options) {
    let url = decodeURIComponent(options.url || '');
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    this.setData({ url });
  },
});
