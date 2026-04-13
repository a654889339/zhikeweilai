<template>
  <div class="home">
    <!-- 独立背景层：铺在整页最底层，红框处（卡片两侧）才能透出背景图 -->
    <div class="home-bg" aria-hidden="true">
      <van-swipe v-if="heroBgList.length" class="home-bg-swipe" :autoplay="4000" indicator-color="rgba(255,255,255,0.5)">
        <van-swipe-item v-for="(item, i) in heroBgList" :key="i">
          <LodImg v-if="item.url" :src="item.url" :thumb="item.thumb" class="home-bg-img" />
        </van-swipe-item>
      </van-swipe>
    </div>
    <!-- Hero 仅负责顶部 logo/分享，背景透明以露出 home-bg -->
    <div class="hero">
      <div class="hero-overlay">
        <div class="hero-header">
          <img v-if="headerLogoUrl" :src="headerLogoUrl" class="hero-logo" alt="Logo" />
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="hero-logo-svg">
            <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#fff"/>
            <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#fff"/>
            <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#fff"/>
            <circle cx="420" cy="102" r="68" stroke="#fff" stroke-width="28" fill="none"/>
            <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#fff"/>
          </svg>
          <div class="hero-actions">
            <div class="share-btn" @click="showShare = true">
              <van-icon name="share-o" size="18" color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share QR Popup -->
    <van-overlay :show="showShare" @click="showShare = false">
      <div class="share-popup" @click.stop>
        <div class="share-card">
          <div class="share-card-header">
            <img v-if="headerLogoUrl" :src="headerLogoUrl" style="height:32px;object-fit:contain" />
          <span v-else style="color:#fff;font-weight:700;font-size:18px;letter-spacing:2px">{{ companyName }}</span>
          </div>
          <div class="share-qr">
            <canvas ref="qrCanvas"></canvas>
          </div>
          <p class="share-hint">扫描二维码，打开 {{ companyName }} 服务站</p>
          <div class="share-url">{{ shareUrl }}</div>
          <van-button size="small" round plain type="primary" color="#B91C1C" class="share-copy-btn" @click="copyUrl">复制链接</van-button>
        </div>
        <van-icon name="close" size="28" color="rgba(255,255,255,0.6)" class="share-close" @click="showShare = false" />
      </div>
    </van-overlay>

    <!-- 首页配置管理区域：仅此区域受「板块整体偏移」影响，不移动首页动画配置（背景/Logo/Hero） -->
    <div class="home-config-wrap" :style="homeSectionOffsetStyle">
    <!-- 自助预约（仅此区块上移，与下方我的商品/热门服务同层级） -->
    <div class="section card-section first-card" v-if="navLgItems.length || navSmItems.length">
      <div class="section-header">
        <h3>{{ navSectionTitle }}</h3>
        <span class="more" @click="$router.push('/products')">进度查询 ›</span>
      </div>
      <!-- 大图标行 -->
      <div class="nav-lg-row" v-if="navLgItems.length">
        <div class="nav-lg-item" v-for="item in navLgItems" :key="item.id" @click="$router.push(item.path)">
          <div class="nav-lg-icon">
            <img v-if="item.imageUrl" :src="item.imageUrlThumb || item.imageUrl" class="nav-lg-img" />
            <van-icon v-else :name="item.icon || 'apps-o'" size="36" :color="item.color || '#B91C1C'" />
          </div>
          <span class="nav-lg-label" :style="{ color: item.color || '#B91C1C' }">{{ item.title }}</span>
        </div>
      </div>
      <!-- 小图标行 -->
      <div class="nav-sm-row" v-if="navSmItems.length">
        <div class="nav-sm-item" v-for="item in navSmItems" :key="item.id" @click="$router.push(item.path)">
          <div class="nav-sm-icon">
            <img v-if="item.imageUrl" :src="item.imageUrlThumb || item.imageUrl" class="nav-sm-img" />
            <van-icon v-else :name="item.icon || 'apps-o'" size="20" color="#666" />
          </div>
          <span class="nav-sm-label">{{ item.title }}</span>
        </div>
      </div>
    </div>

    <!-- 我的商品：为空时整栏隐藏，自助服务紧贴自助预约 -->
    <div v-if="myProducts.length" class="section card-section">
      <div class="section-header">
        <h3>{{ myProductsTitle }}</h3>
        <span class="more" @click="$router.push('/mine/products')">查看全部 ›</span>
      </div>
      <input ref="qrFileInputRef" type="file" accept="image/*" class="hidden-input" @change="onQrFileChange" />
      <div class="my-products-list">
        <div
          v-for="(item, i) in myProducts"
          :key="item.productKey || i"
          class="my-product-item"
          :class="{ 'my-product-item--clickable': !!productGuideSlug(item) }"
          @click="onMyProductItemClick(item)"
        >
          <span class="my-product-category">{{ item.categoryName || '-' }}</span>
          <div class="my-product-icon-wrap">
            <img v-if="productIconUrl(item)" :src="productIconUrl(item)" class="my-product-icon" alt="" />
            <van-icon v-else name="photo-o" class="my-product-icon-placeholder" />
          </div>
          <span class="my-product-name">{{ item.productName || item.productKey }}</span>
        </div>
      </div>
    </div>

    <!-- Hot Services -->
    <div class="section card-section section-hot-service">
      <div class="section-header">
        <h3>{{ hotServiceTitle }}</h3>
        <span class="more" @click="$router.push('/products')">查看全部 ›</span>
      </div>
      <div class="service-list">
        <div v-for="item in hotServices" :key="item.id" class="service-card" @click="$router.push(item.path)">
          <div class="service-cover" :style="{ background: item.coverBg }">
            <van-icon :name="item.icon" size="36" color="#fff" />
          </div>
          <div class="service-info">
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <span class="price">¥{{ item.price }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommend：层级低于底栏，避免遮挡首页/产品/我的底部导航 -->
    <div class="section card-section section-recommend">
      <div class="section-header">
        <h3>{{ recommendTitle }}</h3>
      </div>
      <div class="recommend-grid">
        <div v-for="item in recommends" :key="item.id" class="recommend-card">
          <div class="recommend-icon" :style="{ background: item.bg }">
            <van-icon :name="item.icon" size="28" color="#fff" />
          </div>
          <h4>{{ item.title }}</h4>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>

    <div class="footer-space"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { showToast } from 'vant';
import { homeConfigApi, authApi } from '@/api';
import LodImg from '@/components/LodImg.vue';
import { normalizeBrandText } from '@/utils/brandName';

const router = useRouter();
const showShare = ref(false);
const qrCanvas = ref(null);
const qrFileInputRef = ref(null);
const shareUrl = window.location.origin;
const allItems = ref([]);
const companyName = computed(() => {
  const it = allItems.value.find((i) => i.section === 'companyName' && i.status === 'active');
  const raw = (it && it.title && String(it.title).trim()) || '科必学';
  return normalizeBrandText(raw);
});
const myProducts = ref([]);
const addProductLoading = ref(false);

function productIconUrl(item) {
  const u = (item && (item.iconUrlThumb || item.iconUrl)) || '';
  if (!u) return '';
  return u.startsWith('http') ? u : (window.location.origin + (u.startsWith('/') ? u : '/' + u));
}

function productGuideSlug(item) {
  const s = item && (item.guideSlug != null && item.guideSlug !== '' ? item.guideSlug : item.guide);
  return s != null ? String(s).trim() : '';
}

function onMyProductItemClick(item) {
  const slug = productGuideSlug(item);
  if (!slug) {
    showToast('暂无产品指南');
    return;
  }
  router.push('/guide/' + encodeURIComponent(slug));
}

async function loadMyProducts() {
  if (!localStorage.getItem('vino_token')) return;
  try {
    const r = await authApi.myProducts();
    myProducts.value = r.data || [];
  } catch { myProducts.value = []; }
}

onMounted(async () => {
  try {
    const res = await homeConfigApi.list({ all: 1 });
    allItems.value = res.data || [];
  } catch { /* use empty */ }
  await loadMyProducts();
});

function onAddProductClick() {
  if (!localStorage.getItem('vino_token')) {
    router.push('/login?redirect=' + encodeURIComponent('/mine/products'));
    return;
  }
  qrFileInputRef.value?.click();
}

function parseSnAndGuideFromUrl(raw) {
  let sn = '';
  let guide = '';
  try {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://dummy');
    sn = url.searchParams.get('sn') || '';
    guide = url.searchParams.get('guide') || '';
  } catch {
    const snMatch = raw.match(/[?&]sn=([^&]+)/);
    const guideMatch = raw.match(/[?&]guide=([^&]+)/);
    if (snMatch) sn = decodeURIComponent(snMatch[1].replace(/\+/g, ' '));
    if (guideMatch) guide = decodeURIComponent(guideMatch[1].replace(/\+/g, ' '));
  }
  return { sn: sn.trim(), guide: guide.trim() };
}

async function onQrFileChange(e) {
  const file = e.target?.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!localStorage.getItem('vino_token')) {
    router.push('/login?redirect=' + encodeURIComponent('/mine/products'));
    return;
  }
  addProductLoading.value = true;
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height);
    if (!decoded || !decoded.data) {
      showToast('未能识别二维码，请上传清晰的商品二维码图片');
      return;
    }
    const { sn, guide } = parseSnAndGuideFromUrl(decoded.data);
    if (!sn) {
      showToast('二维码中未包含序列号，请使用商品绑定二维码');
      return;
    }
    const res = await authApi.bindProduct({ sn });
    if (res.code === 0) {
      const guideSlug = (res.data && res.data.guideSlug && String(res.data.guideSlug).trim()) || guide;
      if (guideSlug) {
        router.push('/guide/' + encodeURIComponent(guideSlug));
        return;
      }
      showToast('绑定成功');
      await loadMyProducts();
    } else {
      showToast(res.message || '绑定失败');
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || '识别或绑定失败';
    showToast(msg);
  } finally {
    addProductLoading.value = false;
  }
}

const headerLogoUrl = computed(() => {
  const logo = allItems.value.find(i => i.section === 'headerLogo' && i.status === 'active');
  return logo?.imageUrl || '';
});
// 有缩略图则先加载缩略图再原图，无则直接原图
const heroBgList = computed(() => {
  const list = allItems.value.filter(i => i.section === 'homeBg' && i.status === 'active');
  return (list || [])
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(i => ({ url: i.imageUrl, thumb: '' }))
    .filter(i => i.url);
});
const heroBgFallback = computed(() => allItems.value.find(i => i.section === 'homeBg' && i.status === 'active')?.imageUrl || '');
const navSectionTitle = computed(() => {
  const item = allItems.value.find(i => i.section === 'navSectionTitle' && i.status === 'active');
  return (item?.title || '').trim() || '自助预约';
});
const hotServiceTitle = computed(() => {
  const item = allItems.value.find(i => i.section === 'hotServiceTitle' && i.status === 'active');
  return (item?.title || '').trim() || '自助服务';
});
const recommendTitle = computed(() => {
  const item = allItems.value.find(i => i.section === 'recommendTitle' && i.status === 'active');
  return (item?.title || '').trim() || '服务产品';
});
const myProductsTitle = computed(() => {
  const item = allItems.value.find(i => i.section === 'myProducts' && i.status === 'active');
  return (item?.title || '').trim() || '我的商品';
});
// 首页板块整体上下偏移量(px)，来自后台首页配置
const homeSectionOffsetPx = computed(() => {
  const item = allItems.value.find(i => i.section === 'homeSectionOffset' && i.status === 'active');
  if (!item || item.title === undefined || item.title === '') return 0;
  const n = parseInt(String(item.title).trim(), 10);
  return Number.isNaN(n) ? 0 : n;
});
const homeSectionOffsetStyle = computed(() =>
  homeSectionOffsetPx.value !== 0 ? { marginTop: homeSectionOffsetPx.value + 'px' } : undefined
);

const navLgItems = computed(() =>
  allItems.value.filter(i => i.section === 'navLg' && i.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(i => ({ id: i.id, title: i.title, icon: i.icon, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb, path: i.path || '/products', color: i.color }))
);
const navSmItems = computed(() =>
  allItems.value.filter(i => i.section === 'navSm' && i.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(i => ({ id: i.id, title: i.title, icon: i.icon, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb, path: i.path || '/products', color: i.color }))
);
const hotServices = computed(() =>
  allItems.value.filter(i => i.section === 'hotService' && i.status === 'active')
    .map(i => ({ id: i.id, title: i.title, desc: i.desc, price: i.price, icon: i.icon, coverBg: i.color, path: i.path || '/products' }))
);
const recommends = computed(() =>
  allItems.value.filter(i => i.section === 'recommend' && i.status === 'active')
    .map(i => ({ id: i.id, title: i.title, desc: i.desc, icon: i.icon, bg: i.color }))
);

watch(showShare, async (val) => {
  if (val) {
    await nextTick();
    if (qrCanvas.value) {
      QRCode.toCanvas(qrCanvas.value, shareUrl, { width: 180, margin: 2, color: { dark: '#1d1d1f', light: '#ffffff' } });
    }
  }
});

const copyUrl = async () => {
  try { await navigator.clipboard.writeText(shareUrl); showToast('链接已复制'); }
  catch { showToast('复制失败，请手动复制'); }
};
</script>

<style scoped>
.home {
  position: relative;
  /* 底部预留 ≥ tabbar 高度 + 安全区，避免内容遮挡底部导航 */
  padding-bottom: 180px;
  background: transparent;
  min-height: 100vh;
}

/* ===== 独立背景层：置于最底层，背景图铺满整区，无蓝色遮挡 ===== */
.home-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 78vh;
  min-height: 480px;
  z-index: 0;
  background: transparent;
}
.home-bg-swipe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
}
.home-bg-swipe .van-swipe-item { height: 100%; }
.home-bg-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* ===== Hero：仅顶部内容区，背景透明以露出 home-bg ===== */
.hero {
  position: relative;
  z-index: 1;
  height: 54vh;
  min-height: 320px;
  max-height: 520px;
  background: transparent;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.02) 40%, transparent 65%, rgba(255,255,255,0.02) 100%);
  display: flex;
  flex-direction: column;
}
.hero-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  padding-top: max(14px, env(safe-area-inset-top));
}
.hero-logo { height: 30px; width: auto; max-width: 100px; object-fit: contain; filter: brightness(0) invert(1); }
.hero-logo-svg { width: 64px; height: 26px; }
.hero-actions { display: flex; gap: 8px; }

/* ===== Card Sections：半透明 + 两侧留白，层级低于底部 tabbar，避免遮挡首页/产品等按钮 ===== */
.card-section {
  position: relative;
  z-index: 1;
  margin: 12px;
  border-radius: 16px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.72) 50%, rgba(255,255,255,0.5) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
/* 仅「自助预约」区块上移；我的商品、热门服务等同层级，不设负 margin */
.card-section.first-card {
  margin-top: -32vh;
  min-height: 0;
}
/* 任意连续卡片之间统一留白，避免「我的商品」与自助服务/热门服务重叠 */
.card-section + .card-section {
  margin-top: 20px;
}
/* 为你推荐与卡片区同级，层级低于 tabbar */
.section-recommend {
  z-index: 1;
}

/* ===== Section common ===== */
.section { padding: 20px; animation: fadeInUp 0.4s var(--vino-transition) both; }
.section:nth-child(3) { animation-delay: 0.05s; }
.section:nth-child(4) { animation-delay: 0.1s; }
.section:nth-child(5) { animation-delay: 0.15s; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h3 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--vino-dark); }
.more { font-size: 14px; color: var(--vino-primary); font-weight: 500; cursor: pointer; }

/* ===== 自助预约 - 大图标 ===== */
.nav-lg-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 12px;
}
.nav-lg-row::-webkit-scrollbar { display: none; }
.nav-lg-item {
  flex: 1;
  min-width: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}
.nav-lg-item:active { transform: scale(0.95); }
.nav-lg-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
}
.nav-lg-img { width: 100%; height: 100%; object-fit: cover; }
.nav-lg-label { font-size: 13px; font-weight: 600; text-align: center; }

/* ===== 自助预约 - 小图标 ===== */
.nav-sm-row {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-top: 4px;
  border-top: 1px solid rgba(0,0,0,0.04);
}
.nav-sm-row::-webkit-scrollbar { display: none; }
.nav-sm-item {
  flex: 1;
  min-width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  cursor: pointer;
  transition: transform 0.2s;
}
.nav-sm-item:active { transform: scale(0.92); }
.nav-sm-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}
.nav-sm-img { width: 100%; height: 100%; object-fit: contain; }
.nav-sm-label { font-size: 11px; color: #666; text-align: center; }

/* ===== 我的商品 ===== */
.my-products-empty { padding: 16px; text-align: center; color: #999; font-size: 14px; }
.hidden-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.my-products-list { display: flex; flex-direction: column; gap: 10px; }
.my-product-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; background: #f8f8f8; border-radius: 10px;
}
.my-product-item--clickable { cursor: pointer; transition: opacity 0.2s; }
.my-product-item--clickable:active { opacity: 0.85; }
.my-product-category { font-size: 13px; color: #666; min-width: 48px; flex-shrink: 0; }
.my-product-icon-wrap { width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; overflow: hidden; background: #eee; display: flex; align-items: center; justify-content: center; }
.my-product-icon { width: 100%; height: 100%; object-fit: contain; }
.my-product-icon-placeholder { font-size: 22px; color: #bbb; }
.my-product-name { flex: 1; font-size: 15px; font-weight: 600; color: var(--vino-dark); min-width: 0; }
.my-product-key { font-size: 12px; color: #999; font-family: monospace; flex-shrink: 0; }

/* ===== Hot Services ===== */
.service-list { display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
.service-list::-webkit-scrollbar { display: none; }
.service-card {
  min-width: 150px;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: transform 0.3s;
}
.service-card:active { transform: scale(0.96); }
.service-cover { height: 100px; display: flex; align-items: center; justify-content: center; }
.service-info { padding: 12px 14px 14px; text-align: center; }
.service-info h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--vino-dark); }
.service-info p { font-size: 12px; color: var(--vino-text-secondary); margin-bottom: 8px; }
.price { font-size: 17px; font-weight: 700; color: var(--vino-primary); letter-spacing: -0.02em; }

/* ===== Recommend ===== */
.recommend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.recommend-card { background: #f5f5f5; border-radius: 12px; padding: 20px 16px; transition: transform 0.25s; cursor: pointer; text-align: center; }
.recommend-card:active { transform: scale(0.97); }
.recommend-icon { width: 50px; height: 50px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
.recommend-card h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--vino-dark); }
.recommend-card p { font-size: 13px; color: var(--vino-text-secondary); line-height: 1.5; }

/* 首页配置管理区域包装器，仅此区域受后台「板块整体偏移」影响 */
.home-config-wrap { position: relative; }

/* 底部留白，避免内容被底部导航遮挡（tabbar 高度 + 安全区，与 .home padding-bottom 配合） */
.footer-space {
  height: calc(140px + env(safe-area-inset-bottom, 0px));
  min-height: 140px;
  flex-shrink: 0;
}

/* ===== Share ===== */
.share-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: all 0.25s; }
.share-btn:active { background: rgba(255,255,255,0.3); transform: scale(0.92); }
.share-popup { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 24px; }
.share-card { background: #fff; border-radius: 20px; padding: 28px 24px; width: 290px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 24px 80px rgba(0,0,0,0.35); }
.share-card-header { width: 160px; height: 50px; background: #000; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; padding: 8px 16px; }
.share-qr { padding: 14px; background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; margin-bottom: 18px; }
.share-qr canvas { display: block; }
.share-hint { font-size: 15px; color: var(--vino-dark); font-weight: 600; margin-bottom: 6px; }
.share-url { font-size: 12px; color: var(--vino-text-secondary); margin-bottom: 16px; word-break: break-all; text-align: center; }
.share-copy-btn { width: 130px; }
.share-close { margin-top: 24px; cursor: pointer; }
</style>
