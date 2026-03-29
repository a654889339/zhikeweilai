const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');
const ServiceCategory = require('./ServiceCategory');
const Order = require('./Order');
const OrderLog = require('./OrderLog');
const Address = require('./Address');
const DeviceGuide = require('./DeviceGuide');
const ProductCategory = require('./ProductCategory');
const HomeConfig = require('./HomeConfig');
const Message = require('./Message');
const InventoryCategory = require('./InventoryCategory');
const InventoryProduct = require('./InventoryProduct');
const UserProduct = require('./UserProduct');
const OutletUser = require('./OutletUser');
const OutletOrder = require('./OutletOrder');
const OutletOrderLog = require('./OutletOrderLog');
const OutletAddress = require('./OutletAddress');
const OutletHomeConfig = require('./OutletHomeConfig');
const OutletMessage = require('./OutletMessage');
const OutletServiceCategory = require('./OutletServiceCategory');
const OutletService = require('./OutletService');

ProductCategory.hasMany(DeviceGuide, { foreignKey: 'categoryId', as: 'guides' });
DeviceGuide.belongsTo(ProductCategory, { foreignKey: 'categoryId', as: 'category' });

ServiceCategory.hasMany(Service, { foreignKey: 'categoryId', as: 'services' });
Service.belongsTo(ServiceCategory, { foreignKey: 'categoryId', as: 'serviceCategory' });

OutletServiceCategory.hasMany(OutletService, { foreignKey: 'categoryId', as: 'services' });
OutletService.belongsTo(OutletServiceCategory, { foreignKey: 'categoryId', as: 'serviceCategory' });

InventoryCategory.hasMany(InventoryProduct, { foreignKey: 'categoryId', as: 'products' });
InventoryProduct.belongsTo(InventoryCategory, { foreignKey: 'categoryId', as: 'category' });

User.hasMany(UserProduct, { foreignKey: 'userId', as: 'boundProducts' });
UserProduct.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.hasMany(OrderLog, { foreignKey: 'orderId', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });

OutletUser.hasMany(OutletOrder, { foreignKey: 'userId', as: 'orders' });
OutletOrder.belongsTo(OutletUser, { foreignKey: 'userId', as: 'user' });
OutletOrder.hasMany(OutletOrderLog, { foreignKey: 'orderId', as: 'logs' });
OutletOrderLog.belongsTo(OutletOrder, { foreignKey: 'orderId', as: 'order' });
OutletUser.hasMany(OutletAddress, { foreignKey: 'userId', as: 'addresses' });
OutletAddress.belongsTo(OutletUser, { foreignKey: 'userId', as: 'user' });
OutletUser.hasMany(OutletMessage, { foreignKey: 'userId', as: 'messages' });
OutletMessage.belongsTo(OutletUser, { foreignKey: 'userId', as: 'user' });

const models = { User, Service, ServiceCategory, Order, OrderLog, Address, DeviceGuide, ProductCategory, HomeConfig, Message, InventoryCategory, InventoryProduct, UserProduct, OutletUser, OutletOrder, OutletOrderLog, OutletAddress, OutletHomeConfig, OutletMessage, OutletServiceCategory, OutletService };

const TABLE_PREFIX = process.env.TABLE_PREFIX || '';
// 通过运行时统一表名前缀实现“不同工程使用不同表”，避免读到其他工程的数据
if (TABLE_PREFIX) {
  for (const m of Object.values(models)) {
    if (m && m.options && typeof m.options.tableName === 'string' && !m.options.tableName.startsWith(TABLE_PREFIX)) {
      m.options.tableName = TABLE_PREFIX + m.options.tableName;
      m.tableName = m.options.tableName;
    }
  }
}

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'ZKWL@2026admin';
const ADMIN_EMAIL = 'admin@zhikeweilai.future';
const ADMIN_NICKNAME = '管理员';

// 管理后台登录页（authPage）的 headerLogo 默认配置
// 注意：HomeConfig.imageUrl 字段为 STRING(500)，因此不要放过长的 data URL。
const DEFAULT_HEADER_LOGO_URL =
  process.env.HEADER_LOGO_URL ||
  'https://zkwl-1256887166.cos.ap-guangzhou.myqcloud.com/vino/favicon.svg';

const INDEX_WARN_THRESHOLD = 20;
const INDEX_HARD_LIMIT = 64;

async function cleanDuplicateIndexes() {
  try {
    const [rows] = await sequelize.query(
      `SELECT TABLE_NAME, INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND INDEX_NAME != 'PRIMARY'
         AND INDEX_NAME REGEXP '_[0-9]+$'
       GROUP BY TABLE_NAME, INDEX_NAME
       ORDER BY TABLE_NAME, INDEX_NAME`
    );
    if (!rows.length) return;
    console.warn(`[DB-IndexGuard] Found ${rows.length} duplicate index(es), cleaning...`);
    for (const { TABLE_NAME, INDEX_NAME } of rows) {
      try {
        await sequelize.query(`DROP INDEX \`${INDEX_NAME}\` ON \`${TABLE_NAME}\``);
        console.warn(`[DB-IndexGuard] Dropped duplicate index ${TABLE_NAME}.${INDEX_NAME}`);
      } catch (e) {
        console.error(`[DB-IndexGuard] Failed to drop ${TABLE_NAME}.${INDEX_NAME}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('[DB-IndexGuard] cleanDuplicateIndexes error:', e.message);
  }
}

async function checkIndexHealth() {
  try {
    const [rows] = await sequelize.query(
      `SELECT TABLE_NAME, COUNT(DISTINCT INDEX_NAME) AS idx_count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
       GROUP BY TABLE_NAME
       HAVING idx_count >= ${INDEX_WARN_THRESHOLD}
       ORDER BY idx_count DESC`
    );
    for (const { TABLE_NAME, idx_count } of rows) {
      if (idx_count >= INDEX_HARD_LIMIT) {
        console.error(`[DB-IndexGuard] CRITICAL: ${TABLE_NAME} has ${idx_count} indexes (limit ${INDEX_HARD_LIMIT}), attempting auto-cleanup`);
        await cleanDuplicateIndexes();
        return false;
      }
      console.warn(`[DB-IndexGuard] WARNING: ${TABLE_NAME} has ${idx_count} indexes (threshold ${INDEX_WARN_THRESHOLD})`);
    }
    return true;
  } catch (e) {
    console.error('[DB-IndexGuard] checkIndexHealth error:', e.message);
    return true;
  }
}

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connection established successfully.');
    await cleanDuplicateIndexes();
    await sequelize.sync({ alter: true });
    console.log('[DB] All models synchronized.');
    const healthy = await checkIndexHealth();
    if (!healthy) {
      console.error('[DB-IndexGuard] Index anomaly detected after sync, cleaned duplicates. Re-checking...');
      const ok = await checkIndexHealth();
      if (!ok) console.error('[DB-IndexGuard] Index issue persists after cleanup. Manual intervention may be needed.');
    }

    // 管理员账号：存在则更新密码/邮箱，保证你每次重部署都能拿到可用账号
    const admin = await User.findOne({ where: { username: ADMIN_USERNAME } });
    if (!admin) {
      await User.create({
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        nickname: ADMIN_NICKNAME,
        role: 'admin',
      });
      console.log('[DB] Default admin account created.');
    } else {
      admin.email = ADMIN_EMAIL;
      admin.password = ADMIN_PASSWORD; // 由 User 的 beforeUpdate hook 做 hash
      admin.nickname = ADMIN_NICKNAME;
      admin.role = 'admin';
      admin.status = 'active';
      await admin.save();
      console.log('[DB] Default admin account updated.');
    }

    const catCount = await ProductCategory.count();
    if (catCount === 0) {
      await ProductCategory.bulkCreate([
        { name: '空调', sortOrder: 1 },
        { name: '除湿与储能', sortOrder: 2 },
      ]);
      console.log('[DB] Default product categories created.');
    }

    const guideCount = await DeviceGuide.count();
    if (guideCount === 0) {
      const [cat1, cat2] = await ProductCategory.findAll({ order: [['sortOrder', 'ASC']] });
      const seedGuides = [
        { name: '空调', subtitle: '家用/商用中央空调', icon: 'cluster-o', emoji: '❄️', gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', badge: '热门', sortOrder: 1, categoryId: cat1.id },
        { name: '除湿机', subtitle: '家用/工业除湿设备', icon: 'filter-o', emoji: '💧', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)', badge: '', sortOrder: 2, categoryId: cat2.id },
        { name: '光储一体机', subtitle: '户用光储一体解决方案', icon: 'fire-o', emoji: '☀️', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', badge: '新', sortOrder: 3, categoryId: cat2.id },
        { name: '光伏变电器', subtitle: '光伏发电变电设备', icon: 'balance-list-o', emoji: '⚡', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', badge: '', sortOrder: 4, categoryId: cat2.id },
        { name: '逆变器', subtitle: '光伏/储能逆变器', icon: 'replay', emoji: '🔌', gradient: 'linear-gradient(135deg, #10B981, #059669)', badge: '', sortOrder: 5, categoryId: cat2.id },
      ];
      const tagsData = [
        ['制冷维修','清洗保养','加氟充注','安装移机'],
        ['除湿维修','滤网更换','水箱清洁'],
        ['系统检测','电池维护','并网调试'],
        ['变压器检测','绝缘测试','效率优化'],
        ['故障诊断','固件升级','效率优化'],
      ];
      const sectionsData = [
        [{title:'常见故障',icon:'warning-o',tips:['不制冷/制热','漏水滴水','噪音异常','遥控器失灵','频繁启停']},{title:'保养建议',icon:'info-o',tips:['每月清洗滤网','每年专业深度清洗','定期检查制冷剂','室外机保持通风']}],
        [{title:'常见故障',icon:'warning-o',tips:['不除湿','噪音过大','漏水','显示屏异常']},{title:'保养建议',icon:'info-o',tips:['定期清洗滤网','及时排空水箱','保持进出风口通畅']}],
        [{title:'系统组成',icon:'info-o',tips:['光伏组件','储能电池','混合逆变器','智能监控']},{title:'维护要点',icon:'warning-o',tips:['定期检查光伏板清洁度','监控电池健康状态','检查线缆连接','软件系统更新']}],
        [{title:'检测项目',icon:'warning-o',tips:['绝缘电阻测试','变比测试','温升检测','噪声检测']},{title:'维护建议',icon:'info-o',tips:['定期清洁散热装置','检查接线端子','监控运行温度','定期绝缘测试']}],
        [{title:'常见故障',icon:'warning-o',tips:['不并网','功率不足','报错代码','通讯故障']},{title:'维护建议',icon:'info-o',tips:['保持通风散热','定期清洁滤网','检查直流端子','监控发电效率']}],
      ];
      for (let i = 0; i < seedGuides.length; i++) {
        await DeviceGuide.create({ ...seedGuides[i], slug: seedGuides[i].name === '空调' ? 'aircondition' : seedGuides[i].name === '除湿机' ? 'dehumidifier' : seedGuides[i].name === '光储一体机' ? 'solar-storage' : seedGuides[i].name === '光伏变电器' ? 'pv-inverter' : 'inverter', tags: tagsData[i], sections: sectionsData[i] });
      }
      console.log('[DB] Default device guides created.');
    }

    const hcCount = await HomeConfig.count();
    if (hcCount === 0) {
      const seed = [
        { section:'banner', title:'Vino 品质服务', desc:'专业·高效·可信赖', color:'linear-gradient(135deg, #B91C1C, #7F1D1D)', sortOrder:1 },
        { section:'banner', title:'新用户专享', desc:'首单立减 20 元', color:'linear-gradient(135deg, #1E40AF, #1E3A5F)', sortOrder:2 },
        { section:'banner', title:'企业解决方案', desc:'定制化一站式服务', color:'linear-gradient(135deg, #065F46, #064E3B)', sortOrder:3 },
        { section:'nav', title:'全部产品', icon:'apps-o', path:'/products', color:'#B91C1C', sortOrder:1 },
        { section:'nav', title:'预约', icon:'calendar-o', path:'/products', color:'#D97706', sortOrder:2 },
        { section:'nav', title:'维修', icon:'setting-o', path:'/products', color:'#2563EB', sortOrder:3 },
        { section:'nav', title:'咨询', icon:'chat-o', path:'/products', color:'#7C3AED', sortOrder:4 },
        { section:'nav', title:'安装', icon:'logistics', path:'/products', color:'#059669', sortOrder:5 },
        { section:'nav', title:'保养', icon:'shield-o', path:'/products', color:'#DC2626', sortOrder:6 },
        { section:'nav', title:'检测', icon:'scan', path:'/products', color:'#EA580C', sortOrder:7 },
        { section:'nav', title:'更多', icon:'more-o', path:'/products', color:'#6B7280', sortOrder:8 },
        { section:'hotService', title:'设备维修', desc:'专业工程师上门服务', price:'99', icon:'setting-o', color:'linear-gradient(135deg, #B91C1C, #991B1B)', path:'/products', sortOrder:1 },
        { section:'hotService', title:'深度清洁', desc:'全方位清洁保养', price:'149', icon:'brush-o', color:'linear-gradient(135deg, #2563EB, #1D4ED8)', path:'/products', sortOrder:2 },
        { section:'hotService', title:'系统检测', desc:'全面检测评估', price:'49', icon:'scan', color:'linear-gradient(135deg, #059669, #047857)', path:'/products', sortOrder:3 },
        { section:'hotService', title:'数据恢复', desc:'专业数据找回', price:'199', icon:'replay', color:'linear-gradient(135deg, #7C3AED, #6D28D9)', path:'/products', sortOrder:4 },
        { section:'recommend', title:'会员权益', desc:'专属折扣', icon:'vip-card-o', color:'linear-gradient(135deg, #F59E0B, #D97706)', sortOrder:1 },
        { section:'recommend', title:'服务保障', desc:'无忧售后', icon:'shield-o', color:'linear-gradient(135deg, #10B981, #059669)', sortOrder:2 },
        { section:'recommend', title:'积分商城', desc:'好礼兑换', icon:'gift-o', color:'linear-gradient(135deg, #EC4899, #DB2777)', sortOrder:3 },
        { section:'recommend', title:'邀请有礼', desc:'分享得佣金', icon:'friends-o', color:'linear-gradient(135deg, #6366F1, #4F46E5)', sortOrder:4 },
      ];
      await HomeConfig.bulkCreate(seed);
      console.log('[DB] Default home configs created.');
    }

    // 管理后台登录页 headerLogo：确保有值，避免 section=headerLogo 为空导致显示默认占位。
    const headerLogo = await HomeConfig.findOne({ where: { section: 'headerLogo' } });
    if (!headerLogo) {
      await HomeConfig.create({
        section: 'headerLogo',
        title: '管理后台Logo',
        desc: '',
        imageUrl: DEFAULT_HEADER_LOGO_URL,
        color: '',
        sortOrder: 0,
      });
      console.log('[DB] Default headerLogo created.');
    }

    return true;
  } catch (error) {
    console.error('[DB] Unable to connect:', error.message);
    return false;
  }
};

module.exports = { ...models, sequelize, syncDatabase };
