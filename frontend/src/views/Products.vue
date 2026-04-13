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
            placeholder="搜索实验材料"
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
              'depth-2': cat.depth === 2 || cat.rowKind === 'product',
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
          <van-loading v-if="detailLoading" size="28" class="main-loading" />
          <EmbeddedGuideDetail v-else-if="selectedGuideId" :guide-id="selectedGuideId" />
          <div v-else-if="selectedCategoryId && !detailLoading" class="main-empty">该种类下暂无商品</div>
          <div v-else class="main-empty">请选择左侧分类与商品</div>
        </div>
      </div>

      <div v-if="!listLoading && !sidebarItems.length" class="empty-hint">
        <van-icon name="info-o" size="48" color="#ccc" />
        <p>暂无商品配置</p>
      </div>

      <div class="products-bottom-space" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { guideApi, homeConfigApi } from '@/api';
import LodImg from '@/components/LodImg.vue';
import EmbeddedGuideDetail from '@/components/EmbeddedGuideDetail.vue';
import {
  sortGuidesByDisplayOrder,
  sortCategoriesForSidebar,
} from '@/utils/productGuideOrder';
import {
  findExpandedL1IdFromTree,
  filterVisibleSidebarItems,
  isSidebarRowActive,
} from '@/utils/categorySidebar';
import { normalizeBrandText } from '@/utils/brandName';

const categories = ref([]);
const allGuides = ref([]);
const selectedCategoryId = ref(null);
const selectedGuideId = ref(null);
const expandedL1Id = ref(null);
const expandedL2Id = ref(null);
const listLoading = ref(false);
const detailLoading = ref(false);
const searchKeyword = ref('');

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

function guidesForL2(l2Id) {
  const id = Number(l2Id);
  return (allGuides.value || []).filter((g) => Number(g.categoryId) === id);
}

function pushProductRows(out, parentL1Id, parentL2Id, catNameForSort) {
  let list = guidesForL2(parentL2Id);
  list = sortGuidesByDisplayOrder(list, catNameForSort || '');
  const kw = searchKeyword.value.trim().toLowerCase();
  if (kw) {
    list = list.filter((d) => (d.name || '').toLowerCase().includes(kw));
  }
  list.forEach((g) => {
    const thumb =
      g.iconUrlThumb || g.iconUrl
        ? fullUrl(String((g.iconUrlThumb || g.iconUrl || '').trim()))
        : '';
    out.push({
      _key: `g-${g.id}`,
      rowKind: 'product',
      id: g.id,
      guideId: g.id,
      parentL1Id,
      parentL2Id,
      name: g.name,
      thumb,
      depth: 2,
      isHeader: false,
    });
  });
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
      pushProductRows(out, p.id, c0.id, p.name);
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
          thumb: c.thumbnailUrl
            ? fullUrl(String(c.thumbnailUrl).trim())
            : p.thumbnailUrl
              ? fullUrl(String(p.thumbnailUrl).trim())
              : '',
          depth: 1,
          isHeader: false,
          hasChildren: false,
          firstChildId: null,
          children: [],
        });
        pushProductRows(out, p.id, c.id, c.name);
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
  filterVisibleSidebarItems(sidebarItems.value, expandedL1Id.value, expandedL2Id.value)
);

function isRowActive(cat) {
  return isSidebarRowActive(
    cat,
    selectedCategoryId.value,
    expandedL1Id.value,
    selectedGuideId.value
  );
}

function firstGuideIdForL2(l2Id) {
  const list = guidesForL2(l2Id);
  if (!list.length) return null;
  const name = '';
  const sorted = sortGuidesByDisplayOrder(list, name);
  const kw = searchKeyword.value.trim().toLowerCase();
  const filtered = kw
    ? sorted.filter((d) => (d.name || '').toLowerCase().includes(kw))
    : sorted;
  return filtered.length ? filtered[0].id : sorted[0].id;
}

const selectCategory = async (cat) => {
  if (!cat) return;

  if (cat.rowKind === 'product') {
    selectedCategoryId.value = cat.parentL2Id;
    selectedGuideId.value = cat.guideId;
    expandedL1Id.value = findExpandedL1IdFromTree(categories.value, cat.parentL2Id);
    expandedL2Id.value = cat.parentL2Id;
    return;
  }

  if (cat.isHeader && cat.hasChildren && cat.firstChildId) {
    expandedL1Id.value = Number(cat.id);
    const child = sidebarItems.value.find(
      (x) => Number(x.id) === Number(cat.firstChildId) && !x.isHeader && x.rowKind !== 'product'
    );
    if (child) return selectCategory(child);
    selectedCategoryId.value = cat.firstChildId;
  }

  if (
    selectedCategoryId.value === cat.id &&
    !cat.isHeader &&
    cat.rowKind !== 'product'
  ) {
    expandedL2Id.value = cat.id;
    const gid = firstGuideIdForL2(cat.id);
    selectedGuideId.value = gid;
    return;
  }

  selectedCategoryId.value = cat.id;
  expandedL1Id.value = findExpandedL1IdFromTree(categories.value, cat.id);
  expandedL2Id.value = cat.mergedSingle ? cat.id : cat.depth === 1 ? cat.id : null;

  if (cat.mergedSingle || cat.depth === 1) {
    expandedL2Id.value = cat.id;
  } else if (!cat.isHeader && cat.depth === 0 && !cat.mergedSingle) {
    expandedL2Id.value = null;
  }

  searchKeyword.value = '';

  if (expandedL2Id.value != null) {
    const gid = firstGuideIdForL2(expandedL2Id.value);
    detailLoading.value = true;
    selectedGuideId.value = gid;
    detailLoading.value = false;
  } else {
    selectedGuideId.value = null;
  }
};

onMounted(async () => {
  try {
    const hc = await homeConfigApi.list({ all: 1 });
    const items = hc.data || [];
    const cn = items.find((i) => i.section === 'companyName' && i.status === 'active');
    const name = cn && cn.title ? normalizeBrandText(String(cn.title).trim()) : '';
    document.title = name || '科必学';
  } catch {
    /* ignore */
  }
  listLoading.value = true;
  try {
    const [catRes, guideRes] = await Promise.all([
      guideApi.categories(),
      guideApi.list({}),
    ]);
    categories.value = catRes.data || [];
    allGuides.value = guideRes.data || [];
    const items = sidebarItems.value.filter((x) => !x.isHeader && x.rowKind !== 'product');
    if (items.length) {
      const first = items[0];
      await selectCategory(first);
    }
  } catch {
    /* empty */
  }
  listLoading.value = false;
});

watch(searchKeyword, () => {
  const gid = selectedGuideId.value;
  if (!gid) return;
  const row = sidebarItems.value.find((x) => x.rowKind === 'product' && Number(x.guideId) === Number(gid));
  if (!row) {
    const vis = visibleSidebarItems.value.filter((x) => x.rowKind === 'product');
    if (vis.length) selectCategory(vis[0]);
    else selectedGuideId.value = null;
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

.sidebar-item.depth-2 {
  padding: 8px 8px 8px 14px;
  margin-left: 4px;
  border-radius: 10px;
  border-left: 3px solid rgba(185, 28, 28, 0.25);
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

.sidebar-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  white-space: normal;
  word-break: break-all;
  line-height: 1.25;
  max-width: 6em;
}

.sidebar-item.active {
  background: rgba(255, 183, 77, 0.45);
  color: #111827;
  font-weight: 600;
}

.sidebar-item:active {
  opacity: 0.88;
}

.product-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  background: #fafafa;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.product-main :deep(.embed-guide) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
