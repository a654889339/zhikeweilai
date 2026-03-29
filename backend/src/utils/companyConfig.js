const HomeConfig = require('../models/HomeConfig');

let cache = { v: null, exp: 0 };

async function getCompanyName() {
  const now = Date.now();
  if (cache.exp > now && cache.v) return cache.v;
  try {
    const row = await HomeConfig.findOne({
      where: { section: 'companyName', status: 'active' },
      order: [['id', 'DESC']],
    });
    const name = row && row.title ? String(row.title).trim() : '';
    cache = { v: name || '智科未来', exp: now + 60 * 1000 };
    return cache.v;
  } catch {
    cache = { v: '智科未来', exp: now + 10 * 1000 };
    return cache.v;
  }
}

module.exports = { getCompanyName };

