<template>
  <div class="address-edit-page">
    <van-nav-bar :title="isEdit ? '编辑地址' : '新增地址'" left-arrow @click-left="$router.back()" />

    <van-loading v-if="pageLoading" class="page-loading" size="30" vertical>加载中...</van-loading>

    <div v-else class="form-wrap">
      <van-cell-group inset>
        <van-field v-model="form.contactName" label="联系人" placeholder="请输入联系人姓名" />
        <van-field v-model="form.contactPhone" label="联系电话" type="tel" placeholder="请输入联系电话" />
      </van-cell-group>

      <van-cell-group inset class="mt12">
        <div class="picker-trigger" @click="showCountryList = !showCountryList; showAreaPicker = false">
          <span class="picker-label">国家/地区</span>
          <span :class="['picker-value', { placeholder: !form.country }]">
            {{ countryDisplay || '请选择国家/地区' }}
          </span>
          <van-icon :name="showCountryList ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
        </div>
        <div v-if="showCountryList" class="select-list">
          <div
            v-for="c in countryColumns"
            :key="c"
            class="select-item"
            :class="{ active: form.country === c }"
            @click="selectCountry(c)"
          >
            <span>{{ c }}</span>
            <van-icon v-if="form.country === c" name="success" color="#B91C1C" size="16" />
          </div>
        </div>

        <van-field
          v-if="form.country === '其他'"
          v-model="form.customCountry"
          label="自定义国家"
          placeholder="请输入国家/地区名称"
        />

        <template v-if="form.country === '中国大陆'">
          <div class="picker-trigger" @click="showAreaPicker = !showAreaPicker; showCountryList = false">
            <span class="picker-label">省/市/区</span>
            <span :class="['picker-value', { placeholder: !form.province }]">
              {{ areaDisplay || '请选择省市区' }}
            </span>
            <van-icon :name="showAreaPicker ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
          </div>
          <div v-if="showAreaPicker" class="area-picker-wrap" @touchmove.stop @mousewheel.stop>
            <van-area
              :area-list="areaList"
              @confirm="onAreaConfirm"
              @cancel="showAreaPicker = false"
            />
          </div>
        </template>
      </van-cell-group>

      <van-cell-group inset class="mt12">
        <van-field v-model="form.detailAddress" label="详细地址" type="textarea" rows="2" placeholder="请输入小区/街道等具体地址" />
      </van-cell-group>

      <div class="default-switch">
        <span>设为默认地址</span>
        <van-switch v-model="form.isDefault" size="20" active-color="#B91C1C" />
      </div>

      <div class="app-fixed-bottom-shell">
        <div class="save-btn-wrap">
          <van-button type="primary" color="#B91C1C" block round :loading="saving" @click="onSave">
            保存
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addressApi } from '@/api';
import { showToast } from 'vant';
import { areaList } from '@vant/area-data';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const pageLoading = ref(false);
const saving = ref(false);
const showCountryList = ref(false);
const showAreaPicker = ref(false);

const countryColumns = [
  '中国大陆', '中国香港', '中国澳门', '中国台湾',
  '美国', '英国', '日本', '韩国', '新加坡', '澳大利亚',
  '加拿大', '德国', '法国', '马来西亚', '泰国', '其他',
];

const form = reactive({
  contactName: '',
  contactPhone: '',
  country: '',
  customCountry: '',
  province: '',
  city: '',
  district: '',
  detailAddress: '',
  isDefault: false,
});

const countryDisplay = computed(() => {
  if (form.country === '其他' && form.customCountry) return `其他 - ${form.customCountry}`;
  return form.country || '';
});

const areaDisplay = computed(() => {
  if (form.province) return `${form.province} ${form.city} ${form.district}`.trim();
  return '';
});

const selectCountry = (c) => {
  form.country = c;
  form.province = '';
  form.city = '';
  form.district = '';
  form.customCountry = '';
  showCountryList.value = false;
};

const onAreaConfirm = ({ selectedOptions }) => {
  form.province = selectedOptions[0]?.text || '';
  form.city = selectedOptions[1]?.text || '';
  form.district = selectedOptions[2]?.text || '';
  showAreaPicker.value = false;
};

const onSave = async () => {
  if (!form.contactName.trim()) { showToast('请输入联系人'); return; }
  if (!form.contactPhone.trim()) { showToast('请输入联系电话'); return; }
  if (!form.country) { showToast('请选择国家/地区'); return; }
  if (form.country === '其他' && !form.customCountry.trim()) { showToast('请输入国家/地区名称'); return; }
  if (form.country === '中国大陆' && !form.province) { showToast('请选择省市区'); return; }
  if (!form.detailAddress.trim()) { showToast('请输入详细地址'); return; }

  saving.value = true;
  try {
    if (isEdit.value) {
      await addressApi.update(route.params.id, { ...form });
    } else {
      await addressApi.create({ ...form });
    }
    showToast('保存成功');
    router.back();
  } catch (err) {
    showToast(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  if (isEdit.value) {
    pageLoading.value = true;
    try {
      const res = await addressApi.list();
      const addr = res.data.find(a => a.id === Number(route.params.id));
      if (addr) {
        Object.assign(form, {
          contactName: addr.contactName,
          contactPhone: addr.contactPhone,
          country: addr.country,
          customCountry: addr.customCountry,
          province: addr.province,
          city: addr.city,
          district: addr.district,
          detailAddress: addr.detailAddress,
          isDefault: addr.isDefault,
        });
      }
    } catch (err) {
      showToast('加载地址失败');
    } finally {
      pageLoading.value = false;
    }
  }
});
</script>

<style scoped>
.address-edit-page {
  background: var(--vino-bg, #f5f5f5);
  min-height: 100vh;
}
.page-loading { padding-top: 100px; text-align: center; }
.form-wrap { padding-bottom: 100px; }
.mt12 { margin-top: 12px; }

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
.picker-value.placeholder { color: #c8c9cc; }
.picker-arrow { margin-left: 4px; color: #969799; flex-shrink: 0; }

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
}
.select-item:active { background: #f5f5f5; }
.select-item.active { color: #B91C1C; font-weight: 500; }

.area-picker-wrap {
  border-bottom: 1px solid #f0f0f0;
  height: 260px;
  overflow: hidden;
}

.default-switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  margin: 12px 16px;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
}

.save-btn-wrap {
  position: relative;
  padding: 12px 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  border-radius: 12px 12px 0 0;
}
</style>
