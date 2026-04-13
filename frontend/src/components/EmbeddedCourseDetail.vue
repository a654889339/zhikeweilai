<template>
  <div class="embed-course">
    <van-loading v-if="loading" size="28" class="embed-loading" />
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
    <div v-else-if="!loading" class="embed-empty">暂无课程内容</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { courseApi } from '@/api';
import LodImg from '@/components/LodImg.vue';

const props = defineProps({
  courseId: { type: [Number, String], default: null },
});

const loading = ref(false);
const course = ref({});

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

async function load() {
  const id = props.courseId;
  if (id == null || id === '') {
    course.value = {};
    return;
  }
  loading.value = true;
  try {
    const res = await courseApi.detail(id);
    course.value = res.data || {};
  } catch {
    course.value = {};
  }
  loading.value = false;
}

watch(
  () => props.courseId,
  () => {
    load();
  },
  { immediate: true }
);
</script>

<style scoped>
.embed-course {
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
</style>
