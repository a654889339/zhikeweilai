import { defineStore } from 'pinia';
import { authApi } from '@/api';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('vino_outlet_token') || '',
    userInfo: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(data) {
      const res = await authApi.login(data);
      this.token = res.data.token;
      this.userInfo = res.data.user || res.data;
      localStorage.setItem('vino_outlet_token', res.data.token);
    },
    setAuth(token, user) {
      this.token = token;
      this.userInfo = user;
      localStorage.setItem('vino_outlet_token', token);
    },
    async fetchProfile() {
      const res = await authApi.getProfile();
      this.userInfo = res.data;
    },
    logout() {
      this.token = '';
      this.userInfo = null;
      localStorage.removeItem('vino_outlet_token');
    },
  },
});
