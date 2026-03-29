<template>
  <div class="chatgroup-page">
    <div class="cg-sidebar">
      <div class="cg-sidebar-head">
        <span class="cg-title">群组</span>
        <button type="button" class="cg-new-btn" @click="openCreate">新建群组</button>
      </div>
      <div class="cg-search-wrap">
        <van-icon name="search" class="cg-search-icon" />
        <input v-model.trim="searchKw" class="cg-search-input" type="search" placeholder="搜索群组名称..." />
      </div>
      <div class="cg-list">
        <div v-if="loadingList" class="cg-empty">加载中...</div>
        <template v-else-if="filteredGroups.length">
          <button
            v-for="g in filteredGroups"
            :key="g.id"
            type="button"
            class="cg-item"
            :class="{ active: selectedId === g.id }"
            @click="selectGroup(g)"
          >
            <span class="cg-item-name">{{ g.name }}</span>
            <span class="cg-item-id">#{{ g.id }}</span>
          </button>
        </template>
        <div v-else class="cg-empty">暂无群组</div>
      </div>
    </div>
    <div class="cg-main">
      <div class="cg-main-head">
        {{ selectedGroup ? selectedGroup.name : '选择一个会话' }}
      </div>
      <div v-if="!selectedGroup" class="cg-main-placeholder">选择一个群组开始聊天</div>
      <div v-else class="cg-chat">
        <div ref="msgScrollRef" class="cg-messages">
          <div v-for="m in messages" :key="m.id" :class="['cg-msg', isMine(m) ? 'cg-msg-mine' : '']">
            <div class="cg-msg-meta">{{ m.user?.nickname || m.user?.username || '用户' }}</div>
            <div v-if="m.type === 'image'" class="cg-msg-bubble cg-msg-img-wrap">
              <img :src="mediaUrl(m.content)" class="cg-msg-img" alt="" @click="previewImage(mediaUrl(m.content))" />
            </div>
            <div v-else class="cg-msg-bubble">{{ m.content }}</div>
          </div>
        </div>
        <div class="cg-input-bar">
          <van-uploader :after-read="onAfterReadImage" :max-count="1" accept="image/*">
            <van-button size="small" icon="photo-o" />
          </van-uploader>
          <van-field
            v-model="inputText"
            rows="1"
            autosize
            type="textarea"
            placeholder="输入消息..."
            class="cg-input-field"
            @keydown.enter.exact.prevent="sendText"
          />
          <van-button type="primary" size="small" :loading="sending" @click="sendText">发送</van-button>
        </div>
      </div>
    </div>

    <van-popup v-model:show="showCreate" position="center" round :style="{ width: '86%', maxWidth: '360px' }">
      <div style="padding: 16px">
        <div style="font-weight: 600; margin-bottom: 12px">新建群组</div>
        <van-field v-model="newName" placeholder="群组名称" maxlength="40" />
        <div style="display: flex; gap: 10px; margin-top: 16px; justify-content: flex-end">
          <van-button size="small" @click="showCreate = false">取消</van-button>
          <van-button type="primary" size="small" @click="doCreate">创建</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { showImagePreview, showToast } from 'vant';
import { useUserStore } from '@/stores/user';
import { chatGroupApi } from '@/api';

const router = useRouter();
const userStore = useUserStore();

const loadingList = ref(true);
const groups = ref([]);
const searchKw = ref('');
const selectedId = ref(null);
const selectedGroup = computed(() => groups.value.find((g) => g.id === selectedId.value) || null);
const messages = ref([]);
const inputText = ref('');
const sending = ref(false);
const msgScrollRef = ref(null);
let pollTimer = null;

const showCreate = ref(false);
const newName = ref('');

const BASE = import.meta.env.VITE_API_BASE || '';
function mediaUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  return BASE.replace('/api', '') + u;
}

const filteredGroups = computed(() => {
  const kw = searchKw.value.trim().toLowerCase();
  if (!kw) return groups.value;
  return groups.value.filter((g) => (g.name || '').toLowerCase().includes(kw));
});

function isMine(m) {
  return userStore.userInfo && m.userId === userStore.userInfo.id;
}

async function loadMyGroups() {
  loadingList.value = true;
  try {
    const res = await chatGroupApi.mine();
    groups.value = res.data || [];
  } catch {
    groups.value = [];
  }
  loadingList.value = false;
}

async function loadMessages() {
  if (!selectedId.value) return;
  try {
    const res = await chatGroupApi.messages(selectedId.value, { limit: 80 });
    messages.value = res.data || [];
    await nextTick();
    const el = msgScrollRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  } catch {
    messages.value = [];
  }
}

function selectGroup(g) {
  selectedId.value = g.id;
  loadMessages();
}

function openCreate() {
  newName.value = '';
  showCreate.value = true;
}

async function sendText() {
  const t = inputText.value.trim();
  if (!t || !selectedId.value) return;
  sending.value = true;
  try {
    await chatGroupApi.send(selectedId.value, { content: t, type: 'text' });
    inputText.value = '';
    await loadMessages();
  } catch (e) {
    showToast(e.response?.data?.message || '发送失败');
  }
  sending.value = false;
}

async function onAfterReadImage(file) {
  if (!selectedId.value) {
    showToast('请先选择群组');
    return;
  }
  const f = file.file;
  if (!f) return;
  sending.value = true;
  try {
    await chatGroupApi.uploadImage(selectedId.value, f);
    await loadMessages();
  } catch {
    showToast('图片发送失败');
  }
  sending.value = false;
}

async function doCreate() {
  const name = newName.value.trim();
  if (!name) {
    showToast('请输入名称');
    return;
  }
  try {
    const res = await chatGroupApi.create({ name });
    newName.value = '';
    showCreate.value = false;
    await loadMyGroups();
    if (res.data?.id) {
      selectedId.value = res.data.id;
      await loadMessages();
    }
    showToast('已创建');
  } catch {
    showToast('创建失败');
  }
}

function previewImage(url) {
  if (url) showImagePreview([url]);
}

watch(selectedId, () => {
  if (pollTimer) clearInterval(pollTimer);
  if (selectedId.value) {
    pollTimer = setInterval(loadMessages, 8000);
  }
});

onMounted(async () => {
  document.title = '群组';
  if (!userStore.token) {
    router.push({ path: '/login', query: { redirect: '/chatgroup' } });
    return;
  }
  try {
    await userStore.fetchProfile();
  } catch {
    /* */
  }
  await loadMyGroups();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.chatgroup-page {
  display: flex;
  min-height: calc(100vh - 56px);
  background: #f3f4f6;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.cg-sidebar {
  width: 34%;
  max-width: 320px;
  min-width: 200px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}
.cg-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  border-bottom: 1px solid #f3f4f6;
}
.cg-title {
  font-weight: 600;
  font-size: 16px;
}
.cg-new-btn {
  padding: 6px 12px;
  font-size: 13px;
  border: none;
  border-radius: 8px;
  background: #b91c1c;
  color: #fff;
  cursor: pointer;
}
.cg-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.cg-search-icon {
  color: #9ca3af;
  flex-shrink: 0;
}
.cg-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
}
.cg-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px;
}
.cg-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  margin-bottom: 6px;
  border: none;
  border-radius: 10px;
  background: #f9fafb;
  text-align: left;
  cursor: pointer;
}
.cg-item.active {
  background: #fee2e2;
  outline: 1px solid #b91c1c;
}
.cg-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #111;
}
.cg-item-id {
  font-size: 12px;
  color: #6b7280;
}
.cg-empty {
  text-align: center;
  padding: 24px 8px;
  color: #9ca3af;
  font-size: 14px;
}
.cg-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}
.cg-main-head {
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}
.cg-main-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 15px;
}
.cg-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.cg-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f9fafb;
}
.cg-msg {
  margin-bottom: 12px;
  max-width: 88%;
}
.cg-msg-mine {
  margin-left: auto;
  text-align: right;
}
.cg-msg-mine .cg-msg-bubble {
  background: #b91c1c;
  color: #fff;
}
.cg-msg-meta {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}
.cg-msg-bubble {
  display: inline-block;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fff;
  font-size: 14px;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.cg-msg-img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  vertical-align: top;
}
.cg-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.cg-input-field {
  flex: 1;
  min-width: 0;
}
</style>
