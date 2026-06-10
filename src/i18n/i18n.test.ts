/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { en } from './locales/en';
import { zh } from './locales/zh';

function getKeysDeep(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getKeysDeep(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

describe('i18n locales structure comparison', () => {
  it('should have identical keys in both English and Chinese locales', () => {
    const enKeys = getKeysDeep(en).sort();
    const zhKeys = getKeysDeep(zh).sort();

    const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));

    expect(missingInZh, 'Keys in en.ts but missing in zh.ts').toEqual([]);
    expect(missingInEn, 'Keys in zh.ts but missing in en.ts').toEqual([]);
  });

  it('should have the same translation variables in matching translation strings', () => {
    const enKeys = getKeysDeep(en);
    
    // Find variables in a string (e.g. {{val}})
    const getVars = (str: string) => {
      const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
      return matches.map(m => m.replace(/\{\{|\}\}/g, '')).sort();
    };

    const getValueByPath = (obj: any, path: string) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    enKeys.forEach((key) => {
      const enVal = getValueByPath(en, key);
      const zhVal = getValueByPath(zh, key);

      if (typeof enVal === 'string' && typeof zhVal === 'string') {
        const enVars = getVars(enVal);
        const zhVars = getVars(zhVal);

        expect(enVars, `Variables in key "${key}" do not match: English has ${JSON.stringify(enVars)}, Chinese has ${JSON.stringify(zhVars)}`).toEqual(zhVars);
      }
    });
  });
});

describe('codebase translation key usage verification', () => {
  const getValueByPath = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  it('should only use valid translation keys defined in locale files', () => {
    // 1. Scan files recursively
    const getFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      
      list.forEach((file: string) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          // Skip i18n folder itself and testing folders
          if (file !== 'i18n' && file !== 'test' && file !== '.temp' && file !== 'node_modules') {
            results = results.concat(getFiles(filePath));
          }
        } else {
          if (
            (file.endsWith('.ts') || file.endsWith('.tsx')) &&
            !file.endsWith('.test.ts') &&
            !file.endsWith('.test.tsx')
          ) {
            results.push(filePath);
          }
        }
      });
      return results;
    };

    const srcDir = path.resolve(process.cwd(), 'src');
    const files = getFiles(srcDir);

    const literalKeyRegex = /\bt\(\s*(['"`])([^'`"\s$]+)\1/g;
    const templatePrefixRegex = /\bt\(\s*`([^`$]+)\$\{/g;

    const invalidKeys: { file: string; key: string }[] = [];
    const invalidPrefixes: { file: string; prefix: string }[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');

      // Check literal keys, e.g. t('common.confirm')
      let match;
      literalKeyRegex.lastIndex = 0;
      while ((match = literalKeyRegex.exec(content)) !== null) {
        const key = match[2];
        const val = getValueByPath(en, key);
        if (val === undefined || typeof val !== 'string') {
          invalidKeys.push({ file: path.basename(file), key });
        }
      }

      // Check dynamic keys with template literals, e.g. t(`items.${hoveredItem.type}`)
      let templateMatch;
      templatePrefixRegex.lastIndex = 0;
      while ((templateMatch = templatePrefixRegex.exec(content)) !== null) {
        const prefixWithDot = templateMatch[1]; // e.g., 'items.' or 'itemDescriptions.'
        const prefix = prefixWithDot.endsWith('.') ? prefixWithDot.slice(0, -1) : prefixWithDot;
        const val = getValueByPath(en, prefix);
        if (val === undefined || typeof val !== 'object') {
          invalidPrefixes.push({ file: path.basename(file), prefix });
        }
      }
    });

    expect(invalidKeys, `Literal keys used in t() that do not exist or are not strings in en.ts: ${JSON.stringify(invalidKeys)}`).toEqual([]);
    expect(invalidPrefixes, `Dynamic key prefixes used in t() that do not exist or are not objects in en.ts: ${JSON.stringify(invalidPrefixes)}`).toEqual([]);
  });
});

