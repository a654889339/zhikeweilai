<template>
  <div ref="wrapRef" class="viewer-3d-wrap">
    <canvas
      ref="canvasRef"
      class="viewer-3d-canvas"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @mousedown.prevent="onMouseDown"
      @wheel.prevent="onWheel"
    />
    <div v-if="loading" class="viewer-3d-overlay">加载中…</div>
    <div v-if="error" class="viewer-3d-overlay viewer-3d-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { ModelRenderer } from '@/utils/productModelViewer/ModelRenderer.js';

/** 与小程序 `wechat-mp/pages/products/products.js` 同源路径（主前端静态目录） */
const MODEL_URL = '/res/model-viewer/bucket.glb';
const DECAL_URL = '/res/model-viewer/decal.png';
const SKYBOX_URL = '/res/model-viewer/skybox.png';

const wrapRef = ref(null);
const canvasRef = ref(null);
const loading = ref(false);
const error = ref('');

let renderer = null;
let resizeObserver = null;
let dragging = false;

function disposeRenderer() {
  if (resizeObserver && wrapRef.value) {
    try {
      resizeObserver.unobserve(wrapRef.value);
    } catch {
      /* ignore */
    }
  }
  resizeObserver = null;
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}

function layoutSize() {
  const wrap = wrapRef.value;
  if (!wrap) return { w: 300, h: 280 };
  const r = wrap.getBoundingClientRect();
  const w = Math.max(200, Math.floor(r.width));
  const h = Math.max(280, Math.floor(r.height || w * 0.75));
  return { w, h };
}

async function loadProductPreview() {
  error.value = '';
  loading.value = true;
  await nextTick();
  const canvas = canvasRef.value;
  const wrap = wrapRef.value;
  if (!canvas || !wrap) {
    loading.value = false;
    return;
  }
  const { w, h } = layoutSize();
  try {
    if (!renderer) {
      renderer = new ModelRenderer(canvas, {
        bgColor: '#1a1a2e',
        envMap: SKYBOX_URL,
        showSkybox: true,
        width: w,
        height: h,
      });
      resizeObserver = new ResizeObserver(() => {
        if (!renderer || !wrapRef.value) return;
        const { w: rw, h: rh } = layoutSize();
        renderer.setSize(rw, rh);
      });
      resizeObserver.observe(wrap);
    } else {
      renderer.setSize(w, h);
    }
    await renderer.loadModel(MODEL_URL);
    await renderer.applyDecal(DECAL_URL, {
      angle: 0,
      height: 0,
      arcWidth: Math.PI / 3,
      heightRange: 1.0,
      opacity: 1.0,
    });
  } catch (e) {
    error.value = (e && e.message) || String(e);
  } finally {
    loading.value = false;
  }
}

function onTouchStart(e) {
  renderer && renderer.onTouchStart(e);
}
function onTouchMove(e) {
  renderer && renderer.onTouchMove(e);
}
function onTouchEnd(e) {
  renderer && renderer.onTouchEnd(e);
}

function onMouseDown(e) {
  if (!renderer) return;
  dragging = true;
  renderer.onPointerDown(e.clientX, e.clientY);
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
}

function onWindowMouseMove(e) {
  if (!dragging || !renderer) return;
  renderer.onPointerDrag(e.clientX, e.clientY);
}

function onWindowMouseUp() {
  dragging = false;
  if (renderer) renderer.onPointerUp();
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
}

function onWheel(e) {
  renderer && renderer.onWheel(e.deltaY);
}

defineExpose({ loadProductPreview });

onMounted(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => loadProductPreview());
  });
});

onUnmounted(() => {
  disposeRenderer();
});
</script>

<style scoped>
.viewer-3d-wrap {
  position: relative;
  width: 100%;
  min-height: min(72vh, 520px);
  background: #0f0f14;
  border-radius: 12px;
  overflow: hidden;
}

.viewer-3d-canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: min(72vh, 520px);
  touch-action: none;
  cursor: grab;
}

.viewer-3d-canvas:active {
  cursor: grabbing;
}

.viewer-3d-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #e5e7eb;
  background: rgba(15, 15, 20, 0.45);
  pointer-events: none;
}

.viewer-3d-error {
  color: #fca5a5;
  padding: 16px;
  text-align: center;
}
</style>
