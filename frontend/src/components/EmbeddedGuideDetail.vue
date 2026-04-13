<!-- 嵌入产品页右侧：无顶栏，与 GuideDetail 内容区一致 -->
<template>
  <div class="embed-guide">
    <van-loading v-if="loading" size="28" class="embed-loading" />
    <template v-else-if="guide.id">
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

      <div v-if="helpItems.length || sections.length" class="section-card">
        <h3 class="section-title">使用帮助</h3>
        <van-cell-group inset :border="false">
          <van-cell v-if="helpItems.length" title="电子说明书" icon="description" is-link @click="goManual" />
          <van-cell v-if="sections.length" title="常见问题与保养建议" icon="info-o" is-link @click="goMaintenance" />
        </van-cell-group>
      </div>

      <div style="height:88px" />
    </template>

    <div v-if="!loading && !guide.id" class="embed-empty">暂无内容</div>

    <div v-if="guide.id" class="app-fixed-bottom-shell guide-footer-z">
      <div class="guide-footer-inner guide-footer-actions">
        <van-button class="gf-btn gf-cart" plain hairline type="default" round @click="goCartPage">购物车</van-button>
        <van-button class="gf-btn gf-add" type="primary" color="#B91C1C" round @click="addToCart">加入购物车</van-button>
        <van-button class="gf-btn gf-buy" type="danger" round @click="buyNow">立即下单</van-button>
      </div>
    </div>

    <div v-if="playShowcase" class="video-backdrop" @click.self="closeVideo()">
      <div class="video-overlay">
        <video v-if="currentVideoUrl" :src="currentVideoUrl" controls autoplay playsinline class="overlay-video" />
        <div class="video-close" @click="closeVideo()"><van-icon name="cross" size="24" color="#fff" /></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showImagePreview, showToast } from 'vant';
import { guideApi, authApi } from '@/api';
import LodImg from '@/components/LodImg.vue';

const props = defineProps({
  guideId: { type: [Number, String], default: null },
});

const router = useRouter();
const loading = ref(false);
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

const openMedia = (m) => {
  const url = getMediaUrl(m);
  if (!url) return;
  if (isVideo(m)) {
    playVideo(url);
  } else {
    const images = mediaItems.value
      .filter((item) => !isVideo(item) && getMediaUrl(item))
      .map((item) => getMediaUrl(item));
    const idx = images.indexOf(url);
    showImagePreview({ images, startPosition: idx >= 0 ? idx : 0, closeable: true });
  }
};

const goManual = () => {
  if (guide.value.id) router.push(`/guide/${guide.value.id}/manual`);
};
const goMaintenance = () => {
  if (guide.value.id) router.push(`/guide/${guide.value.id}/maintenance`);
};

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

async function load() {
  const id = props.guideId;
  if (id == null || id === '') {
    guide.value = {};
    return;
  }
  loading.value = true;
  try {
    const res = await guideApi.detail(id);
    guide.value = res.data || {};
  } catch {
    guide.value = {};
  }
  loading.value = false;
}

watch(
  () => props.guideId,
  () => {
    load();
  },
  { immediate: true }
);
</script>

<style scoped>
.embed-guide {
  min-height: 200px;
}
.embed-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.embed-empty {
  text-align: center;
  padding: 32px;
  color: #6b7280;
  font-size: 14px;
}
.hero-block {
  background: #fff;
  margin-bottom: 8px;
}
.hero-section {
  position: relative;
}
.hero-video-wrap,
.hero-img-wrap {
  position: relative;
  cursor: pointer;
}
.hero-img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}
.hero-play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 56px;
  height: 56px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-gradient {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #fff;
}
.hero-gradient h2 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}
.hero-placeholder {
  width: 100%;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-media {
  padding: 16px;
}
.hero-media-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 12px;
}
.media-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.media-scroll::-webkit-scrollbar {
  display: none;
}
.media-card {
  flex-shrink: 0;
  width: 120px;
  cursor: pointer;
}
.media-thumb {
  width: 120px;
  height: 150px;
  border-radius: 10px;
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
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.45);
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
  padding: 20px 8px 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.guide-price-card {
  margin: 0 0 8px;
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.guide-price-inner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 14px;
}
.guide-price-label,
.guide-points-label {
  color: #6b7280;
  font-size: 12px;
}
.guide-price-val {
  font-weight: 700;
  color: #b91c1c;
  font-size: 17px;
}
.guide-points-val {
  font-weight: 600;
  color: #111827;
}
.section-card {
  background: #fff;
  margin: 8px 0;
  border-radius: 12px;
  padding: 16px;
}
.section-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 12px;
}
/* 产品页有底部 Tabbar，底栏需抬高避免被遮挡（与 Tabbar 分层错开） */
.embed-guide :deep(.app-fixed-bottom-shell) {
  bottom: 56px;
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
}
.video-overlay {
  position: relative;
  width: 92vw;
  max-width: 480px;
}
.overlay-video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  max-height: 70vh;
  display: block;
}
.video-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
</style>
