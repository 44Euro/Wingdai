const th = require('./src/i18n/locales/th.json');
const en = require('./src/i18n/locales/en.json');

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? flatten(v, key)
      : [key];
  });
}

const thKeys = flatten(th);
console.log(`Thai keys: ${thKeys.length}`);
console.log(`English keys: ${flatten(en).length}`);
console.log(`Total unique keys: ${thKeys.length}`);
