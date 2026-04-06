<template>
  <div class="course-detail-page">
    <van-loading v-if="loading" size="28" class="loading" />
    <div v-else-if="course.id" class="course-detail-body">
      <div v-if="course.coverImage" class="cover-wrap">
        <LodImg :src="fullUrl(course.coverImage)" class="cover-img" alt="" />
      </div>
      <h1 class="title">{{ course.name }}</h1>
      <p v-if="course.subtitle" class="subtitle">{{ course.subtitle }}</p>
      <div v-if="course.description" class="desc" v-html="course.description"></div>
      <div v-if="videoList.length" class="video-block">
        <div v-for="(url, idx) in videoList" :key="idx" class="video-row">
          <video :src="fullUrl(url)" controls playsinline class="video-el" />
        </div>
      </div>
    </div>
    <div v-else class="empty">课程不存在</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { courseApi, homeConfigApi } from '@/api';
import LodImg from '@/components/LodImg.vue';

const route = useRoute();
const course = ref({});
const loading = ref(true);

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

const videoList = computed(() => {
  const v = course.value.videos;
  return Array.isArray(v) ? v : [];
});

onMounted(async () => {
  const param = route.params.id;
  try {
    const hc = await homeConfigApi.list({ all: 1 });
    const items = hc.data || [];
    const cn = items.find((i) => i.section === 'companyName' && i.status === 'active');
    const name = cn && cn.title ? String(cn.title).trim() : '';
    document.title = name ? `${name} - 课程` : '课程详情';
  } catch {
    document.title = '课程详情';
  }
  try {
    const res = await courseApi.detail(param);
    course.value = res.data || {};
  } catch {
    course.value = {};
  }
  loading.value = false;
});
</script>

<style scoped>
.course-detail-page {
  min-height: 100vh;
  background: #f3f4f6;
  padding: 12px;
  padding-bottom: 72px;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}
.cover-wrap {
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
  background: #e5e7eb;
}
.cover-img {
  width: 100%;
  display: block;
  vertical-align: top;
}
.title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
}
.subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 12px;
}
.desc {
  font-size: 15px;
  line-height: 1.6;
  color: #374151;
  margin-bottom: 16px;
}
.video-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.video-el {
  width: 100%;
  border-radius: 8px;
  background: #000;
  max-height: 220px;
}
.empty {
  text-align: center;
  padding: 48px;
  color: #6b7280;
}
</style>
