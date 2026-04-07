/** 大陆手机号：11 位，第二位 3–9（与后端 services.ValidChinaMobile 一致） */
export const CHINA_MOBILE_RE = /^1[3-9]\d{9}$/;

export function isValidChinaMobile(s) {
  const t = String(s ?? '').trim();
  return CHINA_MOBILE_RE.test(t);
}
