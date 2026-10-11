import fs from 'node:fs';
import path from 'node:path';
import { glossary } from '../src/domain/glossary';
const p = path.resolve(import.meta.dirname, '../src/localization/es.json');
const catalog = JSON.parse(fs.readFileSync(p, 'utf8'));
for (const term of glossary) for (const key of ['title','definition','example'] as const) catalog[term[key].en] = term[key].es;
fs.writeFileSync(p, JSON.stringify(catalog, null, 2) + '\n');
