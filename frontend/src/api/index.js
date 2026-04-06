import request from './request';

export const authApi = {
  login: (data) => request.post('/auth/login', data),
  sendCode: (data) => request.post('/auth/send-code', data),
  sendSmsCode: (data) => request.post('/auth/send-sms-code', data),
  register: (data) => request.post('/auth/register', data),
  getProfile: () => request.get('/auth/profile'),
  updateProfile: (data) => request.put('/auth/profile', data),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request.post('/auth/upload-avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  bindPhone: (data) => request.post('/auth/bind-phone', data),
  myProducts: () => request.get('/auth/my-products'),
  bindProduct: (data) => request.post('/auth/bind-product', data),
  bindByQrImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request.post('/auth/bind-by-qr-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const orderApi = {
  create: (data) => request.post('/orders', data),
  mine: (params) => request.get('/orders/mine', { params }),
  mineStats: () => request.get('/orders/mine/stats'),
  detail: (id) => request.get(`/orders/${id}`),
  cancel: (id) => request.put(`/orders/${id}/cancel`),
};

export const guideApi = {
  categories: () => request.get('/guides/categories'),
  list: (params) => request.get('/guides', { params }),
  detail: (id) => request.get(`/guides/${id}`),
};

export const courseApi = {
  categories: () => request.get('/course-categories'),
  list: (params) => request.get('/courses', { params }),
  detail: (idOrSlug) => request.get(`/courses/${encodeURIComponent(idOrSlug)}`),
};

export const chatGroupApi = {
  mine: () => request.get('/chat-groups/mine'),
  create: (data) => request.post('/chat-groups', data),
  join: (id) => request.post(`/chat-groups/${id}/join`),
  messages: (id, params) => request.get(`/chat-groups/${id}/messages`, { params }),
  send: (id, data) => request.post(`/chat-groups/${id}/messages`, data),
  uploadImage: (id, file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request.post(`/chat-groups/${id}/upload-image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// 聊天消息 API（用户端）
export const messageApi = {
  mine: () => request.get('/messages/mine'),
  send: (data) => request.post('/messages/send', data),
  unread: () => request.get('/messages/unread'),
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request.post('/messages/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const homeConfigApi = {
  list: (params) => request.get('/home-config', { params }),
  tabbar: () => request.get('/home-config', { params: { section: 'tabbar' } }),
};

export const addressApi = {
  list: () => request.get('/addresses'),
  create: (data) => request.post('/addresses', data),
  update: (id, data) => request.put(`/addresses/${id}`, data),
  remove: (id) => request.delete(`/addresses/${id}`),
  setDefault: (id) => request.put(`/addresses/${id}/default`),
};
