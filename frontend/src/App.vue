<template>
  <SplashScreen v-if="showSplash" />
  <router-view />
  <!-- 与 Vino_test 一致：外壳 max-width 750px 居中，底栏宽度与首页内容区对齐 -->
  <div v-if="showTabbar && tabbarItems.length" class="app-tabbar-shell">
    <van-tabbar route active-color="var(--vino-primary)" class="app-tabbar-bar">
      <van-tabbar-item v-for="(item, i) in tabbarItems" :key="item.path || i" :to="item.path" :icon="item.icon">{{ item.title }}</van-tabbar-item>
    </van-tabbar>
  </div>
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
  { title: '群组', icon: 'friends-o', path: '/chatgroup' },
  { title: '我的', icon: 'contact-o', path: '/mine' },
];

function filterTabbarNoService(items) {
  return (items || []).filter((it) => {
    const p = (it.path || '').trim();
    if (p === '/services') return false;
    if (p.startsWith('/service/')) return false;
    if (p === '/orders') return false;
    return true;
  });
}

const tabbarItems = ref([...DEFAULT_TABBAR]);

async function loadTabbarConfig() {
  try {
    const res = await homeConfigApi.tabbar();
    const list = (res.data || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (list.length) {
      tabbarItems.value = filterTabbarNoService(
        list.map((i) => ({
          title: i.title || '',
          icon: (i.icon && i.icon.trim()) || 'wap-home-o',
          path: (i.path && i.path.trim()) || '/',
        })),
      );
      if (!tabbarItems.value.length) tabbarItems.value = [...DEFAULT_TABBAR];
    }
  } catch {
    tabbarItems.value = [...DEFAULT_TABBAR];
  }
}

onMounted(loadTabbarConfig);

const hiddenTabRoutes = ['/login', '/register', '/address', '/guide/'];
const showTabbar = computed(() => {
  return !hiddenTabRoutes.some((r) => route.path.startsWith(r));
});
// 首页、产品页、我的页面不显示聊天悬浮按钮（与小程序一致）；组件始终挂载以便「意见反馈」可打开聊天
const hideChatFab = computed(() => {
  const p = route.path;
  if (p === '/' || p === '/products' || p === '/chatgroup' || p === '/mine') return true;
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
.app-tabbar-shell {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 750px;
  width: 100%;
  margin: 0 auto;
  padding: 0 12px;
  box-sizing: border-box;
  z-index: 3000;
  pointer-events: none;
}
.app-tabbar-shell .app-tabbar-bar {
  pointer-events: auto;
}
:deep(.app-tabbar-bar.van-tabbar) {
  position: relative !important;
  max-width: 100%;
  margin: 0 auto;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.06);
}
:deep(.van-tabbar-item) {
  touch-action: manipulation;
  cursor: pointer;
}
</style>
