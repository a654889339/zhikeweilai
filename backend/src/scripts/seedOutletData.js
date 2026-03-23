/**
 * Seed outlet test data: service categories, services, home config, anim config, mine config.
 * Run: node src/scripts/seedOutletData.js
 */
const path = require('path');
process.chdir(path.join(__dirname, '..', '..'));

async function main() {
  const { OutletServiceCategory, OutletService, OutletHomeConfig, syncDatabase } = require('../models');
  await syncDatabase();

  // 1. Service Categories
  const catCount = await OutletServiceCategory.count();
  if (catCount === 0) {
    await OutletServiceCategory.bulkCreate([
      { name: '维修', key: 'repair', sortOrder: 1, status: 'active' },
      { name: '清洁', key: 'clean', sortOrder: 2, status: 'active' },
      { name: '检测', key: 'inspect', sortOrder: 3, status: 'active' },
      { name: '安装', key: 'install', sortOrder: 4, status: 'active' },
    ]);
    console.log('[Seed] Outlet service categories created.');
  } else {
    console.log('[Seed] Outlet service categories already exist, skipping.');
  }

  // 2. Services
  const svcCount = await OutletService.count();
  if (svcCount === 0) {
    const cats = await OutletServiceCategory.findAll({ order: [['sortOrder', 'ASC']] });
    const catMap = {};
    cats.forEach(c => { catMap[c.key] = c.id; });
    await OutletService.bulkCreate([
      { categoryId: catMap.repair, title: '设备维修', description: '专业工程师提供全方位维修服务，品质保障。', icon: 'setting-o', price: 99, originPrice: 159, bg: '#B91C1C', sortOrder: 1 },
      { categoryId: catMap.repair, title: '上门维修', description: '快速响应，工程师2小时内上门服务。', icon: 'location-o', price: 149, originPrice: 199, bg: '#DC2626', sortOrder: 2 },
      { categoryId: catMap.repair, title: '远程支持', description: '在线视频指导，远程诊断问题。', icon: 'phone-o', price: 29, originPrice: 49, bg: '#EF4444', sortOrder: 3 },
      { categoryId: catMap.clean, title: '深度清洁', description: '全方位清洁保养，焕然一新。', icon: 'brush-o', price: 149, originPrice: 199, bg: '#2563EB', sortOrder: 1 },
      { categoryId: catMap.clean, title: '日常清洁', description: '基础维护清洁，保持良好状态。', icon: 'smile-o', price: 69, originPrice: 89, bg: '#3B82F6', sortOrder: 2 },
      { categoryId: catMap.inspect, title: '全面检测', description: '系统全面评估，发现潜在问题。', icon: 'scan', price: 49, originPrice: 79, bg: '#059669', sortOrder: 1 },
      { categoryId: catMap.inspect, title: '性能优化', description: '提速升级，优化系统性能。', icon: 'fire-o', price: 79, originPrice: 129, bg: '#10B981', sortOrder: 2 },
      { categoryId: catMap.install, title: '新设备安装', description: '专业安装调试，确保稳定运行。', icon: 'logistics', price: 199, originPrice: 299, bg: '#7C3AED', sortOrder: 1 },
      { categoryId: catMap.install, title: '设备迁移', description: '安全拆卸搬迁，重新安装到位。', icon: 'exchange', price: 249, originPrice: 399, bg: '#8B5CF6', sortOrder: 2 },
    ]);
    console.log('[Seed] Outlet services created.');
  } else {
    console.log('[Seed] Outlet services already exist, skipping.');
  }

  // 3. Home Config (首页配置 + 首页动画配置 + 个人中心配置)
  const hcCount = await OutletHomeConfig.count();
  if (hcCount === 0) {
    await OutletHomeConfig.bulkCreate([
      // 首页动画配置 - Logo
      { section: 'headerLogo', title: '服务商Logo', desc: '智科未来服务商', sortOrder: 1, status: 'active' },
      // 首页动画配置 - 背景
      { section: 'homeBg', title: '服务商首页背景1', desc: '紫色渐变', color: 'linear-gradient(180deg, #7C3AED 0%, #4C1D95 100%)', sortOrder: 1, status: 'active' },
      { section: 'homeBg', title: '服务商首页背景2', desc: '深蓝渐变', color: 'linear-gradient(180deg, #1E40AF 0%, #1E3A5F 100%)', sortOrder: 2, status: 'active' },
      // 首页动画配置 - 开场动画
      { section: 'splash', title: '服务商开场动画', desc: '即将进入智科未来服务商', sortOrder: 1, status: 'active' },
      // 首页配置 - 自助预约（大）
      { section: 'navLg', title: '全部服务', icon: 'apps-o', path: '/services', color: '#7C3AED', sortOrder: 1, status: 'active' },
      { section: 'navLg', title: '预约', icon: 'calendar-o', path: '/services', color: '#D97706', sortOrder: 2, status: 'active' },
      { section: 'navLg', title: '维修', icon: 'setting-o', path: '/services', color: '#2563EB', sortOrder: 3, status: 'active' },
      { section: 'navLg', title: '安装', icon: 'logistics', path: '/services', color: '#059669', sortOrder: 4, status: 'active' },
      // 首页配置 - 自助预约（小）
      { section: 'navSm', title: '咨询', icon: 'chat-o', path: '/services', color: '#B91C1C', sortOrder: 1, status: 'active' },
      { section: 'navSm', title: '检测', icon: 'scan', path: '/services', color: '#EA580C', sortOrder: 2, status: 'active' },
      { section: 'navSm', title: '保养', icon: 'shield-o', path: '/services', color: '#DC2626', sortOrder: 3, status: 'active' },
      { section: 'navSm', title: '更多', icon: 'more-o', path: '/services', color: '#6B7280', sortOrder: 4, status: 'active' },
      // 首页配置 - 自助服务（hotService）
      { section: 'hotService', title: '设备维修', desc: '专业工程师上门服务', price: '99', icon: 'setting-o', color: 'linear-gradient(135deg, #7C3AED, #6D28D9)', path: '/service/1', sortOrder: 1, status: 'active' },
      { section: 'hotService', title: '深度清洁', desc: '全方位清洁保养', price: '149', icon: 'brush-o', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)', path: '/service/2', sortOrder: 2, status: 'active' },
      { section: 'hotService', title: '全面检测', desc: '系统全面评估', price: '49', icon: 'scan', color: 'linear-gradient(135deg, #059669, #047857)', path: '/service/3', sortOrder: 3, status: 'active' },
      { section: 'hotService', title: '新设备安装', desc: '专业安装调试', price: '199', icon: 'logistics', color: 'linear-gradient(135deg, #B91C1C, #991B1B)', path: '/service/4', sortOrder: 4, status: 'active' },
      // 首页配置 - 服务产品（recommend）
      { section: 'recommend', title: '服务商权益', desc: '专属优惠折扣', icon: 'vip-card-o', color: 'linear-gradient(135deg, #F59E0B, #D97706)', sortOrder: 1, status: 'active' },
      { section: 'recommend', title: '质保服务', desc: '无忧售后保障', icon: 'shield-o', color: 'linear-gradient(135deg, #10B981, #059669)', sortOrder: 2, status: 'active' },
      { section: 'recommend', title: '配件商城', desc: '正品原装配件', icon: 'gift-o', color: 'linear-gradient(135deg, #EC4899, #DB2777)', sortOrder: 3, status: 'active' },
      { section: 'recommend', title: '推荐有礼', desc: '推荐得佣金', icon: 'friends-o', color: 'linear-gradient(135deg, #6366F1, #4F46E5)', sortOrder: 4, status: 'active' },
      // 个人中心配置
      { section: 'mineConfig', title: '服务商个人中心背景', desc: '紫色主题', color: 'linear-gradient(160deg, #1d1d1f 0%, #7C3AED 100%)', sortOrder: 1, status: 'active' },
    ]);
    console.log('[Seed] Outlet home configs created (home, anim, mine).');
  } else {
    console.log('[Seed] Outlet home configs already exist, skipping.');
  }

  console.log('[Seed] All done!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
