/**
 * 从「产品测试图」目录扫描商品，仅通过后台开放接口创建：
 * - GET/POST /api/product-categories
 * - POST /api/guides/admin/upload
 * - POST/PUT /api/guides/admin
 * - POST /api/inventory/products
 *
 * 用法（PowerShell）:
 *   $env:ZKWL_API="http://106.54.50.88:5302"
 *   $env:ZKWL_TOKEN="管理员 JWT"   # 或见下方用户名密码登录
 *   $env:ZKWL_SOURCE="C:\...\产品测试图"
 *   node scripts/import-product-test-images.mjs
 *
 *   $env:ZKWL_ADMIN_USERNAME="admin"; $env:ZKWL_ADMIN_PASSWORD="***"
 *
 * 干跑（只打印计划，不调 API）:
 *   $env:ZKWL_DRY_RUN="1"
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API = (process.env.ZKWL_API || 'http://106.54.50.88:5302').replace(/\/$/, '');
const SOURCE = process.env.ZKWL_SOURCE || path.join(
  'C:',
  'Users',
  'Administrator',
  'Documents',
  'xwechat_files',
  'w_654889339_7348',
  'msg',
  'file',
  '2026-04',
  '产品测试图'
);
const DRY = process.env.ZKWL_DRY_RUN === '1' || process.env.ZKWL_DRY === '1';

/** 开学课程 → 一级「开学」、二级「课程」 */
const KAI_XUE_KE_CHENG = '开学课程';

/** 仅这些目录下「多图合一商品」：同文件夹内一张主标价图 + 附属图 */
const LOOSE_MERGE_FOLDERS = new Set([
  '儿童实验家拓展实验盒',
  '小学科学实验盒',
  '小学科学实验测试材料包',
]);

function slugifyUnique(seed) {
  const h = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return `pt-${h}`;
}

/** 从「名称 12.5元」类字符串解析 */
function parseNamePriceFromFolderName(dirName) {
  const s = dirName.trim();
  const m = s.match(/^(.+?)\s*([\d.]+)\s*元\s*$/);
  if (m) return { name: m[1].trim(), price: parseFloat(m[2]) };
  const m2 = s.match(/^(.+?)\s+([\d.]+)\s*元\s*$/);
  if (m2) return { name: m2[1].trim(), price: parseFloat(m2[2]) };
  return null;
}

/** 从文件名解析：…价格398.jpg、价格10万元.png、实验家 268元.png 等 */
function parseNamePriceFromFileName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  let name = base;
  let price = 0;
  const wan = base.match(/价格\s*([\d.]+)\s*万/);
  const p1 = base.match(/价格\s*([\d.]+)(?!\s*万)/);
  const p2 = base.match(/([\d.]+)\s*元/);
  if (wan) price = parseFloat(wan[1]) * 10000;
  else if (p1) price = parseFloat(p1[1]);
  else if (p2) price = parseFloat(p2[1]);
  if (wan || p1) name = base.split(/价格/)[0].replace(/[，,]\s*$/, '').trim();
  else if (p2) name = base.replace(/\s*[\d.]+\s*元\s*$/, '').replace(/[，,]\s*$/, '').trim();
  return { name: name || base, price };
}

let token = process.env.ZKWL_TOKEN || '';

async function api(method, pathname, body, form) {
  const url = `${API}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  if (form) {
    res = await fetch(url, { method, headers, body: form });
  } else {
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    } else {
      res = await fetch(url, { method, headers });
    }
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`非 JSON 响应 ${res.status}: ${text.slice(0, 200)}`);
  }
  if (json.code !== 0) {
    const err = new Error(json.message || `API 错误 code=${json.code}`);
    err.payload = json;
    throw err;
  }
  return json.data;
}

async function login() {
  const u = process.env.ZKWL_ADMIN_USERNAME;
  const p = process.env.ZKWL_ADMIN_PASSWORD;
  if (!u || !p) return;
  const data = await api('POST', '/api/auth/login', { username: u, password: p });
  token = data.token;
}

async function uploadFile(absPath) {
  const buf = fs.readFileSync(absPath);
  const name = path.basename(absPath);
  const ext = path.extname(name).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.gif'
          ? 'image/gif'
          : 'application/octet-stream';
  const form = new FormData();
  const blob = new Blob([buf], { type: mime });
  form.append('file', blob, name);
  return api('POST', '/api/guides/admin/upload', undefined, form);
}

/** @returns {{ l1: string, l2: string }} */
function resolveCategoriesFromPath(relDirParts) {
  const parts = relDirParts.filter(Boolean);
  if (parts.length === 0) return { l1: '未分类', l2: '未分类' };
  if (parts.length === 1 && parts[0] === KAI_XUE_KE_CHENG) {
    return { l1: '开学', l2: '课程' };
  }
  if (parts.length === 1) {
    return { l1: parts[0], l2: parts[0] };
  }
  return { l1: parts[0], l2: parts[1] };
}

function collectJobs() {
  const root = SOURCE;
  if (!fs.existsSync(root)) {
    throw new Error(`目录不存在: ${root}`);
  }
  const jobs = [];
  const emittedLooseRoots = new Set();

  function walk(dir, relParts) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory());
    const files = entries.filter((e) => e.isFile());

    for (const d of subdirs) {
      walk(path.join(dir, d.name), [...relParts, d.name]);
    }

    const productFolder = relParts[relParts.length - 1] || '';
    const parsedFolder = parseNamePriceFromFolderName(productFolder);

    if (parsedFolder && files.length > 0) {
      const catParts = relParts.slice(0, -1);
      const { l1, l2 } = resolveCategoriesFromPath(catParts);
      const imageFiles = files
        .map((f) => f.name)
        .filter((n) => /\.(jpe?g|png|gif|webp)$/i.test(n))
        .sort((a, b) => {
          if (a === '1.jpg' || a === '1.JPG') return -1;
          if (b === '1.jpg' || b === '1.JPG') return 1;
          return a.localeCompare(b, 'zh-CN');
        });
      jobs.push({
        kind: 'folder',
        name: parsedFolder.name,
        price: parsedFolder.price,
        l1,
        l2,
        relPath: relParts.join('/'),
        files: imageFiles.map((n) => path.join(dir, n)),
      });
      return;
    }

    if (subdirs.length === 0 && files.length > 0 && relParts.length > 0) {
      const folderName = relParts[relParts.length - 1];
      const imageNames = files.map((f) => f.name).filter((n) => /\.(jpe?g|png|gif|webp)$/i.test(n));
      const pricedName = imageNames.find((n) => /元|价格/.test(n));
      if (
        pricedName &&
        imageNames.length > 1 &&
        folderName !== KAI_XUE_KE_CHENG &&
        LOOSE_MERGE_FOLDERS.has(folderName)
      ) {
        emittedLooseRoots.add(folderName);
        return;
      }

      const catKey =
        folderName === KAI_XUE_KE_CHENG ? [KAI_XUE_KE_CHENG] : relParts.length === 1 ? relParts : relParts.slice(0, -1);
      const { l1, l2 } = resolveCategoriesFromPath(catKey);

      for (const f of files) {
        if (!/\.(jpe?g|png|gif|webp)$/i.test(f.name)) continue;
        const { name, price } = parseNamePriceFromFileName(f.name);
        jobs.push({
          kind: 'file',
          name,
          price,
          l1,
          l2,
          relPath: [...relParts, f.name].join('/'),
          files: [path.join(dir, f.name)],
          coverFromSameFile: true,
        });
      }
    }
  }

  walk(root, []);

  for (const rel of fs.readdirSync(root, { withFileTypes: true })) {
    if (!rel.isDirectory()) continue;
    const folderName = rel.name;
    if (emittedLooseRoots.has(folderName) && LOOSE_MERGE_FOLDERS.has(folderName)) {
      const d = path.join(root, rel.name);
      const entries = fs.readdirSync(d, { withFileTypes: true });
      if (entries.some((e) => e.isDirectory())) continue;
      const files = entries.filter((e) => e.isFile()).map((e) => e.name);
      const imageNames = files.filter((n) => /\.(jpe?g|png|gif|webp)$/i.test(n));
      const priced = imageNames.find((n) => /元|价格/.test(n));
      if (!priced) continue;
      const { name, price } = parseNamePriceFromFileName(priced);
      const { l1, l2 } = resolveCategoriesFromPath([folderName]);
      const paths = [
        path.join(d, priced),
        ...imageNames
          .filter((n) => n !== priced)
          .sort((a, b) => a.localeCompare(b, 'zh-CN'))
          .map((n) => path.join(d, n)),
      ];
      jobs.push({
        kind: 'loose',
        name,
        price,
        l1,
        l2,
        relPath: folderName,
        files: paths,
        primaryFile: path.join(d, priced),
      });
    }
  }

  return jobs;
}

function buildMediaItems(uploadPairs, job) {
  const items = [];
  const byName = Object.fromEntries(uploadPairs);

  const oneJ = job.files.find((f) => /[/\\]1\.jpe?g$/i.test(f));
  if (oneJ && byName[path.basename(oneJ)]) {
    const u = byName[path.basename(oneJ)];
    items.push({
      title: '商品详情',
      type: 'image',
      url: u.url,
      thumb: u.thumbUrl || u.url,
    });
  }

  for (const f of job.files) {
    const bn = path.basename(f);
    if (oneJ && bn.toLowerCase() === '1.jpg') continue;
    const u = byName[bn];
    if (!u) continue;
    items.push({
      title: bn.replace(/\.[^.]+$/, ''),
      type: 'image',
      url: u.url,
      thumb: u.thumbUrl || u.url,
    });
  }

  if (items.length === 0 && uploaded.length > 0) {
    const [first] = uploaded;
    items.push({
      title: '商品详情',
      type: 'image',
      url: first[1].url,
      thumb: first[1].thumbUrl || first[1].url,
    });
  }
  return items;
}

async function ensureCategory(name, level, parentId) {
  const list = await api('GET', '/api/product-categories/');
  const found = list.find((c) => {
    if (c.name !== name || c.level !== level) return false;
    if (level === 1) return !c.parentId || c.parentId === 0;
    return c.parentId === parentId;
  });
  if (found) return found.id;
  const body = { name, level, sortOrder: 0, status: 'active' };
  if (level === 2) body.parentId = parentId;
  const created = await api('POST', '/api/product-categories/', body);
  return created.id;
}

async function main() {
  console.log('API:', API);
  console.log('SOURCE:', SOURCE);
  console.log('DRY_RUN:', DRY);

  const jobs = collectJobs();
  console.log('待处理商品数:', jobs.length);
  for (const j of jobs) {
    console.log('-', j.kind, j.name, j.price, '←', j.relPath);
  }

  if (DRY) {
    console.log('\n干跑结束。设置 ZKWL_DRY_RUN=0 并配置 ZKWL_TOKEN 或管理员账号后重试。');
    return;
  }

  await login();
  if (!token) {
    console.error('请设置 ZKWL_TOKEN，或 ZKWL_ADMIN_USERNAME + ZKWL_ADMIN_PASSWORD');
    process.exit(1);
  }

  const me = await api('GET', '/api/auth/profile');
  if (me.role !== 'admin') {
    console.error('当前账号不是管理员:', me.role);
    process.exit(1);
  }

  let seq = 1;
  for (const job of jobs) {
    const slug = slugifyUnique(job.relPath + job.name);
    const l1id = await ensureCategory(job.l1, 1, null);
    const l2id = await ensureCategory(job.l2, 2, l1id);

    const uploaded = [];
    for (const f of job.files) {
      const r = await uploadFile(f);
      uploaded.push([path.basename(f), r]);
    }
    const byBase = uploaded;

    let coverUrl = '';
    let coverThumb = '';
    if (job.kind === 'file' && job.coverFromSameFile) {
      coverUrl = uploaded[0][1].url;
      coverThumb = uploaded[0][1].thumbUrl || coverUrl;
    } else if (job.primaryFile) {
      const hit = uploaded.find(([bn]) => bn === path.basename(job.primaryFile));
      if (hit) {
        coverUrl = hit[1].url;
        coverThumb = hit[1].thumbUrl || coverUrl;
      }
    } else {
      const one = job.files.find((f) => /[/\\]1\.jpe?g$/i.test(f));
      const pick = one
        ? uploaded.find(([bn]) => bn === path.basename(one))
        : uploaded[0];
      if (pick) {
        coverUrl = pick[1].url;
        coverThumb = pick[1].thumbUrl || coverUrl;
      }
    }

    const mediaItems = buildMediaItems(byBase, job);
    const body = {
      categoryId: l2id,
      name: job.name,
      slug,
      listPrice: job.price,
      rewardPoints: 0,
      status: 'active',
      sortOrder: seq,
      sections: [],
      mediaItems,
      helpItems: [],
      coverImage: coverUrl,
      coverImageThumb: coverThumb || coverUrl,
      iconUrl: coverThumb || coverUrl,
      iconUrlThumb: coverThumb || coverUrl,
    };

    const guide = await api('POST', '/api/guides/admin', body);
    const sn = `PT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(4, '0')}-${slug.slice(-4)}`;
    await api('POST', '/api/inventory/products', {
      productCategoryId: l2id,
      name: job.name,
      serialNumber: sn,
      guideSlug: guide.slug,
      sortOrder: seq,
      status: 'active',
      tags: '产品测试图导入',
    });
    console.log('✓', job.name, 'guideId=', guide.id, 'sn=', sn);
    seq += 1;
  }

  console.log('全部完成。');
}

main().catch((e) => {
  console.error(e.message || e);
  if (e.payload) console.error(e.payload);
  process.exit(1);
});
