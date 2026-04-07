<template>
  <div class="checkout-page">
    <van-nav-bar title="确认订单" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" class="page-loading" vertical>加载中...</van-loading>

    <template v-else>
      <van-empty v-if="!lines.length" description="购物车是空的">
        <van-button type="primary" color="#B91C1C" round @click="$router.replace('/products')">去选购</van-button>
      </van-empty>

      <template v-else>
        <div class="checkout-body">
          <div class="ck-block">
            <div class="ck-block-title">商品明细</div>
            <div v-for="row in lines" :key="row.guideId" class="ck-line">
              <div class="ck-line-name">{{ row.name }}</div>
              <div class="ck-line-meta">
                <span>¥{{ Number(row.listPrice).toFixed(2) }} × {{ row.qty }}</span>
                <span class="ck-line-sub">积分 {{ row.rewardPoints }}/件</span>
              </div>
              <div class="ck-line-total">¥{{ Number(row.lineTotal).toFixed(2) }}</div>
            </div>
            <div class="ck-sum">
              <span>合计 <strong>¥{{ Number(totalPrice).toFixed(2) }}</strong></span>
              <span class="ck-sum-pts">总积分 {{ totalPoints }}</span>
            </div>
          </div>

          <div v-if="savedAddresses.length" class="ck-block">
            <div class="ck-block-title">选择收货地址</div>
            <div
              v-for="addr in savedAddresses"
              :key="addr.id"
              class="addr-pick"
              :class="{ on: selectedAddrId === addr.id }"
              @click="applyAddress(addr)"
            >
              <div class="addr-pick-top">
                {{ addr.contactName }} {{ addr.contactPhone }}
                <van-tag v-if="addr.isDefault" type="primary" color="#B91C1C" size="mini">默认</van-tag>
              </div>
              <div class="addr-pick-detail">{{ formatAddr(addr) }}</div>
            </div>
          </div>

          <van-cell-group inset class="ck-fields">
            <van-field v-model="form.contactName" label="收货人" placeholder="必填" required />
            <van-field v-model="form.contactPhone" label="手机号" type="tel" placeholder="必填" required />
            <van-field
              v-model="form.address"
              label="收货地址"
              type="textarea"
              rows="2"
              autosize
              placeholder="选填，可从上方地址选择自动填充"
            />
            <van-field v-model="form.remark" label="备注" type="textarea" rows="2" autosize placeholder="选填" />
          </van-cell-group>
        </div>

        <div class="app-fixed-bottom-shell checkout-bottom-bar">
          <div class="ck-footer">
            <van-button type="primary" color="#B91C1C" block round :loading="submitting" @click="submit">
              提交订单
            </van-button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { authApi, addressApi, orderApi } from '@/api';

const router = useRouter();
const loading = ref(true);
const lines = ref([]);
const totalPrice = ref(0);
const totalPoints = ref(0);
const savedAddresses = ref([]);
const selectedAddrId = ref(null);
const submitting = ref(false);

const form = ref({
  contactName: '',
  contactPhone: '',
  address: '',
  remark: '',
});

function formatAddr(addr) {
  if (!addr) return '';
  const parts = [];
  if (addr.country === '其他') {
    parts.push(addr.customCountry || '其他');
  } else if (addr.country) {
    parts.push(addr.country);
  }
  if (addr.country === '中国大陆') {
    if (addr.province) parts.push(addr.province);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);
  }
  if (addr.detailAddress) parts.push(addr.detailAddress);
  return parts.join(' ');
}

function applyAddress(addr) {
  selectedAddrId.value = addr.id;
  form.value.contactName = addr.contactName || '';
  form.value.contactPhone = addr.contactPhone || '';
  form.value.address = formatAddr(addr);
}

async function load() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    showToast('请先登录');
    router.replace('/login');
    return;
  }
  try {
    const [cartRes, profileRes, addrRes] = await Promise.all([
      authApi.getCart(),
      authApi.getProfile(),
      addressApi.list(),
    ]);
    const c = cartRes.data || {};
    lines.value = Array.isArray(c.items) ? c.items : [];
    totalPrice.value = c.totalPrice ?? 0;
    totalPoints.value = c.totalPoints ?? 0;

    const profile = profileRes.data || {};
    const rawList = addrRes.data;
    const list = Array.isArray(rawList) ? rawList : [];
    savedAddresses.value = list;

    const def = list.find((a) => a.isDefault) || list[0];
    if (def) {
      selectedAddrId.value = def.id;
      form.value.contactName = def.contactName || profile.nickname || '';
      form.value.contactPhone = def.contactPhone || profile.phone || '';
      form.value.address = formatAddr(def);
    } else {
      form.value.contactName = (profile.nickname || '').trim();
      form.value.contactPhone = (profile.phone || '').trim();
      form.value.address = '';
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const name = form.value.contactName.trim();
  const phone = form.value.contactPhone.trim();
  if (!name || !phone) {
    showToast('请填写收货人和手机号');
    return;
  }
  if (!lines.value.length) {
    showToast('购物车为空');
    return;
  }
  submitting.value = true;
  try {
    await orderApi.cartCheckout({
      contactName: name,
      contactPhone: phone,
      address: form.value.address.trim(),
      remark: form.value.remark.trim(),
    });
    showToast('订单已提交');
    router.replace('/orders');
  } catch (e) {
    showToast(e.message || '下单失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.checkout-page {
  min-height: 100vh;
  background: var(--vino-bg);
  padding-bottom: 120px;
}
.checkout-bottom-bar {
  z-index: 100;
}
.page-loading {
  padding: 80px 0;
  text-align: center;
}
.checkout-body {
  padding: 12px;
}
.ck-block {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.ck-block-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vino-dark);
  margin-bottom: 12px;
}
.ck-line {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}
.ck-line:last-of-type {
  border-bottom: none;
}
.ck-line-name {
  font-weight: 500;
  color: #111;
  margin-bottom: 4px;
}
.ck-line-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
}
.ck-line-sub {
  margin-left: 8px;
}
.ck-line-total {
  text-align: right;
  font-weight: 600;
  color: #b91c1c;
  margin-top: 4px;
}
.ck-sum {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
  font-size: 15px;
}
.ck-sum strong {
  font-size: 20px;
  color: #b91c1c;
}
.ck-sum-pts {
  font-size: 13px;
  color: #6b7280;
}
.addr-pick {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
}
.addr-pick.on {
  border-color: #b91c1c;
  background: #fef2f2;
}
.addr-pick-top {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}
.addr-pick-detail {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}
.ck-fields {
  margin-bottom: 16px;
}
.ck-footer {
  padding: 12px 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98), rgba(248, 248, 250, 0.96));
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.06);
}
</style>
