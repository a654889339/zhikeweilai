<template>
  <div class="cart-page">
    <van-nav-bar title="购物车" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" style="text-align: center; padding: 80px 0" />

    <template v-else-if="!lines.length">
      <van-empty description="购物车是空的">
        <van-button type="primary" round block class="cart-btn" @click="$router.push('/products')">
          去选购
        </van-button>
      </van-empty>
    </template>

    <template v-else>
      <div class="cart-list">
        <van-cell-group inset>
          <van-cell v-for="row in lines" :key="row.guideId" :title="row.name">
            <template #label>
              <span class="cart-line-meta">¥{{ Number(row.listPrice).toFixed(2) }} · 单件积分 {{ row.rewardPoints }}</span>
            </template>
            <template #right-icon>
              <van-stepper
                v-model="row.qty"
                integer
                :min="1"
                :max="9999"
                @change="onQtyChange"
              />
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <div class="cart-bottom">
        <div class="cart-total">
          合计 <strong>¥ {{ Number(totalPrice).toFixed(2) }}</strong>
          <span class="cart-pts">· 积分 {{ totalPoints }}</span>
        </div>
        <van-button type="primary" color="#B91C1C" block round class="cart-submit" @click="checkoutOpen = true">
          下单
        </van-button>
      </div>
    </template>

    <van-dialog
      v-model:show="checkoutOpen"
      title="填写收货与联系信息"
      :show-confirm-button="false"
      :show-cancel-button="false"
    >
      <div class="checkout-dialog">
        <van-field v-model="checkoutForm.contactName" label="联系人" placeholder="必填" />
        <van-field v-model="checkoutForm.contactPhone" label="电话" type="tel" placeholder="必填" />
        <van-field v-model="checkoutForm.address" label="地址" type="textarea" rows="2" autosize placeholder="选填" />
        <van-field v-model="checkoutForm.remark" label="备注" type="textarea" rows="2" autosize placeholder="选填" />
        <div class="checkout-btns">
          <van-button round block @click="checkoutOpen = false">取消</van-button>
          <van-button type="primary" color="#B91C1C" round block :loading="submitting" @click="submitOrder">
            提交订单
          </van-button>
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { authApi, orderApi } from '@/api';

const router = useRouter();
const loading = ref(true);
const lines = ref([]);
const totalPrice = ref(0);
const totalPoints = ref(0);
const checkoutOpen = ref(false);
const submitting = ref(false);
const checkoutForm = ref({
  contactName: '',
  contactPhone: '',
  address: '',
  remark: '',
});

async function load() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    showToast('请先登录');
    router.replace('/login');
    return;
  }
  try {
    const res = await authApi.getCart();
    const d = res.data || {};
    lines.value = Array.isArray(d.items) ? d.items : [];
    totalPrice.value = d.totalPrice || 0;
    totalPoints.value = d.totalPoints || 0;
  } catch {
    lines.value = [];
  } finally {
    loading.value = false;
  }
}

async function pushCartFromLines() {
  const items = lines.value.map((x) => ({ guideId: x.guideId, qty: x.qty }));
  const res = await authApi.putCart({ items });
  const d = res.data || {};
  lines.value = Array.isArray(d.items) ? d.items : [];
  totalPrice.value = d.totalPrice || 0;
  totalPoints.value = d.totalPoints || 0;
}

let qtyTimer;
function onQtyChange() {
  clearTimeout(qtyTimer);
  qtyTimer = setTimeout(() => {
    pushCartFromLines().catch((e) => showToast(e.message || '更新失败'));
  }, 300);
}

async function submitOrder() {
  const name = checkoutForm.value.contactName.trim();
  const phone = checkoutForm.value.contactPhone.trim();
  if (!name || !phone) {
    showToast('请填写联系人和电话');
    return;
  }
  submitting.value = true;
  try {
    await orderApi.cartCheckout({
      contactName: name,
      contactPhone: phone,
      address: checkoutForm.value.address.trim(),
      remark: checkoutForm.value.remark.trim(),
    });
    checkoutOpen.value = false;
    showToast('订单已创建');
    router.push('/orders');
  } catch (e) {
    showToast(e.message || '下单失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.cart-page {
  min-height: 100vh;
  background: var(--vino-bg);
  padding-bottom: 120px;
  box-sizing: border-box;
}
.cart-list {
  padding: 12px 0;
}
.cart-line-meta {
  font-size: 12px;
  color: var(--vino-text-secondary);
}
.cart-bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98), rgba(248, 248, 250, 0.96));
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
}
.cart-total {
  font-size: 15px;
  margin-bottom: 10px;
  color: var(--vino-dark);
}
.cart-total strong {
  color: #b91c1c;
  font-size: 20px;
}
.cart-pts {
  font-size: 13px;
  color: var(--vino-text-secondary);
  margin-left: 4px;
}
.cart-submit {
  font-weight: 600;
}
.cart-btn {
  margin-top: 16px;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}
.checkout-dialog {
  padding: 8px 0 0;
}
.checkout-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 16px;
}
</style>
