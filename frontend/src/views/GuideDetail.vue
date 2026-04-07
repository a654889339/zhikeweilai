<template>
  <div class="guide-detail-page">
    <van-nav-bar :title="guide.name || '设备指南'" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" style="text-align:center;padding:80px 0" />

    <template v-else-if="guide.id">
      <!-- Hero + Media -->
      <div class="hero-block">
        <div class="hero-section">
          <div v-if="guide.showcaseVideo" class="hero-video-wrap" @click="playVideo(fullUrl(guide.showcaseVideo))">
            <LodImg v-if="guide.coverImage" :src="fullUrl(guide.coverImage)" :thumb="guide.coverImageThumb ? fullUrl(guide.coverImageThumb) : ''" class="hero-img" />
            <div v-else class="hero-placeholder" :style="{ background: guide.gradient }">
              <LodImg v-if="guide.iconUrl" :src="guide.iconUrl" :thumb="guide.iconUrlThumb" style="width:64px;height:64px;object-fit:contain" />
              <van-icon v-else :name="guide.icon" size="64" color="#fff" />
            </div>
            <div class="hero-play-btn"><van-icon name="play-circle" size="48" color="#fff" /></div>
          </div>
          <div v-else-if="guide.coverImage" class="hero-img-wrap" @click="previewImage(fullUrl(guide.coverImage))">
            <LodImg :src="fullUrl(guide.coverImage)" :thumb="guide.coverImageThumb ? fullUrl(guide.coverImageThumb) : ''" class="hero-img" />
          </div>
          <div v-else class="hero-gradient" :style="{ background: guide.gradient }">
            <LodImg v-if="guide.iconUrl" :src="guide.iconUrl" :thumb="guide.iconUrlThumb" style="width:64px;height:64px;object-fit:contain" />
            <van-icon v-else :name="guide.icon" size="64" color="#fff" />
            <h2>{{ guide.name }}</h2>
          </div>
        </div>
        <div v-if="mediaItems.length" class="hero-media">
          <h3 class="hero-media-title">{{ mediaItems[0]?.title || guide.name }}</h3>
          <div class="media-scroll">
            <div v-for="(m, i) in mediaItems" :key="i" class="media-card" @click="openMedia(m)">
              <div class="media-thumb">
                <img v-if="getThumbUrl(m)" :src="getThumbUrl(m)" />
                <div v-else class="media-thumb-placeholder"><van-icon :name="isVideo(m) ? 'video-o' : 'photo-o'" size="28" color="#999" /></div>
                <div v-if="isVideo(m)" class="media-play"><van-icon name="play-circle-o" size="24" color="#fff" /></div>
                <div class="media-label-overlay">{{ m.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="guide.id" class="guide-price-card">
        <div class="guide-price-inner">
          <span class="guide-price-label">价格</span>
          <span class="guide-price-val">¥ {{ priceText }}</span>
          <span class="guide-points-label">积分</span>
          <span class="guide-points-val">{{ pointsText }}</span>
        </div>
      </div>

      <!-- Help Links -->
      <div v-if="helpItems.length || sections.length" class="section-card">
        <h3 class="section-title">使用帮助</h3>
        <van-cell-group inset :border="false">
          <van-cell v-if="helpItems.length" title="电子说明书" icon="description" is-link @click="$router.push(`/guide/${guide.id}/manual`)" />
          <van-cell v-if="sections.length" title="常见问题与保养建议" icon="info-o" is-link @click="$router.push(`/guide/${guide.id}/maintenance`)" />
        </van-cell-group>
      </div>

      <!-- Service Entry -->
      <div class="section-card">
        <h3 class="section-title">服务入口</h3>
        <div class="service-entry-grid">
          <div class="entry-item" @click="$router.push('/products')">
            <div class="entry-icon" style="background:#EDE9FE"><van-icon name="service-o" size="22" color="#7C3AED" /></div>
            <span>自助服务</span>
          </div>
          <div class="entry-item" @click="$router.push('/products')">
            <div class="entry-icon" style="background:#DBEAFE"><van-icon name="location-o" size="22" color="#2563EB" /></div>
            <span>服务网点</span>
          </div>
          <div class="entry-item" @click="$router.push('/products')">
            <div class="entry-icon" style="background:#D1FAE5"><van-icon name="shield-o" size="22" color="#059669" /></div>
            <span>售后政策</span>
          </div>
          <div class="entry-item" @click="$router.push('/products')">
            <div class="entry-icon" style="background:#FEF3C7"><van-icon name="balance-list-o" size="22" color="#D97706" /></div>
            <span>维修报价</span>
          </div>
        </div>
      </div>

      <div style="height:88px"></div>
    </template>

    <!-- Video Player Overlay -->
    <div v-if="playShowcase" class="video-backdrop" @click.self="closeVideo()">
      <div class="video-overlay">
        <video v-if="currentVideoUrl" :src="currentVideoUrl" controls autoplay playsinline class="overlay-video" />
        <div class="video-close" @click="closeVideo()"><van-icon name="cross" size="24" color="#fff" /></div>
      </div>
    </div>
    <div class="app-fixed-bottom-shell guide-footer-z">
      <div class="guide-footer-inner guide-footer-actions">
        <van-button class="gf-btn gf-cart" plain hairline type="default" round @click="goCartPage">购物车</van-button>
        <van-button class="gf-btn gf-buy" type="danger" round @click="buyNow">购买</van-button>
        <van-button class="gf-btn gf-add" type="primary" color="#B91C1C" round @click="addToCart">加入购物车</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showImagePreview, showToast } from 'vant';
import { guideApi, authApi } from '@/api';
import LodImg from '@/components/LodImg.vue';

const route = useRoute();
const loading = ref(true);
const guide = ref({});
const playShowcase = ref(false);
const currentVideoUrl = ref('');

const sections = computed(() => {
  const s = guide.value.sections;
  return Array.isArray(s) ? s : [];
});
const mediaItems = computed(() => {
  const m = guide.value.mediaItems;
  return Array.isArray(m) ? m : [];
});
const helpItems = computed(() => {
  const h = guide.value.helpItems;
  return Array.isArray(h) ? h : [];
});

const BASE = import.meta.env.VITE_API_BASE || '';
const fullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
};

const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i;
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i;

const isVideoUrl = (url) => url && VIDEO_EXTS.test(url);
const isImageUrl = (url) => url && IMAGE_EXTS.test(url);

const isVideo = (m) => {
  if (m.url && isVideoUrl(m.url)) return true;
  if (m.thumb && isVideoUrl(m.thumb)) return true;
  return m.type === 'video' && !isImageUrl(m.url || m.thumb || '');
};

const getMediaUrl = (m) => {
  if (m.url) return fullUrl(m.url);
  if (m.thumb) return fullUrl(m.thumb);
  return '';
};

const getThumbUrl = (m) => {
  if (m.thumb && isImageUrl(m.thumb)) return fullUrl(m.thumb);
  if (m.url && isImageUrl(m.url)) return fullUrl(m.url);
  if (m.thumb && !isVideoUrl(m.thumb)) return fullUrl(m.thumb);
  return '';
};

const playVideo = (url) => {
  currentVideoUrl.value = url;
  playShowcase.value = true;
};

const closeVideo = () => {
  playShowcase.value = false;
  currentVideoUrl.value = '';
};

const previewImage = (url) => {
  showImagePreview({ images: [url], closeable: true });
};

const router = useRouter();

const priceText = computed(() => {
  const v = guide.value.listPrice;
  if (v == null || Number.isNaN(Number(v))) return '0.00';
  return Number(v).toFixed(2);
});
const pointsText = computed(() => {
  const v = guide.value.rewardPoints;
  if (v != null && Number(v) > 0) return String(v);
  return '—';
});

const goCartPage = () => {
  router.push('/cart');
};

async function mergeCurrentGuideIntoCart() {
  const gid = Number(guide.value.id);
  if (!gid) return;
  const cartRes = await authApi.getCart();
  const rows = cartRes.data?.items || [];
  const items = rows.map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
  const hit = items.find((x) => x.guideId === gid);
  if (hit) hit.qty += 1;
  else items.push({ guideId: gid, qty: 1 });
  await authApi.putCart({ items });
}

const addToCart = async () => {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showToast('请先登录');
    router.push('/login');
    return;
  }
  if (!Number(guide.value.id)) return;
  try {
    await mergeCurrentGuideIntoCart();
    showToast('已加入购物车');
  } catch (e) {
    showToast(e.message || '操作失败');
  }
};

const buyNow = async () => {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showToast('请先登录');
    router.push('/login');
    return;
  }
  if (!Number(guide.value.id)) return;
  try {
    await mergeCurrentGuideIntoCart();
    router.push('/checkout');
  } catch (e) {
    showToast(e.message || '操作失败');
  }
};

const openMedia = (m) => {
  const url = getMediaUrl(m);
  if (!url) return;
  if (isVideo(m)) {
    playVideo(url);
  } else {
    const images = mediaItems.value
      .filter(item => !isVideo(item) && getMediaUrl(item))
      .map(item => getMediaUrl(item));
    const idx = images.indexOf(url);
    showImagePreview({ images, startPosition: idx >= 0 ? idx : 0, closeable: true });
  }
};

onMounted(async () => {
  try {
    const res = await guideApi.detail(route.params.id);
    guide.value = res.data || {};
  } catch { /* fallback empty */ }
  loading.value = false;
});
</script>

<style scoped>
.guide-detail-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.guide-detail-page :deep(.van-nav-bar) {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.guide-detail-page :deep(.van-nav-bar__title) {
  font-weight: 600;
  font-size: 17px;
  color: var(--vino-dark);
}

/* ===== Hero ===== */
.hero-block {
  background: #fff;
  margin-bottom: 8px;
  animation: fadeInUp 0.4s var(--vino-transition) both;
}

.hero-section { position: relative; }

.hero-video-wrap,
.hero-img-wrap {
  position: relative;
  cursor: pointer;
}

.hero-img {
  width: 100%;
  height: 260px;
  object-fit: cover;
  display: block;
}

.hero-play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s var(--vino-transition);
}

.hero-video-wrap:active .hero-play-btn {
  transform: translate(-50%, -50%) scale(0.9);
}

.hero-gradient {
  height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #fff;
}

.hero-gradient h2 {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.hero-placeholder {
  width: 100%;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== Media ===== */
.hero-media {
  padding: 20px;
}

.hero-media-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-dark);
  margin-bottom: 14px;
  letter-spacing: -0.02em;
}

.media-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.media-scroll::-webkit-scrollbar { display: none; }

.media-card {
  flex-shrink: 0;
  width: 135px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
}

.media-card:active {
  transform: scale(0.96);
}

.media-thumb {
  width: 135px;
  height: 170px;
  border-radius: var(--vino-radius-sm);
  overflow: hidden;
  position: relative;
  background: #1d1d1f;
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
}

.media-play {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-label-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 10px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Section Card ===== */
.section-card {
  background: #fff;
  margin: 8px 12px;
  border-radius: var(--vino-radius);
  padding: 20px;
  animation: fadeInUp 0.4s var(--vino-transition) both;
  animation-delay: 0.1s;
}

.section-card + .section-card {
  animation-delay: 0.15s;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-dark);
  margin-bottom: 14px;
  letter-spacing: -0.02em;
}

.section-card :deep(.van-cell) {
  padding: 14px 16px;
  border-radius: var(--vino-radius-sm);
}

.section-card :deep(.van-cell:active) {
  background: var(--vino-bg);
}

.section-card :deep(.van-cell__title) {
  font-weight: 500;
  font-size: 15px;
}

/* ===== Service Entry ===== */
.service-entry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.entry-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
}

.entry-item:active {
  transform: scale(0.92);
}

.entry-icon {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.entry-item span {
  font-size: 12px;
  color: var(--vino-text-secondary);
  font-weight: 500;
}

.guide-price-card {
  margin: 0 12px 8px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.guide-price-inner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 15px;
}
.guide-price-label,
.guide-points-label {
  color: var(--vino-text-secondary);
  font-size: 13px;
}
.guide-price-val {
  font-weight: 700;
  color: #B91C1C;
  font-size: 18px;
}
.guide-points-val {
  font-weight: 600;
  color: var(--vino-dark);
}

.guide-footer-z {
  z-index: 150;
}
.guide-footer-inner {
  padding: 10px 0;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%);
  backdrop-filter: blur(8px);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.06);
}
.guide-footer-actions {
  display: flex;
  gap: 8px;
  align-items: stretch;
  justify-content: center;
}
.guide-footer-actions .gf-btn {
  flex: 1;
  min-width: 0;
  font-size: 14px;
}

/* ===== Video Overlay ===== */
.video-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease both;
}

.video-overlay {
  position: relative;
  width: 92vw;
  max-width: 480px;
}

.overlay-video {
  width: 100%;
  border-radius: var(--vino-radius-sm);
  background: #000;
  max-height: 70vh;
  display: block;
}

.video-close {
  position: absolute;
  top: -44px;
  right: 0;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.video-close:active {
  background: rgba(255, 255, 255, 0.25);
}
</style>
