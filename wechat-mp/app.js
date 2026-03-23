/** 解析 JWT 过期时间（毫秒），失败返回 null */
function getJwtExpMs(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const buf = wx.base64ToArrayBuffer(b64);
    const arr = new Uint8Array(buf);
    let str = '';
    for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
    const payload = JSON.parse(str);
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch (e) {
    return null;
  }
}

App({
  globalData: {
    baseUrl: 'http://106.54.50.88:5302/api',
    userInfo: null,
    token: '',
  },

  onLaunch() {
    const token = wx.getStorageSync('vino_token');
    if (token) {
      const expMs = getJwtExpMs(token);
      if (expMs != null && Date.now() >= expMs) {
        this.clearToken();
        return;
      }
      this.globalData.token = token;
      this.fetchProfile();
    }
  },

  /** 使用 wx.request，避免无效 token 时 Promise 链报错；401 静默清 token */
  fetchProfile() {
    const app = this;
    const { baseUrl, token } = app.globalData;
    if (!token) return;
    wx.request({
      url: baseUrl + '/auth/profile',
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      success(res) {
        if (res.statusCode === 401) {
          app.clearToken();
          return;
        }
        if (res.data && res.data.code === 0 && res.data.data) {
          app.globalData.userInfo = res.data.data;
        }
      },
    });
  },

  request(options) {
    const app = this;
    const { baseUrl, token } = app.globalData;
    return new Promise((resolve, reject) => {
      wx.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        success: (res) => {
          if (res.statusCode === 401) {
            app.clearToken();
            reject(new Error('请先登录'));
            return;
          }
          if (res.data && res.data.code === 0) {
            resolve(res.data);
          } else {
            reject(new Error((res.data && res.data.message) || '请求失败'));
          }
        },
        fail: (err) => {
          reject(err.errMsg || new Error('网络错误'));
        },
      });
    });
  },

  setToken(token) {
    this.globalData.token = token;
    wx.setStorageSync('vino_token', token);
  },

  clearToken() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('vino_token');
  },

  isLoggedIn() {
    return !!this.globalData.token;
  },

  checkLogin() {
    if (!this.isLoggedIn()) {
      wx.showModal({
        title: '未登录',
        content: '请先登录后再操作',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        },
      });
      return false;
    }
    return true;
  },
});
