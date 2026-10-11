const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const sources = new Map();
function add(text, file, visible = false) {
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length < 2 || !/[A-Za-z]/.test(text) || /https?:|file:\/|\[|^@|\.tsx?$|^rgba|^#[a-f\d]+$/i.test(text)) return;
  if (!visible && !/^[A-Z]|^\{\d+\}/.test(text) || text === 'Footnote' || text === 'Unfold') return;
  sources.set(text, [...(sources.get(text) || []), file]);
}
function walk(dir) { for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
  const file=path.join(dir,item.name); if(item.isDirectory()){ if(item.name !== 'localization') walk(file); continue; }
  if(!/\.tsx?$/.test(file) || /\.test\./.test(file))continue;
  if(!/\/screens\/|\/components\/|\/app\/|\/native\/errors\.ts$|\/domain\/(glossary|review|timeline|bill-status|extraction|fixtures)\.ts$|\/services\/(guide-explanations|backend-mapping|voice-agent|elevenlabs-conversation|local-services|finding-copy)\.ts$/.test(file))continue;
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node) {
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent=node.parent;
      const isSpanish=ts.isPropertyAssignment(parent)&&parent.name.getText(ast)==='es' || ts.isCallExpression(parent)&&['copy','localized','text'].includes(parent.expression.getText(ast))&&parent.arguments[1]===node;
      if(!isSpanish) add(node.text,file);
    } else if(ts.isJsxText(node))add(node.text,file,true);
    else if(ts.isTemplateExpression(node)) {
      let text=node.head.text; node.templateSpans.forEach((s,i)=>text+=`{${i}}`+s.literal.text);add(text,file);
    }
    ts.forEachChild(node,visit);
  } visit(ast);
}}
walk(path.resolve(__dirname,'../src'));
const phrases=[...sources.keys()].sort();
fs.writeFileSync(path.resolve(__dirname,'../src/localization/en.json'), JSON.stringify(Object.fromEntries(phrases.map(t=>[t,t])), null, 2)+'\n');
console.log('UI message count',phrases.length);
