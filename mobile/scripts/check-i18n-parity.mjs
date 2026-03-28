import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const enPath = path.join(ROOT, 'i18n/locales/en.ts');
const viPath = path.join(ROOT, 'i18n/locales/vi.ts');

function parseLocale(filePath, exportName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const withoutDeclaration = raw.replace(/^const\s+\w+\s*=\s*/, '');
  const cleaned = withoutDeclaration.replace(/\s+as const;\s*export default\s+\w+;\s*$/s, '');
  return vm.runInNewContext(`(${cleaned})`, {});
}

function flattenKeys(obj, parent = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = parent ? `${parent}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function diff(a, b) {
  const bSet = new Set(b);
  return a.filter((k) => !bSet.has(k));
}

try {
  const en = parseLocale(enPath, 'en');
  const vi = parseLocale(viPath, 'vi');

  const enKeys = flattenKeys(en).sort();
  const viKeys = flattenKeys(vi).sort();

  const missingInVi = diff(enKeys, viKeys);
  const missingInEn = diff(viKeys, enKeys);

  if (missingInVi.length === 0 && missingInEn.length === 0) {
    console.log('i18n parity check passed: EN and VI keys are aligned.');
    process.exit(0);
  }

  if (missingInVi.length > 0) {
    console.error('Missing in vi.ts:');
    for (const key of missingInVi) {
      console.error(`- ${key}`);
    }
  }

  if (missingInEn.length > 0) {
    console.error('Missing in en.ts:');
    for (const key of missingInEn) {
      console.error(`- ${key}`);
    }
  }

  process.exit(1);
} catch (error) {
  console.error('Failed to run i18n parity check:', error);
  process.exit(1);
}
