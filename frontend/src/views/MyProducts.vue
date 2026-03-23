<template>
  <div class="my-products-page">
    <van-nav-bar title="我的商品" left-arrow @click-left="$router.back()">
      <template #right>
        <span class="nav-add-btn" @click="onAddProductClick">添加商品</span>
      </template>
    </van-nav-bar>
    <input ref="qrFileInputRef" type="file" accept="image/*" class="hidden-input" @change="onQrFileChange" />
    <van-empty v-if="!loading && list.length === 0" description="暂无绑定商品，点击右上角「添加商品」上传二维码" />
    <div v-else class="list">
      <div v-for="(item, i) in list" :key="item.productKey + i" class="item-card">
        <div class="item-row">
          <span class="label">种类</span>
          <span class="value">{{ item.categoryName || '-' }}</span>
        </div>
        <div class="item-row">
          <span class="label">名称</span>
          <span class="value">{{ item.productName || item.productKey }}</span>
        </div>
        <div class="item-row">
          <span class="label">序列号</span>
          <span class="value sn">{{ item.productKey }}</span>
        </div>
        <div class="item-row">
          <span class="label">绑定时间</span>
          <span class="value">{{ formatTime(item.boundAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import jsQR from 'jsqr';
import { showToast } from 'vant';
import { authApi } from '@/api';

const router = useRouter();
const loading = ref(true);
const list = ref([]);
const qrFileInputRef = ref(null);
const addProductLoading = ref(false);

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadList() {
  loading.value = true;
  try {
    const res = await authApi.myProducts();
    list.value = res.data || [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
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

function onAddProductClick() {
  if (!localStorage.getItem('vino_token')) {
    router.push('/login?redirect=' + encodeURIComponent('/mine/products'));
    return;
  }
  qrFileInputRef.value?.click();
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
      await loadList();
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

onMounted(loadList);
</script>

<style scoped>
.my-products-page {
  min-height: 100vh;
  background: var(--vino-bg, #f7f7f7);
}
.nav-add-btn {
  font-size: 14px;
  color: var(--van-primary-color, #B91C1C);
}
.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.list {
  padding: 12px 16px 24px;
}
.item-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}
.item-row .label {
  color: #999;
  min-width: 72px;
}
.item-row .value {
  color: #333;
  flex: 1;
  text-align: right;
  word-break: break-all;
}
.item-row .value.sn {
  font-family: monospace;
  font-size: 13px;
}
</style>
