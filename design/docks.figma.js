// Targeted reconciliation of the mobile v1 reference; run through use_figma.
const page = await figma.getNodeByIdAsync('51:934');
await figma.setCurrentPageAsync(page);
const created = [], mutated = [], removed = [];
const track = n => (created.push(n.id), n);
const targets = await Promise.all(['51:1271','66:365','51:1140','51:1213','51:1423','51:1338','51:1181'].map(id => figma.getNodeByIdAsync(id)));
const fonts = new Map();
for (const root of targets) for (const t of root.findAllWithCriteria({types:['TEXT']})) for (const s of t.getStyledTextSegments(['fontName'])) fonts.set(JSON.stringify(s.fontName), s.fontName);
fonts.set('regular', {family:'Geist',style:'Regular'}); fonts.set('medium', {family:'Geist',style:'Medium'});
await Promise.all([...fonts.values()].map(f => figma.loadFontAsync(f)));
const variables = await figma.variables.getLocalVariablesAsync();
const V = name => variables.find(v => v.name === name);
const rgb = hex => ({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255});
const palette = {background:'#F5F2EB',surface:'#FFFEFA',ink:'#192D2A',muted:'#5E6B65',accent:'#176B5B',accentSoft:'#E8F0E9'};
const paint = name => figma.variables.setBoundVariableForPaint({type:'SOLID',color:rgb(palette[name])},'color',V('color/'+name));
const glass = [{type:'GLASS',visible:true,lightIntensity:.4,lightAngle:45,refraction:.18,depth:2,dispersion:0,radius:12}];
function al(parent,name,direction,width,height) {
  const n=track(figma.createAutoLayout(direction)); parent.appendChild(n);n.name=name;n.resize(width,height);n.primaryAxisSizingMode=n.counterAxisSizingMode='FIXED';n.fills=[];return n;
}
async function text(parent,label,kind='label',color='accent') {
  const n=track(figma.createText());parent.appendChild(n);n.name=label;n.fontName={family:'Geist',style:kind==='label'?'Medium':'Regular'};
  await n.setTextStyleIdAsync(kind==='label'?'S:aa537c9ba3593e45ba66eebed4b29315394c6b38,':'S:f429580f80944dbec5b84d8e312f2742dcb19794,');
  n.fontSize=kind==='label'?14:12;n.lineHeight={unit:'PIXELS',value:kind==='label'?20:18};n.characters=label;n.fills=[paint(color)];return n;
}
function orbSvg(active) {
  const count=84,golden=(1+Math.sqrt(5))/2,angle=active?1:.5,time=0,activity=active?1:0;
  let dots='';
  for(let i=0;i<count;i++) {
    const theta=Math.acos(1-2*(i+.5)/count),phi=2*Math.PI*i/golden;
    const p={x:Math.sin(theta)*Math.cos(phi),y:Math.sin(theta)*Math.sin(phi),z:Math.cos(theta),phase:phi%(2*Math.PI)};
    const radius=19*(1+Math.sin(time*1.2+p.phase*.5)*.01+activity*Math.sin(time*3.3+p.phase)*.045);
    const x=p.x*Math.cos(angle)+p.z*Math.sin(angle),z=-p.x*Math.sin(angle)+p.z*Math.cos(angle);
    const y=p.y*Math.cos(.32)-z*Math.sin(.32),depth=p.y*Math.sin(.32)+z*Math.cos(.32),perspective=3.5/(3.5+depth),front=(depth+1)/2;
    dots+=`<circle cx="${28+x*radius*perspective}" cy="${28+y*radius*perspective}" r="${(.65+front*.85)*perspective}" opacity="${.22+front*.78}" fill="${active?palette.accent:palette.ink}"/>`;
  }
  return `<svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">${dots}</svg>`;
}
let set=page.findOne(n=>n.type==='COMPONENT_SET'&&n.name==='Footnote / Listening control');
if(!set) {
  const variants=[];
  for(const active of [false,true]) {
    const c=track(figma.createComponent());page.appendChild(c);c.name='Status='+(active?'Reading':'Idle');c.layoutMode='HORIZONTAL';c.resize(148,56);c.primaryAxisSizingMode=c.counterAxisSizingMode='FIXED';c.counterAxisAlignItems='CENTER';c.paddingRight=14;c.cornerRadius=28;c.fills=[{...paint('surface'),opacity:.55}];c.effects=glass;
    const dots=track(figma.createNodeFromSvg(orbSvg(active)));c.appendChild(dots);dots.name='Particle sphere · 84 Fibonacci dots';dots.resize(56,56);
    for(const vector of dots.findAllWithCriteria({types:['VECTOR']})){vector.fills=vector.fills.map(fill=>fill.type==='SOLID'?figma.variables.setBoundVariableForPaint(fill,'color',V(active?'color/accent':'color/ink')):fill);mutated.push(vector.id);}
    const labels=al(c,'Playback label','VERTICAL',78,38);await text(labels,active?'Stop':'Listen');await text(labels,active?'Reading':'Device voice','caption','muted');
    c.description='Sticky explanation control. 84 Fibonacci particles, continuous angle with 240ms activity transition; idle .22rad/s, reading .92rad/s. Pause offscreen/background and under Reduce Motion. Device speech until ElevenLabs is connected.';
    variants.push(c);
  }
  set=track(figma.combineAsVariants(variants,page));set.name='Footnote / Listening control';set.x=4580;set.y=980;set.resize(188,160);
  variants.forEach((c,i)=>{c.x=20;c.y=20+i*72;mutated.push(c.id);});
  for(const [from,to] of [[variants[0],variants[1]],[variants[1],variants[0]]]) await from.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:to.id,navigation:'CHANGE_TO',transition:{type:'SMART_ANIMATE',duration:.24,easing:{type:'EASE_OUT'}}}]}]);
}
const idle=set.children.find(n=>n.name==='Status=Idle');
function glassAction(button,width=342) {
  button.resize(width,48);button.cornerRadius=16;button.fills=[{...paint('accent'),opacity:.16}];button.effects=glass;
  for(const t of button.findAllWithCriteria({types:['TEXT']})){t.fills=[paint('accent')];t.fontSize=14;t.lineHeight={unit:'PIXELS',value:20};mutated.push(t.id);}
  mutated.push(button.id);
}
function edge(body) {
  let n=body.children.find(c=>c.name==='Bottom edge · content remains');
  if(!n){n=track(figma.createRectangle());body.appendChild(n);n.name='Bottom edge · content remains';}
  n.resize(body.width,28);n.layoutPositioning='ABSOLUTE';n.x=0;n.y=body.height-28;n.constraints={horizontal:'STRETCH',vertical:'MAX'};
  const color=rgb(palette.background);n.fills=[{type:'GRADIENT_LINEAR',gradientTransform:[[0,1,0],[-1,0,1]],gradientStops:[{position:0,color:{...color,a:0}},{position:1,color:{...color,a:1}}]}];mutated.push(n.id);
}
const review=targets[0],reviewBody=await figma.getNodeByIdAsync('51:1278'),reviewFooter=await figma.getNodeByIdAsync('51:1279'),primary=await figma.getNodeByIdAsync('51:1280');
const inline=await figma.getNodeByIdAsync('51:1299');if(inline){removed.push(inline.id);inline.remove();}
reviewFooter.paddingTop=8;reviewFooter.paddingBottom=24;reviewFooter.primaryAxisSizingMode='AUTO';
const row=reviewFooter.children.find(n=>n.name==='Sticky listening + next step')??al(reviewFooter,'Sticky listening + next step','HORIZONTAL',342,56);row.itemSpacing=12;row.setBoundVariable('itemSpacing',V('space/12'));row.counterAxisAlignItems='CENTER';
if(!row.children.some(n=>n.type==='INSTANCE'&&n.id!==primary.id)){const listen=track(idle.createInstance());row.appendChild(listen);}row.appendChild(primary);glassAction(primary,182);
const label=primary.findAllWithCriteria({types:['TEXT']})[0];label.characters='Prepare request';mutated.push(label.id,reviewFooter.id,reviewBody.id);
edge(reviewBody);
const term=targets[1],termBody=await figma.getNodeByIdAsync('66:370');
const termInline=await figma.getNodeByIdAsync('66:425');if(termInline){removed.push(termInline.id);termInline.remove();}
for(const t of termBody.children.filter(n=>n.type==='TEXT')){t.resize(342,t.height);t.textAutoResize='HEIGHT';mutated.push(t.id);}
const termFooter=term.children.find(n=>n.name==='Action bar')??al(term,'Action bar','VERTICAL',390,88);termFooter.primaryAxisSizingMode='AUTO';termFooter.paddingLeft=termFooter.paddingRight=24;termFooter.paddingTop=8;termFooter.paddingBottom=24;termFooter.setBoundVariable('paddingLeft',V('space/24'));termFooter.setBoundVariable('paddingRight',V('space/24'));
const termRow=termFooter.children.find(n=>n.name==='Sticky listening + copy')??al(termFooter,'Sticky listening + copy','HORIZONTAL',342,56);termRow.itemSpacing=12;termRow.setBoundVariable('itemSpacing',V('space/12'));termRow.counterAxisAlignItems='CENTER';
if(!termRow.children.some(n=>n.type==='INSTANCE'&&n.name!=='Copy question')){const termListen=track(idle.createInstance());termRow.appendChild(termListen);}
const copy=termRow.children.find(n=>n.name==='Copy question')??track(primary.clone());termRow.appendChild(copy);copy.name='Copy question';copy.findAllWithCriteria({types:['TEXT']})[0].characters='Copy question';await copy.setReactionsAsync([]);glassAction(copy,182);
termBody.resize(390,664);termBody.layoutSizingVertical='FILL';mutated.push(termBody.id);edge(termBody);
for(const root of targets.slice(2))for(const bar of root.children.filter(n=>n.name==='Action bar')){bar.paddingTop=8;bar.paddingBottom=24;for(const button of bar.children.filter(n=>n.type==='INSTANCE'))glassAction(button);mutated.push(bar.id);}
const descendants=[...review.findAll(()=>true),...term.findAll(()=>true)];const counts={};for(const n of descendants)counts[n.type]=(counts[n.type]||0)+1;
const images=descendants.filter(n=>'fills'in n&&Array.isArray(n.fills)&&n.fills.some(f=>f.type==='IMAGE')).map(n=>({id:n.id,name:n.name,type:n.type,w:n.width,h:n.height}));
const families=[...new Set(descendants.filter(n=>n.type==='TEXT').flatMap(t=>t.getStyledTextSegments(['fontName']).map(s=>s.fontName.family)))];
return {createdNodeIds:created,mutatedNodeIds:mutated,removedNodeIds:removed,componentSet:set.id,reviewFrame:review.id,termFrame:term.id,descendantCount:descendants.length,nodeTypeCounts:counts,imageNodes:images,fontFamilies:families,docks:[row,termRow].map(n=>({id:n.id,w:n.width,h:n.height,children:n.children.map(c=>({id:c.id,w:c.width,h:c.height}))}))};
