<template>
  <SplashScreen v-if="showSplash" />
  <router-view />
  <van-tabbar v-if="showTabbar && tabbarItems.length" route active-color="var(--vino-primary)">
    <van-tabbar-item v-for="(item, i) in tabbarItems" :key="item.path || i" :to="item.path" :icon="item.icon">{{ item.title }}</van-tabbar-item>
  </van-tabbar>
  <ChatWidget ref="chatWidgetRef" :hide-fab="hideChatFab" />
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue';
import { useRoute } from 'vue-router';
import SplashScreen from '@/components/SplashScreen.vue';
import ChatWidget from '@/components/ChatWidget.vue';
import { homeConfigApi } from '@/api';

const route = useRoute();

const DEFAULT_TABBAR = [
  { title: '首页', icon: 'wap-home-o', path: '/' },
  { title: '产品', icon: 'label-o', path: '/products' },
  { title: '服务', icon: 'apps-o', path: '/services' },
  { title: '订单', icon: 'bill-o', path: '/orders' },
  { title: '我的', icon: 'contact-o', path: '/mine' },
];

const tabbarItems = ref([...DEFAULT_TABBAR]);

async function loadTabbarConfig() {
  try {
    const res = await homeConfigApi.tabbar();
    const list = (res.data || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (list.length) {
      tabbarItems.value = list.map((i) => ({
        title: i.title || '',
        icon: (i.icon && i.icon.trim()) || 'wap-home-o',
        path: (i.path && i.path.trim()) || '/',
      }));
    }
  } catch {
    tabbarItems.value = [...DEFAULT_TABBAR];
  }
}

onMounted(loadTabbarConfig);

const hiddenTabRoutes = ['/login', '/register', '/service/', '/address', '/guide/'];
const showTabbar = computed(() => {
  return !hiddenTabRoutes.some((r) => route.path.startsWith(r));
});
// 首页、产品页、我的页面不显示聊天悬浮按钮（与小程序一致）；组件始终挂载以便「意见反馈」可打开聊天
const hideChatFab = computed(() => {
  const p = route.path;
  if (p === '/' || p === '/products' || p === '/mine') return true;
  if (p.startsWith('/login') || p.startsWith('/register')) return true;
  return false;
});

const chatWidgetRef = ref(null);
provide('chatWidget', chatWidgetRef);

const showSplash = ref(false);

onMounted(() => {
  if (!sessionStorage.getItem('vino_splash_shown')) {
    showSplash.value = true;
    sessionStorage.setItem('vino_splash_shown', '1');
    setTimeout(() => {
      showSplash.value = false;
    }, 3500);
  }
});
</script>

<style scoped>
/* 提高 z-index，避免被页面内 fixed 或聊天 FAB 下方的触摸层遮挡，解决手机端「产品」等按钮无法点击 */
:deep(.van-tabbar) {
  max-width: 750px;
  margin: 0 auto;
  z-index: 100;
}
:deep(.van-tabbar-item) {
  touch-action: manipulation;
  cursor: pointer;
}
</style>
