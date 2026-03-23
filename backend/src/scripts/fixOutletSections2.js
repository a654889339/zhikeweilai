/**
 * Fix outlet_home_configs: split navLg/navSm properly, handle stray banner item.
 */
const path = require('path');
process.chdir(path.join(__dirname, '..', '..'));

async function main() {
  const { OutletHomeConfig, syncDatabase } = require('../models');
  await syncDatabase();

  // 1. Delete the stray "banner" item that got renamed to navLg (id=8, title="banner")
  const banner = await OutletHomeConfig.findOne({ where: { section: 'navLg', title: 'banner' } });
  if (banner) {
    await banner.destroy();
    console.log('[Fix] Deleted stray banner item (id=' + banner.id + ')');
  }

  // 2. Move items 5-8 (咨询,检测,保养,更多) from navLg to navSm
  const navSmTitles = ['咨询', '检测', '保养', '更多'];
  let order = 1;
  for (const title of navSmTitles) {
    const item = await OutletHomeConfig.findOne({ where: { section: 'navLg', title } });
    if (item) {
      await item.update({ section: 'navSm', sortOrder: order++ });
      console.log(`[Fix] Moved "${title}" from navLg to navSm (sortOrder=${order - 1})`);
    }
  }

  // 3. Fix navLg sortOrder (全部服务=1, 预约=2, 维修=3, 安装=4)
  const navLgTitles = ['全部服务', '预约', '维修', '安装'];
  order = 1;
  for (const title of navLgTitles) {
    const item = await OutletHomeConfig.findOne({ where: { section: 'navLg', title } });
    if (item) {
      await item.update({ sortOrder: order++ });
    }
  }

  // Verify final state
  const all = await OutletHomeConfig.findAll({ order: [['section', 'ASC'], ['sortOrder', 'ASC']] });
  console.log('[Fix] Final outlet home config:');
  for (const item of all) {
    console.log(`  id=${item.id}  section=${item.section}  title=${item.title}  sortOrder=${item.sortOrder}`);
  }

  console.log('[Fix2] Done!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
