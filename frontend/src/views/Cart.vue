<template>
  <div class="cart-page">
    <div class="cart-inner">
      <van-empty description="购物车是空的">
        <van-button type="primary" round block class="cart-btn" @click="$router.push('/products')">
          去选购
        </van-button>
      </van-empty>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.cart-page {
  min-height: 100vh;
  background: var(--vino-bg);
  padding: 16px;
  box-sizing: border-box;
}
.cart-inner {
  padding-top: 24px;
}
.cart-btn {
  margin-top: 16px;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}
</style>
