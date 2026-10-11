const fs = require('fs');const path=require('path');
const folder=path.resolve(__dirname,'../src/localization');
const codes=[...fs.readFileSync(path.resolve(__dirname,'../src/domain/languages.ts'),'utf8').matchAll(/code: '([^']+)', agentCode:/g)].map(m=>m[1]);
fs.writeFileSync(path.join(folder,'catalogs.ts'),codes.map((c,i)=>`import language${i} from './${c}.json';`).join('\n')+'\nexport const catalogs: Record<string, Record<string,string>> = {\n'+codes.map((c,i)=>`  '${c}': language${i},`).join('\n')+'\n};\n');
