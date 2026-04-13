<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen" :style="{ background: backgroundColor }" @click="dismiss">
      <div class="splash-content">
        <div class="splash-logo-wrapper" v-if="logoUrl && !imageError">
          <img
            :src="logoUrl"
            :alt="splashConfig?.title || '科必学'"
            class="splash-logo-image"
            @error="onImageError"
          />
        </div>
        <!-- 红框处：后台配置的开场动画描述 -->
        <div class="splash-desc" v-if="displayText">{{ displayText }}</div>
        <div class="splash-progress">
          <div class="splash-progress-bar"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { homeConfigApi } from '@/api';
import { normalizeBrandText } from '@/utils/brandName';

const visible = ref(true);
const splashConfig = ref(null);
const logoUrl = ref('');
const imageError = ref(false);

// 获取背景色：优先使用配置的 color，否则使用默认黑色
const backgroundColor = computed(() => {
  return splashConfig.value?.color || '#000';
});

// 获取显示文本：优先使用配置的描述，否则使用默认文本
const displayText = computed(() => {
  if (splashConfig.value?.desc) {
    return normalizeBrandText(splashConfig.value.desc);
  }
  if (splashConfig.value?.title) {
    return `即将打开${normalizeBrandText(splashConfig.value.title)}...`;
  }
  const fallback = splashConfig.value?.brandTitle || normalizeBrandText(splashConfig.value?.title) || '服务站';
  return `即将打开${fallback}...`;
});


const dismiss = () => {
  visible.value = false;
};

const onImageError = () => {
  imageError.value = true;
  // 图片加载失败时，会自动显示 SVG 备用方案
};

// 加载开场动画配置；Logo 优先使用「首页动画配置」中的 headerLogo，与后台管理后台一致
const loadSplashConfig = async () => {
  try {
    const res = await homeConfigApi.list({ all: 1 });
    if (res.data) {
      const items = res.data;
      const splash = items.find((item) => item.section === 'splash' && item.status === 'active');
      const headerLogo = items.find((item) => item.section === 'headerLogo' && item.status === 'active');
      const cn = items.find((item) => item.section === 'companyName' && item.status === 'active');
      if (splash) {
        splashConfig.value = {
          ...splash,
          brandTitle:
            cn && cn.title ? normalizeBrandText(String(cn.title).trim()) : '',
        };
      } else if (cn && cn.title) {
        splashConfig.value = { brandTitle: normalizeBrandText(String(cn.title).trim()) };
      }
      logoUrl.value =
        (headerLogo && headerLogo.imageUrl && String(headerLogo.imageUrl).trim()) ||
        (splash && splash.imageUrl && String(splash.imageUrl).trim()) ||
        '';
    }
  } catch (error) {
    console.error('加载开场动画配置失败:', error);
  }
};

onMounted(async () => {
  // 先加载配置
  await loadSplashConfig();

  // 3.2秒后自动关闭
  setTimeout(() => {
    visible.value = false;
  }, 3200);
});
</script>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  /* 背景色通过 :style 动态绑定 */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 320px;
  width: 100%;
  padding: 0 24px;
}

.splash-logo-wrapper {
  animation: logoEnter 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: scale(0.6);
}

.splash-logo {
  width: 280px;
  height: auto;
}

.splash-logo-image {
  max-width: 280px;
  max-height: 200px;
  width: auto;
  height: auto;
  object-fit: contain;
}

/* 红框处：后台配置的开场动画描述 */
.splash-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  letter-spacing: 1px;
  line-height: 1.5;
  max-width: 280px;
  min-height: 24px;
  opacity: 0;
  animation: charIn 0.5s 0.8s ease forwards;
}

.splash-progress {
  width: 120px;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  opacity: 0;
  animation: fadeIn 0.3s 1.2s ease forwards;
}

.splash-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #B91C1C, #EF4444);
  border-radius: 2px;
  animation: progressFill 1.8s 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  width: 0;
}

@keyframes logoEnter {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  60% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes charIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

@keyframes progressFill {
  to {
    width: 100%;
  }
}

.splash-fade-leave-active {
  transition: opacity 0.5s ease;
}

.splash-fade-leave-to {
  opacity: 0;
}
</style>
