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
    return request.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  bindPhone: (data) => request.post('/auth/bind-phone', data),
};

export const orderApi = {
  create: (data) => request.post('/orders', data),
  mine: (params) => request.get('/orders/mine', { params }),
  detail: (id) => request.get(`/orders/${id}`),
  cancel: (id) => request.put(`/orders/${id}/cancel`),
};

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

export const guideApi = {
  categories: () => request.get('/guides/categories'),
  list: (params) => request.get('/guides', { params }),
  detail: (id) => request.get(`/guides/${id}`),
};
