import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync(resolve('dist'), { recursive: true });
writeFileSync(resolve('dist/index.d.ts'), "import './design.css';\n");
