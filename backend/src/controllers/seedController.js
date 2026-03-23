const crypto = require('crypto');
const { User, InventoryCategory, InventoryProduct } = require('../models');

const FIRST_NAMES = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '胡', '朱', '郭', '何', '林', '罗', '梁'];
const LAST_NAMES = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋', '勇', '军', '杰', '娟', '涛', '明', '超', '华', '平', '刚', '飞', '玲', '桂英', '艳', '萍'];
const PRODUCT_PREFIXES = ['空调', '冰箱', '洗衣机', '热水器', '油烟机', '电视', '微波炉', '净水器', '扫地机', '风扇', '加湿器', '除湿机', '烤箱', '电磁炉', '咖啡机'];
const PRODUCT_SUFFIXES = ['Pro', 'Max', 'Plus', 'Lite', 'Air', 'Ultra', 'Smart', 'Mini', 'Elite', 'S'];
const TAGS_POOL = ['新品', '热销', '特价', '经典', '智能', '节能', '进口', '国产', '家用', '商用'];

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

exports.seedData = async (req, res) => {
  try {
    const userCount = parseInt(req.query.users) || 10000;
    const productCount = parseInt(req.query.products) || 10000;

    let categories = await InventoryCategory.findAll({ raw: true });
    if (!categories.length) {
      const defaultCats = ['空调', '冰箱', '洗衣机', '热水器', '其他'];
      for (const name of defaultCats) {
        await InventoryCategory.create({ name, sortOrder: 0, status: 'active' });
      }
      categories = await InventoryCategory.findAll({ raw: true });
    }
    const catIds = categories.map(c => c.id);

    // Batch create users
    const BATCH = 500;
    let createdUsers = 0;
    for (let i = 0; i < userCount; i += BATCH) {
      const batch = [];
      const size = Math.min(BATCH, userCount - i);
      for (let j = 0; j < size; j++) {
        const idx = i + j;
        const hex = crypto.randomBytes(4).toString('hex');
        const phone = '1' + String(randInt(30, 99)) + String(idx).padStart(8, '0').slice(-8);
        batch.push({
          username: `test_${hex}_${idx}`,
          password: '$2b$10$dummyHashForSeedDataOnly00000000000000000000000000',
          email: `test${idx}_${hex}@seed.local`,
          phone,
          nickname: randItem(FIRST_NAMES) + randItem(LAST_NAMES) + randInt(1, 999),
          role: 'user',
          status: 'active',
        });
      }
      await User.bulkCreate(batch, { ignoreDuplicates: true });
      createdUsers += size;
    }

    // Batch create inventory products
    let createdProducts = 0;
    for (let i = 0; i < productCount; i += BATCH) {
      const batch = [];
      const size = Math.min(BATCH, productCount - i);
      for (let j = 0; j < size; j++) {
        const idx = i + j;
        const hex = crypto.randomBytes(3).toString('hex');
        const tagCount = randInt(0, 3);
        const tags = [];
        for (let t = 0; t < tagCount; t++) tags.push(randItem(TAGS_POOL));
        batch.push({
          categoryId: randItem(catIds),
          name: randItem(PRODUCT_PREFIXES) + ' ' + randItem(PRODUCT_SUFFIXES) + '-' + hex.toUpperCase(),
          serialNumber: `SN${String(idx).padStart(6, '0')}${hex.toUpperCase()}`,
          guideSlug: '',
          sortOrder: randInt(0, 100),
          status: Math.random() > 0.1 ? 'active' : 'inactive',
          tags: [...new Set(tags)].join(','),
        });
      }
      await InventoryProduct.bulkCreate(batch, { ignoreDuplicates: true });
      createdProducts += size;
    }

    res.json({ code: 0, message: `已生成 ${createdUsers} 个用户、${createdProducts} 个库存商品` });
  } catch (err) {
    console.error('[Seed] seedData error:', err.message);
    res.status(500).json({ code: 500, message: '生成测试数据失败：' + err.message });
  }
};
