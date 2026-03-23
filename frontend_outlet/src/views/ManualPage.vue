<template>
  <div class="manual-page">
    <van-nav-bar :title="title" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" style="text-align:center;padding:60px 0" />

    <template v-else>
      <div class="manual-header">
        <h1 class="manual-title">{{ guide.name }}{{ title ? ' ' : '' }}使用说明书</h1>
        <p v-if="guide.subtitle" class="manual-subtitle">{{ guide.subtitle }}</p>
      </div>

      <div v-if="!chapters.length" class="manual-empty">
        <van-icon name="description" size="48" color="#ddd" />
        <p>暂无说明书内容</p>
      </div>

      <!-- Table of Contents -->
      <div v-if="chapters.length > 1" class="manual-toc">
        <div class="toc-title">目录</div>
        <div
          v-for="(ch, i) in chapters"
          :key="'toc-'+i"
          class="toc-item"
          @click="scrollTo('chapter-'+i)"
        >
          <span class="toc-num">{{ i + 1 }}</span>
          <span class="toc-text">{{ ch.title }}</span>
          <van-icon name="arrow" size="12" color="#ccc" />
        </div>
      </div>

      <!-- Chapters -->
      <div
        v-for="(ch, i) in chapters"
        :key="i"
        :id="'chapter-'+i"
        class="manual-chapter"
      >
        <div class="chapter-header">
          <span class="chapter-num">{{ i + 1 }}</span>
          <h2 class="chapter-title">{{ ch.title }}</h2>
        </div>
        <div class="chapter-content" v-html="ch.content"></div>
      </div>

      <div class="manual-footer">
        <p>以上内容仅供参考，请以实际产品为准</p>
        <p>{{ guide.name }} · 电子说明书</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { guideApi } from '@/api';

const route = useRoute();
const loading = ref(true);
const guide = ref({});

const title = computed(() => guide.value.name ? `${guide.value.name}说明书` : '电子说明书');

const chapters = computed(() => {
  const h = guide.value.helpItems;
  return Array.isArray(h) ? h : [];
});

const scrollTo = (id) => {
  nextTick(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

onMounted(async () => {
  try {
    const res = await guideApi.detail(route.params.id);
    guide.value = res.data || {};
  } catch { /* empty */ }
  loading.value = false;
});
</script>

<style scoped>
.manual-page {
  background: #fff;
  min-height: 100vh;
}

.manual-header {
  padding: 32px 20px 20px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.manual-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  margin: 0;
}

.manual-subtitle {
  font-size: 13px;
  color: #999;
  margin-top: 8px;
}

.manual-empty {
  text-align: center;
  padding: 60px 20px;
  color: #ccc;
}
.manual-empty p {
  margin-top: 12px;
  font-size: 14px;
}

/* Table of Contents */
.manual-toc {
  margin: 16px 16px 0;
  background: #FAFAFA;
  border-radius: 10px;
  padding: 16px;
}

.toc-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.toc-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.toc-item:last-child { border-bottom: none; }

.toc-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #E8E8E8;
  color: #666;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 10px;
}

.toc-text {
  flex: 1;
  font-size: 14px;
  color: #333;
}

/* Chapters */
.manual-chapter {
  padding: 0 20px;
  margin-top: 28px;
}

.chapter-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #1a1a1a;
}

.chapter-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chapter-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

/* Chapter rich text content - matches Xiaomi manual style */
.chapter-content {
  font-size: 14px;
  color: #333;
  line-height: 1.8;
  word-break: break-word;
}

.chapter-content :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 20px 0 10px;
}

.chapter-content :deep(h4) {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 8px;
}

.chapter-content :deep(p) {
  margin: 8px 0;
  color: #333;
  line-height: 1.8;
}

.chapter-content :deep(ul),
.chapter-content :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.chapter-content :deep(li) {
  margin: 4px 0;
  color: #333;
  line-height: 1.8;
}

.chapter-content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 12px 0;
  display: block;
}

.chapter-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}

.chapter-content :deep(th),
.chapter-content :deep(td) {
  border: 1px solid #e5e5e5;
  padding: 8px 10px;
  text-align: left;
}

.chapter-content :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
}

.chapter-content :deep(strong),
.chapter-content :deep(b) {
  font-weight: 600;
  color: #1a1a1a;
}

.chapter-content :deep(.warning),
.chapter-content :deep(.note) {
  background: #FFF7ED;
  border-left: 3px solid #F59E0B;
  padding: 10px 14px;
  border-radius: 0 6px 6px 0;
  margin: 12px 0;
  font-size: 13px;
  color: #92400E;
}

.chapter-content :deep(.danger) {
  background: #FEF2F2;
  border-left: 3px solid #EF4444;
  padding: 10px 14px;
  border-radius: 0 6px 6px 0;
  margin: 12px 0;
  font-size: 13px;
  color: #991B1B;
}

/* Footer */
.manual-footer {
  padding: 32px 20px;
  text-align: center;
  color: #ccc;
  font-size: 12px;
  line-height: 2;
  border-top: 1px solid #f0f0f0;
  margin-top: 32px;
}
</style>
