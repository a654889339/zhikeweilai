<template>
  <div class="chat-widget">
    <!-- Floating Button（部分页面隐藏，但组件仍挂载以便意见反馈可打开） -->
    <div v-show="!hideFab" class="chat-fab" @click="toggleChat">
      <van-icon name="chat-o" size="24" color="#fff" />
      <div v-if="unreadCount > 0" class="chat-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</div>
    </div>

    <!-- Chat Panel -->
    <van-popup v-model:show="showChat" position="bottom" round :style="{ height: '75vh' }" @open="onOpen" @close="onClose">
      <div class="chat-panel">
        <div class="chat-header">
          <span class="chat-title">在线客服</span>
          <van-icon name="cross" size="20" color="#999" class="chat-close" @click="showChat = false" />
        </div>

        <div class="chat-body" ref="chatBody">
          <div v-if="loading" style="text-align:center;padding:40px"><van-loading size="24" /></div>
          <template v-else>
            <div v-if="!messages.length" class="chat-empty">暂无消息，发送第一条消息开始对话吧</div>
            <div v-for="msg in messages" :key="msg.id" :class="['chat-msg', msg.sender === 'user' ? 'chat-msg-right' : 'chat-msg-left']">
              <div class="chat-avatar" :class="msg.sender === 'admin' ? 'avatar-admin' : 'avatar-user'">
                {{ msg.sender === 'admin' ? '客' : (userInitial || '我') }}
              </div>
              <div class="chat-bubble-wrap">
                <div v-if="msg.type === 'image'" :class="['chat-bubble', 'bubble-img', msg.sender === 'admin' ? 'bubble-admin' : 'bubble-user']">
                  <img :src="msg.content" class="chat-img" @click="previewImage(msg.content)" />
                </div>
                <div v-else :class="['chat-bubble', msg.sender === 'admin' ? 'bubble-admin' : 'bubble-user']">{{ msg.content }}</div>
                <div class="chat-time">{{ formatTime(msg.createdAt) }}</div>
              </div>
            </div>
          </template>
        </div>

        <div class="chat-footer">
          <div class="chat-input-wrap">
            <button class="chat-img-btn" @click="triggerImagePick" :disabled="sending || !isLoggedIn" title="发送图片">
              <van-icon name="photo-o" size="22" color="#666" />
            </button>
            <input type="file" ref="fileInput" accept="image/*" style="display:none" @change="onImageSelected" />
            <input
              v-model="inputText"
              class="chat-input"
              placeholder="输入消息..."
              @keydown.enter="sendMessage"
              :disabled="sending || !isLoggedIn"
            />
            <button class="chat-send-btn" @click="sendMessage" :disabled="sending || !inputText.trim() || !isLoggedIn">
              <van-icon name="guide-o" size="20" :color="inputText.trim() ? '#fff' : 'rgba(255,255,255,0.5)'" />
            </button>
          </div>
          <div v-if="!isLoggedIn" class="chat-login-hint" @click="goLogin">请先登录后发送消息</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
/**
 * ChatWidget - 全局聊天悬浮组件
 *
 * 功能：
 * 1. 右下角显示红色悬浮按钮，带未读消息红点
 * 2. 点击弹出底部聊天面板，显示完整历史聊天记录
 * 3. 用户消息（右侧红色气泡）与客服回复（左侧白色气泡）
 * 4. 未登录时禁用输入框并提示登录
 * 5. 支持外部调用 openWithAutoMessage() 自动打开并发送预设消息（如商品咨询）
 * 6. 面板关闭时每 15 秒轮询未读数；面板打开时每 3 秒拉取新消息，快速感知回复
 */
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showImagePreview } from 'vant';
import { messageApi } from '@/api';
import { useUserStore } from '@/stores/user';

defineProps({
  hideFab: { type: Boolean, default: false },
});

const router = useRouter();
const userStore = useUserStore();
const showChat = ref(false);
const messages = ref([]);
const inputText = ref('');
const loading = ref(false);
const sending = ref(false);
const unreadCount = ref(0);
const chatBody = ref(null);
const fileInput = ref(null);

const isLoggedIn = computed(() => !!userStore.token);
// 用户昵称首字，用于聊天头像显示
const userInitial = computed(() => {
  const n = userStore.userInfo?.nickname || userStore.userInfo?.username || '';
  return n ? n[0] : '我';
});

// 轮询定时器：面板关闭时每 15 秒检查未读数，面板打开时每 3 秒拉取新消息
let pollTimer = null;
let activePollTimer = null;

// 格式化消息时间：当天只显示时分，非当天显示月/日 时分
const formatTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `${d.getMonth()+1}/${d.getDate()} ${time}`;
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight;
};

// 加载当前用户的全部聊天记录，同时清零未读计数（服务端会标记已读）
// smartScroll: 仅在有新消息时滚动到底部，避免用户翻看历史时被强制滚动
const loadMessages = async (smartScroll = false) => {
  if (!isLoggedIn.value) return;
  try {
    const res = await messageApi.mine();
    const newList = res.data || [];
    if (smartScroll && newList.length === messages.value.length) return;
    messages.value = newList;
    unreadCount.value = 0;
    scrollToBottom();
  } catch { /* ignore */ }
};

// 轮询检查未读消息数，用于悬浮按钮红点显示
const checkUnread = async () => {
  if (!isLoggedIn.value) return;
  try {
    const res = await messageApi.unread();
    unreadCount.value = res.data || 0;
  } catch { /* ignore */ }
};

// 发送消息：调用 API 后追加到消息列表并滚动到底部
const sendMessage = async () => {
  const content = inputText.value.trim();
  if (!content || sending.value || !isLoggedIn.value) return;
  sending.value = true;
  try {
    const res = await messageApi.send({ content });
    if (res.code === 0) {
      inputText.value = '';
      messages.value.push(res.data);
      scrollToBottom();
    } else {
      showToast(res.message || '发送失败');
    }
  } catch {
    showToast('发送失败');
  }
  sending.value = false;
};

// 待发送的自动消息（由 openWithAutoMessage 设置，面板打开后自动发送）
let pendingAutoMsg = '';

// 开启面板打开期间的快速轮询（3 秒），快速感知管理员回复
const startActivePoll = () => {
  stopActivePoll();
  activePollTimer = setInterval(() => loadMessages(true), 3000);
};
const stopActivePoll = () => {
  if (activePollTimer) { clearInterval(activePollTimer); activePollTimer = null; }
};

// 面板打开时：加载消息 + 启动快速轮询；若有待发自动消息则立即发送
const onOpen = async () => {
  await loadMessages();
  startActivePoll();
  if (pendingAutoMsg && isLoggedIn.value) {
    inputText.value = pendingAutoMsg;
    pendingAutoMsg = '';
    await nextTick();
    await sendMessage();
  }
};

const onClose = () => {
  stopActivePoll();
  checkUnread();
};

const toggleChat = () => {
  showChat.value = !showChat.value;
};

/**
 * 外部调用接口：打开聊天面板并自动发送一条消息
 * 用于"咨询"按钮场景，自动发送商品简介
 */
const openWithAutoMessage = (msg) => {
  pendingAutoMsg = msg || '';
  showChat.value = true;
};

const previewImage = (url) => {
  showImagePreview({ images: [url], closeable: true });
};

const triggerImagePick = () => {
  if (fileInput.value) fileInput.value.click();
};

const onImageSelected = async (e) => {
  const file = e.target.files?.[0];
  if (!file || !isLoggedIn.value) return;
  if (fileInput.value) fileInput.value.value = '';
  sending.value = true;
  try {
    const uploadRes = await messageApi.uploadImage(file);
    if (uploadRes.code === 0 && uploadRes.data?.url) {
      const sendRes = await messageApi.send({ content: uploadRes.data.url, type: 'image' });
      if (sendRes.code === 0) {
        messages.value.push(sendRes.data);
        scrollToBottom();
      }
    } else {
      showToast('图片上传失败');
    }
  } catch {
    showToast('图片上传失败');
  }
  sending.value = false;
};

defineExpose({ openWithAutoMessage });

const goLogin = () => {
  showChat.value = false;
  router.push('/login');
};

onMounted(() => {
  checkUnread();
  pollTimer = setInterval(checkUnread, 15000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  stopActivePoll();
});
</script>

<style scoped>
.chat-fab {
  position: fixed;
  bottom: 80px;
  right: 16px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #B91C1C, #991B1B);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(185, 28, 28, 0.4);
  cursor: pointer;
  z-index: 101;
  transition: transform 0.2s;
}
.chat-fab:active { transform: scale(0.92); }

.chat-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  background: #EF4444;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  text-align: center;
  line-height: 18px;
  padding: 0 4px;
  border: 2px solid #fff;
}

.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.chat-title { font-size: 16px; font-weight: 600; color: #1a1a1a; }
.chat-close { cursor: pointer; }

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8f8f8;
}

.chat-empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 60px 20px;
}

.chat-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: flex-start;
}
.chat-msg-right { flex-direction: row-reverse; }

.chat-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.avatar-admin { background: #B91C1C; color: #fff; }
.avatar-user { background: #E5E7EB; color: #6B7280; }

.chat-bubble-wrap { max-width: 75%; }
.chat-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.bubble-admin {
  background: #fff;
  color: #333;
  border: 1px solid #eee;
  border-top-left-radius: 4px;
}
.bubble-user {
  background: #B91C1C;
  color: #fff;
  border-top-right-radius: 4px;
}
.chat-time {
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
}
.chat-msg-right .chat-time { text-align: right; }

.chat-img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
  display: block;
}
.bubble-img {
  padding: 4px !important;
  background: transparent !important;
  border: none !important;
}

.chat-footer { padding: 12px 16px; border-top: 1px solid #f0f0f0; background: #fff; }
.chat-input-wrap { display: flex; gap: 8px; align-items: center; }
.chat-img-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #e5e5e5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}
.chat-img-btn:active { background: #f5f5f5; }
.chat-img-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-input {
  flex: 1;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.chat-input:focus { border-color: #B91C1C; }
.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #B91C1C;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.2s;
}
.chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-login-hint {
  text-align: center;
  font-size: 13px;
  color: #B91C1C;
  margin-top: 8px;
  cursor: pointer;
  text-decoration: underline;
}
</style>
