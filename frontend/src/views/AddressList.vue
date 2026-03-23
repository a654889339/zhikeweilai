<template>
  <div class="address-page">
    <van-nav-bar title="地址管理" left-arrow @click-left="$router.back()" />

    <van-pull-refresh v-model="refreshing" @refresh="loadAddresses">
      <div class="address-list" v-if="addresses.length">
        <van-swipe-cell v-for="addr in addresses" :key="addr.id">
          <div class="address-card" @click="onEdit(addr)">
            <div class="addr-header">
              <span class="addr-name">{{ addr.contactName }}</span>
              <span class="addr-phone">{{ addr.contactPhone }}</span>
              <van-tag v-if="addr.isDefault" type="primary" color="#B91C1C" size="mini">默认</van-tag>
            </div>
            <div class="addr-detail">{{ formatAddress(addr) }}</div>
            <div class="addr-actions">
              <div class="addr-default" @click.stop="onSetDefault(addr)" v-if="!addr.isDefault">
                <van-icon name="circle" size="16" color="#ccc" />
                <span>设为默认</span>
              </div>
              <div class="addr-default active" v-else>
                <van-icon name="checked" size="16" color="#B91C1C" />
                <span>默认地址</span>
              </div>
              <div class="addr-btns">
                <span class="addr-btn" @click.stop="onEdit(addr)">
                  <van-icon name="edit" size="14" /> 编辑
                </span>
                <span class="addr-btn delete" @click.stop="onDelete(addr)">
                  <van-icon name="delete-o" size="14" /> 删除
                </span>
              </div>
            </div>
          </div>
          <template #right>
            <van-button square type="danger" text="删除" class="swipe-delete" @click="onDelete(addr)" />
          </template>
        </van-swipe-cell>
      </div>

      <van-empty v-else-if="!loading" description="暂无收货地址" image="search" />
    </van-pull-refresh>

    <van-loading v-if="loading" class="page-loading" size="30" vertical>加载中...</van-loading>

    <div class="add-btn-wrap">
      <van-button type="primary" color="#B91C1C" block round icon="plus" @click="$router.push('/address/add')">
        新增地址
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { addressApi } from '@/api';
import { showToast, showConfirmDialog } from 'vant';

const router = useRouter();
const addresses = ref([]);
const loading = ref(true);
const refreshing = ref(false);

const formatAddress = (addr) => {
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
};

const loadAddresses = async () => {
  try {
    const res = await addressApi.list();
    addresses.value = res.data;
  } catch (err) {
    showToast(err.message || '加载失败');
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const onEdit = (addr) => {
  router.push(`/address/edit/${addr.id}`);
};

const onDelete = async (addr) => {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除该地址吗？` });
    await addressApi.remove(addr.id);
    showToast('已删除');
    loadAddresses();
  } catch {}
};

const onSetDefault = async (addr) => {
  try {
    await addressApi.setDefault(addr.id);
    showToast('已设为默认');
    loadAddresses();
  } catch (err) {
    showToast(err.message || '操作失败');
  }
};

onMounted(loadAddresses);
</script>

<style scoped>
.address-page {
  background: var(--vino-bg, #f5f5f5);
  min-height: 100vh;
  padding-bottom: 80px;
}
.page-loading { padding-top: 100px; text-align: center; }
.address-list { padding: 12px; }
.address-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 10px;
}
.addr-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.addr-name { font-size: 16px; font-weight: 600; }
.addr-phone { font-size: 14px; color: #666; }
.addr-detail { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 10px; }
.addr-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f5f5f5;
}
.addr-default {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
  cursor: pointer;
}
.addr-default.active { color: #B91C1C; }
.addr-btns { display: flex; gap: 16px; }
.addr-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}
.addr-btn.delete { color: #ee0a24; }
.add-btn-wrap {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 750px;
  margin: 0 auto;
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}
.swipe-delete { height: 100%; }
</style>
