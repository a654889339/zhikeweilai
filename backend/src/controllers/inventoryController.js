const { InventoryCategory, InventoryProduct, UserProduct } = require('../models');

/** 管理端：种类列表 */
exports.listCategories = async (req, res) => {
  try {
    const list = await InventoryCategory.findAll({
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error('[Inventory] listCategories error:', err.message);
    res.status(500).json({ code: 500, message: '获取种类列表失败' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, sortOrder, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '种类名称不能为空' });
    const cat = await InventoryCategory.create({
      name: name.trim(),
      sortOrder: parseInt(sortOrder, 10) || 0,
      status: status || 'active',
    });
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[Inventory] createCategory error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const cat = await InventoryCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const { name, sortOrder, status } = req.body;
    if (name !== undefined) cat.name = name.trim();
    if (sortOrder !== undefined) cat.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) cat.status = status;
    await cat.save();
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[Inventory] updateCategory error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.removeCategory = async (req, res) => {
  try {
    const cat = await InventoryCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const count = await InventoryProduct.count({ where: { categoryId: cat.id } });
    if (count > 0) return res.status(400).json({ code: 400, message: '该种类下还有商品，请先删除或移出商品' });
    await cat.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Inventory] removeCategory error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

/** 管理端：商品列表（支持种类、状态筛选与名称/序列号关键词查找，支持分页） */
exports.listProducts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { categoryId, status, keyword, tag, page = 1, pageSize = 50 } = req.query;
    const where = {};
    if (categoryId != null && categoryId !== '') where.categoryId = categoryId;
    if (status != null && status !== '') where.status = status;
    if (tag != null && String(tag).trim() !== '') {
      where.tags = { [Op.like]: '%' + String(tag).trim().replace(/%/g, '\\%') + '%' };
    }
    if (keyword != null && String(keyword).trim() !== '') {
      const kw = '%' + String(keyword).trim().replace(/%/g, '\\%') + '%';
      where[Op.or] = where[Op.or] || [];
      where[Op.or].push(
        { name: { [Op.like]: kw } },
        { serialNumber: { [Op.like]: kw } },
      );
    }
    const pg = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(200, parseInt(pageSize)));
    const { count, rows } = await InventoryProduct.findAndCountAll({
      where,
      include: [{ model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }],
      order: [['categoryId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
      limit: ps,
      offset: (pg - 1) * ps,
    });
    const serialNumbers = rows.map(p => p.serialNumber);
    const bindings = serialNumbers.length ? await UserProduct.findAll({
      where: { productKey: serialNumbers },
      attributes: ['userId', 'productKey'],
      raw: true,
    }) : [];
    const boundByProduct = {};
    bindings.forEach(b => {
      if (!boundByProduct[b.productKey]) boundByProduct[b.productKey] = [];
      boundByProduct[b.productKey].push(b.userId);
    });
    const data = rows.map(p => {
      const plain = p.toJSON ? p.toJSON() : p;
      plain.boundUserIds = boundByProduct[p.serialNumber] || [];
      return plain;
    });
    res.json({ code: 0, data: { list: data, total: count, page: pg, pageSize: ps } });
  } catch (err) {
    console.error('[Inventory] listProducts error:', err.message);
    res.status(500).json({ code: 500, message: '获取商品列表失败' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { categoryId, name, serialNumber, guideSlug, sortOrder, status, tags } = req.body;
    if (!categoryId) return res.status(400).json({ code: 400, message: '请选择种类' });
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '商品名称不能为空' });
    if (!serialNumber || !String(serialNumber).trim()) return res.status(400).json({ code: 400, message: '序列号不能为空' });
    const sn = String(serialNumber).trim();
    const existing = await InventoryProduct.findOne({ where: { serialNumber: sn } });
    if (existing) return res.status(400).json({ code: 400, message: '该序列号已存在' });
    const cat = await InventoryCategory.findByPk(categoryId);
    if (!cat) return res.status(400).json({ code: 400, message: '种类不存在' });
    const product = await InventoryProduct.create({
      categoryId,
      name: name.trim(),
      serialNumber: sn,
      guideSlug: guideSlug != null ? String(guideSlug).trim() : '',
      sortOrder: parseInt(sortOrder, 10) || 0,
      status: status || 'active',
      tags: tags != null ? String(tags).trim() : '',
    });
    res.json({ code: 0, data: product });
  } catch (err) {
    console.error('[Inventory] createProduct error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await InventoryProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ code: 404, message: '商品不存在' });
    const { categoryId, name, serialNumber, guideSlug, sortOrder, status, tags } = req.body;
    if (categoryId != null) product.categoryId = categoryId;
    if (name !== undefined) product.name = name.trim();
    if (tags !== undefined) product.tags = String(tags).trim();
    if (serialNumber !== undefined && String(serialNumber).trim()) {
      const sn = String(serialNumber).trim();
      if (sn !== product.serialNumber) {
        const existing = await InventoryProduct.findOne({ where: { serialNumber: sn } });
        if (existing) return res.status(400).json({ code: 400, message: '该序列号已被其他商品使用' });
        product.serialNumber = sn;
      }
    }
    if (guideSlug !== undefined) product.guideSlug = String(guideSlug).trim();
    if (sortOrder !== undefined) product.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) product.status = status;
    await product.save();
    res.json({ code: 0, data: product });
  } catch (err) {
    console.error('[Inventory] updateProduct error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.removeProduct = async (req, res) => {
  try {
    const product = await InventoryProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ code: 404, message: '商品不存在' });
    await product.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Inventory] removeProduct error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

function buildProductBindUrl(product) {
  const frontendBase = process.env.FRONTEND_URL || 'http://106.54.50.88:5301';
  let bindUrl = `${frontendBase}/bind-product?sn=${encodeURIComponent(product.serialNumber)}`;
  if (product.guideSlug && String(product.guideSlug).trim()) {
    bindUrl += '&guide=' + encodeURIComponent(String(product.guideSlug).trim());
  }
  return bindUrl;
}

/** 管理端：生成绑定用二维码 URL 及图片（dataUrl 供前端展示） */
exports.getBindQrUrl = async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const product = await InventoryProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ code: 404, message: '商品不存在' });
    const bindUrl = buildProductBindUrl(product);
    const dataUrl = await QRCode.toDataURL(bindUrl, { width: 400, margin: 2 });
    res.json({ code: 0, data: { url: bindUrl, serialNumber: product.serialNumber, dataUrl } });
  } catch (err) {
    console.error('[Inventory] getBindQrUrl error:', err.message);
    res.status(500).json({ code: 500, message: '获取失败' });
  }
};

/** Excel 列名（与示例一致） */
const EXCEL_COLS = ['种类名称', '商品名称', '序列号', '商品配置', '排序', '状态', '标签'];

/** 管理端：导入 Excel 批量添加商品。请求体为 multipart，字段名 file */
exports.importExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ code: 400, message: '请上传 Excel 文件' });
    }
    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    if (!rows.length) return res.json({ code: 0, data: { success: 0, failed: [], message: '表格为空' } });
    const header = rows[0].map(c => String(c).trim());
    const dataRows = rows.slice(1);
    const categories = await InventoryCategory.findAll();
    const byName = {};
    categories.forEach(c => { byName[c.name] = c.id; });
    let success = 0;
    const failed = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const get = (col) => {
        const idx = header.indexOf(col);
        if (idx === -1) return '';
        const v = row[idx];
        return v != null ? String(v).trim() : '';
      };
      const categoryName = get('种类名称');
      const name = get('商品名称');
      const serialNumber = get('序列号');
      const guideSlug = get('商品配置');
      const sortOrder = parseInt(get('排序'), 10) || 0;
      const statusRaw = get('状态');
      const status = statusRaw === '停用' || statusRaw === 'inactive' ? 'inactive' : 'active';
      const tags = get('标签');
      if (!categoryName || !name || !serialNumber) {
        failed.push({ row: i + 2, reason: '种类名称、商品名称、序列号不能为空' });
        continue;
      }
      const categoryId = byName[categoryName];
      if (!categoryId) {
        failed.push({ row: i + 2, reason: `种类“${categoryName}”不存在` });
        continue;
      }
      const sn = serialNumber;
      const existing = await InventoryProduct.findOne({ where: { serialNumber: sn } });
      if (existing) {
        failed.push({ row: i + 2, reason: '序列号已存在' });
        continue;
      }
      await InventoryProduct.create({
        categoryId,
        name,
        serialNumber: sn,
        guideSlug: guideSlug || '',
        sortOrder,
        status,
        tags: tags || '',
      });
      success++;
    }
    res.json({ code: 0, data: { success, failed, message: `成功导入 ${success} 条${failed.length ? `，失败 ${failed.length} 条` : ''}` } });
  } catch (err) {
    console.error('[Inventory] importExcel error:', err.message);
    res.status(500).json({ code: 500, message: '导入失败：' + err.message });
  }
};

/** 管理端：按当前筛选条件导出商品为 Excel（查询参数与 listProducts 一致） */
exports.exportProducts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { categoryId, status, keyword, tag } = req.query;
    const where = {};
    if (categoryId != null && categoryId !== '') where.categoryId = categoryId;
    if (status != null && status !== '') where.status = status;
    if (tag != null && String(tag).trim() !== '') {
      where.tags = { [Op.like]: '%' + String(tag).trim().replace(/%/g, '\\%') + '%' };
    }
    if (keyword != null && String(keyword).trim() !== '') {
      const kw = '%' + String(keyword).trim().replace(/%/g, '\\%') + '%';
      where[Op.or] = where[Op.or] || [];
      where[Op.or].push(
        { name: { [Op.like]: kw } },
        { serialNumber: { [Op.like]: kw } },
      );
    }
    const list = await InventoryProduct.findAll({
      where,
      include: [{ model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }],
      order: [['categoryId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    const serialNumbers = list.map(p => p.serialNumber);
    const bindings = await UserProduct.findAll({
      where: { productKey: serialNumbers },
      attributes: ['userId', 'productKey'],
      raw: true,
    });
    const boundByProduct = {};
    bindings.forEach(b => {
      if (!boundByProduct[b.productKey]) boundByProduct[b.productKey] = [];
      boundByProduct[b.productKey].push(b.userId);
    });
    const formatDate = (d) => {
      if (!d) return '';
      const t = new Date(d);
      return isNaN(t.getTime()) ? '' : t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    };
    const QRCode = require('qrcode');
    const ExcelJS = require('exceljs');
    const header = ['ID', '种类', '名称', '序列号', '商品配置', '排序', '状态', '标签', '添加时间', '被绑定用户ID', '绑定链接', '绑定二维码'];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('库存商品', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true };
    ws.columns = [
      { width: 8 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 14 },
      { width: 8 }, { width: 8 }, { width: 20 }, { width: 20 }, { width: 22 },
      { width: 48 }, { width: 16 },
    ];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const bindUrl = buildProductBindUrl(p);
      const row = ws.addRow([
        p.id,
        p.category ? p.category.name : '',
        p.name || '',
        p.serialNumber || '',
        p.guideSlug || '',
        p.sortOrder ?? 0,
        p.status === 'inactive' ? '禁用' : '启用',
        p.tags || '',
        formatDate(p.createdAt),
        (boundByProduct[p.serialNumber] || []).join(', '),
        bindUrl,
        '',
      ]);
      row.height = 96;
      try {
        const pngBuffer = await QRCode.toBuffer(bindUrl, { type: 'png', width: 160, margin: 1 });
        const imgId = wb.addImage({ buffer: pngBuffer, extension: 'png' });
        const rowIdx = i + 1;
        ws.addImage(imgId, {
          tl: { col: 11, row: rowIdx },
          ext: { width: 100, height: 100 },
        });
      } catch (qrErr) {
        console.error('[Inventory] export QR error:', qrErr.message);
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    const filename = 'inventory_products_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('[Inventory] exportProducts error:', err.message);
    res.status(500).json({ code: 500, message: '导出失败：' + err.message });
  }
};

/** 管理端：下载示例 Excel */
exports.getSampleExcel = (req, res) => {
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      EXCEL_COLS,
      ['空调', '示例商品A', 'AC001', 'aircondition', 0, '启用', '常用,新品'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '库存商品导入');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_import_sample.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('[Inventory] getSampleExcel error:', err.message);
    res.status(500).json({ code: 500, message: '生成示例文件失败' });
  }
};

/** 批量删除 Excel 列名 */
const DELETE_EXCEL_COLS = ['序列号', '商品名称（选填，仅作对照）'];

/** 管理端：按 Excel 批量删除商品。Excel 首列为「序列号」，按序列号删除 */
exports.batchDeleteByExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ code: 400, message: '请上传 Excel 文件' });
    }
    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    if (!rows.length) return res.json({ code: 0, data: { deleted: 0, failed: [], message: '表格为空' } });
    const header = rows[0].map(c => String(c).trim());
    const serialNumberIdx = header.indexOf('序列号');
    if (serialNumberIdx === -1) {
      return res.status(400).json({ code: 400, message: 'Excel 中需包含「序列号」列' });
    }
    const dataRows = rows.slice(1);
    let deleted = 0;
    const failed = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const sn = row[serialNumberIdx] != null ? String(row[serialNumberIdx]).trim() : '';
      if (!sn) {
        failed.push({ row: i + 2, serialNumber: sn || '(空)', reason: '序列号为空' });
        continue;
      }
      const product = await InventoryProduct.findOne({ where: { serialNumber: sn } });
      if (!product) {
        failed.push({ row: i + 2, serialNumber: sn, reason: '未找到该序列号商品' });
        continue;
      }
      await product.destroy();
      deleted++;
    }
    res.json({ code: 0, data: { deleted, failed, message: `成功删除 ${deleted} 条${failed.length ? `，失败 ${failed.length} 条` : ''}` } });
  } catch (err) {
    console.error('[Inventory] batchDeleteByExcel error:', err.message);
    res.status(500).json({ code: 500, message: '批量删除失败：' + err.message });
  }
};

/** 管理端：下载批量删除示例 Excel */
exports.getSampleDeleteExcel = (req, res) => {
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      DELETE_EXCEL_COLS,
      ['AC001'],
      ['AC123456'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '批量删除');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_delete_sample.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('[Inventory] getSampleDeleteExcel error:', err.message);
    res.status(500).json({ code: 500, message: '生成示例文件失败' });
  }
};
