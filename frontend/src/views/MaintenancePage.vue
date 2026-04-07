<template>
  <div class="maintenance-page">
    <van-nav-bar :title="title" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" style="text-align:center;padding:60px 0" />

    <template v-else>
      <div class="maint-header">
        <h1 class="maint-title">{{ guide.name }} 维护指南</h1>
      </div>

      <div v-if="!sections.length" class="maint-empty">
        <van-icon name="info-o" size="48" color="#ddd" />
        <p>暂无维护内容</p>
      </div>

      <!-- Table of Contents -->
      <div v-if="sections.length > 1" class="maint-toc">
        <div class="toc-title">目录</div>
        <div
          v-for="(sec, i) in sections"
          :key="'toc-'+i"
          class="toc-item"
          @click="scrollTo('sec-'+i)"
        >
          <span class="toc-num">{{ i + 1 }}</span>
          <span class="toc-text">{{ sec.title }}</span>
          <van-icon name="arrow" size="12" color="#ccc" />
        </div>
      </div>

      <!-- Sections -->
      <div
        v-for="(sec, i) in sections"
        :key="i"
        :id="'sec-'+i"
        class="maint-section"
      >
        <div class="section-header">
          <span class="section-num">{{ i + 1 }}</span>
          <h2 class="section-title-text">{{ sec.title }}</h2>
        </div>
        <ul class="tip-list">
          <li v-for="(tip, j) in (sec.tips || [])" :key="j">{{ tip }}</li>
        </ul>
      </div>

      <div class="maint-footer">
        <p>以上内容仅供参考，请以实际情况为准</p>
        <p>{{ guide.name }} · 维护指南</p>
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

const title = computed(() => guide.value.name ? `${guide.value.name}维护指南` : '维护指南');

const sections = computed(() => {
  const s = guide.value.sections;
  return Array.isArray(s) ? s : [];
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
.maintenance-page {
  background: #fff;
  min-height: 100vh;
}

.maint-header {
  padding: 32px 20px 20px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.maint-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  margin: 0;
}

.maint-subtitle {
  font-size: 13px;
  color: #999;
  margin-top: 8px;
}

.maint-empty {
  text-align: center;
  padding: 60px 20px;
  color: #ccc;
}
.maint-empty p {
  margin-top: 12px;
  font-size: 14px;
}

.maint-toc {
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

.maint-section {
  padding: 0 20px;
  margin-top: 28px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #1a1a1a;
}

.section-num {
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

.section-title-text {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.tip-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tip-list li {
  font-size: 14px;
  color: #333;
  line-height: 2.2;
  padding-left: 18px;
  position: relative;
}

.tip-list li::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1a1a1a;
}

.maint-footer {
  padding: 32px 20px;
  text-align: center;
  color: #ccc;
  font-size: 12px;
  line-height: 2;
  border-top: 1px solid #f0f0f0;
  margin-top: 32px;
}
</style>
