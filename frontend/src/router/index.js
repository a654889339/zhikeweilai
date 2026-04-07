import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/products',
    name: 'Products',
    component: () => import('@/views/Products.vue'),
  },
  {
    path: '/courses',
    name: 'Courses',
    component: () => import('@/views/Courses.vue'),
  },
  {
    path: '/course/:id',
    name: 'CourseDetail',
    component: () => import('@/views/CourseDetail.vue'),
  },
  { path: '/services', redirect: '/products' },
  { path: '/service/:id', redirect: '/products' },
  {
    path: '/guide/:id',
    name: 'GuideDetail',
    component: () => import('@/views/GuideDetail.vue'),
  },
  {
    path: '/guide/:id/manual',
    name: 'ManualPage',
    component: () => import('@/views/ManualPage.vue'),
  },
  {
    path: '/guide/:id/maintenance',
    name: 'MaintenancePage',
    component: () => import('@/views/MaintenancePage.vue'),
  },
  {
    path: '/chatgroup',
    name: 'ChatGroup',
    component: () => import('@/views/ChatGroup.vue'),
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/Orders.vue'),
  },
  {
    path: '/mine',
    name: 'Mine',
    component: () => import('@/views/Mine.vue'),
  },
  {
    path: '/cart',
    name: 'Cart',
    component: () => import('@/views/Cart.vue'),
  },
  {
    path: '/checkout',
    name: 'Checkout',
    component: () => import('@/views/Checkout.vue'),
  },
  {
    path: '/mine/profile',
    name: 'ProfileEdit',
    component: () => import('@/views/ProfileEdit.vue'),
  },
  {
    path: '/mine/products',
    name: 'MyProducts',
    component: () => import('@/views/MyProducts.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
  },
  {
    path: '/address',
    name: 'AddressList',
    component: () => import('@/views/AddressList.vue'),
  },
  {
    path: '/address/add',
    name: 'AddressAdd',
    component: () => import('@/views/AddressEdit.vue'),
  },
  {
    path: '/address/edit/:id',
    name: 'AddressEditDetail',
    component: () => import('@/views/AddressEdit.vue'),
  },
  {
    path: '/bind-product',
    name: 'BindProduct',
    component: () => import('@/views/BindProduct.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
