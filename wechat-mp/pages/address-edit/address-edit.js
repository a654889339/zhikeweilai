const app = getApp();

Page({
  data: {
    editId: '',
    contactName: '',
    contactPhone: '',
    country: '中国大陆',
    customCountry: '',
    province: '',
    city: '',
    district: '',
    detailAddress: '',
    isDefault: false,
    countries: ['中国大陆', '中国香港', '中国澳门', '中国台湾', '美国', '日本', '韩国', '新加坡', '其他'],
    countryIdx: 0,
  },

  onLoad(opts) {
    if (opts.id) {
      this.setData({ editId: opts.id });
      this.loadAddress(opts.id);
    }
  },

  loadAddress(id) {
    app.request({ url: '/addresses' })
      .then(res => {
        const addr = (res.data || []).find(a => String(a.id) === String(id));
        if (addr) {
          const idx = this.data.countries.indexOf(addr.country);
          this.setData({
            contactName: addr.contactName || '',
            contactPhone: addr.contactPhone || '',
            country: addr.country || '中国大陆',
            customCountry: addr.customCountry || '',
            province: addr.province || '',
            city: addr.city || '',
            district: addr.district || '',
            detailAddress: addr.detailAddress || '',
            isDefault: !!addr.isDefault,
            countryIdx: idx >= 0 ? idx : 0,
          });
        }
      });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onCountry(e) {
    const idx = e.detail.value;
    this.setData({ countryIdx: idx, country: this.data.countries[idx] });
  },

  onRegion(e) {
    const [province, city, district] = e.detail.value;
    this.setData({ province, city, district });
  },

  onDefault(e) {
    this.setData({ isDefault: e.detail.value });
  },

  save() {
    const { editId, contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault } = this.data;
    if (!contactName.trim()) return wx.showToast({ title: '请输入联系人', icon: 'none' });
    if (!contactPhone.trim()) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!detailAddress.trim()) return wx.showToast({ title: '请输入详细地址', icon: 'none' });

    const body = { contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault };
    const url = editId ? '/addresses/' + editId : '/addresses';
    const method = editId ? 'PUT' : 'POST';

    app.request({ url, method, data: body })
      .then(() => {
        wx.showToast({ title: '保存成功' });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
  },
});
