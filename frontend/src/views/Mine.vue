<template>
  <div class="mine-page">
    <div
      class="profile-header"
      :style="profileHeaderStyle"
      @click="onProfileHeaderClick"
    >
      <div class="avatar">
        <img v-if="userStore.isLoggedIn && userStore.userInfo?.avatar" :src="userStore.userInfo.avatar" class="avatar-img" alt="" />
        <span v-else-if="userStore.isLoggedIn && (userStore.userInfo?.nickname || userStore.userInfo?.username)" class="avatar-initial">{{ (userStore.userInfo?.nickname || userStore.userInfo?.username).charAt(0) }}</span>
        <van-icon v-else name="user-o" size="36" color="#fff" />
      </div>
      <div class="profile-info" v-if="userStore.isLoggedIn">
        <h3>{{ userStore.userInfo?.nickname || userStore.userInfo?.username || '用户' }}</h3>
        <p>{{ profileSubtitle }}</p>
      </div>
      <div class="profile-info" v-else>
        <h3>点击登录</h3>
        <p>登录享更多权益</p>
      </div>
    </div>

    <!-- 积分 / 购物券 / 钱包 -->
    <div class="asset-bar">
      <div class="asset-item" @click="onAssetClick('points')">
        <span class="asset-num">{{ assetPoints }}</span>
        <span class="asset-label">积分</span>
      </div>
      <div class="asset-divider" />
      <div class="asset-item" @click="onAssetClick('coupon')">
        <span class="asset-num">{{ assetCoupons }}</span>
        <span class="asset-label">购物券</span>
      </div>
      <div class="asset-divider" />
      <div class="asset-item" @click="onAssetClick('wallet')">
        <span class="asset-num wallet-num">¥{{ assetWallet }}</span>
        <span class="asset-label">钱包</span>
      </div>
    </div>

    <!-- 我的订单 -->
    <div class="orders-card">
      <div class="orders-card-head">
        <span class="orders-title">我的订单</span>
        <router-link v-if="userStore.isLoggedIn" class="orders-all" to="/orders">
          查看全部订单
          <van-icon name="arrow" />
        </router-link>
        <span v-else class="orders-all muted" @click="router.push('/login')">查看全部订单 <van-icon name="arrow" /></span>
      </div>
      <div class="orders-shortcuts">
        <div
          v-for="s in orderShortcuts"
          :key="s.key"
          class="os-item"
          @click="goOrderTab(s.key)"
        >
          <div class="os-icon-wrap">
            <van-badge v-if="userStore.isLoggedIn && orderStats[s.badgeKey] > 0" :content="orderStats[s.badgeKey]" max="99">
              <van-icon :name="s.icon" size="24" />
            </van-badge>
            <van-icon v-else :name="s.icon" size="24" />
          </div>
          <span class="os-label">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- 功能网格（图3） -->
    <div class="tool-grid">
      <div class="tool-item" @click="goProducts"><van-icon name="records" size="22" /><span>我的课程</span></div>
      <div class="tool-item" @click="openFeedback"><van-icon name="service-o" size="22" /><span>客服</span></div>
      <div class="tool-item" @click="goSecurity"><van-icon name="shield-o" size="22" /><span>账号安全</span></div>
      <div class="tool-item" @click="toastSoon"><van-icon name="friends-o" size="22" /><span>我的班级</span></div>
    </div>

    <van-cell-group inset class="menu-group">
      <van-cell title="我的商品" icon="bag-o" is-link to="/mine/products" />
      <van-cell title="地址管理" icon="location-o" is-link to="/address" />
    </van-cell-group>

    <van-cell-group inset class="menu-group">
      <van-cell title="意见反馈" icon="comment-o" is-link @click="openFeedback" />
      <van-cell :title="`关于${companyName}`" icon="info-o" is-link @click="openAbout" />
      <van-cell title="联系我们" icon="phone-o" is-link @click="openContact" />
    </van-cell-group>

    <div class="logout-area" v-if="userStore.isLoggedIn">
      <van-button block plain type="default" class="logout-btn" @click="handleLogout">退出登录</van-button>
    </div>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted, computed, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter, useRoute } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { homeConfigApi, orderApi } from '@/api';

const userStore = useUserStore();
const router = useRouter();
const route = useRoute();
const chatWidgetRef = inject('chatWidget', ref(null));

const orderStats = ref({
  pending: 0,
  paid: 0,
  processing: 0,
  completed: 0,
  cancelled: 0,
});

const orderShortcuts = [
  { key: 'pending', badgeKey: 'pending', label: '待付款', icon: 'balance-pay' },
  { key: 'paid', badgeKey: 'paid', label: '待发货', icon: 'logistics' },
  { key: 'processing', badgeKey: 'processing', label: '待收货', icon: 'gift-o' },
  { key: 'completed', badgeKey: 'completed', label: '待评价', icon: 'comment-o' },
  { key: 'cancelled', badgeKey: 'cancelled', label: '退款/售后', icon: 'replay' },
];

const profileSubtitle = computed(() => {
  const u = userStore.userInfo;
  if (!u) return '未绑定手机';
  if (u.phone) return u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  if (u.email) return u.email;
  return '未绑定手机';
});

const assetPoints = computed(() => (userStore.isLoggedIn ? (userStore.userInfo?.points ?? 0) : '—'));
const assetCoupons = computed(() => (userStore.isLoggedIn ? (userStore.userInfo?.couponCount ?? 0) : '—'));
const assetWallet = computed(() => {
  if (!userStore.isLoggedIn) return '—';
  const w = userStore.userInfo?.walletBalance;
  const n = Number(w);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
});

const onProfileHeaderClick = () => {
  if (userStore.isLoggedIn) {
    router.push('/mine/profile');
  } else {
    router.push('/login');
  }
};

const mineBgImageUrl = ref('');
const companyName = ref('智科未来');
const profileHeaderStyle = computed(() => {
  if (mineBgImageUrl.value) {
    return {
      backgroundImage: `url(${mineBgImageUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {
    background: 'linear-gradient(160deg, #1d1d1f 0%, #B91C1C 100%)',
  };
});

const loadMineData = async () => {
  try {
    const res = await homeConfigApi.list({ all: 1 });
    const items = res.data || [];
    const cn = items.find((i) => i.section === 'companyName' && i.status === 'active');
    if (cn && cn.title) companyName.value = String(cn.title).trim() || companyName.value;
    const mineBg = items.find((i) => i.section === 'mineBg' && i.status === 'active');
    if (mineBg && mineBg.imageUrl) mineBgImageUrl.value = mineBg.imageUrl;
  } catch (_) {}

  if (!userStore.isLoggedIn) return;
  try {
    await userStore.fetchProfile();
  } catch {
    userStore.logout();
    return;
  }
  try {
    const res = await orderApi.mineStats();
    if (res.data) orderStats.value = { ...orderStats.value, ...res.data };
  } catch (_) {}
};

const goOrderTab = (status) => {
  if (!userStore.isLoggedIn) {
    router.push('/login');
    return;
  }
  router.push({ path: '/orders', query: { status } });
};

const goProducts = () => {
  router.push('/products');
};

const goSecurity = () => {
  if (!userStore.isLoggedIn) {
    showToast('请先登录');
    router.push('/login');
    return;
  }
  router.push('/mine/profile');
};

const toastSoon = () => showToast('敬请期待');

const onAssetClick = (type) => {
  if (!userStore.isLoggedIn) {
    router.push('/login');
    return;
  }
  if (type === 'coupon') showToast('购物券详情敬请期待');
  else if (type === 'wallet') showToast('钱包功能敬请期待');
};

const openFeedback = () => {
  if (chatWidgetRef.value) {
    chatWidgetRef.value.openWithAutoMessage('');
  }
};

const openAbout = () => {
  window.open('https://www.vinotech.cn/', '_blank');
};

const CONTACT_PHONE = '400-8030-683';

const openContact = () => {
  showDialog({
    title: '联系我们',
    message: '客服电话：' + CONTACT_PHONE,
    showCancelButton: true,
    cancelButtonText: '关闭',
    confirmButtonText: '复制',
  }).then((action) => {
    if (action === 'confirm') {
      navigator.clipboard.writeText(CONTACT_PHONE).then(() => showToast('已复制'));
    }
  });
};

onMounted(async () => {
  if (userStore.isLoggedIn && !userStore.userInfo) {
    try {
      await userStore.fetchProfile();
    } catch {
      userStore.logout();
    }
  }
  await loadMineData();
});

watch(
  () => route.path,
  (p) => {
    if (p === '/mine') loadMineData();
  }
);

const handleLogout = () => {
  userStore.logout();
  router.push('/');
};
</script>

<style scoped>
.mine-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.profile-header {
  background: linear-gradient(160deg, #1d1d1f 0%, #B91C1C 100%);
  padding: 48px 24px 28px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-initial {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.profile-info h3 {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 5px;
  letter-spacing: -0.02em;
}

.profile-info p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.asset-bar {
  display: flex;
  align-items: stretch;
  background: var(--vino-card);
  margin: 0 12px 10px;
  border-radius: 12px;
  padding: 18px 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.asset-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.asset-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-dark);
  letter-spacing: -0.02em;
}

.wallet-num {
  font-size: 18px;
  color: #B91C1C;
}

.asset-label {
  font-size: 12px;
  color: var(--vino-text-secondary);
  font-weight: 500;
}

.asset-divider {
  width: 1px;
  background: var(--vino-border, #eee);
  align-self: stretch;
  margin: 4px 0;
  opacity: 0.8;
}

.orders-card {
  background: var(--vino-card);
  margin: 0 12px 10px;
  border-radius: 12px;
  padding: 14px 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.orders-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.orders-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--vino-dark);
}

.orders-all {
  font-size: 13px;
  color: var(--vino-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 2px;
  text-decoration: none;
}

.orders-all.muted {
  cursor: pointer;
}

.orders-shortcuts {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.os-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.os-icon-wrap {
  color: var(--vino-dark);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 28px;
}

.os-label {
  font-size: 11px;
  color: var(--vino-text-secondary);
  text-align: center;
  line-height: 1.2;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 0 12px 10px;
  padding: 14px;
  background: var(--vino-card);
  border-radius: 12px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vino-dark);
  cursor: pointer;
  padding: 8px 4px;
  border-radius: 8px;
}

.tool-item:active {
  background: var(--vino-bg);
}

.menu-group {
  margin: 0 12px 8px !important;
  border-radius: var(--vino-radius) !important;
  overflow: hidden;
}

.menu-group :deep(.van-cell) {
  padding: 15px 20px;
}

.menu-group :deep(.van-cell__title) {
  font-size: 15px;
  font-weight: 500;
  color: var(--vino-dark);
}

.menu-group :deep(.van-cell:active) {
  background: var(--vino-bg);
}

.logout-area {
  padding: 24px 20px;
}

.logout-btn {
  border-radius: var(--vino-radius-sm) !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  color: var(--vino-text-secondary) !important;
  border-color: var(--vino-border) !important;
}
</style>
