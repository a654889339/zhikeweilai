<template>
  <div class="detail-page">
    <van-nav-bar title="服务详情" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>加载中...</van-loading>

    <template v-else>
      <div class="detail-cover">
        <div class="detail-cover-bg" :style="{ background: coverBg, opacity: coverOpacity }"></div>
        <img v-if="serviceIconUrl" :src="serviceIconUrl" class="detail-cover-icon-img" alt="" />
        <van-icon v-else :name="serviceIcon" size="60" color="#fff" />
      </div>

      <div class="detail-body">
        <h2>{{ serviceData.title }}</h2>
        <p class="detail-desc">{{ serviceData.description }}</p>

        <div class="price-row">
          <span class="detail-price">¥{{ serviceData.price }}</span>
          <template v-if="showOriginPrice">
            <span class="origin-price">¥{{ serviceData.originPrice }}</span>
            <van-tag type="primary" color="#B91C1C">限时优惠</van-tag>
          </template>
        </div>

        <van-divider />

        <h3>服务亮点</h3>
        <div class="features">
          <div class="feature-item" v-for="f in features" :key="f.title">
            <van-icon :name="f.icon" size="20" color="#B91C1C" />
            <div>
              <h4>{{ f.title }}</h4>
              <p>{{ f.desc }}</p>
            </div>
          </div>
        </div>

        <van-divider />

        <h3>服务流程</h3>
        <van-steps direction="vertical" :active="0" active-color="#B91C1C">
          <van-step>在线下单</van-step>
          <van-step>工程师接单</van-step>
          <van-step>上门服务</van-step>
          <van-step>验收确认</van-step>
          <van-step>完成评价</van-step>
        </van-steps>
      </div>

      <div class="app-fixed-bottom-shell">
        <div class="detail-footer">
          <van-button icon="chat-o" type="default" size="small" @click="onConsult">咨询</van-button>
          <van-button type="primary" color="#B91C1C" block round @click="onBookClick">
            立即预约
          </van-button>
        </div>
      </div>

      <!-- 下单弹窗 -->
      <van-popup v-model:show="showOrderPopup" position="bottom" round :style="{ maxHeight: '90%' }">
        <div class="order-popup">
          <h3>预约服务</h3>
          <div class="order-service-info">
            <div class="order-service-icon" :style="{ background: coverBg }">
              <img v-if="serviceIconUrl" :src="serviceIconUrl" class="order-service-icon-img" alt="" />
              <van-icon v-else :name="serviceIcon" size="24" color="#fff" />
            </div>
            <div>
              <h4>{{ serviceData.title }}</h4>
              <span class="order-service-price">¥{{ serviceData.price }}</span>
            </div>
          </div>

          <div class="order-form-scroll">
            <div v-if="savedAddresses.length" class="saved-addr-section">
              <div class="saved-addr-title">
                <span>从已保存地址选取</span>
                <span class="saved-addr-clear" v-if="selectedAddrId" @click="clearSelectedAddr">清除选择</span>
              </div>
              <div class="saved-addr-list">
                <div
                  v-for="addr in savedAddresses"
                  :key="addr.id"
                  class="saved-addr-item"
                  :class="{ active: selectedAddrId === addr.id }"
                  @click="applyAddress(addr)"
                >
                  <div class="saved-addr-name">
                    {{ addr.contactName }} {{ addr.contactPhone }}
                    <van-tag v-if="addr.isDefault" type="primary" color="#B91C1C" size="mini">默认</van-tag>
                  </div>
                  <div class="saved-addr-detail">{{ formatSavedAddr(addr) }}</div>
                </div>
              </div>
            </div>

            <van-cell-group inset>
              <van-field v-model="orderForm.contactName" label="联系人" placeholder="请输入联系人姓名" />
              <van-field v-model="orderForm.contactPhone" label="联系电话" type="tel" placeholder="请输入联系电话" />
            </van-cell-group>

            <!-- 国家/地区 -->
            <van-cell-group inset class="mt12">
              <div class="picker-trigger" @click="showInlineCountry = !showInlineCountry; showInlineArea = false">
                <span class="picker-label">国家/地区</span>
                <span :class="['picker-value', { placeholder: !orderForm.country }]">
                  {{ countryDisplay || '请选择国家/地区' }}
                </span>
                <van-icon :name="showInlineCountry ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
              </div>
              <div v-if="showInlineCountry" class="select-list">
                <div
                  v-for="c in countryColumns"
                  :key="c"
                  class="select-item"
                  :class="{ active: orderForm.country === c }"
                  @click="selectCountry(c)"
                >
                  <span>{{ c }}</span>
                  <van-icon v-if="orderForm.country === c" name="success" color="#B91C1C" size="16" />
                </div>
              </div>

              <van-field
                v-if="orderForm.country === '其他'"
                v-model="orderForm.customCountry"
                label="自定义国家"
                placeholder="请输入国家/地区名称"
              />

              <!-- 省/市/区（仅中国大陆） -->
              <template v-if="orderForm.country === '中国大陆'">
                <div class="picker-trigger" @click="showInlineArea = !showInlineArea; showInlineCountry = false">
                  <span class="picker-label">省/市/区</span>
                  <span :class="['picker-value', { placeholder: !orderForm.province }]">
                    {{ areaDisplay || '请选择省市区' }}
                  </span>
                  <van-icon :name="showInlineArea ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
                </div>
                <div v-if="showInlineArea" class="area-picker-wrap" @touchmove.stop @mousewheel.stop>
                  <van-area
                    :area-list="areaList"
                    @confirm="onAreaConfirm"
                    @cancel="showInlineArea = false"
                  />
                </div>
              </template>
            </van-cell-group>

            <van-cell-group inset class="mt12">
              <van-field v-model="orderForm.detailAddress" label="详细地址" placeholder="请输入小区/街道等具体地址" />
              <van-field v-model="orderForm.remark" label="备注" type="textarea" rows="2" placeholder="其他需要说明的事项（选填）" />
            </van-cell-group>
          </div>

          <div class="order-submit-area">
            <div class="order-total">
              <span>合计：</span>
              <span class="order-total-price">¥{{ serviceData.price }}</span>
            </div>
            <van-button type="primary" color="#B91C1C" block round :loading="submitting" @click="submitOrder">
              确认预约
            </van-button>
          </div>
        </div>
      </van-popup>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { serviceApi, orderApi, addressApi } from '@/api';
import { showToast, showDialog } from 'vant';
import { areaList } from '@vant/area-data';

const route = useRoute();
const router = useRouter();
const chatWidgetRef = inject('chatWidget', ref(null));
const loading = ref(true);
const showOrderPopup = ref(false);
const submitting = ref(false);
const showInlineCountry = ref(false);
const showInlineArea = ref(false);
const savedAddresses = ref([]);
const selectedAddrId = ref(null);

const countryColumns = [
  '中国大陆', '中国香港', '中国澳门', '中国台湾',
  '美国', '英国', '日本', '韩国', '新加坡', '澳大利亚',
  '加拿大', '德国', '法国', '马来西亚', '泰国', '其他',
];

const orderForm = reactive({
  contactName: '',
  contactPhone: '',
  country: '',
  customCountry: '',
  province: '',
  city: '',
  district: '',
  areaCode: '',
  detailAddress: '',
  remark: '',
});

const countryDisplay = computed(() => {
  if (orderForm.country === '其他' && orderForm.customCountry) return `其他 - ${orderForm.customCountry}`;
  return orderForm.country || '';
});

const areaDisplay = computed(() => {
  if (orderForm.province) return `${orderForm.province} ${orderForm.city} ${orderForm.district}`.trim();
  return '';
});

const selectCountry = (c) => {
  orderForm.country = c;
  orderForm.province = '';
  orderForm.city = '';
  orderForm.district = '';
  orderForm.areaCode = '';
  orderForm.customCountry = '';
  showInlineCountry.value = false;
};

const onAreaConfirm = ({ selectedOptions }) => {
  orderForm.province = selectedOptions[0]?.text || '';
  orderForm.city = selectedOptions[1]?.text || '';
  orderForm.district = selectedOptions[2]?.text || '';
  orderForm.areaCode = selectedOptions[2]?.value || '';
  showInlineArea.value = false;
};

const buildFullAddress = () => {
  const parts = [];
  if (orderForm.country === '其他') {
    parts.push(orderForm.customCountry || '其他');
  } else if (orderForm.country) {
    parts.push(orderForm.country);
  }
  if (orderForm.country === '中国大陆' && orderForm.province) {
    parts.push(orderForm.province, orderForm.city, orderForm.district);
  }
  if (orderForm.detailAddress) parts.push(orderForm.detailAddress);
  return parts.filter(Boolean).join(' ');
};

const formatSavedAddr = (addr) => {
  const parts = [];
  if (addr.country === '其他') parts.push(addr.customCountry || '其他');
  else if (addr.country) parts.push(addr.country);
  if (addr.country === '中国大陆') {
    if (addr.province) parts.push(addr.province);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);
  }
  if (addr.detailAddress) parts.push(addr.detailAddress);
  return parts.join(' ');
};

const applyAddress = (addr) => {
  selectedAddrId.value = addr.id;
  orderForm.contactName = addr.contactName;
  orderForm.contactPhone = addr.contactPhone;
  orderForm.country = addr.country;
  orderForm.customCountry = addr.customCountry || '';
  orderForm.province = addr.province || '';
  orderForm.city = addr.city || '';
  orderForm.district = addr.district || '';
  orderForm.detailAddress = addr.detailAddress || '';
  showInlineCountry.value = false;
  showInlineArea.value = false;
};

const clearSelectedAddr = () => {
  selectedAddrId.value = null;
  orderForm.contactName = '';
  orderForm.contactPhone = '';
  orderForm.country = '';
  orderForm.customCountry = '';
  orderForm.province = '';
  orderForm.city = '';
  orderForm.district = '';
  orderForm.areaCode = '';
  orderForm.detailAddress = '';
};

const loadSavedAddresses = async () => {
  try {
    const res = await addressApi.list();
    savedAddresses.value = res.data || [];
  } catch {}
};

const onConsult = () => {
  const s = serviceData.value;
  const msg = `我想咨询一下【${s.title || '该服务'}】${s.price ? '（¥' + s.price + '）' : ''}${s.description ? '：' + s.description : ''}`;
  if (chatWidgetRef.value) {
    chatWidgetRef.value.openWithAutoMessage(msg);
  }
};

const onBookClick = () => {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showDialog({ title: '未登录', message: '请先登录后再预约服务' }).then(() => {
      router.push('/login');
    });
    return;
  }
  showInlineCountry.value = false;
  showInlineArea.value = false;
  loadSavedAddresses();
  showOrderPopup.value = true;
};

const fallbackServices = {
  1: { title: '设备维修', description: '专业工程师提供全方位维修服务，品质保障，售后无忧。', price: '99', originPrice: '159', icon: 'setting-o', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
  2: { title: '上门维修', description: '快速响应，工程师2小时内上门服务。', price: '149', originPrice: '199', icon: 'location-o', bg: 'linear-gradient(135deg, #DC2626, #B91C1C)' },
  3: { title: '远程支持', description: '在线视频指导，远程诊断问题。', price: '29', originPrice: '49', icon: 'phone-o', bg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  4: { title: '深度清洁', description: '全方位清洁保养，焕然一新。', price: '149', originPrice: '199', icon: 'brush-o', bg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
  5: { title: '日常清洁', description: '基础维护清洁，保持良好状态。', price: '69', originPrice: '89', icon: 'smile-o', bg: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  6: { title: '全面检测', description: '系统全面评估，发现潜在问题。', price: '49', originPrice: '79', icon: 'scan', bg: 'linear-gradient(135deg, #059669, #047857)' },
  7: { title: '性能优化', description: '提速升级，优化系统性能。', price: '79', originPrice: '129', icon: 'fire-o', bg: 'linear-gradient(135deg, #10B981, #059669)' },
  8: { title: '数据恢复', description: '专业数据找回，高成功率。', price: '199', originPrice: '299', icon: 'replay', bg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
  9: { title: '数据备份', description: '安全迁移，完整备份保护。', price: '59', originPrice: '89', icon: 'description', bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
};

const serviceData = ref({ title: '', description: '', price: '0' });
const serviceIcon = ref('setting-o');
const serviceIconUrl = ref('');
const coverBg = ref('linear-gradient(135deg, #B91C1C, #7F1D1D)');
const coverOpacity = ref(1);

const showOriginPrice = computed(() => {
  const op = serviceData.value.originPrice;
  return op != null && Number(op) > 0;
});

const features = [
  { title: '品质保障', desc: '全部原装配件', icon: 'shield-o' },
  { title: '快速响应', desc: '2小时内上门', icon: 'clock-o' },
  { title: '透明报价', desc: '无隐形消费', icon: 'balance-list-o' },
  { title: '售后无忧', desc: '90天质保', icon: 'certificate' },
];

onMounted(async () => {
  const id = route.params.id;
  try {
    const res = await serviceApi.detail(id);
    const d = res.data;
    serviceData.value = { title: d.title, description: d.description, price: d.price, originPrice: d.originPrice };
    serviceIcon.value = d.icon || 'setting-o';
    serviceIconUrl.value = d.iconUrl || '';
    coverBg.value = d.bg || 'linear-gradient(135deg, #B91C1C, #7F1D1D)';
    coverOpacity.value = d.bgOpacity != null ? Number(d.bgOpacity) / 100 : 1;
  } catch {
    const fb = fallbackServices[id] || fallbackServices[1];
    serviceData.value = { title: fb.title, description: fb.description, price: fb.price, originPrice: fb.originPrice };
    serviceIcon.value = fb.icon;
    serviceIconUrl.value = '';
    coverBg.value = fb.bg;
    coverOpacity.value = 1;
  } finally {
    loading.value = false;
  }
});

const submitOrder = async () => {
  if (!orderForm.contactName.trim()) { showToast('请输入联系人'); return; }
  if (!orderForm.contactPhone.trim()) { showToast('请输入联系电话'); return; }
  if (!orderForm.country) { showToast('请选择国家/地区'); return; }
  if (orderForm.country === '其他' && !orderForm.customCountry.trim()) { showToast('请输入国家/地区名称'); return; }
  if (orderForm.country === '中国大陆' && !orderForm.province) { showToast('请选择省市区'); return; }
  if (!orderForm.detailAddress.trim()) { showToast('请输入详细地址'); return; }

  const fullAddress = buildFullAddress();
  submitting.value = true;
  try {
    await orderApi.create({
      serviceId: Number(route.params.id) || null,
      serviceTitle: serviceData.value.title,
      serviceIcon: serviceIcon.value,
      price: serviceData.value.price,
      contactName: orderForm.contactName.trim(),
      contactPhone: orderForm.contactPhone.trim(),
      address: fullAddress,
      remark: orderForm.remark.trim(),
    });
    showOrderPopup.value = false;
    showDialog({ title: '预约成功', message: '您的服务已预约成功，我们会尽快安排工程师。' }).then(() => {
      router.push('/orders');
    });
  } catch (err) {
    showToast(err.message || '下单失败');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.detail-page {
  background: var(--vino-bg);
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-loading {
  padding-top: 120px;
  text-align: center;
}

.detail-cover {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.detail-cover-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.detail-cover .detail-cover-icon-img,
.detail-cover .van-icon {
  position: relative;
  z-index: 1;
}

.detail-cover-icon-img {
  max-width: 80px;
  max-height: 80px;
  object-fit: contain;
}

.detail-body {
  background: var(--vino-card);
  border-radius: 16px 16px 0 0;
  margin-top: -20px;
  position: relative;
  padding: 24px 16px;
}

.detail-body h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.detail-desc {
  font-size: 14px;
  color: var(--vino-text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-price {
  font-size: 24px;
  font-weight: 700;
  color: var(--vino-primary);
}

.origin-price {
  font-size: 14px;
  color: #ccc;
  text-decoration: line-through;
}

.detail-body h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.feature-item h4 {
  font-size: 14px;
  margin-bottom: 2px;
}

.feature-item p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.detail-footer {
  position: relative;
  background: var(--vino-card);
  padding: 10px 0;
  display: flex;
  gap: 10px;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  border-radius: 12px 12px 0 0;
}

.detail-footer .van-button--default {
  flex-shrink: 0;
}

.detail-footer .van-button--primary {
  flex: 1;
}

.order-popup {
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.order-popup h3 {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.order-service-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--vino-bg, #f5f5f5);
  border-radius: 10px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.order-service-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.order-service-icon-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.order-service-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.order-service-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--vino-primary, #B91C1C);
}

.order-form-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mt12 {
  margin-top: 12px;
}

.picker-trigger {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  min-height: 44px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.picker-label {
  font-size: 14px;
  color: #323233;
  width: 6.2em;
  flex-shrink: 0;
  margin-right: 12px;
}

.picker-value {
  flex: 1;
  font-size: 14px;
  color: #323233;
  text-align: right;
}

.picker-value.placeholder {
  color: #c8c9cc;
}

.picker-arrow {
  margin-left: 4px;
  color: #969799;
  flex-shrink: 0;
}

.select-list {
  max-height: 200px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid #f0f0f0;
}

.select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 14px;
  color: #323233;
  border-bottom: 1px solid #fafafa;
  cursor: pointer;
  transition: background 0.15s;
}

.select-item:active {
  background: #f5f5f5;
}

.select-item.active {
  color: #B91C1C;
  font-weight: 500;
}

.area-picker-wrap {
  border-bottom: 1px solid #f0f0f0;
  height: 260px;
  overflow: hidden;
}

.saved-addr-section {
  padding: 0 16px 8px;
}
.saved-addr-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  padding-top: 4px;
}
.saved-addr-clear {
  font-size: 12px;
  color: #B91C1C;
  cursor: pointer;
}
.saved-addr-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.saved-addr-item {
  background: #f9f9f9;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color .15s;
}
.saved-addr-item.active {
  border-color: #B91C1C;
  background: #fff5f5;
}
.saved-addr-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}
.saved-addr-detail {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.order-submit-area {
  padding: 16px 0 0;
  flex-shrink: 0;
}

.order-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.order-total-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-primary, #B91C1C);
  margin-left: 4px;
}
</style>
