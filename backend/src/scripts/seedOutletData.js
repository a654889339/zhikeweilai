/**
 * Seed outlet test data: home config, anim config, mine config（已下线门店「服务」类目与接口，脚本不再写入 OutletService*）。
 * Run: node src/scripts/seedOutletData.js
 */
const path = require('path');
process.chdir(path.join(__dirname, '..', '..'));

async function main() {
  const { OutletHomeConfig, syncDatabase } = require('../models');
  await syncDatabase();

  const hcCount = await OutletHomeConfig.count();
  if (hcCount === 0) {
    await OutletHomeConfig.bulkCreate([
      { section: 'headerLogo', title: '服务商Logo', desc: '智科未来服务商', sortOrder: 1, status: 'active' },
      { section: 'homeBg', title: '服务商首页背景1', desc: '紫色渐变', color: 'linear-gradient(180deg, #7C3AED 0%, #4C1D95 100%)', sortOrder: 1, status: 'active' },
      { section: 'homeBg', title: '服务商首页背景2', desc: '深蓝渐变', color: 'linear-gradient(180deg, #1E40AF 0%, #1E3A5F 100%)', sortOrder: 2, status: 'active' },
      { section: 'splash', title: '服务商开场动画', desc: '即将进入智科未来服务商', sortOrder: 1, status: 'active' },
      { section: 'navLg', title: '全部产品', icon: 'apps-o', path: '/products', color: '#7C3AED', sortOrder: 1, status: 'active' },
      { section: 'navLg', title: '预约', icon: 'calendar-o', path: '/products', color: '#D97706', sortOrder: 2, status: 'active' },
      { section: 'navLg', title: '维修', icon: 'setting-o', path: '/products', color: '#2563EB', sortOrder: 3, status: 'active' },
      { section: 'navLg', title: '安装', icon: 'logistics', path: '/products', color: '#059669', sortOrder: 4, status: 'active' },
      { section: 'navSm', title: '咨询', icon: 'chat-o', path: '/products', color: '#B91C1C', sortOrder: 1, status: 'active' },
      { section: 'navSm', title: '检测', icon: 'scan', path: '/products', color: '#EA580C', sortOrder: 2, status: 'active' },
      { section: 'navSm', title: '保养', icon: 'shield-o', path: '/products', color: '#DC2626', sortOrder: 3, status: 'active' },
      { section: 'navSm', title: '更多', icon: 'more-o', path: '/products', color: '#6B7280', sortOrder: 4, status: 'active' },
      { section: 'hotService', title: '设备维修', desc: '专业工程师上门服务', price: '99', icon: 'setting-o', color: 'linear-gradient(135deg, #7C3AED, #6D28D9)', path: '/products', sortOrder: 1, status: 'active' },
      { section: 'hotService', title: '深度清洁', desc: '全方位清洁保养', price: '149', icon: 'brush-o', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)', path: '/products', sortOrder: 2, status: 'active' },
      { section: 'hotService', title: '全面检测', desc: '系统全面评估', price: '49', icon: 'scan', color: 'linear-gradient(135deg, #059669, #047857)', path: '/products', sortOrder: 3, status: 'active' },
      { section: 'hotService', title: '新设备安装', desc: '专业安装调试', price: '199', icon: 'logistics', color: 'linear-gradient(135deg, #B91C1C, #991B1B)', path: '/products', sortOrder: 4, status: 'active' },
      { section: 'recommend', title: '服务商权益', desc: '专属优惠折扣', icon: 'vip-card-o', color: 'linear-gradient(135deg, #F59E0B, #D97706)', sortOrder: 1, status: 'active' },
      { section: 'recommend', title: '质保服务', desc: '无忧售后保障', icon: 'shield-o', color: 'linear-gradient(135deg, #10B981, #059669)', sortOrder: 2, status: 'active' },
      { section: 'recommend', title: '配件商城', desc: '正品原装配件', icon: 'gift-o', color: 'linear-gradient(135deg, #EC4899, #DB2777)', sortOrder: 3, status: 'active' },
      { section: 'recommend', title: '推荐有礼', desc: '推荐得佣金', icon: 'friends-o', color: 'linear-gradient(135deg, #6366F1, #4F46E5)', sortOrder: 4, status: 'active' },
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
