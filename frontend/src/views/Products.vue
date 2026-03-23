<template>
  <div class="products-page">
    <!-- 第一栏：只显示商品种类 -->
    <div class="product-nav">
      <div class="product-nav-scroll">
        <a
          v-for="cat in categories"
          :key="cat.id"
          class="product-nav-item"
          :class="{ active: selectedCategoryId === cat.id }"
          @click="selectCategory(cat)"
        >{{ cat.name }}</a>
      </div>
    </div>

    <!-- 第二行：下拉框显示此类下的所有商品 -->
    <div class="product-select-row" v-if="categories.length">
      <van-field
        readonly
        clickable
        :model-value="selectedProductLabel"
        label="选择商品"
        :placeholder="selectedCategoryId && !deviceGuides.length ? '该种类下暂无商品' : '请选择商品'"
        @click="deviceGuides.length ? (showProductPicker = true) : null"
      />
      <van-popup v-model:show="showProductPicker" position="bottom" round>
        <van-picker
          :columns="productPickerColumns"
          @confirm="onProductPick"
          @cancel="showProductPicker = false"
        />
      </van-popup>
    </div>

    <!-- Product detail content -->
    <van-loading v-if="loading" size="36" style="text-align:center;padding:80px 0" />

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
                <LodImg v-if="getMediaUrl(m) && !isVideo(m)" :src="getMediaUrl(m)" :thumb="getThumbUrl(m) !== getMediaUrl(m) ? getThumbUrl(m) : ''" class="media-thumb-img" />
                <img v-else-if="getThumbUrl(m)" :src="getThumbUrl(m)" />
                <div v-else class="media-thumb-placeholder"><van-icon :name="isVideo(m) ? 'video-o' : 'photo-o'" size="28" color="#999" /></div>
                <div v-if="isVideo(m)" class="media-play"><van-icon name="play-circle-o" size="24" color="#fff" /></div>
                <div class="media-label-overlay">{{ m.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="helpItems.length || sections.length" class="section-card">
        <h3 class="section-title">使用帮助</h3>
        <van-cell-group inset :border="false">
          <van-cell v-if="helpItems.length" title="电子说明书" icon="description" is-link @click="$router.push(`/guide/${guide.id}/manual`)" />
          <van-cell v-if="sections.length" title="常见问题与保养建议" icon="info-o" is-link @click="$router.push(`/guide/${guide.id}/maintenance`)" />
        </van-cell-group>
      </div>

      <div class="section-card">
        <h3 class="section-title">服务入口</h3>
        <div class="service-entry-grid">
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#EDE9FE"><van-icon name="service-o" size="22" color="#7C3AED" /></div>
            <span>自助服务</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#DBEAFE"><van-icon name="location-o" size="22" color="#2563EB" /></div>
            <span>服务网点</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#D1FAE5"><van-icon name="shield-o" size="22" color="#059669" /></div>
            <span>售后政策</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#FEF3C7"><van-icon name="balance-list-o" size="22" color="#D97706" /></div>
            <span>维修报价</span>
          </div>
        </div>
      </div>

      <div style="height:70px"></div>
    </template>

    <div v-else-if="!loading" class="empty-hint">
      <van-icon name="info-o" size="48" color="#ccc" />
      <p>{{ categories.length ? '请在上方选择种类与商品' : '暂无商品配置' }}</p>
    </div>

    <!-- Video Player -->
    <div v-if="playShowcase" class="video-backdrop" @click.self="closeVideo()">
      <div class="video-overlay">
        <video v-if="currentVideoUrl" :src="currentVideoUrl" controls autoplay playsinline class="overlay-video" />
        <div class="video-close" @click="closeVideo()"><van-icon name="cross" size="24" color="#fff" /></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { showImagePreview } from 'vant';
import { guideApi } from '@/api';
import LodImg from '@/components/LodImg.vue';

const categories = ref([]);
const selectedCategoryId = ref(null);
const deviceGuides = ref([]);
const activeId = ref(null);
const guide = ref({});
const loading = ref(false);
const playShowcase = ref(false);
const currentVideoUrl = ref('');
const showProductPicker = ref(false);

const selectedProductLabel = computed(() => {
  const g = deviceGuides.value.find(d => d.id === activeId.value);
  return g ? g.name : '';
});

const productPickerColumns = computed(() =>
  deviceGuides.value.map(d => ({ text: d.name, value: d.id }))
);

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
  if (m.url && !isVideoUrl(m.url)) return fullUrl(m.url);
  return '';
};

const playVideo = (url) => { currentVideoUrl.value = url; playShowcase.value = true; };
const closeVideo = () => { playShowcase.value = false; currentVideoUrl.value = ''; };
const previewImage = (url) => { showImagePreview({ images: [url], closeable: true }); };

const openMedia = (m) => {
  const url = getMediaUrl(m);
  if (!url) return;
  if (isVideo(m)) { playVideo(url); return; }
  const images = mediaItems.value.filter(item => !isVideo(item) && getMediaUrl(item)).map(item => getMediaUrl(item));
  const idx = images.indexOf(url);
  showImagePreview({ images, startPosition: idx >= 0 ? idx : 0, closeable: true });
};

const loadGuideDetail = async (id) => {
  loading.value = true;
  try {
    const res = await guideApi.detail(id);
    guide.value = res.data || {};
  } catch { guide.value = {}; }
  loading.value = false;
};

const selectCategory = async (cat) => {
  if (selectedCategoryId.value === cat.id) return;
  selectedCategoryId.value = cat.id;
  try {
    const res = await guideApi.list({ categoryId: cat.id });
    deviceGuides.value = res.data || [];
    activeId.value = null;
    guide.value = {};
    if (deviceGuides.value.length) {
      const first = deviceGuides.value[0];
      activeId.value = first.id;
      loadGuideDetail(first.slug || first.id);
    }
  } catch { deviceGuides.value = []; }
};

const onProductPick = ({ selectedOptions }) => {
  showProductPicker.value = false;
  const opt = selectedOptions[0];
  if (!opt) return;
  const device = deviceGuides.value.find(d => d.id === opt.value);
  if (device) {
    activeId.value = device.id;
    loadGuideDetail(device.slug || device.id);
  }
};

onMounted(async () => {
  try {
    const res = await guideApi.categories();
    categories.value = res.data || [];
    if (categories.value.length) {
      selectedCategoryId.value = categories.value[0].id;
      const listRes = await guideApi.list({ categoryId: categories.value[0].id });
      deviceGuides.value = listRes.data || [];
      if (deviceGuides.value.length) {
        const first = deviceGuides.value[0];
        activeId.value = first.id;
        loadGuideDetail(first.slug || first.id);
      }
    }
  } catch { /* empty */ }
});
</script>

<style scoped>
.products-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

/* ===== Product Nav ===== */
.product-nav {
  background: var(--vino-card);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 10;
}

.product-select-row {
  background: var(--vino-card);
  padding: 0 16px 12px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

.product-nav-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0 12px;
}

.product-nav-scroll::-webkit-scrollbar { display: none; }

.product-nav-item {
  flex-shrink: 0;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 400;
  color: var(--vino-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s var(--vino-transition);
  position: relative;
}

.product-nav-item.active {
  color: var(--vino-dark);
  font-weight: 600;
}

.product-nav-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: var(--vino-dark);
  border-radius: 1px;
}

.product-nav-item:active {
  opacity: 0.6;
}

/* ===== Hero ===== */
.hero-block {
  background: #fff;
  margin-bottom: 8px;
  animation: fadeInUp 0.35s var(--vino-transition) both;
}

.hero-section { position: relative; }
.hero-video-wrap, .hero-img-wrap { position: relative; cursor: pointer; }
.hero-img { width: 100%; height: 260px; object-fit: cover; display: block; }

.hero-play-btn {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 64px; height: 64px; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
}

.hero-gradient {
  height: 220px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; color: #fff;
}

.hero-gradient h2 { font-size: 24px; font-weight: 700; color: #fff; }

.hero-placeholder {
  width: 100%; height: 260px; display: flex; align-items: center; justify-content: center;
}

/* ===== Media（红框区域元素居中） ===== */
.hero-media { padding: 20px; text-align: center; }
.hero-media-title { font-size: 20px; font-weight: 700; color: var(--vino-dark); margin-bottom: 14px; letter-spacing: -0.02em; }

.media-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; justify-content: center; }
.media-scroll::-webkit-scrollbar { display: none; }
.media-card { flex-shrink: 0; width: 135px; cursor: pointer; transition: transform 0.25s var(--vino-transition); }
.media-card:active { transform: scale(0.96); }
.media-thumb { width: 135px; height: 170px; border-radius: var(--vino-radius-sm); overflow: hidden; position: relative; background: #1d1d1f; }
.media-thumb img { width: 100%; height: 100%; object-fit: cover; }
.media-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #2a2a2a; }
.media-play { position: absolute; top: 40%; left: 50%; transform: translate(-50%,-50%); width: 40px; height: 40px; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.media-label-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 24px 10px 10px; background: linear-gradient(transparent, rgba(0,0,0,0.65)); font-size: 13px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== Section Card ===== */
.section-card {
  background: #fff; margin: 8px 12px; border-radius: var(--vino-radius); padding: 20px;
  animation: fadeInUp 0.35s var(--vino-transition) both; animation-delay: 0.05s;
}

.section-card + .section-card { animation-delay: 0.1s; }

.section-title { font-size: 20px; font-weight: 700; color: var(--vino-dark); margin-bottom: 14px; letter-spacing: -0.02em; }

.section-card :deep(.van-cell) { padding: 14px 16px; border-radius: var(--vino-radius-sm); }
.section-card :deep(.van-cell:active) { background: var(--vino-bg); }
.section-card :deep(.van-cell__title) { font-weight: 500; font-size: 15px; }

/* ===== Service Entry ===== */
.service-entry-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.entry-item { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: transform 0.25s var(--vino-transition); }
.entry-item:active { transform: scale(0.92); }
.entry-icon { width: 50px; height: 50px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
.entry-item span { font-size: 12px; color: var(--vino-text-secondary); font-weight: 500; }

/* ===== Empty ===== */
.empty-hint { text-align: center; padding: 80px 0; color: var(--vino-text-secondary); }
.empty-hint p { margin-top: 12px; font-size: 15px; }

/* ===== Video ===== */
.video-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.88); z-index: 200; display: flex; align-items: center; justify-content: center; }
.video-overlay { position: relative; width: 92vw; max-width: 480px; }
.overlay-video { width: 100%; border-radius: var(--vino-radius-sm); background: #000; max-height: 70vh; display: block; }
.video-close { position: absolute; top: -44px; right: 0; width: 36px; height: 36px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
</style>
