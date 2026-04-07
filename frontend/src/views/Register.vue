<template>
  <div class="register-page">
    <van-nav-bar title="注册" left-arrow @click-left="$router.back()" />

    <div class="register-header">
      <img
        v-if="headerLogoUrl && !headerLogoError"
        :src="headerLogoUrl"
        alt="Logo"
        class="register-logo-img"
        @error="headerLogoError = true"
      />
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="register-logo">
        <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
        <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
        <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
        <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
        <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
        <circle cx="498" cy="38" r="10" stroke="#999" stroke-width="1.5" fill="none"/>
        <text x="498" y="43" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" font-weight="bold">R</text>
      </svg>
      <h2>创建账号</h2>
    </div>

    <div class="register-form">
      <van-tabs v-model:active="registerMode" class="register-tabs">
        <van-tab title="邮箱注册" name="email">
          <van-cell-group inset>
            <van-field v-model="form.username" label="账号" placeholder="请输入用户名（2-50字符）" left-icon="manager-o" maxlength="50" />
            <van-field v-model="form.password" type="password" label="密码" placeholder="请输入密码（至少6位）" left-icon="lock" autocomplete="new-password" />
            <van-field v-model="form.email" label="邮箱" placeholder="请输入邮箱" left-icon="envelop-o" type="email" />
            <van-field v-model="form.code" label="验证码" placeholder="请输入邮箱验证码" left-icon="shield-o" maxlength="6">
              <template #button>
                <van-button size="small" type="primary" color="#B91C1C" :disabled="countdown > 0 || sendingCode" :loading="sendingCode" @click="handleSendCode">
                  {{ countdown > 0 ? countdown + 's' : '发送验证码' }}
                </van-button>
              </template>
            </van-field>
            <van-field v-model="form.nickname" label="昵称" placeholder="选填" left-icon="contact-o" maxlength="50" />
          </van-cell-group>
        </van-tab>
        <van-tab title="手机号注册" name="phone">
          <van-cell-group inset>
            <van-field v-model="form.phone" label="手机号" placeholder="请输入11位手机号" left-icon="phone-o" type="tel" maxlength="11" />
            <van-field v-model="form.smsCode" label="验证码" placeholder="请输入短信验证码" left-icon="shield-o" maxlength="6">
              <template #button>
                <van-button size="small" type="primary" color="#B91C1C" :disabled="smsCountdown > 0 || sendingSmsCode" :loading="sendingSmsCode" @click="handleSendSmsCode">
                  {{ smsCountdown > 0 ? smsCountdown + 's' : '获取验证码' }}
                </van-button>
              </template>
            </van-field>
            <van-field v-model="form.password" type="password" label="密码" placeholder="请输入密码（至少6位）" left-icon="lock" autocomplete="new-password" />
            <van-field v-model="form.nickname" label="昵称" placeholder="选填" left-icon="contact-o" maxlength="50" />
          </van-cell-group>
        </van-tab>
      </van-tabs>

      <div class="register-actions">
        <van-button
          type="primary"
          color="#B91C1C"
          block
          round
          :loading="loading"
          @click="handleRegister"
        >
          注册
        </van-button>
        <p class="login-link">
          已有账号？<span @click="$router.replace('/login')">去登录</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { authApi, homeConfigApi } from '@/api';
import { showToast } from 'vant';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const headerLogoUrl = ref('');
const headerLogoError = ref(false);

onMounted(async () => {
  try {
    const res = await homeConfigApi.list();
    const items = res.data || [];
    const headerLogo = items.find(i => i.section === 'headerLogo' && i.status === 'active');
    if (headerLogo && headerLogo.imageUrl) headerLogoUrl.value = headerLogo.imageUrl;
    else {
      const splash = items.find(i => i.section === 'splash' && i.status === 'active');
      if (splash && splash.imageUrl) headerLogoUrl.value = splash.imageUrl;
    }
  } catch (_) {}
});
const sendingCode = ref(false);
const countdown = ref(0);
let timer = null;

const registerMode = ref('email');
const form = reactive({
  username: '',
  password: '',
  email: '',
  code: '',
  nickname: '',
  phone: '',
  smsCode: '',
});
const smsCountdown = ref(0);
const sendingSmsCode = ref(false);
let smsTimer = null;

const handleSendCode = async () => {
  if (!form.email) {
    showToast('请先输入邮箱');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) {
    showToast('邮箱格式不正确');
    return;
  }
  sendingCode.value = true;
  try {
    await authApi.sendCode({ email: form.email });
    showToast('验证码已发送');
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || '发送失败';
    showToast(msg);
  } finally {
    sendingCode.value = false;
  }
};

const handleSendSmsCode = async () => {
  if (!/^1[3-9]\d{9}$/.test((form.phone || '').trim())) {
    showToast('请输入正确的11位手机号');
    return;
  }
  sendingSmsCode.value = true;
  try {
    await authApi.sendSmsCode({ phone: form.phone, scene: 'register' });
    showToast('验证码已发送');
    smsCountdown.value = 60;
    smsTimer = setInterval(() => {
      smsCountdown.value--;
      if (smsCountdown.value <= 0) clearInterval(smsTimer);
    }, 1000);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || '发送失败';
    showToast(msg);
  } finally {
    sendingSmsCode.value = false;
  }
};

const handleRegister = async () => {
  if (registerMode.value === 'phone') {
    if (!form.phone || !form.smsCode || !form.password) {
      showToast('请填写手机号、验证码和密码');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test((form.phone || '').trim())) {
      showToast('手机号格式不正确');
      return;
    }
    if (form.password.length < 6) {
      showToast('密码至少6位');
      return;
    }
  } else {
    if (!form.username || !form.password || !form.email || !form.code) {
      showToast('请填写完整信息');
      return;
    }
    if (form.password.length < 6) {
      showToast('密码至少6位');
      return;
    }
  }
  loading.value = true;
  try {
    const payload = registerMode.value === 'phone'
      ? { phone: form.phone, smsCode: form.smsCode, password: form.password, nickname: form.nickname }
      : form;
    const res = await authApi.register(payload);
    const d = res.data || res;
    userStore.setAuth(d.token, d.user);
    showToast('注册成功');
    router.replace('/');
  } catch (err) {
    showToast(err.message || '注册失败');
  } finally {
    loading.value = false;
  }
};

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (smsTimer) clearInterval(smsTimer);
});
</script>

<style scoped>
.register-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.register-header {
  text-align: center;
  padding: 30px 20px 16px;
}

.register-logo-img {
  width: 80px;
  height: auto;
  margin: 0 auto 12px;
  display: block;
  object-fit: contain;
}

.register-logo {
  width: 80px;
  margin: 0 auto 12px;
}

.register-header h2 {
  font-size: 20px;
  color: var(--vino-text);
}

.register-form {
  padding: 16px 0;
}

.register-actions {
  padding: 24px 16px;
}

.login-link {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--vino-text-secondary);
}

.login-link span {
  color: var(--vino-primary);
  cursor: pointer;
}
</style>
