<template>
  <div class="services-page">
    <van-tabs v-model:active="activeTab" sticky color="var(--vino-primary)">
      <van-tab v-for="cat in categories" :key="cat.key" :title="cat.name">
        <div class="service-grid">
          <div
            v-for="item in cat.items"
            :key="item.id"
            class="grid-card"
            @click="$router.push(`/service/${item.id}`)"
          >
            <div class="grid-icon" :style="{ background: item.bg }">
              <img v-if="item.iconUrl" :src="item.iconUrl" class="grid-icon-img" alt="" />
              <van-icon v-else :name="item.icon" size="26" color="#fff" />
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <span class="grid-price">¥{{ item.price }}起</span>
          </div>
        </div>
      </van-tab>
    </van-tabs>

    <!-- 设备指南详情弹窗 -->
    <van-popup
      v-model:show="showGuideDetail"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
    >
      <div class="guide-detail" v-if="currentGuide">
        <div class="guide-detail-header" :style="{ background: currentGuide.gradient }">
          <van-icon :name="currentGuide.icon" size="40" color="#fff" />
          <div>
            <h3>{{ currentGuide.name }}</h3>
            <p>{{ currentGuide.model }}</p>
          </div>
        </div>
        <div class="guide-detail-body">
          <div class="guide-detail-section" v-for="(section, idx) in currentGuide.sections" :key="idx">
            <h4>
              <van-icon :name="section.icon" size="16" />
              {{ section.title }}
            </h4>
            <ul>
              <li v-for="(tip, i) in section.tips" :key="i">{{ tip }}</li>
            </ul>
          </div>
          <div class="guide-detail-tags">
            <van-tag v-for="tag in currentGuide.tags" :key="tag" plain type="primary" color="#B91C1C" size="medium">{{ tag }}</van-tag>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 全部设备指南弹窗 -->
    <van-popup
      v-model:show="showAllGuides"
      position="bottom"
      round
      :style="{ maxHeight: '85%' }"
    >
      <div class="all-guides">
        <div class="all-guides-title">
          <h3>全部设备指南</h3>
        </div>
        <div class="all-guides-grid">
          <div
            v-for="device in deviceGuides"
            :key="device.id"
            class="all-guide-item"
            @click="showAllGuides = false; openGuide(device)"
          >
            <div class="all-guide-icon" :style="{ background: device.iconUrl ? '#fff' : device.gradient }">
              <LodImg v-if="device.iconUrl" :src="device.iconUrl" :thumb="device.iconUrlThumb" class="guide-icon-img-sm" />
              <van-icon v-else :name="device.icon" size="24" color="#fff" />
            </div>
            <div class="all-guide-info">
              <h4>{{ device.name }}</h4>
              <p>{{ device.model }}</p>
            </div>
            <van-icon name="arrow" size="14" color="#ccc" />
          </div>
        </div>
      </div>
    </van-popup>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { serviceApi } from '@/api';
import LodImg from '@/components/LodImg.vue';

const activeTab = ref(0);
const categories = ref([]);

const fallbackCategories = [
  { key: 'repair', name: '维修', items: [
    { id: 1, title: '设备维修', desc: '专业工程师', icon: 'setting-o', price: '99', bg: '#B91C1C' },
    { id: 2, title: '上门维修', desc: '快速响应', icon: 'location-o', price: '149', bg: '#DC2626' },
    { id: 3, title: '远程支持', desc: '在线指导', icon: 'phone-o', price: '29', bg: '#EF4444' },
  ]},
  { key: 'clean', name: '清洁', items: [
    { id: 4, title: '深度清洁', desc: '全方位保养', icon: 'brush-o', price: '149', bg: '#2563EB' },
    { id: 5, title: '日常清洁', desc: '基础维护', icon: 'smile-o', price: '69', bg: '#3B82F6' },
  ]},
  { key: 'inspect', name: '检测', items: [
    { id: 6, title: '全面检测', desc: '系统评估', icon: 'scan', price: '49', bg: '#059669' },
    { id: 7, title: '性能优化', desc: '提速升级', icon: 'fire-o', price: '79', bg: '#10B981' },
  ]},
  { key: 'data', name: '数据', items: [
    { id: 8, title: '数据恢复', desc: '专业找回', icon: 'replay', price: '199', bg: '#7C3AED' },
    { id: 9, title: '数据备份', desc: '安全迁移', icon: 'description', price: '59', bg: '#8B5CF6' },
  ]},
];

const categoryColors = { repair: '#B91C1C', clean: '#2563EB', inspect: '#059669', data: '#7C3AED' };

onMounted(async () => {
  try {
    const res = await serviceApi.list();
    const services = res.data?.list || res.data || [];
    if (services.length) {
      const catMap = {};
      services.forEach(s => {
        const cat = s.serviceCategory || s.category;
        const catKey = cat?.key ?? cat?.id ?? (typeof cat === 'string' ? cat : 'repair');
        const catName = cat?.name ?? (typeof cat === 'string' ? cat : '维修');
        if (!catMap[catKey]) catMap[catKey] = { key: String(catKey), name: catName, items: [] };
        catMap[catKey].items.push({
          id: s.id,
          title: s.title,
          desc: s.description || '',
          icon: s.icon || 'setting-o',
          iconUrl: s.iconUrl || '',
          price: String(s.price ?? 0),
          bg: s.bg || categoryColors[catKey] || '#B91C1C',
        });
      });
      categories.value = Object.values(catMap);
    } else {
      categories.value = fallbackCategories;
    }
  } catch {
    categories.value = fallbackCategories;
  }
});
</script>

<style scoped>
.services-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

/* ===== Nav Bar ===== */
.services-page :deep(.van-nav-bar) {
  background: var(--vino-card);
}
.services-page :deep(.van-nav-bar__title) {
  font-size: 17px;
  font-weight: 600;
  color: var(--vino-dark);
}

/* ===== Tabs ===== */
.services-page :deep(.van-tabs__nav) {
  background: #fff;
}

.services-page :deep(.van-tab--active) {
  font-weight: 600;
}

/* ===== Service Grid ===== */
.service-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px 20px;
}

.grid-card {
  background: var(--vino-card);
  border-radius: var(--vino-radius);
  padding: 18px 16px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
  box-shadow: var(--vino-shadow);
}

.grid-card:active {
  transform: scale(0.96);
}

.grid-icon {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.grid-icon-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.grid-card h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--vino-dark);
}

.grid-card p {
  font-size: 13px;
  color: var(--vino-text-secondary);
  margin-bottom: 10px;
}

.grid-price {
  font-size: 17px;
  font-weight: 700;
  color: var(--vino-primary);
  letter-spacing: -0.02em;
}

/* ===== Guide Detail Popup ===== */
.guide-detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px 24px;
  border-radius: 16px 16px 0 0;
}

.guide-detail-header h3 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.guide-detail-header p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 4px;
}

.guide-detail-body {
  padding: 20px 24px 28px;
}

.guide-detail-section {
  margin-bottom: 20px;
}

.guide-detail-section h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vino-dark);
}

.guide-detail-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.guide-detail-section li {
  font-size: 14px;
  color: var(--vino-text-secondary);
  padding: 7px 0 7px 18px;
  position: relative;
  line-height: 1.5;
}

.guide-detail-section li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vino-primary);
}

.guide-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
}

/* ===== All Guides Popup ===== */
.all-guides {
  padding: 0 0 28px;
}

.all-guides-title {
  padding: 24px 24px 14px;
  text-align: center;
}

.all-guides-title h3 {
  font-size: 20px;
  font-weight: 700;
}

.all-guides-grid {
  padding: 0 16px;
}

.all-guide-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px;
  border-radius: var(--vino-radius-sm);
  cursor: pointer;
  transition: background 0.2s;
}

.all-guide-item:active {
  background: var(--vino-bg);
}

.all-guide-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.all-guide-info {
  flex: 1;
  min-width: 0;
}

.all-guide-info h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 3px;
  color: var(--vino-dark);
}

.all-guide-info p {
  font-size: 13px;
  color: var(--vino-text-secondary);
}
</style>
