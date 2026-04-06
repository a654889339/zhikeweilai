<template>
  <div class="mine-page">
    <div class="profile-header" :style="profileHeaderStyle" @click="onProfileHeaderClick">
      <div class="avatar">
        <img v-if="userStore.isLoggedIn && userStore.userInfo?.avatar" :src="userStore.userInfo.avatar" class="avatar-img" alt="" />
        <span v-else-if="userStore.isLoggedIn && (userStore.userInfo?.nickname || userStore.userInfo?.username)" class="avatar-initial">{{ (userStore.userInfo?.nickname || userStore.userInfo?.username).charAt(0) }}</span>
        <van-icon v-else name="user-o" size="36" color="#fff" />
      </div>
      <div class="profile-info" v-if="userStore.isLoggedIn">
        <h3>{{ userStore.userInfo?.nickname || userStore.userInfo?.username || '服务商' }}</h3>
        <p>{{ profileSubtitle }}</p>
      </div>
      <div class="profile-info" v-else>
        <h3>点击登录</h3>
        <p>登录享服务商权益</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item" v-for="s in stats" :key="s.label">
        <span class="stat-num">{{ s.value }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </div>
    </div>

    <van-cell-group inset class="menu-group">
      <van-cell title="我的订单" icon="orders-o" is-link to="/orders" />
      <van-cell title="服务商地址" icon="location-o" is-link to="/address" />
      <van-cell title="优惠券" icon="coupon-o" is-link />
    </van-cell-group>

    <van-cell-group inset class="menu-group">
      <van-cell title="意见反馈" icon="comment-o" is-link @click="openFeedback" />
      <van-cell title="联系我们" icon="phone-o" is-link @click="openContact" />
    </van-cell-group>

    <div class="logout-area" v-if="userStore.isLoggedIn">
      <van-button block plain type="default" class="logout-btn" @click="handleLogout">退出登录</van-button>
    </div>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted, computed } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { homeConfigApi } from '@/api';

const userStore = useUserStore();
const router = useRouter();
const chatWidgetRef = inject('chatWidget', ref(null));

const profileSubtitle = computed(() => {
  const u = userStore.userInfo;
  if (!u) return '未绑定手机';
  if (u.phone) return u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  if (u.email) return u.email;
  return '未绑定手机';
});

const onProfileHeaderClick = () => {
  if (userStore.isLoggedIn) router.push('/mine/profile');
  else router.push('/login');
};

const mineBgImageUrl = ref('');
const profileHeaderStyle = computed(() => {
  if (mineBgImageUrl.value) {
    return { backgroundImage: `url(${mineBgImageUrl.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: 'linear-gradient(160deg, #1d1d1f 0%, #7C3AED 100%)' };
});

const openFeedback = () => {
  if (chatWidgetRef.value) chatWidgetRef.value.openWithAutoMessage('');
};
const CONTACT_PHONE = '400-8030-683';
const openContact = () => {
  showDialog({
    title: '联系我们', message: '客服电话：' + CONTACT_PHONE,
    showCancelButton: true, cancelButtonText: '关闭', confirmButtonText: '复制',
  }).then(() => {
    navigator.clipboard.writeText(CONTACT_PHONE).then(() => showToast('已复制'));
  }).catch(() => {});
};

const stats = [
  { label: '待支付', value: 0 },
  { label: '进行中', value: 0 },
  { label: '待评价', value: 0 },
  { label: '售后', value: 0 },
];

onMounted(async () => {
  if (userStore.isLoggedIn && !userStore.userInfo) {
    try { await userStore.fetchProfile(); } catch { userStore.logout(); }
  }
  try {
    const res = await homeConfigApi.list({ all: 1 });
    const items = res.data || [];
    const mineBg = items.find(i => i.section === 'mineBg' && i.status === 'active');
    if (mineBg && mineBg.imageUrl) mineBgImageUrl.value = mineBg.imageUrl;
  } catch (_) {}
});

const handleLogout = () => { userStore.logout(); router.push('/'); };
</script>

<style scoped>
.mine-page { background: var(--vino-bg); min-height: 100vh; }
.profile-header { background: linear-gradient(160deg, #1d1d1f 0%, #7C3AED 100%); padding: 48px 24px 36px; display: flex; align-items: center; gap: 16px; cursor: pointer; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-initial { font-size: 24px; font-weight: 700; color: #fff; }
.profile-info h3 { color: #fff; font-size: 20px; font-weight: 700; margin-bottom: 5px; }
.profile-info p { color: rgba(255, 255, 255, 0.6); font-size: 14px; }
.stats-row { display: flex; background: var(--vino-card); padding: 20px 0; margin-bottom: 8px; }
.stat-item { flex: 1; text-align: center; display: flex; flex-direction: column; gap: 5px; }
.stat-num { font-size: 20px; font-weight: 700; color: var(--vino-dark); }
.stat-label { font-size: 12px; color: var(--vino-text-secondary); font-weight: 500; }
.menu-group { margin: 0 12px 8px !important; border-radius: var(--vino-radius) !important; overflow: hidden; }
.menu-group :deep(.van-cell) { padding: 15px 20px; }
.menu-group :deep(.van-cell__title) { font-size: 15px; font-weight: 500; color: var(--vino-dark); }
.logout-area { padding: 24px 20px; }
.logout-btn { border-radius: var(--vino-radius-sm) !important; font-size: 15px !important; font-weight: 500 !important; color: var(--vino-text-secondary) !important; border-color: var(--vino-border) !important; }
</style>
