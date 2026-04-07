<template>
  <div class="products-page">
    <div class="products-body">
      <div class="products-search-wrap">
        <div class="products-search-inner">
          <van-icon name="search" class="products-search-icon" />
          <input
            v-model.trim="searchKeyword"
            type="search"
            class="products-search-input"
            placeholder="搜索课程"
            enterkeyhint="search"
            autocomplete="off"
          />
        </div>
      </div>

      <div class="products-layout">
        <aside class="product-sidebar" v-if="sidebarItems.length">
          <button
            v-for="cat in visibleSidebarItems"
            :key="cat._key"
            type="button"
            class="sidebar-item"
            :class="{
              active: isRowActive(cat),
              sub: cat.depth === 1,
              header: cat.isHeader,
            }"
            @click="selectCategory(cat)"
          >
            <span class="sidebar-item-inner">
              <span class="sidebar-thumb" v-if="cat.thumb">
                <LodImg :src="cat.thumb" :thumb="cat.thumb" class="sidebar-thumb-img" alt="" />
              </span>
              <span class="sidebar-name">{{ cat.name }}</span>
            </span>
          </button>
        </aside>
        <div class="product-main">
          <div v-if="l2PickerOptions.length > 1" class="course-l2-picker-row">
            <span class="course-l2-label">选择子分类</span>
            <select
              class="course-l2-select"
              :value="String(selectedCategoryId ?? '')"
              @change="onL2PickerChange"
            >
              <option v-for="opt in l2PickerOptions" :key="opt.id" :value="String(opt.id)">
                {{ opt.name }}
              </option>
            </select>
          </div>
          <van-loading v-if="listLoading" size="28" class="main-loading" />
          <div v-else-if="filteredCourses.length" class="product-grid">
            <button
              v-for="d in filteredCourses"
              :key="d.id"
              type="button"
              class="grid-card"
              @click="openCourse(d)"
            >
              <div class="grid-card-icon">
                <LodImg
                  v-if="d.coverImage"
                  :src="fullUrl(d.coverImage)"
                  :thumb="fullUrl(d.coverImage)"
                  class="grid-card-icon-img"
                />
                <van-icon v-else :name="d.icon || 'records'" size="28" color="#6b7280" />
              </div>
              <span class="grid-card-name">{{ d.name }}</span>
            </button>
          </div>
          <div v-else-if="selectedCategoryId && !listLoading && courses.length && !filteredCourses.length" class="main-empty">
            未找到匹配的课程
          </div>
          <div v-else-if="selectedCategoryId && !listLoading && !courses.length" class="main-empty">该分类下暂无课程</div>
        </div>
      </div>

      <div v-if="!listLoading && !sidebarItems.length" class="empty-hint">
        <van-icon name="info-o" size="48" color="#ccc" />
        <p>暂无课程分类</p>
      </div>

      <div class="products-bottom-space" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { courseApi, homeConfigApi } from '@/api';
import LodImg from '@/components/LodImg.vue';
import { sortCategoriesForSidebar } from '@/utils/productGuideOrder';
import {
  findExpandedL1IdFromTree,
  filterVisibleSidebarItems,
  isSidebarRowActive,
} from '@/utils/categorySidebar';

const router = useRouter();

/** 将课程分类树的 title 转为与产品侧栏一致的 name */
function mapCourseTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => ({
    ...n,
    name: n.title || n.name,
    thumbnailUrl: n.thumbnailUrl || '',
    children: mapCourseTree(n.children || []),
  }));
}

const categories = ref([]);
const selectedCategoryId = ref(null);
const expandedL1Id = ref(null);
const courses = ref([]);
const listLoading = ref(false);
const searchKeyword = ref('');

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

function flattenSidebarTree(tree) {
  const out = [];
  const arr = Array.isArray(tree) ? tree : [];
  const sortedParents = sortCategoriesForSidebar(arr);
  sortedParents.forEach((p) => {
    const children = Array.isArray(p.children) ? sortCategoriesForSidebar(p.children) : [];
    if (children.length === 1) {
      const c0 = children[0];
      out.push({
        _key: `sc-${p.id}-${c0.id}`,
        id: c0.id,
        parentL1Id: p.id,
        mergedSingle: true,
        name: p.name,
        thumb: c0.thumbnailUrl
          ? fullUrl(String(c0.thumbnailUrl).trim())
          : p.thumbnailUrl
            ? fullUrl(String(p.thumbnailUrl).trim())
            : '',
        depth: 0,
        isHeader: false,
        hasChildren: false,
        firstChildId: null,
        children: [],
      });
    } else if (children.length > 1) {
      out.push({
        _key: `p-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        thumb: p.thumbnailUrl ? fullUrl(String(p.thumbnailUrl).trim()) : '',
        depth: 0,
        isHeader: true,
        hasChildren: true,
        firstChildId: children[0] ? children[0].id : null,
        children,
      });
      children.forEach((c) => {
        out.push({
          _key: `c-${c.id}`,
          id: c.id,
          parentL1Id: p.id,
          name: c.name,
          thumb: c.thumbnailUrl ? fullUrl(String(c.thumbnailUrl).trim()) : (p.thumbnailUrl ? fullUrl(String(p.thumbnailUrl).trim()) : ''),
          depth: 1,
          isHeader: false,
          hasChildren: false,
          firstChildId: null,
          children: [],
        });
      });
    } else {
      out.push({
        _key: `p-${p.id}`,
        id: p.id,
        parentL1Id: p.id,
        name: p.name,
        thumb: p.thumbnailUrl ? fullUrl(String(p.thumbnailUrl).trim()) : '',
        depth: 0,
        isHeader: false,
        hasChildren: false,
        firstChildId: null,
        children: [],
      });
    }
  });
  return out;
}

const sidebarItems = computed(() => flattenSidebarTree(categories.value));

const visibleSidebarItems = computed(() =>
  filterVisibleSidebarItems(sidebarItems.value, expandedL1Id.value)
);

function isRowActive(cat) {
  return isSidebarRowActive(cat, selectedCategoryId.value, expandedL1Id.value);
}

const filteredCourses = computed(() => {
  const list = courses.value || [];
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((d) => (d.name || '').toLowerCase().includes(kw));
});

/** 多二级时：主区域下拉列出当前一级下全部二级（与小程序课程页一致） */
const l2PickerOptions = computed(() => {
  const eid = expandedL1Id.value;
  if (eid == null) return [];
  const p = categories.value.find((x) => Number(x.id) === Number(eid));
  const ch = p && Array.isArray(p.children) ? sortCategoriesForSidebar(p.children) : [];
  if (ch.length <= 1) return [];
  return ch.map((c) => ({ id: c.id, name: c.name || c.title || '' }));
});

function onL2PickerChange(e) {
  const id = Number((e.target && e.target.value) || '');
  if (!Number.isFinite(id)) return;
  const cat = sidebarItems.value.find((x) => Number(x.id) === id && !x.isHeader);
  if (cat) selectCategory(cat);
}

function openCourse(d) {
  const idOrSlug = d.slug || d.id;
  router.push(`/course/${encodeURIComponent(String(idOrSlug))}`);
}

const selectCategory = async (cat) => {
  if (!cat) return;
  if (cat.isHeader && cat.hasChildren && cat.firstChildId) {
    expandedL1Id.value = Number(cat.id);
    const child = sidebarItems.value.find((x) => Number(x.id) === Number(cat.firstChildId));
    if (child) return selectCategory(child);
    selectedCategoryId.value = cat.firstChildId;
  }
  if (selectedCategoryId.value === cat.id) return;
  selectedCategoryId.value = cat.id;
  expandedL1Id.value = findExpandedL1IdFromTree(categories.value, cat.id);
  searchKeyword.value = '';
  listLoading.value = true;
  try {
    const res = await courseApi.list({ categoryId: cat.id });
    courses.value = res.data || [];
  } catch {
    courses.value = [];
  }
  listLoading.value = false;
};

onMounted(async () => {
  try {
    const hc = await homeConfigApi.list({ all: 1 });
    const items = hc.data || [];
    const cn = items.find((i) => i.section === 'companyName' && i.status === 'active');
    const name = cn && cn.title ? String(cn.title).trim() : '';
    document.title = name ? `${name} - 课程` : '课程中心';
  } catch {
    document.title = '课程中心';
  }
  try {
    const res = await courseApi.categories();
    categories.value = mapCourseTree(res.data || []);
    const items = sidebarItems.value.filter((x) => !x.isHeader);
    if (items.length) {
      const first = items[0];
      selectedCategoryId.value = first.id;
      expandedL1Id.value = findExpandedL1IdFromTree(categories.value, first.id);
      listLoading.value = true;
      try {
        const listRes = await courseApi.list({ categoryId: first.id });
        courses.value = listRes.data || [];
      } catch {
        courses.value = [];
      }
      listLoading.value = false;
    }
  } catch {
    /* empty */
  }
});
</script>

<style scoped>
.products-page {
  position: relative;
  background: #e8e8ed;
  min-height: 100vh;
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.products-body {
  position: relative;
  z-index: 1;
  padding-top: 0;
}
.products-search-wrap {
  padding: 10px 12px 12px;
  box-sizing: border-box;
}
.products-search-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #2d2d33;
  border-radius: 10px;
  padding: 10px 14px;
  box-sizing: border-box;
}
.products-search-icon {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 18px;
}
.products-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: #f3f4f6;
  font-size: 15px;
  outline: none;
}
.products-search-input::placeholder {
  color: #9ca3af;
}
.products-bottom-space {
  height: 56px;
}
.products-layout {
  display: flex;
  align-items: stretch;
  min-height: 200px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.product-sidebar {
  flex-shrink: 0;
  width: 150px;
  padding: 12px 0;
  background: #eef0f3;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}
.sidebar-item {
  margin: 0 8px;
  padding: 12px 8px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  line-height: 1.35;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.sidebar-item.header {
  cursor: default;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  padding: 10px 6px 6px;
  border-radius: 10px;
}
.sidebar-item.sub {
  padding: 10px 8px;
}
.sidebar-item-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-thumb {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #f3f4f6;
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.sidebar-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.course-l2-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}
.course-l2-label {
  flex-shrink: 0;
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}
.course-l2-select {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
  color: #111827;
}
.sidebar-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  white-space: normal;
  word-break: break-all;
  line-height: 1.25;
  max-width: 5em;
}
.sidebar-item.active {
  background: rgba(255, 183, 77, 0.45);
  color: #111827;
  font-weight: 600;
}
.product-main {
  flex: 1;
  min-width: 0;
  padding: 12px;
  background: #fafafa;
}
.main-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.main-empty {
  text-align: center;
  padding: 32px 12px;
  font-size: 14px;
  color: #6b7280;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.grid-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  min-height: 104px;
}
.grid-card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #f3f4f6;
  overflow: hidden;
}
.grid-card-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.grid-card-name {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  text-align: center;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.empty-hint {
  text-align: center;
  padding: 48px 16px;
  color: #6b7280;
}
.empty-hint p {
  margin-top: 12px;
  font-size: 15px;
}
</style>
