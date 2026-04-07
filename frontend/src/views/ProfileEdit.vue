<template>
  <div class="profile-edit-page">
    <van-nav-bar title="个人资料" left-arrow @click-left="$router.back()" />

    <div class="card">
      <div class="edit-row">
        <span class="edit-label">更换头像</span>
        <label class="edit-avatar-wrap">
          <input type="file" accept="image/*" class="edit-file-input" @change="onAvatarChange" />
          <img v-if="avatarUrl" :src="avatarUrl" class="avatar-preview" alt="" />
          <span v-else class="edit-btn-text">选择头像</span>
        </label>
      </div>
      <div class="edit-row">
        <span class="edit-label">修改昵称</span>
        <input
          v-model="nickname"
          type="text"
          class="edit-nickname-input"
          placeholder="点击修改"
          maxlength="50"
          @blur="onNicknameBlur"
        />
      </div>
      <div class="edit-row edit-row-phone">
        <span class="edit-label">手机号</span>
        <template v-if="userPhone">
          <span class="phone-masked">{{ maskedPhone }}</span>
          <span class="edit-link" @click="onChangePhone">更换</span>
        </template>
        <template v-else>
          <div class="bind-phone-inline">
            <input
              v-model="bindPhone"
              type="tel"
              class="bind-phone-input"
              placeholder="11位手机号"
              maxlength="11"
            />
            <input
              v-model="bindCode"
              type="tel"
              class="bind-code-input"
              placeholder="验证码"
              maxlength="6"
            />
            <van-button
              size="small"
              class="btn-get-code"
              :disabled="smsCountdown > 0 || sendingSmsCode"
              :loading="sendingSmsCode"
              @click="onSendBindCode"
            >
              {{ smsCountdown > 0 ? smsCountdown + 's' : '获取验证码' }}
            </van-button>
            <van-button size="small" type="primary" color="#B91C1C" class="btn-bind-phone" @click="onSubmitBindPhone">
              绑定
            </van-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useUserStore } from '@/stores/user';
import { authApi } from '@/api';

const router = useRouter();
const userStore = useUserStore();

const avatarUrl = ref('');
const nickname = ref('');
const userPhone = ref('');
const bindPhone = ref('');
const bindCode = ref('');
const smsCountdown = ref(0);
const sendingSmsCode = ref(false);
let countdownTimer = null;

const maskedPhone = computed(() => {
  const p = userPhone.value;
  return p && p.length >= 11 ? p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
});

function loadUser() {
  const u = userStore.userInfo;
  if (u) {
    avatarUrl.value = u.avatar || '';
    nickname.value = u.nickname || u.username || '';
    userPhone.value = u.phone || '';
    return;
  }
  authApi.getProfile().then((res) => {
    const u = res.data || {};
    userStore.userInfo = u;
    avatarUrl.value = u.avatar || '';
    nickname.value = u.nickname || u.username || '';
    userPhone.value = u.phone || '';
  }).catch(() => {
    router.replace('/login');
  });
}

onMounted(() => {
  if (!userStore.isLoggedIn()) {
    router.replace('/login');
    return;
  }
  loadUser();
});

watch(() => userStore.userInfo, (u) => {
  if (u) {
    avatarUrl.value = u.avatar || '';
    nickname.value = u.nickname || u.username || '';
    userPhone.value = u.phone || '';
  }
}, { deep: true });

const onAvatarChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  e.target.value = '';
  try {
    const res = await authApi.uploadAvatar(file);
    const url = res.data?.url;
    if (url) {
      await authApi.updateProfile({ avatar: url });
      await userStore.fetchProfile();
      avatarUrl.value = url;
      showToast('头像已更新');
    }
  } catch (err) {
    showToast(err.message || '上传失败');
  }
};

const onNicknameBlur = async () => {
  const name = (nickname.value || '').trim();
  const current = userStore.userInfo?.nickname || userStore.userInfo?.username || '';
  if (name === current || !name) return;
  try {
    await authApi.updateProfile({ nickname: name });
    await userStore.fetchProfile();
    showToast('昵称已更新');
  } catch (err) {
    showToast(err.message || '更新失败');
    nickname.value = current;
  }
};

const onSendBindCode = async () => {
  const phone = bindPhone.value.replace(/\D/g, '').slice(0, 11);
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('请输入正确的11位手机号');
    return;
  }
  sendingSmsCode.value = true;
  try {
    await authApi.sendSmsCode({ phone });
    showToast('验证码已发送');
    smsCountdown.value = 60;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      smsCountdown.value--;
      if (smsCountdown.value <= 0) clearInterval(countdownTimer);
    }, 1000);
  } catch (err) {
    showToast(err.message || '发送失败');
  } finally {
    sendingSmsCode.value = false;
  }
};

const onSubmitBindPhone = async () => {
  const phone = bindPhone.value.replace(/\D/g, '').slice(0, 11);
  const code = bindCode.value.replace(/\D/g, '').slice(0, 6);
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('请输入正确的11位手机号');
    return;
  }
  if (code.length !== 6) {
    showToast('请输入6位验证码');
    return;
  }
  try {
    await authApi.bindPhone({ phone, code });
    await userStore.fetchProfile();
    const u = userStore.userInfo;
    userPhone.value = u?.phone || '';
    bindPhone.value = '';
    bindCode.value = '';
    showToast('绑定成功');
  } catch (err) {
    showToast(err.message || '绑定失败');
  }
};

const onChangePhone = () => {
  userPhone.value = '';
  bindPhone.value = '';
  bindCode.value = '';
};
</script>

<style scoped>
.profile-edit-page {
  min-height: 100vh;
  background: var(--vino-bg);
  padding: 12px;
}

.card {
  background: var(--vino-card);
  border-radius: var(--vino-radius);
  overflow: hidden;
}

.edit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--vino-border);
}

.edit-row:last-child {
  border-bottom: none;
}

.edit-label {
  font-size: 15px;
  color: var(--vino-dark);
  font-weight: 500;
  flex-shrink: 0;
  width: 80px;
}

.edit-avatar-wrap {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.edit-file-input {
  display: none;
}

.avatar-preview {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
}

.edit-btn-text {
  font-size: 14px;
  color: var(--vino-primary);
}

.edit-nickname-input {
  flex: 1;
  text-align: right;
  font-size: 14px;
  color: var(--vino-dark);
  border: none;
  background: transparent;
  outline: none;
  margin-left: 16px;
}

.edit-row-phone {
  flex-wrap: wrap;
}

.phone-masked {
  font-size: 14px;
  color: var(--vino-dark);
}

.edit-link {
  font-size: 13px;
  color: var(--vino-primary);
  margin-left: 12px;
  cursor: pointer;
}

.bind-phone-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.bind-phone-input,
.bind-code-input {
  width: 100px;
  height: 36px;
  padding: 0 10px;
  font-size: 14px;
  border: 1px solid var(--vino-border);
  border-radius: 8px;
}

.btn-get-code {
  min-width: 90px;
}

.btn-bind-phone {
  min-width: 60px;
}
</style>
