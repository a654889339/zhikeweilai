/**
 * Fix outlet_home_configs section names to match frontend expectations.
 * Run: node src/scripts/fixOutletSections.js
 */
const path = require('path');
process.chdir(path.join(__dirname, '..', '..'));

async function main() {
  const { OutletHomeConfig, syncDatabase } = require('../models');
  await syncDatabase();

  const renames = [
    { from: 'headerBg', to: 'homeBg' },
    { from: 'nav', to: 'navLg' },
    { from: 'navSmall', to: 'navSm' },
    { from: 'banner', to: 'navLg' },
    { from: 'myProduct', to: 'myProducts' },
  ];

  for (const { from, to } of renames) {
    const [count] = await OutletHomeConfig.update(
      { section: to },
      { where: { section: from } }
    );
    if (count > 0) {
      console.log(`[Fix] Renamed section "${from}" -> "${to}" (${count} rows)`);
    }
  }

  // Also ensure nav items that were seeded as 'nav' are now 'navLg'
  const all = await OutletHomeConfig.findAll({ order: [['section', 'ASC'], ['sortOrder', 'ASC']] });
  console.log('[Fix] Current outlet home config data:');
  for (const item of all) {
    console.log(`  id=${item.id}  section=${item.section}  title=${item.title}  sortOrder=${item.sortOrder}`);
  }

  console.log('[Fix] Done!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
