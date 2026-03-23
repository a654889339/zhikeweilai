<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen" :style="{ background: backgroundColor }" @click="dismiss">
      <div class="splash-content">
        <div class="splash-logo-wrapper">
          <!-- 动态图片：如果配置了 imageUrl 则显示图片，否则显示默认 SVG -->
          <img
            v-if="splashConfig?.imageUrl && !imageError"
            :src="splashConfig.imageUrl"
            :alt="splashConfig.title || '智科未来'"
            class="splash-logo-image"
            @error="onImageError"
          />
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="splash-logo">
            <rect width="520" height="200" fill="#000"/>
            <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
            <path d="M38 35 L55 35 L55 60 L45 35 Z" fill="#000" opacity="0.2"/>
            <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
            <path d="M172 35 L180 35 L180 170 L172 170 Z" fill="#000" opacity="0.15"/>
            <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
            <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
            <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
            <circle cx="498" cy="38" r="10" stroke="#666" stroke-width="1.5" fill="none"/>
            <text x="498" y="43" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" font-weight="bold">R</text>
          </svg>
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

const visible = ref(true);
const splashConfig = ref(null);
const imageError = ref(false);

// 获取背景色：优先使用配置的 color，否则使用默认黑色
const backgroundColor = computed(() => {
  return splashConfig.value?.color || '#000';
});

// 获取显示文本：优先使用配置的描述，否则使用默认文本
const displayText = computed(() => {
  if (splashConfig.value?.desc) {
    return splashConfig.value.desc;
  }
  if (splashConfig.value?.title) {
    return `即将打开${splashConfig.value.title}...`;
  }
  return '即将打开智科未来服务站...';
});


const dismiss = () => {
  visible.value = false;
};

const onImageError = () => {
  imageError.value = true;
  // 图片加载失败时，会自动显示 SVG 备用方案
};

// 加载开场动画配置
const loadSplashConfig = async () => {
  try {
    const res = await homeConfigApi.list();
    if (res.data) {
      // 查找 section 为 splash 且状态为 active 的配置
      const splash = res.data.find(item => item.section === 'splash' && item.status === 'active');
      if (splash) {
        splashConfig.value = splash;
      }
    }
  } catch (error) {
    console.error('加载开场动画配置失败:', error);
    // 失败时使用默认配置（SVG）
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
