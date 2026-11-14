import {buildGraph,filterGraph,analyze,queryEvidence,parseMarkdown,memoryEvents,layoutGraph,evidencePath} from './atlas-core.js';
import {translateText,localizeDOM,localizeCorpus} from './atlas-i18n.js';
import {getVersionGraph,renderImpactSvg,renderImpactInspector,buildReviewExport,validateImpactDemo,formatLineRange} from './atlas-impact.js';
import {requestMoiSelection} from './moi-browser-client.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={moon:'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z',sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.5 5.5 7 7m10 10 1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',network:'M8 7 16 5M8 9l4 7m5-9-3 9M4 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0m12-2a2 2 0 1 0 4 0 2 2 0 1 0-4 0m-6 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0',branch:'M4 12h6m0 0V5h7m-7 7v7h7M17 3h4v4h-4Zm0 14h4v4h-4ZM1 10h4v4H1Z',library:'M4 4h4v16H4Zm7 0h4v16h-4Zm7 1 3-1 4 15-3 1Z',chart:'M4 3v18h18M8 16v-5m5 5V6m5 10v-8',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2',search:'m16 16 5 5M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0',file:'M5 3h9l5 5v13H5Zm9 0v5h5M8 12h8M8 16h6',plug:'m8 3 0 5m8-5v5M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4',compass:'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0m12-3-2 4-4 2 2-4Z',help:'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0m6-3a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01',grid:'M3 3h7v7H3Zm11 0h7v7H3Zm-11 11h7v7H3Zm11 0h7v7h-7Z',menu:'M4 6h16M4 12h16M4 18h16',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',plus:'M12 4v16M4 12h16',arrow:'M4 12h16m-6-6 6 6-6 6',sparkles:'m12 3 2 6 6 3-6 2-2 7-2-7-7-2 7-3Zm8-2v4m-2-2h4',check:'m4 12 5 5L20 6',link:'m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',layers:'m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5m-18 5 9 5 9-5',book:'M12 5v16M3 3c3 0 6 0 9 2 3-2 6-2 9-2v16c-3 0-6 0-9 2-3-2-6-2-9-2Z',external:'M14 3h7v7m0-7-11 11M10 3H3v18h18v-7',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',chevron:'m9 6 6 6-6 6',chevrons:'m8 9 4-4 4 4m-8 6 4 4 4-4',minimize:'M5 12h14',expand:'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',swap:'M8 7h11m0 0-3-3m3 3-3 3M16 17H5m0 0 3-3m-3 3 3 3'};
const icon=name=>`<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name]||paths.file}"/></svg>`;
function hydrateIcons(root=document){
 if(typeof DOMParser==='undefined'){
  root.querySelectorAll?.('[data-icon]')?.forEach?.(x=>{x.innerHTML=icon(x.dataset?.icon);});
  return;
 }
 root.querySelectorAll('[data-icon]').forEach(x=>x.replaceWith(new DOMParser().parseFromString(icon(x.dataset.icon),'text/html').body.firstChild));
}
const types={source:{label:'来源文档',color:'var(--node-source)',fill:'var(--node-source-fill)',icon:'file'},claim:{label:'知识声明',color:'var(--node-claim)',fill:'var(--node-claim-fill)',icon:'check'},topic:{label:'知识对象',color:'var(--node-topic)',fill:'var(--node-topic-fill)',icon:'network'},asset:{label:'工作资产',color:'var(--node-asset)',fill:'var(--node-asset-fill)',icon:'book'}};
const titles={overview:'探索工作台',graph:'知识图谱',mindmap:'知识脑图',library:'资产目录',analytics:'洞察分析',memory:'记忆与版本',connections:'数据连接',brand:'Captain Kiko'};
const normalizeRoute=r=>r==='wardrobe'?'brand':r;
let topicNames={float_:'float_ / float64',complex_:'complex_ / complex128',copy:'copy=False',promotion:'dtype promotion',ptp:'ndarray.ptp'};
const state={route:'overview',version:'all',types:[],search:'',selected:null,topic:'',libraryType:'all',librarySearch:'',sort:'type',sortDir:1,collapsed:new Set(),kiko:'C1',kikoPreview:null,workspace:'astronomy',lang:'zh',theme:'light',searchIndex:0,graphMode:'knowledge',impactVersion:'2.0',impactSelectedNode:null,impactSelectedEdge:null,inspectorSheetOpen:false,pendingFocusSelected:false,assistantMinimized:false,assistantRect:null};
let moiRequestGeneration=0;
let moiPendingRequest=null;
let activeRevealTimer=null;
let activeRevealItem=null;
let activeRevealCleanup=null;
let base,rawBase,corpus,graph,locals=[],reviews={},toastTimer,importFile=null,importBusy=false,importSession=0,labSerial=0,lastFocus=null,assistantTriggerFocus=null,assistantDragSession=null,assistantResizeSession=null,deletedNote=null,impactDemoCache=null,impactLoadingPromise=null,impactError=null,impactRequestId=0,impactAbortController=null,impactResizeObserver=null,graphResizeObserver=null,lastExportSnapshot=null,lastFailedExport=null,exportBusy=false,workspaceSwitchTimer=null;
const activeObjectUrls=new Set();
const catalog=new Map();
const labLoadErrors=new Set();
const labInFlight=new Map();
const labRequestSeq=new Map();
const labs=[
 {id:'astronomy',file:'astronomy.json',name:'天文数据探险',name_en:'Astronomy explorer',description:'从系外行星到光谱，沿 NASA 与 ESA 的证据远航。',description_en:'Explore exoplanets, spectra and the evidence behind them.',symbol:'✦',catalog:{sources:7,distinctDocuments:7,claims:10,topics:5,assets:3,objects:25,scope:'宇宙入门 / 观测方法',scope_en:'Cosmic foundations / Observation methods'}},
 {id:'hospitality',file:'hospitality.json',name:'酒店节能探索',name_en:'Hospitality energy explorer',description:'循着暖通、照明与客房控制证据，探索酒店能效基线与运营策略。',description_en:'Explore HVAC, lighting and guest-room evidence across energy baselines and operations.',symbol:'H',catalog:{sources:6,distinctDocuments:4,claims:11,topics:5,assets:3,objects:25,scope:'基线与规划 / 运营与维护',scope_en:'Baseline & planning / Operations & maintenance'}},
 {id:'numpy',file:'evidence.json',name:'NumPy 迁移实验场',name_en:'NumPy migration',description:'追踪 API 与行为的版本变化。',description_en:'Trace version changes in APIs and behavior.',symbol:'N',catalog:{sources:7,distinctDocuments:7,claims:10,topics:5,assets:3,objects:25,scope:'NumPy 1.26 / NumPy 2.0',scope_en:'NumPy 1.26 / NumPy 2.0'}}
];
const chatHistory={astronomy:[],hospitality:[],numpy:[]};
const getChatHistory=(ws=state.workspace)=>{if(!chatHistory[ws])chatHistory[ws]=[];return chatHistory[ws];};
const tr=(zh,en)=>state.lang==='en'?en:zh;
const locale=()=>state.lang==='en'?'en-US':'zh-CN';
const versions=()=>base?.metadata?.versions||[{id:'1.26',label:'NumPy 1.26'},{id:'2.0',label:'NumPy 2.0'}];
const isCollection=()=>base?.metadata?.versionMode==='collection';
const scopeLabel=()=>tr(isCollection()?'资料集':'适用版本',isCollection()?'Collection':'Version');
const versionName=v=>v==='all'||v==='compare'?tr('全部资料','All scopes'):v==='multiple'?versions().map(x=>x.label).join(' / '):versions().find(x=>x.id===v)?.label||v||tr('未绑定','Unscoped');
const labTitle=()=>base?.metadata?.title||tr(labs.find(x=>x.id===state.workspace).name,labs.find(x=>x.id===state.workspace).name_en);
const noteKey=()=>state.workspace==='numpy'?'notes':`notes:${state.workspace}`;
const reviewKey=()=>state.workspace==='numpy'?'reviews':`reviews:${state.workspace}`;
const memory=()=>memoryEvents(corpus);
const analyzeRecords=(data=corpus,version='all')=>analyze(data,version,{countSourceRecords:true});
const rawSourceFor=id=>{const s=corpus?.sources?.find(x=>x.id===id);const gn=graph?.nodes?.find(x=>x.id===id);return s?{...s,publisher:s.publisher||gn?.publisher||null,section:s.section||gn?.section||null}:gn||null;};
const distinctDocumentCount=(sources=corpus?.sources||[])=>{const keys=new Set(sources.map(s=>s.document_id||s.document||s.canonical_url||(s.url?String(s.url).split('#')[0]:s.id)));return keys.size;};
function compactPublisherList(pubs){
 const raw=[...new Set((pubs||[]).map(p=>String(p||'').trim()).filter(Boolean))];
 const hasStandaloneEpa=raw.some(p=>/\bEPA\b/i.test(p)&&!/ENERGY\s+STAR/i.test(p));
 return [...new Set(raw.map(p=>hasStandaloneEpa&&/^U\.S\.\s+EPA\s*\/\s*ENERGY\s+STAR$/i.test(p)?'ENERGY STAR':p))];
}
function sourceSubtitle(a){
 const recs=a.sourceRecords??a.sources,docs=a.distinctDocuments??recs,pubs=compactPublisherList(a.publishers);
 const pubText=pubs.length?` · ${pubs.join(' / ')}`:'';
 return docs<recs?tr(`${recs} 条章节记录 · 源自 ${docs} 份官方文献${pubText}`,`${recs} section records · from ${docs} official documents${pubText}`):tr(`公开官方来源${pubText}`,`Public official sources${pubText}`);
}
const localize=root=>localizeDOM(root||document,state.lang);
const storage={get(key,fallback){try{const x=JSON.parse(localStorage.getItem('knowligence:'+key));return x??fallback}catch{return fallback}},set(key,value){try{localStorage.setItem('knowligence:'+key,JSON.stringify(value));return true}catch{toast('浏览器存储不可用，当前更改未能保存。');return false}}};
function toast(message){$('#toast').textContent=translateText(message,state.lang);$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function rebuild(){
 base=localizeCorpus(rawBase||base,state.lang);
 corpus={...base,assets:[...base.assets,...locals]};
 topicNames=Object.fromEntries((base.metadata?.topics||[]).map(t=>[t.id,t.label]));
 graph=buildGraph(corpus,{locale:state.lang});
 for(const n of graph.nodes)if(n.type==='topic'&&!topicNames[n.topic])topicNames[n.topic]=n.label;
 $('#node-count').textContent=graph.nodes.length;$('#local-count').textContent=locals.length;
}
function heading(title,sub,actions=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div><div class="page-heading-right">${actions}</div></div>`}
function legend(){return `<div class="legend">${Object.entries(types).map(([key,t])=>`<span><i class="node-key ${key}"></i>${translateText(t.label,state.lang)}</span>`).join('')}<span><i class="edge-key supports"></i>${tr('支持 →','supports →')}</span><span><i class="edge-key applies"></i>${tr('归属于 →','belongs to →')}</span><span><i class="edge-key candidate"></i>${tr('待复核影响 →','candidate link →')}</span><button class="ontology-open-btn" data-open-ontology aria-label="${esc(tr('查看语义模型与图谱规则说明','View ontology and graph semantic model explanation'))}">${icon('network')}<span>${tr('语义模型','Ontology')}</span></button></div>`}
function graphOntologyNote(){
 return `<div class="graph-ontology-note" role="note" aria-label="${esc(tr('图谱语义模型说明','Graph semantic model explanation'))}"><span class="ontology-note-badge">${tr('本体语义模型','Ontology Semantic Model')}</span><p>${tr('本图谱采用本体启发的语义模型，组织四类对象（来源文档、知识声明、知识对象、工作资产）与有向关系（支持 supports、归属 belongs-to、待复核候选影响 candidate impact）。候选关系仅代表结构提及，属于未经核验的候选影响；图谱基于本地受控规则呈现，未连接外部本体服务或自动化真值判定。','This graph uses an ontology-inspired semantic model organizing four types (source document, claim, knowledge object, work asset) and directed relations (supports, belongs-to, candidate impact). Candidate links indicate structural mentions and remain unverified; this graph runs on local curated structures without external ontology services or automated truth.')} <button type="button" class="text-button inline-ontology-link" data-open-ontology>${tr('查看完整语义模型说明 →','View full model explanation →')}</button></p></div>`;
}
function versionSelect(id='view-version'){return `<select id="${id}" class="field-select" aria-label="${esc(base.metadata?.versionLabel||tr('资料范围','Evidence scope'))}"><option value="all" ${state.version==='all'?'selected':''}>${tr('全部资料','All scopes')}</option>${versions().map(v=>`<option value="${esc(v.id)}" ${state.version===v.id?'selected':''}>${esc(v.label)}</option>`).join('')}</select>`}
function metrics(a){const srcCount=a.sourceRecords??a.sources;const items=[['source',srcCount,sourceSubtitle(a)],['claim',a.claims,tr('绑定来源与资料范围','Source and scope attached')],['topic',a.topics,tr('当前资料覆盖的主题','Topics in this evidence set')],['asset',a.assets,tr('示例与本地笔记','Examples and local notes')]];return `<div class="metrics">${items.map(([kind,n,sub])=>`<button class="metric" data-metric="${kind}" aria-label="${esc(tr('查看','View ')+translateText(types[kind].label,state.lang))}"><span class="metric-top"><i class="node-key ${kind}"></i>${translateText(types[kind].label,state.lang)}${icon('arrow')}</span><span class="metric-value">${n}</span><span class="metric-bottom">${esc(sub)}</span></button>`).join('')}</div>`}
function bars(a){const nameFor=(k,v)=>topicNames[k]||v?.label||k;const rows=Object.entries(a.byTopic).sort((a,b)=>a[1].sources-b[1].sources||a[1].claims-b[1].claims||String(nameFor(a[0],a[1])).localeCompare(String(nameFor(b[0],b[1])),locale()));const max=Math.max(1,...rows.flatMap(([,v])=>[v.sources,v.claims])),min=rows[0]?.[1].sources;const sourceFreq=new Map();for(const [,v]of rows)sourceFreq.set(v.sources,(sourceFreq.get(v.sources)||0)+1);const minTiedCount=min!==undefined?(sourceFreq.get(min)||0):0;const allEqual=rows.length>1&&sourceFreq.size===1;const tieNote=allEqual?tr(`当前各主题均为 ${min} 条来源记录（所有主题并列），按声明数与主题名称排序。`,`All topics have ${min} source records (all topics tied); ordered by claims then topic name.`):minTiedCount>1?tr(`优先查看来源记录较少的主题；最低档 ${min} 条来源记录共 ${minTiedCount} 个主题并列，同等标记。`,`Fewer source records first; ${minTiedCount} topics tie at the lowest count (${min} source records) and share the same marker.`):tr('优先查看来源记录较少的主题；并列时按声明数与主题名称排序并同等标记。','Fewer source records first; ties are ordered by claim count then topic name and equally marked.');return `<div class="coverage-head"><div class="coverage-legend" role="list" aria-label="${tr('图表图例与单位','Chart legend and units')}"><span class="coverage-legend-item" role="listitem"><i class="coverage-swatch sources" aria-hidden="true"></i>${tr('上条：来源记录（单位：条）','Top bar: Source records (unit: records)')}</span><span class="coverage-legend-item" role="listitem"><i class="coverage-swatch claims" aria-hidden="true"></i>${tr('下条：知识声明（单位：条）','Bottom bar: Claims (unit: claims)')}</span><span class="coverage-scale">${tr(`横条刻度：0–${max}（水平长度按数量比例缩放）`,`Bar scale: 0–${max} (horizontal length proportional to count)`)}</span></div><div class="coverage-note">${tieNote}</div></div><div class="mini-bars">${rows.map(([k,v])=>{const isMin=v.sources===min;const isTied=(sourceFreq.get(v.sources)||0)>1;const badgeText=allEqual?tr('所有主题并列','All topics tied'):isMin?(minTiedCount>1?tr('并列最薄弱 · 来源记录最少','Tied lowest · Fewest source records'):tr('来源记录最少','Fewest source records')):(isTied?tr('来源记录并列','Tied source records'):'');const labelText=nameFor(k,v);const docs=v.distinctDocuments??v.sources;const docHint=docs<v.sources?tr(`（源自 ${docs} 份文献）`,` (from ${docs} documents)`):'';const docAria=docs<v.sources?tr(`（源自 ${docs} 份文献，多条记录可指向同一文献）`,` (from ${docs} documents; multiple records may point to the same document)`):'';return `<button class="coverage-row ${isMin?'weak':''} ${isTied?'tied':''} ${state.topic===k?'selected':''}" data-topic-filter="${esc(k)}" aria-pressed="${state.topic===k}" aria-label="${esc(labelText)}: ${v.sources} ${tr('条来源记录','source records')}${docAria}, ${v.claims} ${tr('条声明','claims')}${badgeText?` (${badgeText})`:''}"><span class="coverage-title"><strong>${esc(labelText)}</strong>${badgeText?`<small class="coverage-badge ${isMin&&!allEqual?'lowest':'tie'}">${esc(badgeText)}</small>`:''}</span><span class="coverage-tracks" aria-hidden="true"><span class="track-line" title="${tr('来源记录','Source records')}: ${v.sources} / ${max}${docHint}"><b class="track-tag">${tr('记录','Rec')}</b><span class="track-bar"><i class="sources" style="width:${v.sources/max*100}%"></i></span></span><span class="track-line" title="${tr('知识声明','Claims')}: ${v.claims} / ${max}"><b class="track-tag">${tr('声明','Clm')}</b><span class="track-bar"><i class="claims" style="width:${v.claims/max*100}%"></i></span></span></span><span class="coverage-values num"><span class="val-sources">${v.sources} ${tr('条记录','records')}</span><span class="val-claims">${v.claims} ${tr('条声明','claims')}</span></span></button>`;}).join('')}</div>`}
const moiOverviewBoundary=()=>`<section class="panel capability-strip" data-capability-boundary="overview" aria-label="${esc(tr('MOI 现有能力与演进方向边界说明','MOI current capabilities and future direction boundaries'))}"><div class="capability-head"><span class="tag blue">${tr('当前已验证 · 可选在线精选','Verified current · Optional online selection')}</span><span class="tag">${tr('演进目标 · 原生检索与 Memoria 未连接','Future goals · Native retrieval & Memoria not connected')}</span></div><div class="capability-columns"><p class="capability-col"><strong>${tr('当前已验证能力：','Verified current capability: ')}</strong>${tr('公开精选证据随站点分发至浏览器，默认基于本地预设规则离线回答；登录用户主动点击「MOI 在线询问」时，可将问题与匹配的公开证据发送至 Genesis qwen3.8-flash 筛选声明（共享每日额度）。','Bundled curated public evidence is shipped with the site and served to browsers, using local offline presets by default; when signed-in users explicitly click “Ask MOI online”, the question and matched public evidence are sent to Genesis qwen3.8-flash to select claims (shared daily quota).')}</p><p class="capability-col"><strong>${tr('未连接能力与本地边界：','Unconnected capabilities & local boundary: ')}</strong>${tr('MOI 原生知识检索、Memoria 版本历史与云端同步尚未接通（规划目标）。本地笔记与复核状态仅保存在当前浏览器本地，不会自动同步或迁移。','Native MOI knowledge retrieval, Memoria version history, and cloud sync are not connected (future goals). Browser-local notes and review status remain local in this browser and are not synced.')}</p></div></section>`;
const moiMemoryBoundary=(hasPairedVersions=false)=>`<section class="capability-note" data-capability-boundary="memory" aria-label="${esc(tr('记忆与版本能力边界与演进方向','Memory and version capability boundaries and future direction'))}"><div class="capability-head"><span class="tag blue">${tr('当前已验证 · 本地复核与可选在线精选','Verified current · Local review & optional online selection')}</span><span class="tag">${tr('演进目标 · Memoria 与云端同步未接通','Future goals · Memoria & cloud sync not connected')}</span></div><p><strong>${tr('当前能力边界：','Current boundary: ')}</strong>${hasPairedVersions?tr('本实验场随站点分发有官方出处支撑的成对版本对照；问答默认采用本地离线预设，登录用户主动点击可将问题与匹配的公开证据发送至 Genesis qwen3.8-flash 筛选声明（共享每日额度）。','This lab ships source-backed paired version comparisons with the site; Q&A uses local offline presets by default, while signed-in users can explicitly send their question and matched public evidence to Genesis qwen3.8-flash to select claims (shared daily quota).'):tr('本实验场随站点分发按主题整理的公开来源台账（无成对历史版本对照）；问答默认采用本地离线预设，登录用户主动点击可将问题与匹配的公开证据发送至 Genesis qwen3.8-flash 筛选声明（共享每日额度）。','This lab ships a thematic public source register with the site (without paired version comparisons); Q&A uses local offline presets by default, while signed-in users can explicitly send their question and matched public evidence to Genesis qwen3.8-flash to select claims (shared daily quota).')}</p><p><strong>${tr('未接通服务与本地存储：','Unconnected services & local storage: ')}</strong>${tr('MOI 原生知识检索、Memoria 生成的历史记录与云端同步尚未连接（演进目标）。本地笔记与复核状态仅保存在当前浏览器 localStorage，不会自动同步。','Native MOI knowledge retrieval, Memoria-generated history, and cloud sync are not connected (future goals). Browser-local notes and review status stay in this browser’s localStorage and are not synced.')}</p></section>`;
const kikoWardrobeBoundary=()=>`<section class="capability-note wardrobe-boundary-note" data-capability-boundary="wardrobe" aria-label="${esc(tr('Kiko 衣橱造型与存储说明','Kiko wardrobe companion and storage explanation'))}"><p class="wardrobe-guidance-line"><strong>${tr('造型指南：','Wardrobe guide: ')}</strong>${tr('点击「揭晓」即可解锁新档案；点击「预览」查看大图且不影响当前搭档；点击「确认设为搭档」即可更换形象。更换形象仅切换外观图片，不影响页面主题、问答内容或推理逻辑。已解锁的档案与搭档选择均保存在当前浏览器中。','Click "Reveal" to unlock a new file; "Preview" lets you inspect an outfit without changing your active companion; "Apply" sets your new companion. Applying updates only the avatar image without changing themes, Q&A answers, or reasoning logic. Your unlocked collection and choice stay in this browser.')}</p></section>`;
function overview(){const a=analyzeRecords(corpus),topics=Object.entries(a.byTopic).sort((a,b)=>a[1].sources-b[1].sources).slice(0,3);return heading(esc(labTitle()),esc(base.metadata?.description||tr('从资料出发，让每次发现都能回到证据。','Start with a source. Keep every discovery connected to evidence.')))+metrics(a)+`<div class="overview-grid"><section class="panel"><div class="panel-head"><div><h2>你的知识版图</h2><p>${graph.nodes.length} 个对象 · ${graph.edges.length} 条有类型的关系</p></div><a class="text-button" href="#graph">进入探索 ${icon('arrow')}</a></div><div class="graph-preview" id="overview-graph"></div><div class="graph-bottom">${legend()}<span>${tr('选择一个节点，沿着证据继续探索','Select a node to follow its evidence')}</span></div>${graphOntologyNote()}</section><div class="right-stack"><section class="kiko-card ${state.kiko.startsWith('E')?'transparent-art':'legacy-art'}"><img src="/assets/kiko-${state.kiko}.png" alt="Captain Kiko"><span class="tag kiko-offline-pill">${tr('默认离线预设 · 可选在线精选','Offline presets by default · Optional online selection')}</span><h3>${tr('让好奇心启航。','Follow your curiosity.')}</h3><p>${tr('默认基于本实验场精选证据与预设规则离线回答；登录后可主动点击 MOI 在线入口，从精选证据中筛选回答（共享每日额度）。','Default answers use local curated evidence and preset rules offline; after sign-in, you can explicitly click the MOI online option to select from curated evidence (shares daily quota).')}</p><button class="button" data-open-assistant>一起出发 ${icon('arrow')}</button><a class="kiko-collection-link" href="#brand">${tr('探索 Kiko 衣橱','Explore Kiko’s wardrobe')}</a></section><section class="panel queue"><h3>值得继续探索</h3>${topics.map(([id,t])=>`<button class="queue-item" data-node="topic:${esc(id)}"><span class="queue-icon">${icon('compass')}</span><span><strong>${esc(t.label)}</strong><small>${tr(`${t.claims} 条声明 · ${t.sources} 条来源记录`,`${t.claims} claims · ${t.sources} source records`)}</small></span>${icon('chevron')}</button>`).join('')}<a class="queue-more text-button" href="#analytics">${tr('查看全部线索','View all clues')} ${icon('arrow')}</a></section></div></div><div class="two-col"><section class="panel"><div class="panel-head"><h2>从资料到资产</h2><a class="text-button" href="#library">查看全部 ${icon('arrow')}</a></div><div class="table-wrap"><table><thead><tr><th>名称</th><th class="num" title="${tr('经共同主题关联；不代表已证实影响','Linked through shared topics; not confirmed impact')}">${tr('关联声明','Related claims')}</th><th>状态</th></tr></thead><tbody>${corpus.assets.slice(-3).map(a=>`<tr data-row-node="${esc(a.id)}" tabindex="0" aria-label="${esc(a.title)}"><td><button class="table-title" data-node="${esc(a.id)}"><strong data-no-translate>${esc(a.title)}</strong></button></td><td class="num">${corpus.claims.filter(c=>(graph.nodes.find(n=>n.id===a.id)?.topics||[]).includes(c.topic)).length}</td><td><span class="tag amber">待复核</span></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h2>知识覆盖分布</h2><p>${tr('来源记录与声明分别计数 · 优先发现薄弱处','Separate source-record and claim counts · Find gaps first')}</p></div><a class="text-button" href="#analytics">深入分析 ${icon('arrow')}</a></div>${bars(a)}<p class="subtext">${tr('多条来源记录可指向同一份文献；同一文献也可支持多个主题，主题计数不可相加为文献总数。','Multiple source records may point to the same document, and one document may support several topics; topic counts do not sum to total distinct documents.')}</p></section></div>`+moiOverviewBoundary()}
function mindmapPage(){const a=analyzeRecords(corpus,state.version);return heading('让思路，有迹可循。','从主题展开证据层级。点击分支可折叠，点击结论可回到出处。',`${versionSelect()}<button class="button" data-export-mindmap title="${tr('导出层级证据大纲 (Markdown)','Export hierarchical evidence outline (Markdown)')}" aria-label="${tr('导出层级证据大纲 (Markdown)','Export hierarchical evidence outline (Markdown)')}">${icon('download')}${tr('导出 Markdown','Export Markdown')}</button>`)+`<section class="panel"><div class="panel-head"><h2>${esc(labTitle())} · ${tr("知识脑图","Mind map")}</h2><span class="tag">证据层级视图</span></div><div class="mindmap-container"><div class="mindmap"><div class="mind-root"><strong>${esc(labTitle())}</strong><small>${tr("主题 → 声明 → 来源","Topics → claims → sources")}</small></div><div class="mind-branches">${Object.entries(a.byTopic).map(([topic,t])=>`<div class="mind-branch"><button class="mind-topic" data-collapse="${esc(topic)}" aria-expanded="${!state.collapsed.has(topic)}">${esc(topicNames[topic]||topic)}<span>${state.collapsed.has(topic)?'+':'−'}</span></button><div class="mind-leaves">${state.collapsed.has(topic)?`<span class="muted" style="font-size:12px">${t.claims} 条结论已收起</span>`:corpus.claims.filter(c=>c.topic===topic&&(state.version==='all'||c.version===state.version)).map(c=>`<button class="mind-leaf" data-node="${esc(c.id)}" title="${esc(c.title)}" aria-label="${esc(c.title)} (${esc(versionName(c.version))}, ${c.source_ids.length} ${tr('个出处','sources')})"><small class="mono">${esc(versionName(c.version))} · <span class="num">${c.source_ids.length}</span> ${tr('个出处','sources')}</small><span class="mind-leaf-title">${esc(c.title)}</span></button>`).join('')}</div></div>`).join('')}</div></div></div><p class="small-note">脑图来自已整理的主题与声明；图谱中的候选影响、笔记双链不会被提升为事实层级。</p></section>`}
function selectedLibrary(){let nodes=filterGraph(graph,{search:state.librarySearch,version:state.version}).nodes.filter(n=>state.libraryType==='all'||n.type===state.libraryType);return nodes.sort((a,b)=>String(a[state.sort]||'').localeCompare(String(b[state.sort]||''),locale())*state.sortDir)}
function libraryPage(){return heading('知识资产，井然有序。','文档、声明、对象与笔记，拥有同一套可检查的属性和关系。',`<button class="button primary" data-import>${icon('plus')}添加笔记</button>`)+`<div class="controls"><label class="search-field">${icon('search')}<input id="library-search" value="${esc(state.librarySearch)}" placeholder="查找名称或正文…" aria-label="搜索资产"></label>${versionSelect()}<div class="segmented">${[['all','全部'],...Object.entries(types).map(([k,t])=>[k,t.label])].map(([k,l])=>`<button data-library-type="${k}" class="${state.libraryType===k?'active':''}">${l}</button>`).join('')}</div><span class="spacer"></span><button class="text-button" data-export-library title="${tr('导出筛选后的资产列表 (CSV)','Export filtered asset list (CSV)')}" aria-label="${tr('导出筛选后的资产列表 (CSV)','Export filtered asset list (CSV)')}">${icon('download')}${tr('导出 CSV','Export CSV')}</button></div><section class="panel"><div class="table-wrap"><table class="asset-table"><thead><tr><th><button data-sort="label">名称 ↕</button></th><th><button data-sort="type">对象类型 ↕</button></th><th><button data-sort="version">${scopeLabel()} ↕</button></th><th>溯源状态</th><th class="num">关系</th><th></th></tr></thead><tbody id="library-rows"></tbody></table></div><p class="small-note">本地笔记仅保存在当前浏览器；JSON / CSV 导出便于迁移。来源链接与已核查声明只读，避免误改证据。</p></section>`}
function drawLibrary(){const list=selectedLibrary();$('#library-rows').innerHTML=list.map(n=>`<tr data-row-node="${esc(n.id)}" tabindex="0" aria-label="${esc(n.label)}"><td><button data-node="${esc(n.id)}"><span class="type-mark" style="background:${types[n.type].fill};color:${types[n.type].color}">${icon(types[n.type].icon)}</span><strong data-no-translate>${esc(n.label)}</strong></button></td><td>${types[n.type].label}</td><td>${esc(versionName(n.version))}</td><td><span class="tag ${n.type==='asset'?'amber':'green'}">${n.type==='asset'?'待复核':n.type==='claim'?'有来源声明':n.type==='source'?'公开官方来源':'关联证据'}</span></td><td class="num">${graph.edges.filter(e=>e.source===n.id||e.target===n.id).length}</td><td>${n.origin==='local-import'?`<button class="icon-button" data-delete="${esc(n.id)}" aria-label="删除笔记 ${esc(n.label)}">${icon('trash')}</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">没有符合条件的资产。</td></tr>';localize($('#library-rows'));}
function analyticsPage(){const a=analyzeRecords(corpus,state.version);const coverage=a.citationCoverage.ratio, pct=coverage===null?'—':Math.round(coverage*100);const global=analyzeRecords(corpus);const max=Math.max(1,...Object.values(global.byVersion).map(x=>Math.max(x.sources,x.claims)));const rows=Object.entries(a.byTopic).filter(([t])=>!state.topic||t===state.topic).sort((x,y)=>x[1].sources-y[1].sources||x[1].claims-y[1].claims||String(topicNames[x[0]]||x[1].label||x[0]).localeCompare(String(topicNames[y[0]]||y[1].label||y[0]),locale()));return heading('看清知识的结构与边界。','基于当前证据库的可复算指标。点选图表，将主题筛选同步到明细。',`${versionSelect()}<button class="button ghost" data-open-ontology aria-label="${esc(tr('查看语义模型与关系说明','View ontology & relationships explanation'))}">${icon('network')}${tr('语义模型','Ontology')}</button><button class="button" data-export-analysis title="${tr('导出结构与分布分析 (JSON)','Export structural metrics & distributions (JSON)')}" aria-label="${tr('导出结构与分布分析 (JSON)','Export structural metrics & distributions (JSON)')}">${icon('download')}${tr('导出分析','Export analysis')}</button>`)+metrics(a,true)+`<div class="analysis-grid"><section class="panel"><div class="panel-head"><div><h2>${tr(isCollection()?'资料集中的知识分布':'版本间的知识分布',isCollection()?'Knowledge by collection':'Knowledge by version')}</h2><p>${tr('全库对照 · 点击范围筛选主题与明细','Compare the library · Select a scope to filter details')}</p></div><span class="tag">${tr('单位：条（记录 / 声明）','Unit: records / claims')}</span></div><div class="chart-container"><div class="chart-legend"><span><i></i>${tr('知识声明','Claims')}</span><span><i></i>${tr('来源记录','Source records')}</span></div><div class="axis-note">数量（0–${max}）</div><div class="chart-bars">${versions().map(({id:v})=>`<button class="chart-group" data-version="${v}" aria-label="${esc(versionName(v))}: ${global.byVersion[v].claims} ${tr("条声明","claims")}, ${global.byVersion[v].sources} ${tr("条来源记录","source records")}" aria-pressed="${state.version===v}"><div class="chart-column" style="height:${global.byVersion[v].claims/max*88}%"><span>${global.byVersion[v].claims}</span></div><div class="chart-column alt" style="height:${global.byVersion[v].sources/max*88}%"><span>${global.byVersion[v].sources}</span></div><span class="x-label">${esc(versionName(v))}</span></button>`).join('')}</div><div class="bottom-space"></div></div></section><section class="panel"><div class="panel-head"><div><h2>引用结构覆盖</h2><p>${tr('有效且资料范围一致的引用 / 全部声明','Valid, scope-matched citations / all claims')}</p></div><span class="tag green">可追溯</span></div><div class="quality-grid"><div class="donut" style="--coverage:${pct==='—'?0:pct}%" role="img" aria-label="引用结构覆盖 ${pct}%"><strong>${pct}${pct==='—'?'':'%'}</strong></div><div class="quality-legend"><p><b>${a.citationCoverage.versionBound}</b> ${tr('条引用范围一致','scope-matched citations')}</p><p><b>${a.citationCoverage.totalClaims-a.citationCoverage.versionBound}</b> 条待补充或不一致</p><p>当前范围：${versionName(state.version)}</p></div></div><p class="small-note">这是引用结构的完整度，不能等同事实准确率、检索召回率或生产迁移安全率。</p></section></div><div class="analysis-grid"><section class="panel"><div class="panel-head"><div><h2>主题证据覆盖</h2><p>${tr('来源记录数 · 多条记录可源自同一文献，同一文献也可覆盖多个主题','Source record count · Multiple records may come from the same document, and one document may cover multiple topics')}</p></div>${state.topic?'<button class="text-button" data-clear-topic>清除主题筛选 ×</button>':`<span class="tag">${tr('单位：条（记录 / 声明）','Unit: records / claims')}</span>`}</div>${bars(a)}<p class="subtext">${state.topic?'已筛选：'+esc(topicNames[state.topic]):tr('点选主题或横条，可联动右侧资产与下方明细；多条来源记录可指向同一文献。','Select a topic or bar to filter related assets and the detail table; multiple source records may point to the same document.')}</p></section><section class="panel"><div class="panel-head"><div><h2>待复核的关联资产</h2><p>主题提及形成候选关系，需人工验证</p></div><span class="tag amber">候选影响</span></div><div style="padding:0 20px 15px">${filterGraph(graph,{version:state.version}).nodes.filter(n=>n.type==='asset'&&(!state.topic||n.topics.includes(state.topic))).map(n=>`<button class="queue-item" data-node="${esc(n.id)}"><span class="queue-icon">${icon('book')}</span><span><strong data-no-translate>${esc(n.label)}</strong><small>${esc(n.topics.map(t=>topicNames[t]||t).join(' · '))}</small></span>${icon('chevron')}</button>`).join('')||'<p class="empty">当前范围没有关联资产</p>'}</div></section></div><section class="panel"><div class="panel-head"><h2>知识覆盖明细</h2><span class="tag">${versionName(state.version)}${state.topic?' / '+esc(topicNames[state.topic]):''}</span></div><div class="table-wrap"><table class="coverage-table" data-scope-kind="${isCollection()?'collection':'version'}"><thead><tr><th>主题</th><th class="num">${tr('来源记录','Source records')}</th><th class="num">知识声明</th><th class="num">候选资产</th><th>${scopeLabel()}</th></tr></thead><tbody>${rows.map(([t,v])=>{const docs=v.distinctDocuments??v.sources;return `<tr><td><button data-node="topic:${esc(t)}"><strong>${esc(v.label)}</strong></button></td><td class="num">${v.sources}${docs<v.sources?` <small class="muted">${tr(`（源自 ${docs} 份文献）`,`(from ${docs} docs)`)}</small>`:''}</td><td class="num">${v.claims}</td><td class="num">${v.assets}</td><td>${v.versions.map(v=>isCollection()?versionName(v):v).join(' / ')}</td></tr>`;}).join('')}</tbody></table></div></section>`}
function reviewSignature(e){const canonical=localizeCorpus(corpus,'zh');const event=memoryEvents(canonical).find(x=>x.id===e.id);return JSON.stringify({event,sources:canonical.sources.filter(s=>e.sourceIds.includes(s.id))})}
function reviewAt(e){const r=reviews[e.id];return r&&r.signature===reviewSignature(e)?r.at:null}
function memoryPage(){const events=memoryEvents(corpus);if(!events.length)return evidenceMemoryPage();const scopes=[...new Set(events.flatMap(e=>[e.fromVersion,e.toVersion]).filter(Boolean))].map(v=>versionName(v)).join(' → ');const scopeSuffix=scopes?`（${esc(scopes)}）`:'';const scopeSuffixEn=scopes?` (${esc(scopes)})`:'';return heading('知识会改变，来路始终清晰。','保留旧知识，对照新证据，让每次复核都有迹可循。',`<button class="button" data-export-memory title="${tr('导出本地复核记录 (JSON)','Export local review record (JSON)')}" aria-label="${tr('导出本地复核记录 (JSON)','Export local review record (JSON)')}">${icon('download')}${tr('导出版本记录','Export review history')}</button>`)+`<div class="memory-banner">${icon('history')}<div><h3>${tr('浏览器本地版本复核 · MOI Memoria 未连接','Browser-local version review · MOI Memoria not connected')}</h3><p>${tr(`以下 ${events.length} 组记录是当前实验场基于精选官方证据整理的成对版本对照${scopeSuffix}，并非变更发生日期或 MOI Memoria 原生版本操作。复核状态仅保存在当前浏览器的 localStorage 中，底层证据变更时自动失效，不会同步至未连接的 MOI Memoria 服务。`,`The ${events.length} entries below are paired curated evidence comparisons${scopeSuffixEn} in this lab, not event occurrence dates or native MOI Memoria version operations. Review status is stored only in this browser’s localStorage, invalidates if underlying evidence changes, and is never synced to the unconnected MOI Memoria service.`)}</p></div><span class="tag blue">${tr('MOI Memoria 未连接 · 仅本地复核','MOI Memoria not connected · Local-only review')}</span></div>${moiMemoryBoundary(true)}<div class="timeline">${events.map(e=>`<article class="panel memory-item"><h3>${esc(topicNames[e.topic]||e.topic)}<span class="tag ${reviewAt(e)?'green':'amber'}">${reviewAt(e)?'本地已复核':'待复核'}</span></h3><div class="memory-meta"><span>证据校验：${esc(e.recordedAt||'未记录')}</span><span>来源：${e.sourceIds.length} 份（${esc(e.sourceIds.join('、'))}）</span><span>版本对照，非变更发生日期</span></div><div class="diff"><div><small>${tr("之前","Before")} / ${esc(versionName(e.fromVersion))} · <span class="mono">${esc(e.before.claimIds.join(', '))}</span></small><p>${esc(e.before.text)}</p></div><div><small>${tr("之后","After")} / ${esc(versionName(e.toVersion))} · <span class="mono">${esc(e.after.claimIds.join(', '))}</span></small><p>${esc(e.after.text)}</p></div></div><div class="memory-actions"><button class="button small review-button" data-review="${esc(e.id)}" aria-pressed="${Boolean(reviewAt(e))}">${icon('check')}${reviewAt(e)?'撤销本地复核':'标记为已复核'}</button><button class="text-button" data-node="topic:${esc(e.topic)}">查看完整证据链 ${icon('arrow')}</button><span>${reviewAt(e)?'本地复核于 '+esc(new Date(reviewAt(e)).toLocaleString(locale())):'复核状态仅保存在当前浏览器（未同步至 MOI Memoria）'}</span></div></article>`).join('')}</div>`}
const connectors=[{key:'markdown',label:'Markdown & Obsidian',symbol:'◈',tag:'浏览器内可用',tone:'green',desc:'导入 .md / .txt，保留正文、#标签与 [[双链]]。无需把笔记放入数据库。',action:'导入一份笔记'},{key:'moi',label:'MOI Knowledge',symbol:'M',tag:'原生接入待完成',tone:'blue',desc:'官方支持文档知识探索及多类数据连接。当前页面使用已核查的公开证据集。',action:'查看接入范围'},{key:'memoria',label:'MOI Memoria',symbol:'↶',tag:'服务与权限待验证',tone:'blue',desc:'设计为默认追溯底座：快照、分支、差异与回退。当前展示文档版本对照。',action:'查看默认追溯契约'},{key:'snowflake',label:'Snowflake',symbol:'❄',tag:'可扩展连接方案',tone:'purple',desc:'适合已有 Snowflake 数据资产的组织。通过授权接口加入表、指标和非结构化资产元数据。',action:'查看连接方案'},{key:'denodo',label:'Denodo',symbol:'D',tag:'可扩展连接方案',tone:'purple',desc:'在已有企业数据虚拟化环境中，复用受治理的数据服务与业务语义，减少重复搬运。',action:'查看连接方案'},{key:'files',label:'更多文档与信息',symbol:'▤',tag:'解析管线待建设',tone:'amber',desc:'PDF、Office、网页与会议记录可以成为知识源。需要解析、权限继承和来源锚点。',action:'查看格式路线'}];
function connectionsPage(){return heading('连接信息孤岛，尊重原有边界。','从文件和笔记开始，逐步接入企业数据与记忆服务。')+`<div class="connect-grid">${connectors.map(c=>`<article class="panel connect-card"><div class="connector-icon">${c.symbol}</div><h3>${c.label}</h3><span class="tag ${c.tone}">${c.tag}</span><p>${c.desc}</p><button class="button" data-connector="${c.key}">${c.action} ${icon('arrow')}</button></article>`).join('')}</div><section class="panel"><div class="panel-head"><h2>面向知识对象的连接路径</h2><span class="tag">架构设计</span></div><div class="architecture"><div><strong>文档 / 文件 / 数据服务</strong><small>保留权限与原始出处</small></div>${icon('arrow')}<div><strong>MOI 知识与记忆底座</strong><small>检索 · 版本 · 追溯</small></div>${icon('arrow')}<div><strong>Knowligence 本体</strong><small>对象 · 关系 · 证据 · 动作</small></div></div><p class="small-note">Denodo 与 Snowflake 是可选适配层。当前核查的 MOI 5.0 连接器表单未列出二者，不能据此宣称已原生接通。</p></section>`}
const expeditionOutfits={E01:['罗盘启航','Compass captain'],E02:['月夜领航','Moon navigator'],E03:['雨天寻宝','Rainy-day scout'],E04:['轨道漫游','Orbital explorer'],E05:['森林侦察','Forest ranger'],E06:['珊瑚潜游','Coral diver'],E07:['书海制图','Book cartographer'],E08:['雪山提灯','Snowy mountaineer'],E09:['甜点远征','Pastry explorer'],E10:['星图守望','Stargazer'],E11:['花园采集','Field botanist'],E12:['极光梦航','Aurora dreamer']};
const kikoNames={A1:['罗盘船长','Compass captain'],A2:['罗盘船长','Compass captain'],B1:['书本船长','Book captain'],B2:['书本船长','Book captain'],C1:['远航船长','Voyager captain'],C2:['远航船长','Voyager captain'],D1:['团子船长','Mochi captain'],D2:['月兔航海家','Moon bunny'],D3:['星图水獭','Atlas otter'],X1:['星云梦航家','Nebula dreamer'],...expeditionOutfits};
function isSameClassicDesign(a,b){if(a===b)return true;const map={A2:'A1',B2:'B1',C2:'C1',A1:'A1',B1:'B1',C1:'C1'};return Boolean(map[a]&&map[a]===map[b]);}
function kikoCollectionLabel(k){if(Object.hasOwn(expeditionOutfits,k))return tr('航海衣橱','Expedition wardrobe');if(k.startsWith('D'))return tr('柔软探险系列','Soft explorer collection');if(k==='X1')return tr('隐藏收藏款','Secret collectible');return tr('经典船长系列','Original captain collection');}
function kikoImageHtml(k,altText,extraClass=''){return `<div class="kiko-img-wrap ${extraClass}"><img loading="lazy" src="/assets/kiko-${esc(k)}.png" alt="${esc(altText)}" onload="this.closest('.kiko-img-wrap')?.classList.add('is-loaded')" onerror="this.closest('.kiko-img-wrap')?.classList.add('img-error');this.hidden=true"><span class="kiko-img-fallback" aria-hidden="true">Kiko · ${esc(k)}</span></div>`;}
function discoveredOutfits(){const saved=storage.get('kikoDiscoveries',[]);return Array.isArray(saved)?[...new Set(saved.filter(id=>Object.hasOwn(expeditionOutfits,id)))]:[];}
function revealOutfit(id){if(!Object.hasOwn(expeditionOutfits,id))return;const found=discoveredOutfits();if(!found.includes(id)&&!storage.set('kikoDiscoveries',[...found,id]))return;render();$(`[data-kiko="${id}"]`)?.focus();toast(tr('新伙伴已揭晓：','Meet your companion: ')+tr(...expeditionOutfits[id]));}
function expeditionCollection(){const found=discoveredOutfits(),next=Object.keys(expeditionOutfits).find(id=>!found.includes(id));return `<section class="expedition-collection"><div class="section-heading"><div><h2>${tr('十二段旅程，十二套新装。','Twelve journeys. Twelve new outfits.')}</h2><p class="muted">${tr('逐个开启免费的航海档案，找到你的探索搭档。','Open free expedition files and find your exploration companion.')}</p></div><span class="tag">${found.length} / 12 ${tr('已发现','discovered')}</span></div><div class="collection-actions"><p>${tr('每盒固定一款 · 可全部免费开启 · 无随机概率或付费 · 收藏保存在此浏览器','One fixed outfit per box · All free · No odds or purchases · Saved in this browser')}</p>${next?`<button class="button" data-reveal-outfit="${next}">${icon('sparkles')}${tr('开启下一份档案','Open the next file')}</button>`:`<span class="tag green">${tr('全系列已收藏','Collection complete')}</span>`}</div><div class="brand-grid expedition-grid">${Object.entries(expeditionOutfits).map(([id,names],i)=>{const open=found.includes(id),selected=state.kiko===id;return `<article class="panel brand-option expedition-option ${open?'revealed':'sealed'} ${selected?'is-selected':''}">${open?kikoImageHtml(id,tr(...names)):`<div class="outfit-envelope" aria-hidden="true"><span class="envelope-number">${String(i+1).padStart(2,'0')}</span>${icon('compass')}<span>EXPEDITION FILE</span></div>`}<footer><div><strong>${open?esc(tr(...names)):tr('未启封的旅程','An unopened journey')}</strong><small><span class="mono">${id}</span> · ${open?tr('航海衣橱','Expedition wardrobe'):tr('里面会是谁？','Who is waiting inside?')}</small></div><button class="button" ${open?`data-kiko="${id}" data-preview-kiko="${id}" aria-pressed="${selected}"`:`data-reveal-outfit="${id}"`}>${open?(selected?tr('当前搭档 · 预览','Selected · Preview'):tr('预览搭档','Preview outfit')):tr('揭晓盲盒','Reveal outfit')}</button></footer></article>`;}).join('')}</div></section>`;}
function brandPage(){const unlocked=storage.get('kikoUnlocked',false);const card=k=>{const selected=isSameClassicDesign(state.kiko,k);return `<article class="panel brand-option ${selected?'is-selected':''}">${kikoImageHtml(k,tr(...kikoNames[k]))}<footer><div><strong>${esc(tr(...kikoNames[k]))}</strong><small><span class="mono">${k}</span> · ${kikoCollectionLabel(k)}</small></div><button data-kiko="${k}" data-preview-kiko="${k}" aria-pressed="${selected}">${selected?tr('当前搭档 · 预览','Selected · Preview'):tr('预览搭档','Preview outfit')}</button></footer></article>`;};return heading('Meet Captain Kiko.','对未知保持好奇，对每个答案保留证据。')+`<section class="panel brand-intro">${kikoImageHtml(state.kiko,'Captain Kiko','brand-intro-img')}<div><h2>${tr('小小船长，大大好奇心。','Small captain. Big curiosity.')}</h2><p>${tr('选择一位探险搭档。它会陪你出现在工作台和助手里，记住你的选择。','Choose an exploration companion for your workspace and assistant. Your choice stays with you.')}</p><button class="button" data-open-assistant>和 Kiko 一起探索 ${icon('arrow')}</button></div></section>`+kikoWardrobeBoundary()+`${expeditionCollection()}<div class="section-heading"><h2>${tr('柔软探险系列','The soft explorer collection')}</h2><span class="tag">${tr('3 位新伙伴','3 new companions')}</span></div><div class="brand-grid">${['D1','D2','D3'].map(card).join('')}</div><section class="panel blind-box ${unlocked?'revealed':''}">${unlocked?`${kikoImageHtml('X1',tr(...kikoNames.X1),'blind-box-img')}<div><span class="tag">${tr('隐藏款已解锁','Secret companion unlocked')}</span><h2>${tr(...kikoNames.X1)}</h2><p>${tr('未知，也是探索的礼物。你可以随时选择这位伙伴。','A little gift from the unknown. Your secret companion is yours to choose.')}</p><button class="button" data-kiko="X1" data-preview-kiko="X1" aria-pressed="${state.kiko==='X1'}">${state.kiko==='X1'?tr('当前搭档 · 预览','Selected · Preview'):tr('预览搭档','Preview outfit')}</button></div>`:`<div class="mystery-symbol" aria-hidden="true">?</div><div><h2>${tr('还有一位伙伴，在星光后面。','Someone is waiting beyond the stars.')}</h2><p>${tr('打开这份免费的探索盲盒，揭晓一位隐藏船长。','Open a free discovery box and meet one secret captain.')}</p><button class="button" data-reveal-kiko>${icon('sparkles')}${tr('揭晓隐藏款','Reveal secret companion')}</button><small>${tr('固定隐藏款 · 无付费、无抽奖概率','One fixed collectible · No purchase or odds')}</small></div>`}</section><details class="classic-collection"><summary>${tr('经典系列 · 3 款','Original collection · 3 styles')}</summary><div class="brand-grid">${['A1','B1','C1'].map(card).join('')}</div></details>`}
function render(){graphResizeObserver?.disconnect();const hashRoute=normalizeRoute(location.hash.replace(/^#/,''));if(titles[hashRoute])state.route=hashRoute;else if(titles[normalizeRoute(state.route)])state.route=normalizeRoute(state.route);else state.route='overview';$('#page-crumb').textContent=titles[state.route];$$('[data-route]').forEach(a=>{const match=normalizeRoute(a.dataset.route)===state.route;a.classList.toggle('active',match);if(match)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});closeNavigation(false);const views={overview,graph:graphPage,mindmap:mindmapPage,library:libraryPage,analytics:analyticsPage,memory:memoryPage,connections:connectionsPage,brand:brandPage};$('#app').innerHTML=`<div class="page-enter">${views[state.route]()}</div>`;if(state.route==='overview')drawGraph($('#overview-graph'),graph,true);if(state.route==='graph')refreshGraph();if(state.route==='library')drawLibrary();bindViewInputs();localize($('#app'));updateShell();}
function navigateNode(id){state.route='graph';state.selected=id;state.graphMode='knowledge';state.inspectorSheetOpen=true;state.pendingFocusSelected=true;if(location.hash==='#graph')render();else location.hash='graph'}
function graphSubset(){return filterGraph(graph,{version:state.version,search:state.search,types:state.types})}
// Helpers to be inserted into atlas.js

function ensureImpactData(){
 if(impactDemoCache)return Promise.resolve(impactDemoCache);
 if(impactLoadingPromise)return impactLoadingPromise;
 impactError=null;
 const currentReqId=++impactRequestId;
 const controller=typeof AbortController!=='undefined'?new AbortController():null;
 impactAbortController=controller;

 impactLoadingPromise=new Promise((resolve,reject)=>{
  let settled=false;
  const timeoutId=setTimeout(()=>{
   if(settled)return;
   settled=true;
   try{controller?.abort?.();}catch{}
   const err=new Error('timeout');
   err.code='timeout';
   reject(err);
  },15000);

  fetch('/assets/impact-demo.json',{signal:controller?.signal})
   .then(res=>{
    if(!res.ok){
     const err=new Error('http_error');
     err.code='http_error';
     err.status=res.status;
     throw err;
    }
    return res.json().catch(parseErr=>{
     const err=new Error('parse_error');
     err.code='parse_error';
     throw err;
    });
   })
   .then(data=>{
    if(settled)return;
    settled=true;
    clearTimeout(timeoutId);
    try{
     validateImpactDemo(data);
     resolve(data);
    }catch(valErr){
     const err=new Error('validation_error');
     err.code='validation_error';
     reject(err);
    }
   })
   .catch(err=>{
    if(settled)return;
    settled=true;
    clearTimeout(timeoutId);
    reject(err);
   });
 })
  .then(data=>{
   if(currentReqId===impactRequestId){
    impactDemoCache=data;
    impactError=null;
   }
   return data;
  })
  .catch(err=>{
   if(currentReqId===impactRequestId){
    impactDemoCache=null;
    impactError=err?.code||(err?.name==='AbortError'?'timeout':'network_error');
   }
   return null;
  })
  .finally(()=>{
   if(currentReqId===impactRequestId){
    impactLoadingPromise=null;
    impactAbortController=null;
   }
  });

 return impactLoadingPromise;
}

function graphPage(){
 const canImpact = state.workspace==='numpy';
 const isImpact = canImpact && state.graphMode==='impact';
 const switchHtml = canImpact ? `<div class="graph-view-switch" role="group" aria-label="${tr('图谱视图切换','Graph view switcher')}"><button class="${!isImpact?'active':''}" data-graph-mode="knowledge">${tr('知识关系','Knowledge relations')}</button><button class="${isImpact?'active':''}" data-graph-mode="impact">${tr('影响路径','Impact paths')}</button></div>` : '';

 if(isImpact){
  const hasValidData=!!(impactDemoCache&&getVersionGraph(impactDemoCache,state.impactVersion));
  return heading(tr('为什么需要复核。','Why review is required.'),tr('追踪旧代码建议如何在新目标版本中演变，并回到原件行号与官方证据。','Trace legacy advice to upstream version changes and official provenance.'),switchHtml+`<div class="export-action-group"><button class="button ${!hasValidData?'disabled':''}" data-export-impact title="${tr('导出受控演示影响图谱快照 (JSON)','Export controlled impact graph snapshot (JSON)')}" aria-label="${tr('导出受控演示影响图谱快照 (JSON)','Export controlled impact graph snapshot (JSON)')}" aria-describedby="impact-export-reason" ${!hasValidData?'disabled aria-disabled="true"':''}>${icon('download')}${tr('导出当前图谱','Export graph')}</button><span id="impact-export-reason" class="export-reason" ${hasValidData?'hidden':''}>${tr('演示数据尚未就绪，加载完成后可导出','Demo data is not ready yet; export unlocks once loaded')}</span></div>`)+`<div class="impact-banner"><span class="badge">${tr('自建演示资料包','Self-authored demo')}</span><span>${tr('本展示基于仓库自建的受控演示资料（A.md、B.py、C.md），不扫描本地文件或第三方代码，未调用在线外部模型。','Based on a repository-authored demonstration fixture (A.md, B.py, C.md); zero code execution or external model calls.')}</span></div><div class="controls"><label class="search-field" style="max-width:240px;align-items:center">${tr('目标适用版本：','Target Version: ')}<select id="impact-version-select" aria-label="${tr('选择目标版本','Select target version')}" style="padding:4px 8px;border:1px solid var(--line);border-radius:var(--radius-control);background:var(--paper);color:var(--ink);font-size:13px;margin-left:6px"><option value="2.0" ${state.impactVersion==='2.0'?'selected':''}>NumPy 2.0 (${tr('包含破坏性移除','breaking removals')})</option><option value="1.26" ${state.impactVersion==='1.26'?'selected':''}>NumPy 1.26 (${tr('旧别名仍兼容','legacy alias valid')})</option></select></label><span class="spacer"></span><button class="text-button" data-clear-impact>${tr('重置选择','Reset')}</button></div><div class="graph-layout"><section class="panel"><div class="impact-canvas-container" id="main-impact-canvas"></div><div class="graph-bottom"><div class="impact-legend"><span class="impact-legend-item"><span class="legend-line author"></span> ${tr('作者声明引用 (B → A)','Author-declared reference (B → A)')}</span><span class="impact-legend-item"><span class="legend-line derived"></span> ${tr('建议复核 (A → B)','Derived review candidate (A → B)')}</span></div><span id="impact-stats"></span></div></section><aside class="panel inspector ${state.inspectorSheetOpen?'sheet-open':'sheet-collapsed'}" id="inspector"></aside></div>`;
 }

 return heading('沿着关系，发现知识。','从文档走向结论，再追踪它关联的主题与工作资产。',switchHtml+`<button class="button" data-export-graph title="${tr('导出当前知识图谱快照 (JSON)','Export current knowledge graph snapshot (JSON)')}" aria-label="${tr('导出当前知识图谱快照 (JSON)','Export current knowledge graph snapshot (JSON)')}">${icon('download')}${tr('导出当前图谱','Export graph')}</button>`)+`<div class="controls"><label class="search-field">${icon('search')}<input id="graph-search" value="${esc(state.search)}" placeholder="搜索当前图谱…" aria-label="搜索当前图谱"></label>${versionSelect()}<span class="spacer"></span>${Object.entries(types).map(([k,t])=>`<button class="filter-chip ${!state.types.length||state.types.includes(k)?'active':''}" data-type="${k}" aria-pressed="${!state.types.length||state.types.includes(k)}">${t.label}</button>`).join('')}<button class="text-button" data-clear-graph>重置</button></div><div class="graph-layout"><section class="panel"><div class="graph-canvas" id="main-graph"></div><div class="graph-bottom">${legend()}<span id="graph-stats"></span></div>${graphOntologyNote()}</section><aside class="panel inspector ${state.inspectorSheetOpen?'sheet-open':'sheet-collapsed'}" id="inspector"></aside></div>`;
}

function refreshGraph(){
 impactResizeObserver?.disconnect();
 if(state.workspace==='numpy'&&state.graphMode==='impact'){
  refreshImpactGraph();
  return;
 }
 const g=graphSubset();
 const existsInFull=Boolean(state.selected&&graph.nodes.some(n=>n.id===state.selected));
 const inFiltered=Boolean(state.selected&&g.nodes.some(n=>n.id===state.selected));
 if(!state.selected||!existsInFull){
  state.selected=g.nodes.find(n=>n.type==='topic')?.id||g.nodes[0]?.id||null;
 }
 drawGraph($('#main-graph'),g,false);
 $('#graph-stats').textContent=`${g.nodes.length} 个对象 · ${g.edges.length} 条关系`;
 drawInspector(g);
 localize($('#main-graph'));
 localize($('#inspector'));
 localize($('#graph-stats'));
 if(state.pendingFocusSelected){
  state.pendingFocusSelected=false;
  const targetNode=$(`#main-graph [data-graph-node="${state.selected}"]`);
  if(targetNode)targetNode.focus();
  else $('#inspector [data-clear-graph]')?.focus?.();
 }
}

function updateImpactExportButton(){
 const btn=$('[data-export-impact]');
 if(!btn)return;
 const hasValidData=!!(impactDemoCache&&getVersionGraph(impactDemoCache,state.impactVersion));
 btn.disabled=!hasValidData;
 btn.setAttribute('aria-disabled',!hasValidData?'true':'false');
 btn.classList.toggle('disabled',!hasValidData);
 const reason=$('#impact-export-reason');
 if(reason){
  reason.hidden=hasValidData;
  reason.textContent=hasValidData?'':tr('演示数据尚未就绪，加载完成后可导出','Demo data is not ready yet; export unlocks once loaded');
 }
}

function formatImpactErrorCode(code){
 switch(code){
  case 'timeout':
   return tr('加载演示数据超时（15 秒），请重试。','Loading impact demo timed out (15s limit). Please retry.');
  case 'http_error':
   return tr('演示数据服务不可用，请稍后重试。','Demo data service unavailable. Please retry later.');
  case 'parse_error':
   return tr('演示数据格式损坏，无法解析。','Demo data format corrupted; unable to parse.');
  case 'validation_error':
   return tr('演示数据结构校验未通过，已拒绝加载。','Demo data failed structural validation; loading refused.');
  default:
   return tr('演示数据加载失败，请检查网络或重试。','Failed to load demo data. Please retry.');
 }
}

function clearImpactInspectorAndStats(){
 const insp=$('#inspector');
 if(insp)insp.innerHTML='<div class="empty"></div>';
 const stats=$('#impact-stats');
 if(stats)stats.textContent='';
 updateImpactExportButton();
}

async function refreshImpactGraph(){
 const container=$('#main-impact-canvas');
 if(!container)return;
 impactResizeObserver?.disconnect();

 if(!impactDemoCache){
  clearImpactInspectorAndStats();
  container.innerHTML=`<div class="loading skeleton-pulse" role="status" aria-live="polite"><div class="skeleton-bar"></div><div class="skeleton-bar short"></div><span>${tr('正在加载影响路径数据…','Loading impact paths demo…')}</span></div>`;
  const loaded=await ensureImpactData();
  // Guard check: route, workspace, or container might have changed during await
  if(state.route!=='graph'||state.workspace!=='numpy'||state.graphMode!=='impact'||$('#main-impact-canvas')!==container){
   return;
  }
  if(!loaded){
   clearImpactInspectorAndStats();
   const errorMsg=formatImpactErrorCode(impactError);
   container.innerHTML=`<div class="empty" role="alert" aria-live="assertive"><p>${esc(errorMsg)}</p><button class="button small" data-retry-impact>${tr('重试','Retry')}</button></div>`;
   localize(container);
   return;
  }
 }

 if(state.impactVersion!=='1.26'&&state.impactVersion!=='2.0'){
  clearImpactInspectorAndStats();
  const unsupportedVerMsg=tr(`不支持的目标版本 "${state.impactVersion}"。`,`Unsupported target version "${state.impactVersion}".`);
  container.innerHTML=`<div class="empty" role="alert" aria-live="assertive"><p>${esc(unsupportedVerMsg)}</p><button class="button small" data-clear-impact>${tr('重置为默认版本','Reset to default version')}</button></div>`;
  localize(container);
  return;
 }

 const vg=getVersionGraph(impactDemoCache,state.impactVersion);
 if(!vg){
  clearImpactInspectorAndStats();
  container.innerHTML=`<div class="empty" role="alert" aria-live="assertive"><p>${tr('无有效图谱数据。','No valid graph data available.')}</p><button class="button small" data-clear-impact>${tr('重置为默认版本','Reset to default version')}</button></div>`;
  localize(container);
  return;
 }

 // If target version is 1.26, ensure no stale derived edge is selected
 if(state.impactVersion==='1.26'&&state.impactSelectedEdge&&state.impactSelectedEdge.includes('derived_review_candidate')){
  state.impactSelectedEdge=null;
  state.impactSelectedNode='A';
 }

 if(!state.impactSelectedNode&&!state.impactSelectedEdge){
  state.impactSelectedNode='A';
 }

 const renderView=()=>{
  const width=container.clientWidth||container.getBoundingClientRect?.().width||760;
  container.innerHTML=renderImpactSvg(vg,{width,height:460,selectedNodeId:state.impactSelectedNode,selectedEdgeId:state.impactSelectedEdge,lang:state.lang});
  $('#impact-stats').textContent=`${vg.nodes.length} ${tr('个演示节点','demo nodes')} · ${vg.edges.length} ${tr('条影响路径','impact paths')}`;
  $('#inspector').innerHTML=inspectorSheetHeaderHtml()+renderImpactInspector(vg,{selectedNodeId:state.impactSelectedNode,selectedEdgeId:state.impactSelectedEdge},state.lang);
  syncInspectorSheetClasses();
  localize($('#inspector'));
  localize($('#impact-stats'));
  updateImpactExportButton();
  bindImpactInteractions(container,vg);
 };

 renderView();

 if(typeof ResizeObserver!=='undefined'){
  let oldWidth=container.clientWidth||760;
  impactResizeObserver=new ResizeObserver(entries=>{
   const next=entries[0].contentRect.width;
   if(Math.abs(next-oldWidth)>4){
    oldWidth=next;
    renderView();
   }
  });
  impactResizeObserver.observe(container);
 }
}

function bindImpactInteractions(container,vg){
 const highlightNode=(nodeId)=>{
  container.querySelectorAll('[data-impact-node]').forEach(el=>{
   el.classList.toggle('selected',el.dataset.impactNode===nodeId);
  });
 };

 const highlightEdge=(edgeId)=>{
  container.querySelectorAll('[data-impact-edge]').forEach(el=>{
   el.classList.toggle('selected',el.dataset.impactEdge===edgeId);
  });
 };

 const focusPaths=(activeNodeId,activeEdgeId)=>{
  if(!activeNodeId&&!activeEdgeId){
   container.querySelectorAll('[data-impact-node]').forEach(el=>{
    el.classList.remove('dimmed','highlighted','hovered');
   });
   container.querySelectorAll('[data-impact-edge]').forEach(el=>{
    el.classList.remove('dimmed','highlighted','hovered');
   });
   return;
  }
  if(activeNodeId){
   const relatedEdges=new Set(vg.edges.filter(e=>e.source===activeNodeId||e.target===activeNodeId).map(e=>e.id));
   const relatedNodes=new Set([activeNodeId]);
   vg.edges.filter(e=>e.source===activeNodeId||e.target===activeNodeId).forEach(e=>{
    relatedNodes.add(e.source);relatedNodes.add(e.target);
   });
   container.querySelectorAll('[data-impact-node]').forEach(el=>{
    const id=el.dataset.impactNode;
    el.classList.toggle('highlighted',id===activeNodeId);
    el.classList.toggle('dimmed',!relatedNodes.has(id));
   });
   container.querySelectorAll('[data-impact-edge]').forEach(el=>{
    const id=el.dataset.impactEdge;
    el.classList.toggle('highlighted',relatedEdges.has(id));
    el.classList.toggle('dimmed',!relatedEdges.has(id));
   });
  }else if(activeEdgeId){
   const edge=vg.edges.find(e=>e.id===activeEdgeId);
   const endpoints=edge?new Set([edge.source,edge.target]):new Set();
   container.querySelectorAll('[data-impact-node]').forEach(el=>{
    const id=el.dataset.impactNode;
    el.classList.toggle('highlighted',endpoints.has(id));
    el.classList.toggle('dimmed',!endpoints.has(id));
   });
   container.querySelectorAll('[data-impact-edge]').forEach(el=>{
    const id=el.dataset.impactEdge;
    el.classList.toggle('highlighted',id===activeEdgeId);
    el.classList.toggle('dimmed',id!==activeEdgeId);
   });
  }
 };

 container.querySelectorAll('[data-impact-node]').forEach(el=>{
  const id=el.dataset.impactNode;
  const select=()=>{
   state.impactSelectedNode=id;
   state.impactSelectedEdge=null;
   state.inspectorSheetOpen=true;
   highlightNode(id);
   highlightEdge(null);
   $('#inspector').innerHTML=inspectorSheetHeaderHtml()+renderImpactInspector(vg,{selectedNodeId:id,selectedEdgeId:null},state.lang);
   syncInspectorSheetClasses();
   localize($('#inspector'));
   el.focus();
  };
  const enter=()=>{el.classList.add('hovered');focusPaths(id,null);};
  const leave=()=>{el.classList.remove('hovered');focusPaths(null,null);};
  el.addEventListener('pointerenter',enter);
  el.addEventListener('pointerleave',leave);
  el.addEventListener('focus',enter);
  el.addEventListener('blur',leave);
  el.addEventListener('click',select);
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
 });

 container.querySelectorAll('[data-impact-edge]').forEach(el=>{
  const id=el.dataset.impactEdge;
  const select=()=>{
   state.impactSelectedEdge=id;
   state.impactSelectedNode=null;
   state.inspectorSheetOpen=true;
   highlightEdge(id);
   highlightNode(null);
   $('#inspector').innerHTML=inspectorSheetHeaderHtml()+renderImpactInspector(vg,{selectedNodeId:null,selectedEdgeId:id},state.lang);
   syncInspectorSheetClasses();
   localize($('#inspector'));
   el.focus();
  };
  const enter=()=>{el.classList.add('hovered');focusPaths(null,id);};
  const leave=()=>{el.classList.remove('hovered');focusPaths(null,null);};
  el.addEventListener('pointerenter',enter);
  el.addEventListener('pointerleave',leave);
  el.addEventListener('focus',enter);
  el.addEventListener('blur',leave);
  el.addEventListener('click',select);
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
 });
}

function shortLabel(n,width){
 if(n.type==='claim'){
  const scope=n.version==='overview'?tr('入门','Foundations'):n.version==='observation'?tr('观测','Observations'):n.version==='baseline'?tr('基线','Baselines'):n.version==='operations'?tr('运营','Operations'):versionName(n.version);
  const rawTitle=String(n.label||'').trim();
  if(!rawTitle||rawTitle==='x')return scope;
  let used=0,result='';
  for(const char of rawTitle){
   used+=/[\u2e80-\u9fff]/.test(char)?12:6.5;
   if(used>width-12)return result+'…';
   result+=char;
  }
  return result;
 }
 const label=n.type==='source'?n.label.replace('NumPy ',''):n.label;
 let used=0,result='';for(const char of label){used+=/[\u2e80-\u9fff]/.test(char)?12:6.5;if(used>width-12)return result+'…';result+=char}
 return result;
}
function graphShape(type){
 const t=types[type];
 if(type==='source')return `<rect x="-11" y="-11" width="22" height="22" rx="2" fill="${t.fill}" stroke="${t.color}" stroke-width="2"/>`;
 if(type==='asset')return `<rect x="-12" y="-12" width="24" height="24" rx="6" fill="${t.color}"/><path d="M-5-3h10m-10 6h10" stroke="var(--paper)" stroke-width="2" stroke-linecap="round"/>`;
 if(type==='claim')return `<circle r="10" fill="var(--paper)" stroke="${t.color}" stroke-width="2.5"/><path d="m-4 0 3 3 5-6" fill="none" stroke="${t.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
 return `<circle r="13" fill="${t.color}"/><circle r="4" fill="var(--paper)"/>`;
}

function filterExcludedBannerHtml(excludedNode){
 if(!excludedNode)return '';
 return `<div class="filter-excluded-banner" role="status"><span>${tr('所选对象不在当前筛选范围内：','The selected object is outside the active filters: ')}<strong data-no-translate>${esc(excludedNode.label)}</strong></span><button class="button small" data-clear-graph data-reset-excluded-node="${esc(excludedNode.id)}">${tr('重置筛选以查看','Reset filters to view')}</button></div>`;
}

function syncFilterExcludedBanner(container,g,preview=false){
 if(!container)return;
 const banner=container.querySelector?.('.filter-excluded-banner');
 if(preview){
  if(banner)banner.remove();
  else if(container.innerHTML&&container.innerHTML.includes('filter-excluded-banner')){
   container.innerHTML=container.innerHTML.replace(/<div class="filter-excluded-banner"[\s\S]*?<\/div>/,'');
  }
  return;
 }
 const excludedNode=state.selected&&!g.nodes.some(n=>n.id===state.selected)?graph.nodes.find(n=>n.id===state.selected):null;
 if(!excludedNode){
  if(banner)banner.remove();
  else if(container.innerHTML&&container.innerHTML.includes('filter-excluded-banner')){
   container.innerHTML=container.innerHTML.replace(/<div class="filter-excluded-banner"[\s\S]*?<\/div>/,'');
  }
  return;
 }
 const html=filterExcludedBannerHtml(excludedNode);
 if(banner){
  banner.outerHTML=html;
 }else if(container.insertAdjacentHTML){
  container.insertAdjacentHTML('afterbegin',html);
 }else{
  container.innerHTML=html+(container.innerHTML||'');
 }
}

function drawGraph(container,g,preview=false){
 graphResizeObserver?.disconnect();
 const hasActiveFilters=state.version!=='all'||Boolean(state.search)||state.types.length>0;
 const excludedNode=!preview&&state.selected&&!g.nodes.some(n=>n.id===state.selected)?graph.nodes.find(n=>n.id===state.selected):null;
 const excludedBanner=filterExcludedBannerHtml(excludedNode);
 if(!g.nodes.length){
  container.innerHTML=excludedBanner+`<div class="empty"><p>${tr('未找到匹配对象。调整搜索、类型或版本后继续探索。','No matching objects. Adjust your search, type or scope.')}</p>${hasActiveFilters?`<button class="button small" data-clear-graph>${tr('清除全部筛选','Clear all filters')}</button>`:''}</div>`;
  return;
 }
 const width=container.clientWidth||container.getBoundingClientRect?.().width||900;
 const layout=layoutGraph(g,{width:preview?Math.max(760,width):width,height:620}),pos=new Map(layout.points.map(p=>[p.id,p]));
 const selected=preview?null:state.selected,edgeLabel=e=>tr(e.relation==='supports'?'文档支持结论':e.relation==='applies-to'?'声明归属于主题':'主题提及或候选影响，待复核',e.relation==='supports'?'Source supports claim':e.relation==='applies-to'?'Claim belongs to topic':'Mention or candidate impact; review required');
 const edgeMarker=rel=>rel==='supports'?'url(#edge-arrow-supports)':rel==='applies-to'?'url(#edge-arrow-applies)':'url(#edge-arrow-impacts)';
 const svgAttrs=preview?`width="${layout.width}" height="${layout.height}"`:`style="width:${layout.width}px;height:${layout.height}px"`;
 const scrollHint=preview?`<div class="graph-scroll-hint">${tr('↔ 左右滑动或滚动可浏览完整四列图谱 · 点击节点查看证据','↔ Scroll horizontally on narrow screens to view all 4 lanes · Click a node to inspect')}</div>`:'';
 container.innerHTML=excludedBanner+`<svg ${svgAttrs} viewBox="0 0 ${layout.width} ${layout.height}" role="group" aria-label="${tr('知识关系图','Knowledge graph')}: ${g.nodes.length} ${tr('节点','nodes')}"><defs><marker id="edge-arrow-supports" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="var(--edge-proven)"/></marker><marker id="edge-arrow-applies" viewBox="0 0 10 10" refX="21" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><circle cx="5" cy="5" r="3.5" fill="var(--paper)" stroke="var(--edge-applies)" stroke-width="2"/></marker><marker id="edge-arrow-impacts" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="var(--edge-candidate)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker></defs><g class="graph-columns">${layout.columns.map((c,i)=>`<text x="${c.x}" y="28" text-anchor="middle">${translateText(types[c.type].label,state.lang)}</text>${i<3?`<text class="lane-arrow" x="${c.x+layout.width*.12665}" y="28" text-anchor="middle">→</text>`:''}<line x1="${c.x}" y1="48" x2="${c.x}" y2="${layout.height-20}"/>`).join('')}</g><g class="viewport">${g.edges.map(e=>{const a=pos.get(e.source),b=pos.get(e.target);return `<path data-edge="${esc(e.id)}" class="graph-edge ${e.relation} ${['supports','applies-to'].includes(e.relation)?'proven':'candidate'}" marker-end="${edgeMarker(e.relation)}" d="M${a.x},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x},${b.y}"><title>${edgeLabel(e)}</title></path>`}).join('')}${g.nodes.map(n=>{const p=pos.get(n.id),src=n.type==='source'?rawSourceFor(n.id):null,topicHint=n.type==='claim'&&n.topics?.[0]?topicNames[n.topics[0]]||n.topics[0]:null,sourceCountHint=n.type==='claim'&&n.sourceIds?.length?tr(`${n.sourceIds.length} 份来源`,`${n.sourceIds.length} sources`):null,metaParts=[n.label,topicHint,src?.publisher,src?.section,versionName(n.version),sourceCountHint].filter(Boolean).join(' · '),fullAria=`${translateText(types[n.type].label,state.lang)}: ${metaParts}`;return `<g class="graph-node ${selected===n.id?'selected':''}" transform="translate(${p.x},${p.y})" data-graph-node="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(fullAria)}"><title data-no-translate>${esc(metaParts)}</title><rect class="node-hitbox" x="-60" y="-18" width="120" height="52" rx="8" fill="transparent"/>${graphShape(n.type)}<text data-no-translate text-anchor="middle" y="30">${esc(shortLabel(n,layout.width*.20))}</text></g>`}).join('')}</g></svg><div class="graph-tooltip" role="status" hidden></div>${scrollHint}${preview?'':`<div class="graph-tools"><button data-zoom="in" aria-label="${tr('放大图谱','Zoom in')}">+</button><button data-zoom="out" aria-label="${tr('缩小图谱','Zoom out')}">−</button><button data-zoom="reset">${tr('重置','Reset')}</button></div>`}`;
 const tooltip=container.querySelector('.graph-tooltip');
 const highlight=id=>{const path=evidencePath(g,id),nodes=new Set(path.nodeIds),edges=new Set(path.edgeIds);container.querySelectorAll('[data-graph-node]').forEach(el=>el.classList.toggle('dimmed',!!id&&!nodes.has(el.dataset.graphNode)));container.querySelectorAll('[data-edge]').forEach(el=>{el.classList.toggle('dimmed',!!id&&!edges.has(el.dataset.edge));el.classList.toggle('highlighted',!!id&&edges.has(el.dataset.edge));});};
 const choose=id=>{if(preview)navigateNode(id);else{state.selected=id;state.inspectorSheetOpen=true;container.querySelectorAll('[data-graph-node]').forEach(el=>el.classList.toggle('selected',el.dataset.graphNode===id));syncFilterExcludedBanner(container,g,preview);drawInspector(g);localize($('#inspector'));highlight(id);}};
 container.querySelectorAll('[data-graph-node]').forEach(el=>{
  const id=el.dataset.graphNode,n=g.nodes.find(n=>n.id===id);
  const src=n?.type==='source'?rawSourceFor(n.id):null;
  const topicHint=n?.type==='claim'&&n.topics?.[0]?topicNames[n.topics[0]]||n.topics[0]:null;
  const sourceCountHint=n?.type==='claim'&&n.sourceIds?.length?tr(`${n.sourceIds.length} 份来源`,`${n.sourceIds.length} sources`):null;
  const enter=()=>{highlight(id);tooltip.textContent=[n.label,topicHint,src?.publisher,src?.section,versionName(n.version),sourceCountHint].filter(Boolean).join(' · ');tooltip.hidden=false;};
  const leave=()=>{highlight(preview?null:state.selected);tooltip.hidden=true;};
  el.addEventListener('pointerenter',enter);el.addEventListener('pointerleave',leave);el.addEventListener('focus',enter);el.addEventListener('blur',leave);
  el.addEventListener('click',()=>choose(id));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(id);}});
 });highlight(selected);
 if(typeof ResizeObserver!=='undefined'){let oldWidth=width;graphResizeObserver=new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(Math.abs(next-oldWidth)>2){oldWidth=next;drawGraph(container,g,preview);}});graphResizeObserver.observe(container);}
 if(preview)return;
 const svg=container.querySelector('svg'),view=container.querySelector('.viewport');let z=1,tx=0,ty=0,drag=null;
 if(!svg||!view)return;
 const apply=()=>view.setAttribute('transform',`translate(${tx} ${ty}) scale(${z})`);
 const zoom=factor=>{z=Math.max(.75,Math.min(2.6,z*factor));tx=layout.width/2*(1-z);ty=layout.height/2*(1-z);apply();};
 container.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{if(b.dataset.zoom==='reset'){z=1;tx=ty=0;apply();}else zoom(b.dataset.zoom==='in'?1.2:1/1.2);});
 svg.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);},{passive:false});
 svg.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.target.closest('[data-graph-node]'))return;drag={x:e.clientX,y:e.clientY,tx,ty};svg.setPointerCapture?.(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!drag)return;tx=drag.tx+e.clientX-drag.x;ty=drag.ty+e.clientY-drag.y;apply();});
 svg.addEventListener('pointerup',()=>drag=null);svg.addEventListener('pointercancel',()=>drag=null);
}
function inspectorSheetHeaderHtml(){
 return `<div class="inspector-sheet-bar"><button type="button" class="inspector-sheet-handle" data-toggle-inspector-sheet aria-expanded="${state.inspectorSheetOpen}" aria-label="${tr(state.inspectorSheetOpen?'收起详情面板':'展开详情面板',state.inspectorSheetOpen?'Collapse inspector':'Expand inspector')}"><span class="sheet-pill" aria-hidden="true"></span><span>${tr('属性与证据','Details & evidence')}</span></button><button type="button" class="icon-button inspector-sheet-close" data-close-inspector-sheet aria-label="${tr('收起详情面板','Collapse inspector')}">×</button></div>`;
}
function syncInspectorSheetClasses(){
 const insp=$('#inspector');
 if(!insp)return;
 insp.classList.toggle('sheet-open',Boolean(state.inspectorSheetOpen));
 insp.classList.toggle('sheet-collapsed',!state.inspectorSheetOpen);
}
function drawInspector(g){
 const n=g.nodes.find(n=>n.id===state.selected);
 const excludedNode=!n&&state.selected?graph.nodes.find(x=>x.id===state.selected):null;
 if(excludedNode){
  $('#inspector').innerHTML=inspectorSheetHeaderHtml()+`<div class="empty"><p>${tr('所选对象不在当前筛选范围内。','The selected object is outside the active filters.')}</p><p class="mono">${esc(excludedNode.id)}</p><button class="button small" data-clear-graph data-reset-excluded-node="${esc(excludedNode.id)}">${tr('重置筛选以查看','Reset filters to view')}</button></div>`;
  syncInspectorSheetClasses();
  return;
 }
 if(!n){
  $('#inspector').innerHTML=inspectorSheetHeaderHtml()+'<div class="empty">选择一个对象查看属性与证据。</div>';
  syncInspectorSheetClasses();
  return;
 }
 const edges=g.edges.filter(e=>e.source===n.id||e.target===n.id);
 const relations=edges.map(e=>({edge:e,node:graph.nodes.find(x=>x.id===(e.source===n.id?e.target:e.source))}));
 const url=safeUrl(n.url);
 const rawSource=n.type==='source'?rawSourceFor(n.id):null;
 const docTotal=distinctDocumentCount(corpus.sources);
 const topicSrcObjs=n.type==='topic'&&n.sourceIds?.length?corpus.sources.filter(s=>n.sourceIds.includes(s.id)):[];
 const topicDocCount=topicSrcObjs.length?distinctDocumentCount(topicSrcObjs):0;
 const sourceCountSummary=n.type==='source'&&docTotal<corpus.sources.length?tr(`${corpus.sources.length} 条记录（源自 ${docTotal} 份文献）`,`${corpus.sources.length} records (from ${docTotal} documents)`):n.type==='topic'&&topicDocCount>0&&topicDocCount<n.sourceIds.length?tr(`${n.sourceIds.length} 条关联来源记录（源自 ${topicDocCount} 份文献）`,`${n.sourceIds.length} linked source records (from ${topicDocCount} documents)`):tr(`${n.sourceIds.length} 条关联来源记录`,`${n.sourceIds.length} linked source records`);
 $('#inspector').innerHTML=inspectorSheetHeaderHtml()+`<div class="type-line"><span class="tag ${n.type==='asset'?'green':n.type==='claim'?'purple':'blue'}">${types[n.type].label}</span>${icon(types[n.type].icon)}</div><h3 data-no-translate>${esc(n.label)}</h3><p data-no-translate>${esc(n.text||n.excerpt||n.question||tr('汇聚同一知识对象下的版本声明与来源，沿关系逐步缩小探索范围。','Follow related claims and sources to narrow your exploration.'))}</p><dl class="property-list"><dt>对象 ID</dt><dd class="mono">${esc(n.id)}</dd><dt>${scopeLabel()}</dt><dd>${esc(versionName(n.version))}</dd>${rawSource?.publisher?`<dt>${tr('发布机构','Publisher')}</dt><dd data-no-translate>${esc(rawSource.publisher)}</dd>`:''}${rawSource?.section?`<dt>${tr('章节 / 条目','Section')}</dt><dd data-no-translate>${esc(rawSource.section)}</dd>`:''}<dt>证据来源</dt><dd>${esc(sourceCountSummary)}</dd><dt>当前图关系</dt><dd class="num">${edges.length}</dd><dt>核查边界</dt><dd>${n.type==='asset'?'用户笔记 / 示例，影响待复核':tr('精选官方文档 · ','Curated official sources · ')+(base.metadata.verified_at||'—')}</dd>${n.tags?.length?`<dt>标签</dt><dd data-no-translate>${esc(n.tags.join(' · '))}</dd>`:''}${n.wikilinks?.length?`<dt>笔记链接</dt><dd data-no-translate>${esc(n.wikilinks.join(' · '))}</dd>`:''}</dl>${url?`<a class="button small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开原始出处 ${icon('external')}</a>`:''}${n.code?`<details><summary style="font-size:12px">查看示例代码</summary><pre class="mono" style="font-size:12px;overflow:auto"><code>${esc(n.code)}</code></pre></details>`:''}<div class="divider"></div><h4>当前图谱关联 <span class="muted num">${relations.length}</span></h4><div class="inspector-links">${relations.map(({node:x,edge:e})=>`<button class="relation-link" data-node="${esc(x.id)}"><span class="tag ${e.relation==='impacts'?'amber':'blue'}">${e.relation==='supports'?'支持':e.relation==='applies-to'?'归属':'待复核'}</span><span data-no-translate>${esc(x.label)}</span></button>`).join('')||'<p class="muted">尚未形成已知关系。</p>'}</div><div class="divider"></div><button class="button small" data-ask="${esc((n.topics?.[0]&&topicNames[n.topics[0]]||n.label)+tr(' 有哪些证据？',' — what does the evidence say?'))}">${icon('sparkles')}请 Kiko 解释证据</button>`;
 syncInspectorSheetClasses();
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null}catch{return null}}
function bindViewInputs(){const ver=$('#view-version');if(ver)ver.onchange=()=>{state.version=ver.value;render()};const gs=$('#graph-search');if(gs)gs.oninput=()=>{state.search=gs.value;refreshGraph()};const ls=$('#library-search');if(ls)ls.oninput=()=>{state.librarySearch=ls.value;drawLibrary()};const iv=$('#impact-version-select');if(iv)iv.onchange=()=>{state.impactVersion=iv.value;state.impactSelectedNode='A';state.impactSelectedEdge=null;render();};}
function serializeExportPayload(data,type){
 if(type==='application/json')return JSON.stringify(data,null,2);
 return String(data??'');
}
function triggerBrowserDownload(name,content,type){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 activeObjectUrls.add(url);
 const a=document.createElement('a');
 a.href=url;
 a.download=name;
 a.hidden=true;
 a.style='display:none';
 const host=document.body||document.documentElement;
 host?.append?.(a);
 try{
  a.click();
 }finally{
  a.remove?.();
  setTimeout(()=>{
   try{URL.revokeObjectURL(url);}catch{}
   activeObjectUrls.delete(url);
  },1000);
 }
}
function showActionToast(message,actionAttr,actionLabel,duration=6000){
 toast(message);
 const btn=document.createElement('button');
 btn.type='button';
 btn.className='toast-undo toast-action';
 btn.dataset[actionAttr]='';
 btn.textContent=actionLabel;
 $('#toast').append(btn);
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),duration);
}
function download(name,data,type='application/json',triggerEl=null,{preSerialized=false}={}){
 if(exportBusy)return false;
 let content;
 try{
  content=preSerialized?String(data??''):serializeExportPayload(data,type);
 }catch(err){
  lastFailedExport={name,data,type,preSerialized:false};
  showActionToast(`${tr('导出失败：','Export failed: ')}${err?.message||name}`,'retryExport',tr('重试导出','Retry export'));
  return false;
 }
 exportBusy=true;
 const wasDisabled=Boolean(triggerEl?.disabled);
 const prevHtml=triggerEl?.innerHTML||'';
 const prevText=triggerEl?.textContent||'';
 const prevAriaLabel=triggerEl?.getAttribute?.('aria-label')||'';
 const busyLabel=tr('正在生成导出…','Generating export…');
 if(triggerEl){
  triggerEl.disabled=true;
  triggerEl.setAttribute('aria-busy','true');
  triggerEl.classList?.add?.('is-busy');
  if(triggerEl.classList?.contains?.('icon-button')){
   triggerEl.setAttribute('aria-label',busyLabel);
  }else{
   triggerEl.textContent=busyLabel;
  }
 }
 try{
   triggerBrowserDownload(name,content,type);
   lastExportSnapshot=Object.freeze({name,content,type,createdAt:new Date().toISOString()});
   lastFailedExport=null;
   showActionToast(`${tr('已发起下载：','Download initiated: ')}${name}`,'redownloadExport',tr('重新下载','Download again'));
  }catch(err){
   lastFailedExport=Object.freeze({name,content,type,preSerialized:true});
   showActionToast(`${tr('导出失败：','Export failed: ')}${err?.message||name}`,'retryExport',tr('重试导出','Retry export'));
  }finally{
   setTimeout(()=>{
   exportBusy=false;
   if(triggerEl){
    triggerEl.removeAttribute('aria-busy');
    triggerEl.classList?.remove?.('is-busy');
    if(triggerEl.classList?.contains?.('icon-button')){
     if(prevAriaLabel)triggerEl.setAttribute('aria-label',prevAriaLabel);
    }else if(prevHtml){
     triggerEl.innerHTML=prevHtml;
    }else if(prevText){
     triggerEl.textContent=prevText;
    }
    triggerEl.disabled=wasDisabled;
    if(triggerEl.matches?.('[data-export-impact]'))updateImpactExportButton();
   }
   },120);
  }
 return true;
}
function redownloadLastExport(triggerEl=null){
 if(!lastExportSnapshot)return false;
 const {name,content,type}=lastExportSnapshot;
 return download(name,content,type,triggerEl,{preSerialized:true});
}
function retryLastFailedExport(triggerEl=null){
 if(!lastFailedExport)return false;
 if(lastFailedExport.preSerialized){
  return download(lastFailedExport.name,lastFailedExport.content,lastFailedExport.type,triggerEl,{preSerialized:true});
 }
 return download(lastFailedExport.name,lastFailedExport.data,lastFailedExport.type,triggerEl);
}
function info(title,html){$('#info-title').textContent=title;$('#info-content').innerHTML=html;openDialog('info-dialog');localize($('#info-dialog'))}
const connectorInfo={moi:['MOI 原生知识接入','MOI 5.0 官方提供文档知识探索和对象存储、数据库等连接。当前已核查表单包含 OSS、S3、HDFS、MatrixOne、Hive、MySQL、SQL Server、Oracle、PostgreSQL、MongoDB、Langfuse。下一步需要实际建立知识库与受限检索权限。','https://docs.matrixorigin.cn/moi/zh/5.0/introduction/index.html'],memoria:['Memoria 默认追溯契约','每条结论必须绑定来源版本、查询快照、适用环境与证据集合。MOI Memoria 官方项目包含 snapshot、branch、diff、rollback 能力；当前账号的服务地址与权限尚未完成验证。本页复核记录是浏览器本地数据，不是 Memoria 的服务日志。','https://github.com/matrixorigin/Memoria'],snowflake:['Snowflake 连接方案','当企业已经使用 Snowflake 时，可将受治理的表、指标、文件元数据映射为 Knowligence 对象，保留原有授权边界。需要另行实现服务端适配与凭据管理；当前没有建立 Snowflake 连接，也未确认 MOI 对其有原生连接器。','https://docs.snowflake.com/en/user-guide/unstructured-intro'],denodo:['Denodo 连接方案','企业已有 Denodo 时，通过授权数据服务读取业务视图和语义元数据，再关联到文档与声明。Denodo 是可选的数据虚拟化适配层；不会成为导入 Markdown/PDF 的前置条件。当前没有建立此连接。','https://www.denodo.com/en/data-management/what-is-data-virtualization'],files:['文档解析路线','浏览器现已支持 Markdown 和 TXT。PDF、Word、PPT、网页与会议记录需要增量解析、来源锚点、权限继承与索引更新。正式接入将先复用 MOI 支持的文件解析能力，再补充格式适配。','https://docs.matrixorigin.cn/moi/zh/5.0/introduction/index.html']};
const ASSISTANT_DEFAULTS={width:404,height:620,minWidth:320,minHeight:360,minHeaderHeight:64,margin:16,rightOffset:24,bottomOffset:24};
function getViewportBounds(){
 const vw=Number(window?.innerWidth)||Number(document?.documentElement?.clientWidth)||1280;
 const vh=Number(window?.innerHeight)||Number(document?.documentElement?.clientHeight)||800;
 return {vw:Math.max(320,vw),vh:Math.max(320,vh)};
}
function isMobileAssistantViewport(){
 return getViewportBounds().vw<=600;
}
function isDesktopSplitAssistantViewport(){
 return getViewportBounds().vw>=1024;
}
function computeClampedAssistantRect(rect=null){
 const {vw,vh}=getViewportBounds();
 if(vw<=600){
  const m=vw<=390?6:8;
  const w=Math.max(260,vw-m*2);
  const h=Math.min(540,Math.max(260,vh-76));
  const x=m;
  const y=Math.max(m,vh-h-m);
  return {x,y,width:w,height:h,mobile:true};
 }
 const margin=ASSISTANT_DEFAULTS.margin;
 const maxW=Math.max(ASSISTANT_DEFAULTS.minWidth,Math.min(720,vw-margin*2));
 const maxH=Math.max(ASSISTANT_DEFAULTS.minHeight,Math.min(820,vh-margin*2));
 const rawW=Number(rect?.width)||ASSISTANT_DEFAULTS.width;
 const rawH=Number(rect?.height)||Math.min(ASSISTANT_DEFAULTS.height,vh-48);
 const width=Math.round(Math.max(ASSISTANT_DEFAULTS.minWidth,Math.min(maxW,rawW)));
 const height=Math.round(Math.max(ASSISTANT_DEFAULTS.minHeight,Math.min(maxH,rawH)));
 const defaultX=Math.max(margin,vw-width-ASSISTANT_DEFAULTS.rightOffset);
 const defaultY=Math.max(margin,vh-height-ASSISTANT_DEFAULTS.bottomOffset);
 const rawX=Number.isFinite(rect?.x)?rect.x:defaultX;
 const rawY=Number.isFinite(rect?.y)?rect.y:defaultY;
 const maxX=Math.max(margin,vw-width-margin);
 const maxY=Math.max(margin,vh-height-margin);
 const x=Math.round(Math.max(margin,Math.min(maxX,rawX)));
 const y=Math.round(Math.max(margin,Math.min(maxY,rawY)));
 return {x,y,width,height,mobile:false};
}
const KIKO_GEOMETRY_STORAGE_KEY='kikoGeometry';
function sanitizeAssistantGeometry(rect){
 if(!rect||typeof rect!=='object'||Array.isArray(rect))return null;
 if(typeof rect.x!=='number'||typeof rect.y!=='number'||typeof rect.width!=='number'||typeof rect.height!=='number')return null;
 if(!Number.isFinite(rect.x)||!Number.isFinite(rect.y)||!Number.isFinite(rect.width)||!Number.isFinite(rect.height))return null;
 if(rect.width<=0||rect.height<=0)return null;
 return {x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)};
}
function loadStoredAssistantGeometry(){
 try{
  const raw=storage.get(KIKO_GEOMETRY_STORAGE_KEY,null);
  return sanitizeAssistantGeometry(raw);
 }catch{
  return null;
 }
}
function saveAssistantGeometry(rect){
 const safe=sanitizeAssistantGeometry(rect);
 if(!safe)return false;
 try{
  if(typeof localStorage?.setItem==='function'){
   localStorage.setItem('knowligence:'+KIKO_GEOMETRY_STORAGE_KEY,JSON.stringify(safe));
   return true;
  }
 }catch{}
 return false;
}
function clearStoredAssistantGeometry(){
 try{
  if(typeof localStorage?.removeItem==='function'){
   localStorage.removeItem('knowligence:'+KIKO_GEOMETRY_STORAGE_KEY);
  }else if(typeof localStorage?.setItem==='function'){
   localStorage.setItem('knowligence:'+KIKO_GEOMETRY_STORAGE_KEY,'null');
  }
  return true;
 }catch{
  return false;
 }
}
function syncShellAssistantSafeSpace(){
 const panel=$('#assistant'),shell=$('#workspace-scroll');
 const isOpen=Boolean(panel&&!panel.hidden&&!state.assistantMinimized);
 const splitActive=false;
 const reservedPx=0;
 if(document.body){
  document.body.classList?.toggle?.('assistant-open',isOpen);
  document.body.classList?.toggle?.('assistant-minimized',Boolean(state.assistantMinimized));
  if(document.body.dataset){
   document.body.dataset.assistantState=isOpen?'open':(state.assistantMinimized?'minimized':'closed');
  }
 }
 if(document.documentElement?.style){
  if(reservedPx>0){
   document.documentElement.style.setProperty?.('--assistant-safe-space',`${reservedPx}px`);
   document.documentElement.style['--assistant-safe-space']=`${reservedPx}px`;
  }else{
   document.documentElement.style.removeProperty?.('--assistant-safe-space');
   delete document.documentElement.style['--assistant-safe-space'];
  }
 }
 if(shell){
  shell.classList?.toggle?.('assistant-safe-split',splitActive);
  if(!shell.dataset)shell.dataset={};
  shell.dataset.assistantSafeSpace=String(reservedPx);
 }
 return reservedPx;
}
function applyAssistantBounds(){
 const panel=$('#assistant');
 if(!panel)return null;
 const next=computeClampedAssistantRect(state.assistantRect);
 if(!next.mobile){
  state.assistantRect={x:next.x,y:next.y,width:next.width,height:next.height};
 }
 if(!panel.style)panel.style={};
 if(next.mobile){
  if(typeof panel.style.removeProperty==='function'){
   ['left','top','right','bottom','width','height'].forEach(p=>panel.style.removeProperty(p));
  }else{
   delete panel.style.left;delete panel.style.top;delete panel.style.right;delete panel.style.bottom;delete panel.style.width;delete panel.style.height;
  }
  panel.dataset.layoutMode='mobile-sheet';
 }else{
  panel.style.left=`${next.x}px`;
  panel.style.top=`${next.y}px`;
  panel.style.right='auto';
  panel.style.bottom='auto';
  panel.style.width=`${next.width}px`;
  panel.style.height=`${next.height}px`;
  panel.dataset.layoutMode='desktop-floating';
 }
 panel.dataset.x=String(next.x);
 panel.dataset.y=String(next.y);
 panel.dataset.width=String(next.width);
 panel.dataset.height=String(next.height);
 syncShellAssistantSafeSpace();
 syncAssistantRelocateUI();
 return next;
}
function syncAssistantRelocateUI(){
 const btn=$('#assistant-relocate');
 if(!btn)return;
 const cue=$('#assistant-relocate-cue')||btn.querySelector?.('.assistant-relocate-cue');
 const isMobile=isMobileAssistantViewport();
 if(isMobile){
  btn.disabled=true;
  btn.setAttribute('aria-disabled','true');
  const mobileLabel=tr('移动窗口仅在桌面端可用','Window relocation is only available on desktop');
  btn.setAttribute('aria-label',mobileLabel);
  btn.setAttribute('title',mobileLabel);
  if(cue)cue.textContent='';
  return;
 }
 btn.disabled=false;
 btn.removeAttribute('aria-disabled');
 const cur=computeClampedAssistantRect(state.assistantRect);
 const {vw}=getViewportBounds();
 const isCurrentlyLeft=(cur.x+cur.width/2)<(vw/2);
 const destinationText=isCurrentlyLeft
  ? tr('右移','Right')
  : tr('左移','Left');
 const label=isCurrentlyLeft
  ? tr('移至右侧','Move to right side')
  : tr('移至左侧（避让右侧详情）','Move to left (reveal right-side details)');
 btn.setAttribute('aria-label',label);
 btn.setAttribute('title',label);
 if(cue)cue.textContent=destinationText;
 btn.dataset.assistantSide=isCurrentlyLeft?'left':'right';
 const panel=$('#assistant');
 if(panel)panel.dataset.assistantSide=isCurrentlyLeft?'left':'right';
}
function relocateAssistant(){
 if(isMobileAssistantViewport())return applyAssistantBounds();
 const cur=computeClampedAssistantRect(state.assistantRect);
 const {vw,vh}=getViewportBounds();
 const margin=ASSISTANT_DEFAULTS.margin;
 const maxX=Math.max(margin,vw-cur.width-margin);
 const maxY=Math.max(margin,vh-cur.height-margin);
 const rightTargetX=Math.round(Math.max(margin,Math.min(maxX,vw-cur.width-ASSISTANT_DEFAULTS.rightOffset)));
 const leftTargetX=Math.round(Math.max(margin,Math.min(maxX,ASSISTANT_DEFAULTS.rightOffset)));
 const isCurrentlyLeft=(cur.x+cur.width/2)<(vw/2);
 const targetX=isCurrentlyLeft?rightTargetX:leftTargetX;
 const targetY=Math.round(Math.max(margin,Math.min(maxY,cur.y)));
 state.assistantRect={x:targetX,y:targetY,width:cur.width,height:cur.height};
 const res=applyAssistantBounds();
 if(res&&!res.mobile)saveAssistantGeometry(res);
 return res;
}
function resetAssistantPosition(){
 clearStoredAssistantGeometry();
 state.assistantRect=null;
 const res=applyAssistantBounds();
 syncAssistantRelocateUI();
 return res;
}
function syncAssistantLauncherLabels(){
 const toggle=$('#assistant-toggle'),panel=$('#assistant');
 if(!toggle)return;
 const isOpen=Boolean(panel&&!panel.hidden&&!state.assistantMinimized);
 const isMin=Boolean(state.assistantMinimized);
 const semState=isOpen?'open':(isMin?'minimized':'closed');
 toggle.dataset.assistantState=semState;
 toggle.classList.toggle('is-minimized',isMin);
 toggle.setAttribute('aria-expanded',String(isOpen));
 if(isMin){
  toggle.setAttribute('aria-label',tr('恢复 Captain Kiko 知识助手窗口（已最小化 · 默认离线预设 · 可选登录在线精选）','Restore Captain Kiko assistant window (Minimized · Offline presets by default · Optional signed-in online selection)'));
  toggle.setAttribute('title',tr('恢复已最小化的 Captain Kiko 助手窗口 · 默认离线预设 · 可选登录在线精选','Restore minimized Captain Kiko assistant window · Offline presets by default · Optional signed-in online selection'));
 }else{
  toggle.setAttribute('aria-label',tr('打开 Captain Kiko 知识助手（默认离线预设 · 可选登录在线精选）','Open Captain Kiko assistant (Offline presets by default · Optional signed-in online selection)'));
  toggle.setAttribute('title',tr('打开 Captain Kiko · 默认离线预设 · 可选登录在线精选','Open Captain Kiko · Offline presets by default · Optional signed-in online selection'));
 }
}
function syncAssistantMinimizeUI(){
 const panel=$('#assistant'),body=$('#assistant-body'),btn=$('#assistant-minimize'),toggle=$('#assistant-toggle');
 const min=Boolean(state.assistantMinimized);
 const isOpen=Boolean(panel&&!panel.hidden&&!min);
 const semState=isOpen?'open':(min?'minimized':'closed');
 if(panel){
  panel.classList.toggle('minimized',min);
  panel.dataset.assistantState=semState;
  if(min)panel.hidden=true;
 }
 if(body)body.hidden=min;
 if(btn){
  btn.setAttribute('aria-expanded',String(!min));
  const label=min?tr('展开助手窗口','Expand assistant window'):tr('最小化至圆形头像','Minimize to circular avatar');
  btn.setAttribute('aria-label',label);
  btn.setAttribute('title',label);
  btn.innerHTML=icon(min?'expand':'minimize');
 }
 if(toggle){
  if(min||panel?.hidden)toggle.hidden=false;
  else toggle.hidden=true;
 }
 syncAssistantLauncherLabels();
 applyAssistantBounds();
}
function minimizeAssistant(){
 cancelActiveReveal(true);
 assistantDragSession=null;
 assistantResizeSession=null;
 state.assistantMinimized=true;
 const panel=$('#assistant'),toggle=$('#assistant-toggle');
 if(panel)panel.hidden=true;
 if(toggle)toggle.hidden=false;
 syncAssistantMinimizeUI();
 toggle?.focus?.({preventScroll:true});
}
function restoreAssistant(triggerEl=null){
 return openAssistant(triggerEl);
}
function setAssistantMinimized(minimized){
 if(minimized){
  minimizeAssistant();
 }else{
  openAssistant();
 }
}
function toggleAssistantMinimize(){
 if(state.assistantMinimized||$('#assistant')?.hidden){
  openAssistant($('#assistant-toggle'));
 }else{
  minimizeAssistant();
 }
}
function moveAssistantBy(dx=0,dy=0){
 if(isMobileAssistantViewport())return applyAssistantBounds();
 const cur=computeClampedAssistantRect(state.assistantRect);
 state.assistantRect={x:cur.x+dx,y:cur.y+dy,width:cur.width,height:cur.height};
 const res=applyAssistantBounds();
 if(res&&!res.mobile)saveAssistantGeometry(res);
 return res;
}
function resizeAssistantBy(dw=0,dh=0){
 if(isMobileAssistantViewport()||state.assistantMinimized)return applyAssistantBounds();
 const cur=computeClampedAssistantRect(state.assistantRect);
 state.assistantRect={x:cur.x,y:cur.y,width:cur.width+dw,height:cur.height+dh};
 const res=applyAssistantBounds();
 if(res&&!res.mobile)saveAssistantGeometry(res);
 return res;
}
function openAssistant(triggerEl=null){
 const panel=$('#assistant'),toggle=$('#assistant-toggle');
 const wasHidden=Boolean(panel?.hidden);
 const wasMinimized=Boolean(state.assistantMinimized);
 if(triggerEl&&triggerEl!==toggle){
  assistantTriggerFocus=triggerEl;
 }else if(triggerEl===toggle&&!wasMinimized){
  assistantTriggerFocus=toggle;
 }else if(!assistantTriggerFocus&&wasHidden&&document.activeElement&&document.activeElement!==document.body&&document.activeElement!==toggle&&!panel?.contains?.(document.activeElement)){
  assistantTriggerFocus=document.activeElement;
 }
 state.assistantMinimized=false;
 if(panel)panel.hidden=false;
 if(toggle)toggle.hidden=true;
 syncAssistantMinimizeUI();
 $('#assistant-question')?.focus?.({preventScroll:true});
}
function closeAssistant(){
 cancelActiveReveal(true);
 assistantDragSession=null;
 assistantResizeSession=null;
 state.assistantMinimized=false;
 const panel=$('#assistant'),toggle=$('#assistant-toggle');
 if(panel)panel.hidden=true;
 if(toggle)toggle.hidden=false;
 syncAssistantMinimizeUI();
 const target=(assistantTriggerFocus&&!assistantTriggerFocus.hidden&&assistantTriggerFocus!==document.body)?assistantTriggerFocus:toggle;
 assistantTriggerFocus=null;
 target?.focus?.({preventScroll:true});
}
function ask(question,triggerEl=null){
 cancelActiveReveal(true);
 openAssistant(triggerEl);
 getChatHistory(state.workspace).push({question,version:$('#assistant-version').value||'compare',revealed:false});
 renderMessages();
 $('#messages').scrollTop=$('#messages').scrollHeight;
}
function openImport(){importSession++;importFile=null;$('#file-input').value='';$('#import-error').textContent='';openDialog('import-dialog');}
function searchResults(){
 const term=$('#global-search').value.trim();
 const termLower=term.toLowerCase();
 const rawCommands=[
  {id:'nav:graph',title:tr('打开知识图谱','Open knowledge graph'),title_alt:state.lang==='zh'?'Open knowledge graph':'打开知识图谱',desc:tr('以四列有向网络探索来源、声明、主题与资产','Explore sources, claims, topics, and assets as a 4-column directed network'),desc_alt:state.lang==='zh'?'Explore sources, claims, topics, and assets as a 4-column directed network':'以四列有向网络探索来源、声明、主题与资产',icon:'network',category:tr('快捷指令','Commands'),tags:['graph','tupu','knowledge','tu','知识图谱','图谱'],action:'graph'},
  {id:'nav:mindmap',title:tr('打开知识脑图','Open mind map'),title_alt:state.lang==='zh'?'Open mind map':'打开知识脑图',desc:tr('按主题层级大纲浏览结构化证据','Browse structured evidence in a hierarchical topic outline'),desc_alt:state.lang==='zh'?'Browse structured evidence in a hierarchical topic outline':'按主题层级大纲浏览结构化证据',icon:'branch',category:tr('快捷指令','Commands'),tags:['mindmap','naotu','branch','tree','outline','脑图','知识脑图','大纲'],action:'mindmap'},
  {id:'nav:library',title:tr('打开资产目录','Open asset library'),title_alt:state.lang==='zh'?'Open asset library':'打开资产目录',desc:tr('检索和检查来源、声明、主题与本地笔记','Search and inspect sources, claims, topics, and local notes'),desc_alt:state.lang==='zh'?'Search and inspect sources, claims, topics, and local notes':'检索和检查来源、声明、主题与本地笔记',icon:'library',category:tr('快捷指令','Commands'),tags:['library','zichan','assets','notes','sources','claims','资产目录','目录','资产','笔记'],action:'library'},
  {id:'nav:analytics',title:tr('打开洞察分析','Open insights'),title_alt:state.lang==='zh'?'Open insights':'打开洞察分析',desc:tr('查看全库知识分布、引用结构覆盖与主题证据分析','View library distributions, citation coverage, and topic metrics'),desc_alt:state.lang==='zh'?'View library distributions, citation coverage, and topic metrics':'查看全库知识分布、引用结构覆盖与主题证据分析',icon:'chart',category:tr('快捷指令','Commands'),tags:['analytics','dongcha','fenxi','insights','coverage','charts','洞察分析','分析','覆盖率','指标'],action:'analytics'},
  {id:'nav:memory',title:tr('打开记忆与版本','Open memory & versions'),title_alt:state.lang==='zh'?'Open memory & versions':'打开记忆与版本',desc:tr('追溯版本前后对比与本地复核记录','Trace version comparisons and browser-local review records'),desc_alt:state.lang==='zh'?'Trace version comparisons and browser-local review records':'追溯版本前后对比与本地复核记录',icon:'history',category:tr('快捷指令','Commands'),tags:['memory','jiyi','banben','history','version','review','versions','记忆与版本','记忆','版本','复核'],action:'memory'},
  {id:'nav:assistant',title:tr('打开 Captain Kiko','Open Captain Kiko'),title_alt:state.lang==='zh'?'Open Captain Kiko':'打开 Captain Kiko',desc:tr('呼出离线预设问答助手','Summon the offline preset assistant'),desc_alt:state.lang==='zh'?'Summon the offline preset assistant':'呼出离线预设问答助手',icon:'sparkles',category:tr('快捷指令','Commands'),tags:['kiko','assistant','zhushou','captain','ai','ask','chat','助手','提问','问答'],action:'assistant'},
  {id:'nav:brand',title:tr('打开 Kiko 衣橱','Open Kiko wardrobe'),title_alt:state.lang==='zh'?'Open Kiko wardrobe':'打开 Kiko 衣橱',desc:tr('探索与预览 Captain Kiko 探险搭档造型','Explore and preview Captain Kiko companion outfits'),desc_alt:state.lang==='zh'?'Explore and preview Captain Kiko companion outfits':'探索与预览 Captain Kiko 探险搭档造型',icon:'sparkles',category:tr('快捷指令','Commands'),tags:['wardrobe','brand','kiko','outfit','outfits','costume','dress','companion','yichu','huanzhuang','衣橱','换装','航海衣橱','造型','装扮','盲盒','搭档'],action:'brand'},
  {id:'nav:workspaces',title:tr('选择公开实验场','Choose public lab'),title_alt:state.lang==='zh'?'Choose public lab':'选择公开实验场',desc:tr('切换天文数据、绿色酒店或 NumPy 实验场','Switch between astronomy, hospitality, or NumPy labs'),desc_alt:state.lang==='zh'?'Switch between astronomy, hospitality, or NumPy labs':'切换天文数据、绿色酒店或 NumPy 实验场',icon:'compass',category:tr('快捷指令','Commands'),tags:['workspace','shiyanchang','labs','choose','switch','lab','experiment','实验场','工作空间','切换'],action:'workspaces'}
 ];
 const matchedCommands=term?rawCommands.filter(c=>{

  const text=(c.title+' '+c.desc+' '+(c.title_alt||'')+' '+(c.desc_alt||'')+' '+(c.tags||[]).join(' ')).toLowerCase();
  return text.includes(termLower);
 }):rawCommands;

 const matchedNodes=filterGraph(graph,{search:term}).nodes.slice(0,30);
 const totalCount=matchedCommands.length+matchedNodes.length;
 state.searchIndex=totalCount>0?Math.max(0,Math.min(state.searchIndex,totalCount-1)):0;

 let html='';
 let itemIndex=0;

 if(matchedCommands.length){
  html+=`<div class="search-section-header" role="presentation"><span class="search-section-title">${tr('快捷导航指令','Quick Navigation Commands')}</span><span class="search-section-count num">${matchedCommands.length}</span></div>`;
  html+=matchedCommands.map(c=>{
   const i=itemIndex++;
   const active=i===state.searchIndex;
   return `<button role="option" id="search-option-${i}" aria-selected="${active}" class="search-result search-command-result ${active?'is-active':''}" data-search-command="${esc(c.action)}"><span class="type-mark command-mark">${icon(c.icon)}</span><span><strong data-no-translate>${esc(c.title)}</strong><small>${esc(c.desc)}</small></span><span class="search-command-badge">${tr('指令','Command')}</span></button>`;
  }).join('');
 }

 if(matchedNodes.length){
  if(matchedCommands.length){
   html+=`<div class="search-section-header" role="presentation"><span class="search-section-title">${tr('知识对象与证据','Knowledge & Evidence')}</span><span class="search-section-count num">${matchedNodes.length}</span></div>`;
  }
  html+=matchedNodes.map(n=>{
   const i=itemIndex++;
   const active=i===state.searchIndex;
   return `<button role="option" id="search-option-${i}" aria-selected="${active}" class="search-result ${active?'is-active':''}" data-search-node="${esc(n.id)}"><span class="type-mark" style="color:${types[n.type].color};background:${types[n.type].fill}">${icon(types[n.type].icon)}</span><span><strong data-no-translate>${esc(n.label)}</strong><small>${translateText(types[n.type].label,state.lang)} · ${esc(versionName(n.version))}</small></span>${icon('arrow')}</button>`;
  }).join('');
 }

 if(!totalCount){
  html=`<div class="empty"><strong>${tr('没有找到相关知识','No matching knowledge')}</strong><p>${tr('试试主题名称、来源标题，或导入一条相关笔记。','Try a topic, source title, or import a relevant note.')}</p></div>`;
 }

 $('#search-results').innerHTML=html;
 $('#global-search').setAttribute('aria-activedescendant',totalCount>0?`search-option-${state.searchIndex}`:'');
 $('#search-clear').hidden=!term;
 $('#search-hint').textContent=tr(`↑ ↓ 选择 · Enter 打开 · Esc 关闭 · ${matchedNodes.length} 项知识 · ${matchedCommands.length} 条指令`,`↑ ↓ Choose · Enter Open · Esc Close · ${matchedNodes.length} knowledge results · ${matchedCommands.length} ${matchedCommands.length===1?'command':'commands'}`);
 localize($('#search-results'));
}
function executeCommand(action){
 closeDialog("search-dialog");
 const routeAction=normalizeRoute(action);
 if(routeAction==="graph"||routeAction==="mindmap"||routeAction==="library"||routeAction==="analytics"||routeAction==="memory"||routeAction==="brand"||routeAction==="connections"){
  state.route=routeAction;
  if(normalizeRoute(location.hash.replace(/^#/,''))===routeAction)render();else location.hash="#"+routeAction;
  return;
 }
 if(action==="assistant"){
  openAssistant();
  return;
 }
 if(action==="workspaces"){
  showWorkspaces();
  return;
 }
}
function csv(rows){return rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}).join(',')).join('\r\n')}

function evidenceMemoryPage(){
 const isAstro=state.workspace==='astronomy';
 const subtitle=base.metadata?.curation||(isAstro?tr('天文实验场按知识主题和观测方法整理资料，不将它们伪装成历史版本变化。','This astronomy lab groups learning topics and observing methods. These are not historical versions.'):tr('当前实验场按主题与资料集整理公开证据，不将它们伪装成历史版本变化。','This lab organizes public evidence by topic and collection rather than historical versions.'));
 const docTotal=distinctDocumentCount(corpus.sources);
 const pubs=compactPublisherList((corpus.sources||[]).map(s=>rawSourceFor(s.id)?.publisher));
 const pubBadge=pubs.length?` · ${pubs.join(' / ')}`:'';
 const registerSummary=docTotal<corpus.sources.length?`<span class="tag">${tr(`${corpus.sources.length} 条记录 · 源自 ${docTotal} 份文献${pubBadge}`,`${corpus.sources.length} records · from ${docTotal} documents${pubBadge}`)}</span>`:`<span class="tag">${tr(`${corpus.sources.length} 份来源${pubBadge}`,`${corpus.sources.length} sources${pubBadge}`)}</span>`;
 return heading(tr('每个发现，都留下出处。','Every discovery keeps its source.'),subtitle)+`<div class="memory-banner">${icon('history')}<div><h3>${tr('公开来源台账 · MOI Memoria 未连接','Public source register · MOI Memoria not connected')}</h3><p>${tr('当前资料按主题资料集整理，没有成对的历史版本，因此绝不虚构版本变更记录。每条声明均保留原始链接、发布机构、资料集和核查日期；本地复核仅保存在当前浏览器，未连接 MOI Memoria 服务。','This evidence set is organized by thematic collections rather than paired historical versions, so no version change events are fabricated. Every claim retains its source link, publisher, collection, and check date; any local review stays in this browser only and is not connected to MOI Memoria.')}</p></div><span class="tag">MOI Memoria ${tr('待接通 · 仅本地存储','not connected · Local-only')}</span></div>${moiMemoryBoundary(false)}<section class="panel"><div class="panel-head"><h2>${tr('公开来源清单','Public source register')}</h2>${registerSummary}</div><div class="table-wrap"><table><thead><tr><th>${tr('原始资料','Source')}</th><th>${tr('资料集','Collection')}</th><th>${tr('核查时间','Checked')}</th></tr></thead><tbody>${corpus.sources.map(s=>{const meta=rawSourceFor(s.id);return `<tr><td><a href="${esc(safeUrl(s.url)||'#')}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ${icon('external')}</a>${meta?.publisher||meta?.section?`<br><small class="muted" data-no-translate>${esc([meta.publisher,meta.section].filter(Boolean).join(' · '))}</small>`:''}</td><td>${esc(versionName(s.version))}</td><td>${esc(s.verified_at||base.metadata.verified_at||'—')}</td></tr>`}).join('')}</tbody></table></div></section>`;
}
function getAssistantPlaceholder(workspace=state.workspace,lang=state.lang){
 const isEn=lang==='en';
 if(workspace==='astronomy'){
  return isEn?'Ask Kiko about astronomy collections or observation topics…':'向 Kiko 提问天文资料集或观测主题…';
 }
 if(workspace==='hospitality'){
  return isEn?'Ask Kiko about hotel energy or water savings…':'向 Kiko 提问酒店节能或节水…';
 }
 return isEn?'Ask Kiko about NumPy migration and target software version…':'向 Kiko 提问 NumPy 迁移，带上目标软件版本…';
}
function updateAssistantPlaceholder(){
 const input=$('#assistant-question');
 if(!input)return;
 const phZh=getAssistantPlaceholder(state.workspace,'zh');
 const phCurrent=getAssistantPlaceholder(state.workspace,state.lang);
 input.dataset.i18nOriginalPlaceholder=phZh;
 input.setAttribute('placeholder',phCurrent);
 input.placeholder=phCurrent;
}
function updateShell(){
 const current=labs.find(x=>x.id===state.workspace);
 $('#workspace-info').innerHTML=`<span class="workspace-icon">${current.symbol}</span><span><strong>${esc(labTitle())}</strong><small>${tr('公开实验场','Public lab')}</small></span><span class="chevrons">${icon('chevrons')}</span>`;

 $('#corpus-footnote').textContent=tr('公开证据 · 核查于 ','Public evidence · Checked ')+(base.metadata.verified_at||'—');
 $('#language-toggle').textContent=state.lang==='zh'?'EN':'中';
 $('#language-toggle').setAttribute('aria-label',state.lang==='zh'?'Switch to English':'切换至中文');
 $('#language-toggle').setAttribute('title',state.lang==='zh'?'Switch to English':'切换至中文');
 $('#theme-toggle').innerHTML=icon(state.theme==='dark'?'sun':'moon');
 $('#theme-toggle').setAttribute('aria-label',state.theme==='dark'?tr('切换至日间主题','Switch to light theme'):tr('切换至夜间主题','Switch to dark theme'));
 $('#theme-toggle').setAttribute('title',$('#theme-toggle').getAttribute?.('aria-label')||'Theme');
 $('#theme-toggle').setAttribute('aria-pressed',state.theme==='dark');
 $('#page-crumb').textContent=translateText(titles[state.route],state.lang);
 $('#crumb-path').hidden=state.route==='overview';
 $('#search-shortcut').textContent=typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?'⌘ K':'Ctrl K';
 const scope=$('#assistant-version').value;
 $('#assistant-version').innerHTML=`<option value="compare">${tr(base.metadata.versionMode==='collection'?'全部资料集':'对照两个版本',base.metadata.versionMode==='collection'?'All collections':'Compare versions')}</option>${versions().map(v=>`<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('')}`;
 $('#assistant-version').value=scope==='compare'||versions().some(v=>v.id===scope)?scope:'compare';
 $('#assistant-version').setAttribute('aria-label',tr(isCollection()?'回答资料集':'回答适用版本',isCollection()?'Answer collection':'Answer version'));
 const dockNote=$('.dock-note');
 if(dockNote)dockNote.textContent=tr('默认离线预设助手 · 可选登录在线精选','Offline preset assistant by default · Optional signed-in online selection');
 const dragHandle=$('#assistant-drag-handle');
 if(dragHandle){
  dragHandle.setAttribute('aria-label',tr('移动助手窗口（方向键可调整位置，Home 重置默认位置）','Move assistant window (Arrow keys adjust position, Home resets default)'));
 }
 const resizeHandle=$('#assistant-resize-handle');
 if(resizeHandle){
  resizeHandle.setAttribute('aria-label',tr('调整助手窗口大小（方向键可调整宽高，Home 重置默认尺寸）','Resize assistant window (Arrow keys adjust size, Home resets default)'));
  resizeHandle.setAttribute('title',tr('拖拽或使用方向键调整窗口大小','Drag or use arrow keys to resize window'));
 }
 const resetPosBtn=$('#assistant-reset-pos');
 if(resetPosBtn){
  const resetLabel=tr('重置窗口位置与大小','Reset window position and size');
  resetPosBtn.setAttribute('aria-label',resetLabel);
  resetPosBtn.setAttribute('title',resetLabel);
 }
 syncAssistantRelocateUI();
 const closeAssistantBtn=$('#assistant-close');
 if(closeAssistantBtn){
  const closeLabel=tr('关闭助手','Close assistant');
  closeAssistantBtn.setAttribute('aria-label',closeLabel);
  closeAssistantBtn.setAttribute('title',closeLabel);
 }
 const assistantMode=$('.assistant-mode');
 if(assistantMode)assistantMode.textContent=tr('默认离线预设 · MOI 在线入口需授权并主动点击','Offline presets by default · MOI online requires authorization and an explicit click');
 const clearAssistant=$('#assistant-clear');
 if(clearAssistant)clearAssistant.textContent=tr('清空当前对话','Clear current chat');
 const moiButton=$('#moi-online-button');
 if(moiButton)moiButton.textContent=tr('MOI 在线询问（可能消耗额度）','Ask MOI online (may use quota)');
 const moiNote=$('#moi-online-note');
 if(moiNote)moiNote.textContent=tr('在线询问会将问题和匹配的公开证据发送至 MOI，请勿输入敏感信息。','Online requests send your question and matched public evidence to MOI. Do not enter sensitive information.');
 const moiSignIn=$('#moi-sign-in');
 if(moiSignIn)moiSignIn.textContent=tr('登录以使用 MOI','Sign in to use MOI');
 $('#assistant-scope').textContent=tr(`默认离线预设：仅基于本实验场 ${base.claims.length} 条精选声明与 ${base.sources.length} 条官方来源记录本地匹配；登录后主动点击「MOI 在线询问」可由受限在线模型从精选证据中筛选声明（共享每日额度）。`,`Offline presets by default: matched locally against ${base.claims.length} curated claims and ${base.sources.length} official source records in this lab; after sign-in, explicitly clicking “Ask MOI online” uses a restricted online model to select from curated evidence (shares daily quota).`);
 updateAssistantPlaceholder();
 localize(document);
 updateAssistantPlaceholder();
 syncAssistantMinimizeUI();
}
function selectRefusalSuggestions(question,version='compare',result=null){
 const pool=[];
 const seen=new Set();
 const askedNorm=String(question||'').trim().toLocaleLowerCase();
 const addCandidate=(q,label='',topics=[])=>{
  const text=String(q||'').trim();
  if(!text)return;
  const key=text.toLocaleLowerCase();
  if(key===askedNorm||seen.has(key))return;
  seen.add(key);
  const detected=Array.isArray(topics)&&topics.length?topics:(queryEvidence(corpus,text,'compare',{locale:state.lang}).topics||[]);
  pool.push({question:text,label:String(label||'').trim()||text,topics:detected});
 };
 for(const p of base?.metadata?.prompts||[]){
  addCandidate(p?.question,p?.label,p?.topics);
 }
 for(const s of base?.metadata?.suggestions||[]){
  if(typeof s==='string')addCandidate(s,s);
  else if(s&&typeof s==='object')addCandidate(s.question,s.label,s.topics);
 }
 if(!pool.length)return [];
 const matchedTopics=new Set(result?.topics||[]);
 const currentScope=version||'compare';
 const scored=pool.map((cand,idx)=>{
  let score=0;
  let answerableInScope=false;
  try{
   const checkInScope=queryEvidence(corpus,cand.question,currentScope,{locale:state.lang});
   if(checkInScope.status==='answered'){score+=4;answerableInScope=true;}
   else{
    const checkAll=queryEvidence(corpus,cand.question,'compare',{locale:state.lang});
    if(checkAll.status==='answered')score+=2;
   }
  }catch{}
  if(matchedTopics.size&&cand.topics.some(t=>matchedTopics.has(t)))score+=(answerableInScope?2:0.5);
  return {cand,score,idx};
 }).sort((a,b)=>b.score-a.score||a.idx-b.idx);
 return scored.slice(0,2).map(x=>x.cand);
}
function prefersReducedMotion(){
 try{
  if(typeof window!=='undefined'&&typeof window.matchMedia==='function'){
   return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  }
 }catch{}
 return false;
}
function splitGraphemes(text){
 const str=String(text??'');
 if(typeof Intl!=='undefined'&&Intl.Segmenter){
  try{
   return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(str)].map(s=>s.segment);
  }catch{}
 }
 return Array.from(str);
}
function cancelActiveReveal(finishCurrent=true){
 if(activeRevealTimer){
  clearTimeout(activeRevealTimer);
  activeRevealTimer=null;
 }
 if(finishCurrent&&typeof activeRevealCleanup==='function'){
  const cleanup=activeRevealCleanup;
  activeRevealCleanup=null;
  cleanup();
 }
 activeRevealItem=null;
 activeRevealCleanup=null;
}
function startKikoReveal(replyEl,targets,item){
 if(!targets.length||prefersReducedMotion()){
  for(const t of targets)t.el.textContent=t.fullText;
  item.revealed=true;
  return;
 }
 cancelActiveReveal(true);
 activeRevealItem=item;
 replyEl.classList.add('kiko-revealing');
 for(const t of targets){
  t.el.textContent='';
  t.el.setAttribute('aria-hidden','true');
 }
 const cursor=document.createElement('span');
 cursor.className='kiko-reveal-cursor';
 cursor.setAttribute('aria-hidden','true');
 cursor.setAttribute('title',tr('渐进呈现中（视觉动效，非实时流式）','Progressive reveal (visual effect, not live streaming)'));
 cursor.textContent='▍';
 if(targets[0])targets[0].el.appendChild(cursor);
 let targetIdx=0;
 let graphemeIdx=0;
 activeRevealCleanup=()=>{
  for(const t of targets){
   t.el.textContent=t.fullText;
   t.el.removeAttribute('aria-hidden');
  }
  cursor.remove();
  replyEl.classList.remove('kiko-revealing');
  const srEl=replyEl.querySelector('.sr-only');
  if(srEl)srEl.remove();
  item.revealed=true;
 };
 function tick(){
  if(targetIdx>=targets.length){
   cancelActiveReveal(true);
   return;
  }
  const current=targets[targetIdx];
  const stepCount=current.fullGraphemes.length>80?2:1;
  graphemeIdx=Math.min(graphemeIdx+stepCount,current.fullGraphemes.length);
  current.el.textContent=current.fullGraphemes.slice(0,graphemeIdx).join('');
  current.el.appendChild(cursor);
  const messages=$('#messages');
  if(messages)messages.scrollTop=messages.scrollHeight;
  if(graphemeIdx>=current.fullGraphemes.length){
   current.el.textContent=current.fullText;
   current.el.removeAttribute('aria-hidden');
   targetIdx++;
   graphemeIdx=0;
   if(targetIdx>=targets.length){
    cancelActiveReveal(true);
    return;
   }
   if(targets[targetIdx])targets[targetIdx].el.appendChild(cursor);
  }
  activeRevealTimer=setTimeout(tick,18);
 }
 activeRevealTimer=setTimeout(tick,18);
}
function renderMessages(){
 cancelActiveReveal(true);
 const prompts=base.metadata.prompts||[];
 const messagesEl=$('#messages');
 messagesEl.replaceChildren?.();
 messagesEl.innerHTML=`<div class="chat welcome"><strong>Ahoy, Explorer!</strong><p>${tr('我是离线预设演示助手 Kiko。点击下方预设问题或输入范围内关键词，即可对照本实验场的官方出处；超出范围的问题会如实拒答。','I am Kiko, an offline preset demonstration assistant. Pick a preset question below or ask within scope to inspect official sources; out-of-scope questions are refused honestly.')}</p><div class="chat-prompts">${prompts.slice(0,3).map(p=>`<button type="button" data-ask="${esc(p.question)}">${esc(p.label)} ${icon('arrow')}</button>`).join('')}</div></div>`;
 const history=getChatHistory(state.workspace);
 let latestUnrevealedIdx=-1;
 for(let i=history.length-1;i>=0;i--){
  const hItem=history[i];
  if(hItem.mode==='online'){
   if(hItem.result?.status==='answered'&&!hItem.revealed){latestUnrevealedIdx=i;break;}
  }else{
   const res=queryEvidence(corpus,hItem.question,hItem.version,{locale:state.lang});
   if(res.status==='answered'&&!hItem.revealed){latestUnrevealedIdx=i;break;}
  }
 }
 for(let i=0;i<history.length;i++){
  if(i!==latestUnrevealedIdx)history[i].revealed=true;
 }
 for(let i=0;i<history.length;i++){
  const item=history[i];
  const isNewAnswer=(i===latestUnrevealedIdx&&!prefersReducedMotion());
  if(item.mode==='online'){
   const user=document.createElement('div');user.className='chat user-chat';user.setAttribute('data-no-translate','');user.textContent=item.question;$('#messages').append(user);
   const reply=document.createElement('div');reply.className='chat moi-chat';reply.setAttribute('role','status');
   const title=document.createElement('strong');title.textContent=tr('MOI 在线 · 精选证据','MOI online · Curated evidence');
   if(item.result?.status==='answered'){
    const srParts=[title.textContent];
    const targets=[];
    const visualContent=document.createElement('div');
    visualContent.className='kiko-reveal-content';
    visualContent.append(title);
    for(const claim of item.result.claims){
     const text=(state.lang==='en'&&claim.text_en)||claim.text||claim.title||'';
     const p=document.createElement('p');
     p.className='claim-text';
     visualContent.append(p);
     srParts.push(text);
     targets.push({el:p,fullText:text,fullGraphemes:splitGraphemes(text)});
    }
    for(const source of item.result.sources){
     const url=safeUrl(source.url);if(!url)continue;
     const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
     const sTitle=((state.lang==='en'&&source.title_en)||source.title||source.id)+' ↗';
     a.textContent=sTitle;
     visualContent.append(a);
     srParts.push(sTitle);
    }
    if(isNewAnswer){
     const srEl=document.createElement('div');
     srEl.className='sr-only';
     srEl.setAttribute('role','status');
     srEl.setAttribute('aria-live','polite');
     srEl.textContent=srParts.join(' · ');
     reply.append(srEl);
     reply.append(visualContent);
     $('#messages').append(reply);
     startKikoReveal(reply,targets,item);
    }else{
     item.revealed=true;
     for(const t of targets)t.el.textContent=t.fullText;
     reply.append(visualContent);
     $('#messages').append(reply);
    }
   }else{
    item.revealed=true;
    reply.append(title);
    const labels={pending:tr('正在询问 MOI，可能消耗额度…','Asking MOI; this may use quota…'),unauthorized:tr('请先登录以使用在线询问。','Sign in to ask MOI online.'),quota_exceeded:tr('今日在线调用额度已用完。','The daily online quota is exhausted.'),insufficient:tr('精选证据不足，未调用模型。','Insufficient curated evidence; no model call was made.'),invalid_request:tr('问题不符合在线请求限制。','The question does not meet online request limits.'),cancelled:tr('实验场已切换，本次结果未显示。','The lab changed; this result was not displayed.')};
    const p=document.createElement('p');p.textContent=labels[item.result?.status]||tr('在线服务暂不可用，未生成在线结果。','Online service is unavailable; no online result was generated.');reply.append(p);
    $('#messages').append(reply);
   }
   continue;
  }
  const result=queryEvidence(corpus,item.question,item.version,{locale:state.lang});
  const user=document.createElement('div');user.className='chat user-chat';user.setAttribute('data-no-translate','');user.textContent=item.question;$('#messages').append(user);
  const reply=document.createElement('div');reply.className='chat';
  const isAnswered=result.status==='answered';
  const isTrulyInsufficient=!isAnswered&&result.status==='insufficient';
  const suggestions=isTrulyInsufficient?selectRefusalSuggestions(item.question,item.version,result):[];
  const suggestionsHtml=suggestions.length?`<div class="chat-suggestions" role="group" aria-label="${esc(tr('推荐预设问题','Suggested preset questions'))}"><p class="chat-suggestions-label">${esc(tr('试试当前实验场的预设问题：','Try a preset question in this lab:'))}</p><div class="chat-suggestions-list">${suggestions.map(s=>`<button type="button" class="chat-suggestion-btn" data-ask="${esc(s.question)}" data-suggested-question="${esc(s.question)}"><span data-no-translate>${esc(s.question)}</span>${icon('arrow')}</button>`).join('')}</div></div>`:'';
  if(!isAnswered){
   item.revealed=true;
   reply.innerHTML=`<strong>${tr('现有证据还不足以回答。','The current evidence is not enough.')}</strong>${!isAnswered?`<p>${esc(result.gaps?.[0]||tr('现有资料未覆盖这个问题。','This question is outside the current evidence.'))}</p>${suggestionsHtml}`:''}<p class="citation">${tr('离线预设与规则匹配 · 精选证据 · 未调用在线模型','Offline preset & rule match · Curated evidence · No live model call')}</p>`;
   $('#messages').append(reply);
  }else{
   const titleText=tr('找到有来源的证据了。','Here is what the evidence says.');
   const disclaimerText=tr('离线预设与规则匹配 · 精选证据 · 未调用在线模型','Offline preset & rule match · Curated evidence · No live model call');
   const visualHtml=`<div class="kiko-reveal-content"><strong>${titleText}</strong>${result.claims.map((c,cIdx)=>`<div class="claim-answer"><strong>${esc(c.title)}</strong><p class="claim-text" data-claim-idx="${cIdx}">${esc(c.text)}</p><span class="citation">${esc(versionName(c.version))}</span><button type="button" class="text-button" data-node="${esc(c.id)}">${tr('在图谱中查看','View in graph')}${icon('arrow')}</button></div>`).join('')}${result.sources.map(s=>safeUrl(s.url)?`<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`:'').join('')}<p class="citation">${disclaimerText}</p></div>`;
   if(isNewAnswer){
    const srParts=[titleText];
    for(const c of result.claims){srParts.push((c.title?c.title+': ':'')+c.text);}
    for(const s of result.sources){srParts.push(s.title);}
    srParts.push(disclaimerText);
    const srHtml=`<div class="sr-only" role="status" aria-live="polite">${esc(srParts.join(' · '))}</div>`;
    reply.innerHTML=`${srHtml}${visualHtml}`;
    $('#messages').append(reply);
    const targets=[];
    const pEls=reply.querySelectorAll('.claim-text');
    pEls.forEach((p,idx)=>{
     const fullText=result.claims[idx]?.text||p.textContent;
     targets.push({el:p,fullText,fullGraphemes:splitGraphemes(fullText)});
    });
    startKikoReveal(reply,targets,item);
   }else{
    item.revealed=true;
    reply.innerHTML=visualHtml;
    $('#messages').append(reply);
   }
  }
 }
}
function isValidKiko(k){
 return ['A1','A2','B1','B2','C1','C2','D1','D2','D3'].includes(k)||(k==='X1'&&storage.get('kikoUnlocked',false))||discoveredOutfits().includes(k);
}
function openKikoPreview(k,triggerEl=null){
 if(!isValidKiko(k))return;
 state.kikoPreview=k;
 const names=kikoNames[k]||[k,k];
 const titleEl=$('#kiko-preview-title'),subEl=$('#kiko-preview-subtitle'),bodyEl=$('#kiko-preview-body'),confirmBtn=$('#kiko-confirm-apply');
 if(titleEl)titleEl.textContent=tr('预览探险搭档','Preview exploration companion');
 if(subEl)subEl.textContent=tr('确认后才会替换当前工作台与助手中的搭档。','Your current companion stays unchanged until you confirm.');
 if(bodyEl){
  const isCurrent=state.kiko===k;
  bodyEl.innerHTML=`<div class="kiko-preview-card">${kikoImageHtml(k,tr(...names),'kiko-preview-img')}<div class="kiko-preview-meta"><span class="tag">${esc(kikoCollectionLabel(k))}</span><h3>${esc(tr(...names))}</h3><p class="mono">ID: ${esc(k)}</p><p class="muted">${isCurrent?tr('当前已在使用这位探险搭档。','This companion is currently active.'):tr('确认设为搭档后，它会陪伴你探索知识空间。','Confirm to set this companion across your workspace and assistant.')}</p></div></div>`;
 }
 if(confirmBtn){
  confirmBtn.dataset.confirmKiko=k;
  confirmBtn.textContent=tr('确认设为搭档','Apply as companion');
 }
 if(triggerEl)lastFocus=triggerEl;
 openDialog('kiko-preview-dialog',triggerEl);
 confirmBtn?.focus?.();
}
function confirmKikoPreview(){
 const k=state.kikoPreview||$('#kiko-confirm-apply')?.dataset?.confirmKiko;
 if(!k||!isValidKiko(k))return;
 state.kikoPreview=null;
 closeDialog('kiko-preview-dialog');
 chooseKiko(k);
}
function cancelKikoPreview(){
 state.kikoPreview=null;
 closeDialog('kiko-preview-dialog');
}
function openDialog(id,triggerEl=null){
 const dialog=document.getElementById(id);if(!dialog||dialog.open)return;
 lastFocus=triggerEl||document.activeElement;
 dialog.showModal();localize(dialog);
}
function closeDialog(id){
 const dialog=document.getElementById(id);if(dialog?.open)dialog.close();
}
function closeNavigation(restore=false){
 $('#sidebar').classList.remove('open');$('#sidebar-backdrop').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false');
 if(restore)$('#menu-toggle').focus();
}
function openSearch(){state.searchIndex=0;openDialog('search-dialog');searchResults();$('#global-search').focus?.({preventScroll:true});}
function isValidLabPayload(data){
 return Boolean(data&&typeof data==='object'&&!Array.isArray(data)&&data.metadata&&typeof data.metadata==='object'&&Array.isArray(data.sources)&&Array.isArray(data.claims)&&Array.isArray(data.assets));
}
async function loadLabData(lab){
 if(catalog.has(lab.id))return catalog.get(lab.id);
 if(labInFlight.has(lab.id))return labInFlight.get(lab.id);
 const reqSeq=(labRequestSeq.get(lab.id)||0)+1;
 labRequestSeq.set(lab.id,reqSeq);
 const promise=(async()=>{
  try{
   const response=await fetch(`/assets/${lab.file}`);
   if(!response||!response.ok)throw Error(tr('公开资料暂时无法加载，请重试。','Public evidence could not be loaded. Please retry.'));
   let data;
   try{data=await response.json();}catch{throw Error(tr('公开资料暂时无法加载，请重试。','Public evidence could not be loaded. Please retry.'));}
   if(!isValidLabPayload(data))throw Error(tr('公开资料暂时无法加载，请重试。','Public evidence could not be loaded. Please retry.'));
   if(labRequestSeq.get(lab.id)===reqSeq&&!catalog.has(lab.id)){
    catalog.set(lab.id,data);
    labLoadErrors.delete(lab.id);
   }
   return catalog.get(lab.id)||data;
  }catch(err){
   if(labRequestSeq.get(lab.id)===reqSeq&&!catalog.has(lab.id)){
    labLoadErrors.add(lab.id);
   }
   throw err;
  }finally{
   if(labInFlight.get(lab.id)===promise)labInFlight.delete(lab.id);
  }
 })();
 labInFlight.set(lab.id,promise);
 return promise;
}
function getLabPickerSummary(lab){
 if(labLoadErrors.has(lab.id)&&!catalog.has(lab.id)){
  const msg=tr('公开资料暂时无法加载 · 点击重试','Public evidence unavailable · Select to retry');
  return {failed:true,source:'failed',sourceBadge:tr('未加载 · 点击重试','Unavailable · Select to retry'),countLine:msg,countHtml:esc(msg),scopeLine:''};
 }
 const data=catalog.get(lab.id);
 const isLoaded=Boolean(data);
 const a=data?analyzeRecords(data):lab.catalog;
 if(!a){
  const msg=tr('打开后载入公开资料','Load public evidence on open');
  return {failed:false,source:'none',sourceBadge:tr('待载入','Pending load'),countLine:msg,countHtml:esc(msg),scopeLine:''};
 }
 const sources=a.sources??0,docs=a.distinctDocuments??sources,claims=a.claims??0,topics=a.topics??0,assets=a.assets??0;
 const total=a.graph?.nodes??a.objects??(sources+claims+topics+assets);
 const docHint=docs<sources?tr(`（源自 ${docs} 份文献）`,` (from ${docs} documents)`):'';
 const countLine=tr(`${total} 个对象 · ${sources} 条来源记录${docHint} · ${claims} 条声明 · ${topics} 个主题 · ${assets} 项资产`,`${total} objects · ${sources} source records${docHint} · ${claims} claims · ${topics} topics · ${assets} assets`);
 const totalItem=tr(`${total} 个对象`,`${total} objects`);
 const sourcesItem=tr(`${sources} 条来源记录${docHint}`,`${sources} source records${docHint}`);
 const claimsItem=tr(`${claims} 条声明`,`${claims} claims`);
 const topicsItem=tr(`${topics} 个主题`,`${topics} topics`);
 const assetsItem=tr(`${assets} 项资产`,`${assets} assets`);
 const countHtml=`<span class="count-chip">${esc(totalItem)}<span class="count-sep" aria-hidden="true"> · </span></span><span class="count-chip">${esc(sourcesItem)}<span class="count-sep" aria-hidden="true"> · </span></span><span class="count-chip">${esc(claimsItem)}<span class="count-sep" aria-hidden="true"> · </span></span><span class="count-chip">${esc(topicsItem)}<span class="count-sep" aria-hidden="true"> · </span></span><span class="count-chip">${esc(assetsItem)}</span>`;
 const scopeLine=data?.metadata?.versions?.length?data.metadata.versions.map(v=>state.lang==='en'?(v.label_en||v.label):v.label).join(' / '):tr(lab.catalog?.scope||'',lab.catalog?.scope_en||lab.catalog?.scope||'');
 const sourceBadge=isLoaded?tr('当前会话已载入数据','Loaded in this session'):tr('内置样例基线（打开后载入）','Bundled sample baseline (loaded on open)');
 return {failed:false,source:isLoaded?'loaded':'bundled-baseline',sourceBadge,countLine,countHtml,scopeLine,total,sources,distinctDocuments:docs,claims,topics,assets};
}
function renderWorkspaceOptions(){
 const container=$('#workspace-options');if(!container)return;
 container.innerHTML=labs.map(l=>{
  const info=getLabPickerSummary(l);
  const isCurrent=state.workspace===l.id;
  return `<button class="workspace-option ${isCurrent?'selected active':''} ${info.failed?'load-failed':''}" data-workspace="${l.id}" data-count-source="${info.source||'none'}" aria-pressed="${isCurrent}"><span class="lab-symbol ${l.id}">${l.symbol}</span><strong>${esc(tr(l.name,l.name_en))}</strong><p>${esc(tr(l.description,l.description_en))}</p>${info.scopeLine?`<span class="tag workspace-scope-tag">${esc(tr('范围：','Scope: ')+info.scopeLine)}</span>`:''}<small class="workspace-count-line num">${info.countHtml||esc(info.countLine)}</small>${info.sourceBadge?`<small class="workspace-source-note">${esc(info.sourceBadge)}</small>`:''}<span class="workspace-action">${isCurrent?tr('当前实验场','Current lab'):info.failed?tr('重试加载 →','Retry load →'):tr('进入探索 →','Explore →')}</span></button>`;
 }).join('');
}
function showWorkspaces(){
 $('#workspace-dialog-title').textContent=tr('选择你的公开实验场','Choose your public lab');
 $('#workspace-dialog-description').textContent=tr('换一个主题，继续探索。每个实验场的笔记和复核状态独立保存。','A new subject, the same curiosity. Notes and reviews are kept separately for each lab.');
 renderWorkspaceOptions();
 openDialog('workspace-dialog');
 $(`#workspace-options [data-workspace="${state.workspace}"]`)?.focus?.({preventScroll:true});
}
function renderOntologyContent(){
 const body=$('#ontology-dialog-body');if(!body)return;
 const filteredGraph=graphSubset();
 const nodeCount=filteredGraph.nodes.length;
 const edgeCount=filteredGraph.edges.length;

 const typeCards=[
  {
   type:'source',
   glyph:`<svg viewBox="-14 -14 28 28" width="24" height="24"><rect x="-11" y="-11" width="22" height="22" rx="2" fill="var(--node-source-fill)" stroke="var(--node-source)" stroke-width="2"/><path d="M-6 -6h12m-12 4h12m-12 4h8" stroke="var(--node-source)" stroke-width="1.5" stroke-linecap="round"/></svg>`,
   shapeCue:tr('形状：带边框矩形 · 非颜色提示：双线边框与文档折角','Shape: Bordered rectangle · Non-color cue: Double outline and document fold'),
   desc:tr('一手官方文档、PEP/规范或已核验学术文献章节。','Primary official documentation, PEPs/specs, or verified scholarly chapters.')
  },
  {
   type:'claim',
   glyph:`<svg viewBox="-14 -14 28 28" width="24" height="24"><circle r="10" fill="var(--paper)" stroke="var(--node-claim)" stroke-width="2.5"/><path d="m-4 0 3 3 5-6" fill="none" stroke="var(--node-claim)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
   shapeCue:tr('形状：单线圆环与勾号 · 非颜色提示：实线圆环勾号','Shape: Single-ring circle with check · Non-color cue: Solid ring checkmark'),
   desc:tr('包含版本绑定声明，由官方文档提供直接证据。','Contains version-bound claims supported directly by official source evidence.')
  },
  {
   type:'topic',
   glyph:`<svg viewBox="-14 -14 28 28" width="24" height="24"><circle r="12" fill="var(--node-topic)"/><circle r="4" fill="var(--paper)"/></svg>`,
   shapeCue:tr('形状：实心同心圆 · 非颜色提示：同心双圆','Shape: Solid concentric circle · Non-color cue: Concentric circles'),
   desc:tr('结构化知识主题，归集相关声明并聚合讨论范围。','Structured knowledge topics grouping relevant claims and scoping inquiry.')
  },
  {
   type:'asset',
   glyph:`<svg viewBox="-14 -14 28 28" width="24" height="24"><rect x="-11" y="-11" width="22" height="22" rx="5" fill="var(--node-asset)"/><path d="M-5 -3h10m-10 6h10" stroke="var(--paper)" stroke-width="2" stroke-linecap="round"/></svg>`,
   shapeCue:tr('形状：圆角矩形与横线 · 非颜色提示：双横线标记','Shape: Rounded rectangle with horizontal lines · Non-color cue: Double horizontal bars'),
   desc:tr('本地笔记、迁移示例或代码资产；提及主题，但影响关系未经证实。','Local notes, migration examples, or code assets; mentions topics with unverified impact.')
  }
 ];

 const edgeCards=[
  {
   key:'supports',
   name:tr('支持','Supports'),
   dir:tr('方向：来源文档 → 知识声明','Direction: Source Document → Claim'),
   tagClass:'verified',
   tagText:tr('一手证据 · 版本绑定','Primary evidence · Version bound'),
   lineClass:'supports',
   strokeCue:tr('线型：粗实线 · 箭头：实心三角箭头 · 非颜色提示：加粗实线 (2.5px)','Line: Thick solid · Arrow: Solid triangle · Non-color cue: Heavy solid stroke (2.5px)'),
   desc:tr('表示官方一手资料（规范、论文、手册等）对抽取出的知识声明提供直接来源证据。仅在版本严格匹配时建立。','Indicates official primary sources (specs, papers, manuals) providing direct evidentiary support for extracted claims. Formed only under strict version match.')
  },
  {
   key:'applies',
   name:tr('归属于','Belongs to'),
   dir:tr('方向：知识声明 → 知识对象','Direction: Claim → Topic'),
   tagClass:'structural',
   tagText:tr('结构归类 · 确定关系','Structural classification · Determined'),
   lineClass:'applies',
   strokeCue:tr('线型：虚线 · 箭头：空心圆形端点 · 非颜色提示：中等虚线 (2px dashed)','Line: Dashed · Arrow: Hollow circular terminal · Non-color cue: Medium dashed stroke (2px dashed)'),
   desc:tr('表示已验证知识声明在概念层次上归属于某一结构化知识对象（迁移主题、研究领域等）。','Indicates an established claim conceptually belongs to a structured knowledge topic (migration theme, research domain, etc.).')
  },
  {
   key:'candidate',
   name:tr('待复核影响','Candidate link'),
   dir:tr('方向：知识对象 → 工作资产','Direction: Topic → Asset'),
   tagClass:'candidate',
   tagText:tr('待复核候选 · 未经证实','Candidate for review · Unverified'),
   lineClass:'candidate',
   strokeCue:tr('线型：点线 · 箭头：开口角形箭头 · 非颜色提示：细密点线 (2px dotted) 与候选角标','Line: Dotted · Arrow: Open angle chevron · Non-color cue: Fine dotted stroke (2px dotted) and candidate tag'),
   desc:tr('表示工作资产提及该主题而产生的潜在关联。此影响关系未经人工或动态复核证实，仅作为待审查候选提示，绝非已确认代码失效或因果破坏。','Indicates a potential link where a working asset mentions a topic. This impact link is strictly unverified and serves as a candidate for review, never a confirmed code failure or causal breakage.')
  }
 ];

 body.innerHTML=`
  <section class="ontology-counts-banner" aria-label="${esc(tr('当前筛选范围统计','Current Filtered Scope Counts'))}">
   <div class="ontology-counts-desc">${tr('以下统计采用知识图谱的筛选条件（版本、搜索与类型），可能与当前页面范围不同。','Counts use knowledge graph filters (version, search, and types), which may differ from this page’s scope.')}</div>
   <div class="ontology-count-badges">
    <span class="ontology-badge">${tr('当前范围节点','Nodes in Scope')}: <strong class="num">${nodeCount}</strong></span>
    <span class="ontology-badge">${tr('当前范围关系','Links in Scope')}: <strong class="num">${edgeCount}</strong></span>
   </div>
  </section>

  <section>
   <h3 class="ontology-section-title">${tr('核心对象类型','Core Object Types')}</h3>
   <div class="ontology-grid">
    ${typeCards.map(c=>`
     <div class="ontology-card" data-ontology-type="${c.type}">
      <div class="ontology-card-head">
       <span class="ontology-card-type"><span class="ontology-glyph" aria-hidden="true">${c.glyph}</span>${translateText(types[c.type].label,state.lang)}</span>
       <span class="tag ${c.type==='asset'?'amber':'blue'}">${c.type}</span>
      </div>
      <div class="ontology-cue">${c.shapeCue}</div>
      <div class="ontology-desc">${c.desc}</div>
     </div>
    `).join('')}
   </div>
  </section>

  <section>
   <h3 class="ontology-section-title">${tr('关系与方向契约','Relationships & Direction Contract')}</h3>
   <div class="ontology-grid">
    ${edgeCards.map(e=>`
     <div class="ontology-edge-card" data-ontology-edge="${e.key}">
      <div class="ontology-edge-head">
       <span class="ontology-edge-name"><span class="ontology-edge-line ${e.lineClass}" aria-hidden="true"></span>${e.name}</span>
       <span class="ontology-status-tag ${e.tagClass}">${e.tagText}</span>
      </div>
      <div class="ontology-direction">${e.dir}</div>
      <div class="ontology-cue">${e.strokeCue}</div>
      <div class="ontology-desc">${e.desc}</div>
     </div>
    `).join('')}
   </div>
  </section>

  <section class="ontology-disclosures" aria-label="${esc(tr('系统边界与诚实披露','System Boundaries & Honest Disclosures'))}">
   <h3 class="ontology-section-title" style="margin:0">${tr('系统边界与诚实披露','System Boundaries & Honest Disclosures')}</h3>
   <p>${tr('无未实现的扩展对象类型、写操作、资产所有权认证或变更签名流程。','No unimplemented extended object types, write operations, asset ownership certification, or change signing flows.')}</p>
   <p>${tr('本语义层为纯前端只读模型。本体（Ontology）设计受 Palantir 等对象与关系建模启发，仅作为概念灵感，系统绝未原生集成 Palantir，亦未调用任何其专有服务。','This semantic layer is a pure front-end read-only model. The ontology design is conceptually inspired by object-and-relationship modeling such as Palantir, but the system has zero native Palantir integration and invokes no proprietary Palantir services.')}</p>
   <p>${tr('当前展示基于本地只读精选语料与静态 AST 解析，未连接实时数据流、未启用真实 MOI Memoria 记忆同步、未集成在线语义向量搜索，亦不执行用户提交代码。','The current presentation is based on local read-only curated corpora and static AST parsing. It is not connected to live data streams, real MOI Memoria sync, or online semantic search, and never executes submitted code.')}</p>
  </section>
 `;
}
function openOntology(triggerEl=null){
 $('#ontology-dialog-title').textContent=tr('语义模型说明','Ontology & Semantic Layer');
 $('#ontology-dialog-subtitle').textContent=tr('探索现有四大知识对象类型与有向关系的只读语义层。','Explore the read-only semantic layer for the four core knowledge object types and directed relationships.');
 renderOntologyContent();
 openDialog('ontology-dialog',triggerEl);
 const closeBtn=$('#ontology-dialog [data-close="ontology-dialog"]');
 if(closeBtn)closeBtn.focus?.({preventScroll:true});
}
function readLocals(data,id){
 const saved=storage.get(id==='numpy'?'notes':`notes:${id}`,[]);
 return Array.isArray(saved)?saved.filter(n=>n&&typeof n.name==='string'&&typeof n.text==='string').slice(0,100).flatMap(n=>{try{return[parseMarkdown(n.name,n.text,data)]}catch{return[]}}):[];
}
function readReviews(id){
 const saved=storage.get(id==='numpy'?'reviews':`reviews:${id}`,{});
 return saved&&typeof saved==='object'&&!Array.isArray(saved)?Object.fromEntries(Object.entries(saved).filter(([k,v])=>k.startsWith('change:')&&v&&typeof v==='object'&&typeof v.signature==='string'&&typeof v.at==='string'&&Number.isFinite(Date.parse(v.at)))):{};
}
async function selectWorkspace(id,{initial=false}={}){
 const targetLab=labs.find(l=>l.id===id);
 if(!targetLab)return;
 if(importBusy){toast(tr('笔记正在导入，完成后即可切换实验场。','A note is being imported. Switch labs when it finishes.'));return;}
 cancelActiveReveal(false);
 const wasDialogOpen=Boolean($('#workspace-dialog')?.open);
 const focusBeforeSwitch=wasDialogOpen?(lastFocus||$('#workspace-info')):document.activeElement;
 if(!initial&&state.workspace===id&&base){
  ++labSerial;
  clearTimeout(workspaceSwitchTimer);
  $('#app').classList.remove('workspace-switching');
  delete $('#app').dataset.switchingTo;
  $('#app').removeAttribute('aria-busy');
  if(wasDialogOpen)renderWorkspaceOptions();
  lastFocus=null;
  closeDialog('workspace-dialog');closeNavigation();
  const focusTarget=(wasDialogOpen?$('#workspace-info'):null)||(focusBeforeSwitch&&focusBeforeSwitch!==document.body?focusBeforeSwitch:null)||$('#workspace-info')||$('#content');
  focusTarget?.focus?.({preventScroll:true});
  return;
 }
 const hashRoute=normalizeRoute(location.hash.replace(/^#/,''));
 const normStateRoute=normalizeRoute(state.route);
 const currentRoute=normStateRoute&&titles[normStateRoute]&&normStateRoute!=='overview'?normStateRoute:(titles[hashRoute]?hashRoute:(titles[normStateRoute]?normStateRoute:'overview'));
 const serial=++labSerial;
 const appEl=$('#app');
 appEl.setAttribute('aria-busy','true');
 if(!initial){
  clearTimeout(workspaceSwitchTimer);
  appEl.classList.remove('workspace-settled');
  appEl.classList.add('workspace-switching');
  appEl.dataset.switchingTo=id;
 }
 try{
  const data=await loadLabData(targetLab);
  if(serial!==labSerial)return;
  const hadActiveFilters=!initial&&state.workspace!==id&&(
   state.version!=='all'||
   (Array.isArray(state.types)&&state.types.length>0)||
   Boolean(String(state.search||'').trim())||
   Boolean(String(state.topic||'').trim())||
   state.libraryType!=='all'||
   Boolean(String(state.librarySearch||'').trim())||
   Boolean(String($('#global-search')?.value||'').trim())||
   (state.graphMode==='impact'&&id!=='numpy')
  );
  const nextLocals=readLocals(data,id),nextReviews=readReviews(id);
  if(state.workspace!==id){
   moiRequestGeneration++;
   if(moiPendingRequest){moiPendingRequest.item.result={status:'cancelled'};moiPendingRequest.controller.abort();moiPendingRequest=null;}
   const onlineButton=$('#moi-online-button');if(onlineButton)onlineButton.disabled=false;
  }
  state.workspace=id;rawBase=data;locals=nextLocals;reviews=nextReviews;
  const nextGraphMode=id==='numpy'&&state.graphMode==='impact'?'impact':'knowledge';
  Object.assign(state,{route:currentRoute,version:'all',types:[],search:'',selected:null,topic:'',libraryType:'all',librarySearch:'',collapsed:new Set(),graphMode:nextGraphMode,inspectorSheetOpen:false,pendingFocusSelected:false});
  deletedNote=null;$('#global-search').value='';$('#assistant-version').value='compare';
  if(titles[currentRoute]&&normalizeRoute(location.hash.replace(/^#/,''))!==currentRoute){
   location.hash='#'+currentRoute;
  }
  storage.set('workspace',id);rebuild();render();renderMessages();
  if($('#workspace-dialog')?.open)renderWorkspaceOptions();
  lastFocus=null;
  closeDialog('workspace-dialog');closeNavigation();
  if(!initial){
   appEl.classList.remove('workspace-switching');
   delete appEl.dataset.switchingTo;
   appEl.classList.add('workspace-settled');
   clearTimeout(workspaceSwitchTimer);
   workspaceSwitchTimer=setTimeout(()=>appEl.classList.remove('workspace-settled'),200);
   const currentPageLabel=translateText(titles[state.route],state.lang);
   const filterResetSuffix=hadActiveFilters?tr(' · 已重置原实验场的筛选条件',' · Incompatible filters were reset'):'';
   toast(tr(`已切换至「${labTitle()}」· 保留当前视图：${currentPageLabel}${filterResetSuffix}`,`Switched to ${labTitle()} · Kept view: ${currentPageLabel}${filterResetSuffix}`));
   $('#workspace-scroll')?.scrollTo?.({top:0,behavior:'instant'});
   const focusTarget=(wasDialogOpen?$('#workspace-info'):null)||(focusBeforeSwitch&&focusBeforeSwitch!==document.body?focusBeforeSwitch:null)||$('#workspace-info')||$('#content');
   focusTarget?.focus?.({preventScroll:true});
  }
 }catch(err){
  if(serial!==labSerial)return;
  appEl.classList.remove('workspace-switching');
  delete appEl.dataset.switchingTo;
  if($('#workspace-dialog')?.open)renderWorkspaceOptions();
  if(base)toast(err.message);else appEl.innerHTML=`<section class="panel empty" role="alert"><h1>${tr('暂时无法打开实验场','Unable to open this lab')}</h1><p>${esc(err.message)}</p><button class="button" data-retry-lab="${esc(id)}">${tr('重试','Try again')}</button></section>`;
 }finally{if(serial===labSerial)appEl.removeAttribute('aria-busy');}
}
function changeLanguage(){
 state.lang=state.lang==='zh'?'en':'zh';storage.set('language',state.lang);
 if(document.documentElement)document.documentElement.lang=state.lang==='en'?'en':'zh-CN';
 rebuild();render();renderMessages();
 if($('#workspace-dialog').open)showWorkspaces();
 if($('#ontology-dialog')?.open)openOntology();
 if($('#search-dialog').open)searchResults();
 if($('#kiko-preview-dialog')?.open&&state.kikoPreview)openKikoPreview(state.kikoPreview);
}
function changeTheme(){
 state.theme=state.theme==='light'?'dark':'light';storage.set('theme',state.theme);
 if(document.documentElement)document.documentElement.dataset.theme=state.theme;
 updateShell();
}
function chooseKiko(k){
 if(!isValidKiko(k))return;
 state.kiko=k;storage.set('kiko',k);$$('#assistant img,#assistant-toggle img').forEach(img=>img.src=`/assets/kiko-${k}.png`);render();toast(tr('新的探险搭档，准备就绪。','Your companion is ready to explore.'));
}
function deleteNote(id){
 const removed=locals.find(x=>x.id===id);if(!removed)return;
 const next=locals.filter(x=>x.id!==id);
 if(!storage.set(noteKey(),next))return;
 deletedNote={note:removed,workspace:state.workspace};locals=next;rebuild();drawLibrary();updateShell();
 toast(tr('已移除笔记。','Note removed.'));
 const undo=document.createElement('button');undo.className='toast-undo';undo.dataset.undoNote='';undo.textContent=tr('撤销','Undo');$('#toast').append(undo);
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),9000);
}
function undoDelete(){
 if(!deletedNote||deletedNote.workspace!==state.workspace)return;
 const next=[...locals,deletedNote.note];if(!storage.set(noteKey(),next))return;
 locals=next;deletedNote=null;rebuild();render();toast(tr('笔记已恢复。','Note restored.'));
}

document.addEventListener('click',e=>{
 const b=e.target.closest('button,a,[data-row-node]');if(!b)return;const d=b.dataset;
 if(d.rowNode){navigateNode(d.rowNode);return;}
 if(d.route&&titles[normalizeRoute(d.route)])state.route=normalizeRoute(d.route);
 if(d.metric){const fromOverview=state.route==='overview';state.route='library';state.libraryType=d.metric;state.librarySearch='';if(fromOverview)state.version='all';if(location.hash==='#library')render();else location.hash='library';return;}
 if(d.node){navigateNode(d.node);return;}
 if(d.searchCommand){executeCommand(d.searchCommand);return;}
 if(d.searchNode){closeDialog('search-dialog');navigateNode(d.searchNode);return;}
 if(d.close){if(d.close==='kiko-preview-dialog')state.kikoPreview=null;closeDialog(d.close);return;}
 if(d.cancelKiko!==undefined){cancelKikoPreview();return;}
 if(d.confirmKiko!==undefined){confirmKikoPreview();return;}
 if(d.redownloadExport!==undefined){redownloadLastExport(b);return;}
 if(d.retryExport!==undefined){retryLastFailedExport(b);return;}
 if(d.toggleInspectorSheet!==undefined){state.inspectorSheetOpen=!state.inspectorSheetOpen;syncInspectorSheetClasses();b.setAttribute('aria-expanded',String(state.inspectorSheetOpen));return;}
 if(d.closeInspectorSheet!==undefined){state.inspectorSheetOpen=false;syncInspectorSheetClasses();$('#inspector [data-toggle-inspector-sheet]')?.setAttribute('aria-expanded','false');return;}
 if(d.workspace){selectWorkspace(d.workspace);return;}
 if(d.retryLab){selectWorkspace(d.retryLab,{initial:true});return;}
 if(d.workspacePicker!==undefined){showWorkspaces();return;}
 if(d.openOntology!==undefined){openOntology(b);return;}
 if(d.openAssistant!==undefined){openAssistant(b);return;}
 if(d.ask){ask(d.ask,b);return;}
 if(d.import!==undefined){openImport();return;}
 if(d.type){const selected=state.types.length?[...state.types]:Object.keys(types);state.types=selected.includes(d.type)?selected.filter(x=>x!==d.type):[...selected,d.type];if(!state.types.length)state.types=Object.keys(types).filter(t=>t===d.type);render();return;}
 if(d.clearGraph!==undefined){const preserveSelected=d.resetExcludedNode||null;Object.assign(state,{version:'all',search:'',types:[],selected:preserveSelected});render();return;}
 if(d.collapse){state.collapsed.has(d.collapse)?state.collapsed.delete(d.collapse):state.collapsed.add(d.collapse);render();return;}
 if(d.libraryType){state.libraryType=d.libraryType;render();return;}
 if(d.sort){if(state.sort===d.sort)state.sortDir*=-1;else{state.sort=d.sort;state.sortDir=1}drawLibrary();return;}
 if(d.delete){deleteNote(d.delete);return;}
 if(d.undoNote!==undefined){undoDelete();return;}
 if(d.topicFilter){state.topic=state.topic===d.topicFilter?'':d.topicFilter;if(state.route!=='analytics'){state.route='analytics';location.hash='analytics';}else render();return;}
 if(d.clearTopic!==undefined){state.topic='';render();return;}
 if(d.version){state.version=state.version===d.version?'all':d.version;render();return;}
 if(d.review){const event=memory().find(x=>x.id===d.review);if(!event)return;const next={...reviews};if(reviewAt(event))delete next[d.review];else next[d.review]={at:new Date().toISOString(),signature:reviewSignature(event)};if(storage.set(reviewKey(),next)){reviews=next;render();toast(next[d.review]?'已记录本地复核。':'已撤销本地复核。')}return;}
 if(d.connector){if(d.connector==='markdown'){openImport();return;}const [title,content,url]=connectorInfo[d.connector];info(title,`<p>${content}</p><a href="${url}" target="_blank" rel="noopener noreferrer">查看官方资料 ↗</a>`);return;}
 if(d.revealOutfit){revealOutfit(d.revealOutfit);return;}
 if(d.kiko){openKikoPreview(d.kiko,b);return;}
 if(d.revealKiko!==undefined){if(storage.set('kikoUnlocked',true)){render();toast(tr('隐藏伙伴已解锁，愿好奇心一直陪伴你。','Secret companion unlocked. Keep your curiosity close.'));}return;}
 if(d.selectEdge){
  state.impactSelectedEdge=d.selectEdge;
  state.impactSelectedNode=null;
  refreshImpactGraph();
  return;
 }
 if(d.graphMode){state.graphMode=d.graphMode;state.impactSelectedNode='A';state.impactSelectedEdge=null;render();return;}
 if(d.clearImpact!==undefined){state.impactVersion='2.0';state.impactSelectedNode='A';state.impactSelectedEdge=null;render();return;}
 if(d.retryImpact!==undefined){impactDemoCache=null;refreshImpactGraph();return;}
 if(d.exportImpact!==undefined){
  if(impactDemoCache){
   const vg=getVersionGraph(impactDemoCache,state.impactVersion);
   if(vg){
    download(`knowligence-impact-graph-${state.impactVersion}.json`,{
     workspace:'numpy',
     target_version:state.impactVersion,
     exportedAt:new Date().toISOString(),
     graph:vg
    },'application/json',b);
   }
  }
  return;
 }
 if(d.exportReview){
  if(impactDemoCache){
   const vg=getVersionGraph(impactDemoCache,state.impactVersion);
   try{
    const record=buildReviewExport(vg,d.exportReview);
    download(`knowligence-impact-review-${d.exportReview}.json`,record,'application/json',b);
   }catch(err){
    lastFailedExport={name:`knowligence-impact-review-${d.exportReview}.json`,data:null,type:'application/json'};
    showActionToast(`${tr('导出失败：','Export failed: ')}${err.message}`,'retryExport',tr('重试导出','Retry export'));
   }
  }
  return;
 }
 if(d.viewExcerpt){
  if(impactDemoCache){
   const vg=getVersionGraph(impactDemoCache,state.impactVersion);
   const node=vg.nodes.find(n=>n.id===d.viewExcerpt);
   if(node){
    info(
     `${tr('原件文件内容：','Original File: ')}${node.path}`,
     `<pre class="code-excerpt mono" style="max-height:400px;overflow:auto"><code>${esc(node.file_content)}</code></pre>`
    );
   }
  }
  return;
 }
 if(d.exportGraph!==undefined){download('knowligence-graph.json',{workspace:state.workspace,exportedAt:new Date().toISOString(),filters:{version:state.version,search:state.search,types:state.types},graph:graphSubset()},'application/json',b);return;}
 if(d.exportMindmap!==undefined){const lines=['# '+labTitle(),''];for(const [topic,label]of Object.entries(topicNames)){lines.push('## '+label);for(const c of corpus.claims.filter(c=>c.topic===topic&&(state.version==='all'||c.version===state.version))){lines.push(`- ${versionName(c.version)}: ${c.text}`);for(const id of c.source_ids){const source=corpus.sources.find(s=>s.id===id);if(source)lines.push(`  - [${source.title}](${source.url})`);}}lines.push('');}download('knowligence-mindmap.md',lines.join('\n'),'text/markdown',b);return;}
 if(d.exportLibrary!==undefined){download('knowligence-assets.csv','\uFEFF'+csv([['id',tr('名称','Name'),tr('类型','Type'),tr('范围','Scope'),tr('来源','Sources')],...selectedLibrary().map(n=>[n.id,n.label,n.type,n.version,n.sourceIds.join('|')])]),'text/csv;charset=utf-8',b);return;}
 if(d.exportAnalysis!==undefined){download('knowligence-analysis.json',{workspace:state.workspace,exportedAt:new Date().toISOString(),version:state.version,topic:state.topic||null,analysis:analyzeRecords(corpus,state.version),definition:tr('引用结构覆盖不等于准确率；来源记录按条目计数，多条记录可指向同一文献，且同一文献可覆盖多个主题与资料集。','Citation coverage is not accuracy; source records are counted per entry, multiple records may point to the same document, and documents may span multiple topics and scopes.')},'application/json',b);return;}
 if(d.exportMemory!==undefined){download('knowligence-version-review.json',{workspace:state.workspace,events:memory(),localReviews:reviews,provider:'browser-local; not Memoria service events'},'application/json',b);return;}
 if(d.exportChat!==undefined){
  const items=getChatHistory(state.workspace).map(item=>{
   if(item.mode==='online')return {question:item.question,version:item.version,mode:'online-curated-selection',status:item.result?.status||'unavailable',claims:item.result?.status==='answered'?item.result.claims.map(c=>c.id):[],gaps:[]};
   const res=queryEvidence(corpus,item.question,item.version,{locale:state.lang});
   return {question:item.question,version:item.version,status:res.status,claims:res.status==='answered'?res.claims.map(c=>c.id):[],gaps:res.gaps||[]};
  });
  download(`knowligence-chat-${state.workspace}.json`,{workspace:state.workspace,exportedAt:new Date().toISOString(),mode:items.some(item=>item.mode==='online-curated-selection')?'mixed-curated-evidence':'curated-evidence-only',messages:items},'application/json',b);
  return;
 }
});
$('#assistant-toggle').onclick=e=>openAssistant(e?.currentTarget||$('#assistant-toggle'));
$('#assistant-close').onclick=closeAssistant;
$('#assistant-clear')?.addEventListener('click',()=>{
 cancelActiveReveal(false);
 moiRequestGeneration++;
 if(moiPendingRequest){moiPendingRequest.controller.abort();moiPendingRequest=null;}
 const onlineButton=$('#moi-online-button');if(onlineButton)onlineButton.disabled=false;
 chatHistory[state.workspace]=[];
 renderMessages();
 $('#assistant-question')?.focus?.({preventScroll:true});
});
if($('#assistant-relocate')){
 $('#assistant-relocate').onclick=()=>relocateAssistant();
 $('#assistant-relocate').onkeydown=e=>{
  if(e.key==='Enter'||e.key===' '){
   e.preventDefault?.();
   relocateAssistant();
  }
 };
}
if($('#assistant-minimize'))$('#assistant-minimize').onclick=toggleAssistantMinimize;
if($('#assistant-reset-pos'))$('#assistant-reset-pos').onclick=()=>{resetAssistantPosition();$('#assistant-drag-handle')?.focus?.({preventScroll:true});};
const dragHandleEl=$('#assistant-drag-handle')||$('#assistant-header');
if(dragHandleEl){
 dragHandleEl.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  if(e.target?.closest?.('button,a,input,select,textarea')&&e.target!==dragHandleEl)return;
  if(isMobileAssistantViewport())return;
  const cur=computeClampedAssistantRect(state.assistantRect);
  assistantDragSession={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,origX:cur.x,origY:cur.y};
  dragHandleEl.setPointerCapture?.(e.pointerId);
 });
 dragHandleEl.addEventListener('pointermove',e=>{
  if(!assistantDragSession)return;
  if(assistantDragSession.pointerId!==undefined&&e.pointerId!==undefined&&e.pointerId!==assistantDragSession.pointerId)return;
  const dx=e.clientX-assistantDragSession.startX,dy=e.clientY-assistantDragSession.startY;
  const cur=computeClampedAssistantRect(state.assistantRect);
  state.assistantRect={x:assistantDragSession.origX+dx,y:assistantDragSession.origY+dy,width:cur.width,height:cur.height};
  applyAssistantBounds();
 });
 const endDrag=e=>{
  if(!assistantDragSession)return;
  try{if(e?.pointerId!==undefined)dragHandleEl.releasePointerCapture?.(e.pointerId);}catch{}
  assistantDragSession=null;
  if(!isMobileAssistantViewport()&&state.assistantRect){
   const clamped=computeClampedAssistantRect(state.assistantRect);
   saveAssistantGeometry(clamped);
  }
 };
 dragHandleEl.addEventListener('pointerup',endDrag);
 dragHandleEl.addEventListener('pointercancel',endDrag);
 dragHandleEl.addEventListener('keydown',e=>{
  const step=e.shiftKey?48:24;
  if(e.key==='ArrowLeft'){e.preventDefault();moveAssistantBy(-step,0);}
  else if(e.key==='ArrowRight'){e.preventDefault();moveAssistantBy(step,0);}
  else if(e.key==='ArrowUp'){e.preventDefault();moveAssistantBy(0,-step);}
  else if(e.key==='ArrowDown'){e.preventDefault();moveAssistantBy(0,step);}
  else if(e.key==='Home'){e.preventDefault();resetAssistantPosition();}
 });
}
const resizeHandleEl=$('#assistant-resize-handle');
if(resizeHandleEl){
 resizeHandleEl.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  if(isMobileAssistantViewport()||state.assistantMinimized)return;
  e.stopPropagation?.();
  const cur=computeClampedAssistantRect(state.assistantRect);
  assistantResizeSession={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,origX:cur.x,origY:cur.y,origW:cur.width,origH:cur.height};
  resizeHandleEl.setPointerCapture?.(e.pointerId);
 });
 resizeHandleEl.addEventListener('pointermove',e=>{
  if(!assistantResizeSession)return;
  if(assistantResizeSession.pointerId!==undefined&&e.pointerId!==undefined&&e.pointerId!==assistantResizeSession.pointerId)return;
  const dw=e.clientX-assistantResizeSession.startX,dh=e.clientY-assistantResizeSession.startY;
  state.assistantRect={x:assistantResizeSession.origX,y:assistantResizeSession.origY,width:assistantResizeSession.origW+dw,height:assistantResizeSession.origH+dh};
  applyAssistantBounds();
 });
 const endResize=e=>{
  if(!assistantResizeSession)return;
  try{if(e?.pointerId!==undefined)resizeHandleEl.releasePointerCapture?.(e.pointerId);}catch{}
  assistantResizeSession=null;
  if(!isMobileAssistantViewport()&&!state.assistantMinimized&&state.assistantRect){
   const clamped=computeClampedAssistantRect(state.assistantRect);
   saveAssistantGeometry(clamped);
  }
 };
 resizeHandleEl.addEventListener('pointerup',endResize);
 resizeHandleEl.addEventListener('pointercancel',endResize);
 resizeHandleEl.addEventListener('keydown',e=>{
  const step=e.shiftKey?48:24;
  if(e.key==='ArrowLeft'){e.preventDefault();resizeAssistantBy(-step,0);}
  else if(e.key==='ArrowRight'){e.preventDefault();resizeAssistantBy(step,0);}
  else if(e.key==='ArrowUp'){e.preventDefault();resizeAssistantBy(0,-step);}
  else if(e.key==='ArrowDown'){e.preventDefault();resizeAssistantBy(0,step);}
  else if(e.key==='Home'){e.preventDefault();resetAssistantPosition();}
 });
}
window.addEventListener('resize',()=>{if(!$('#assistant')?.hidden)applyAssistantBounds();else syncShellAssistantSafeSpace();});
$('#assistant-form').onsubmit=e=>{e.preventDefault();const q=$('#assistant-question').value.trim();if(q){ask(q);$('#assistant-question').value='';}};
// Explicit opt-in only; failures remain visible and never become offline "online" successes.
$('#moi-online-button')?.addEventListener('click',async()=>{
 const button=$('#moi-online-button'),input=$('#assistant-question');
 if(button.disabled)return;
 const question=input.value.trim(),workspace=state.workspace,version=$('#assistant-version').value||'compare';
 if(!question){input.focus?.({preventScroll:true});return;}
 cancelActiveReveal(true);
 const generation=++moiRequestGeneration;
 const item={mode:'online',question,version,result:{status:'pending'},revealed:false};
 const controller=new AbortController();moiPendingRequest={controller,item};
 getChatHistory(workspace).push(item);input.value='';button.disabled=true;renderMessages();$('#messages').scrollTop=$('#messages').scrollHeight;
 try{
  const result=await requestMoiSelection({question,workspace,version,signal:controller.signal});
  item.result=(generation===moiRequestGeneration&&state.workspace===workspace)?result:{status:'cancelled'};
  if(item.result?.status==='answered')item.revealed=false;
 }catch{item.result={status:generation===moiRequestGeneration?'unavailable':'cancelled'};}
 finally{if(generation===moiRequestGeneration){button.disabled=false;moiPendingRequest=null;}if(state.workspace===workspace){renderMessages();$('#messages').scrollTop=$('#messages').scrollHeight;}}
});
$('#assistant-question').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#assistant-form').requestSubmit();}};
$('#import-open').onclick=openImport;$('#new-note').onclick=openImport;
$('#file-input').onchange=()=>{importFile=$('#file-input').files[0]||null;$('#import-error').textContent=importFile?tr('已选择 ','Selected ')+importFile.name:'';};
$('#import-form').onsubmit=async e=>{
 e.preventDefault();if(importBusy)return;const button=e.submitter||$('#import-form button[type="submit"]');button.disabled=true;importBusy=true;const sessionSnapshot=importSession;
 try{
  let n;const fileSnapshot=importFile,nameSnapshot=$('#note-name').value,textSnapshot=$('#note-text').value,workspaceSnapshot=state.workspace;
  if(fileSnapshot){if(fileSnapshot.size>1048576)throw Error('文件超过 1 MB，请缩小后重试。');const bytes=await fileSnapshot.arrayBuffer();const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);n=parseMarkdown(fileSnapshot.name,text,rawBase);}
  else {if(!textSnapshot.trim())throw Error('请填写笔记内容或选择文件。');n=parseMarkdown((nameSnapshot.trim()||tr('新笔记','New note'))+'.md',textSnapshot,rawBase);}
  if(workspaceSnapshot!==state.workspace)throw Error(tr('实验场已改变，请重新导入。','The lab changed. Please import again.'));
  if(locals.some(x=>x.id===n.id))throw Error('相同内容的笔记已在知识空间中。');if(locals.length>=100)throw Error('本地演示最多保存 100 条笔记，请先导出并移除旧笔记。');
  const next=[...locals,n];if(!storage.set(noteKey(),next))throw Error('未保存导入内容，请先释放浏览器存储空间。');
  locals=next;rebuild();const sameDraft=sessionSnapshot===importSession&&nameSnapshot===$('#note-name').value&&textSnapshot===$('#note-text').value&&fileSnapshot===importFile;
  if(sameDraft){closeDialog('import-dialog');$('#note-name').value='';$('#note-text').value='';importFile=null;$('#file-input').value='';}state.libraryType='asset';state.librarySearch='';
  if(location.hash==='#library')render();else location.hash='library';toast(tr(`已导入「${n.title}」，识别 ${n.wikilinks.length} 个双链、${n.tags.length} 个标签。`,`Imported “${n.title}”: ${n.wikilinks.length} wiki links, ${n.tags.length} tags.`));
 }catch(err){const message=translateText(err.message||'导入失败。',state.lang);if(sessionSnapshot===importSession)$('#import-error').textContent=message;else toast(message);}finally{button.disabled=false;importBusy=false;}
};
$('#search-open').onclick=openSearch;
$('#global-search').oninput=()=>{state.searchIndex=0;searchResults();};
$('#search-clear').onclick=()=>{$('#global-search').value='';state.searchIndex=0;searchResults();$('#global-search').focus();};
$('#global-search').onkeydown=e=>{
 const results=$$('#search-results .search-result');
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!results.length)return;state.searchIndex=(state.searchIndex+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;searchResults();$(`#search-option-${state.searchIndex}`)?.scrollIntoView({block:'nearest'});}
 if(e.key==='Enter'&&!e.isComposing){e.preventDefault();results[state.searchIndex]?.click();}
};
$('#menu-toggle').onclick=()=>{const open=!$('#sidebar').classList.contains('open');$('#sidebar').classList.toggle('open',open);$('#sidebar-backdrop').hidden=!open;$('#menu-toggle').setAttribute('aria-expanded',open);if(open)$('#workspace-info').focus();};
$('#sidebar-backdrop').onclick=()=>closeNavigation(true);
function handleWorkspaceExport(triggerEl){
 download('knowligence-workspace.json',{workspace:state.workspace,exportedAt:new Date().toISOString(),corpus,localReviews:reviews,mode:'public-curated-demo',notice:tr('本地笔记与复核数据；非 MOI Memoria 服务备份。','Local notes and reviews; not a MOI Memoria backup.')},'application/json',triggerEl||$('#export-workspace'));
}
$('#export-workspace').onclick=e=>handleWorkspaceExport(e?.currentTarget||$('#export-workspace'));
$('#mobile-export-workspace')?.addEventListener('click',e=>{
 handleWorkspaceExport(e?.currentTarget||$('#mobile-export-workspace'));
 closeNavigation(true);
});
$('#workspace-info').onclick=showWorkspaces;
$('#about-button').onclick=()=>info('Knowligence · MatrixNEXT 2026',`<p>${tr('创意赛道 · 知识库探险家。让分散的资料成为可探索、可分析、可追溯的知识。','Creative track · Knowledge explorer. Turn scattered sources into knowledge you can explore, analyze and trace.')}</p><p>${tr('当前为精选公开证据演示：默认提供本地离线预设与规则匹配回答；登录并主动点击「MOI 在线询问」后，可调用受限 Genesis 在线模型从当前精选证据中筛选声明（共享每日额度）。MOI 原生知识库检索与 Memoria 尚未连接。','This is a curated public evidence demo: answers use local offline presets and rule matching by default; after sign-in and an explicit click on “Ask MOI online”, a restricted Genesis online model can select claims from the curated evidence (shares daily quota). MOI native knowledge retrieval and Memoria are not connected.')}</p><p><a href="/project-guide.html">${tr('项目导览与评审手册（独立说明页）','Project & Evaluator Guide (Standalone Page)')} →</a></p><p><a href="#brand" data-close="info-dialog">${tr('认识 Captain Kiko · 探索衣橱','Meet Captain Kiko · Explore the wardrobe')} →</a></p><a href="https://github.com/tony311536/moi" target="_blank" rel="noopener noreferrer">${tr('项目代码与文档','Project code and documentation')} ↗</a>`);
$('#language-toggle').onclick=changeLanguage;$('#theme-toggle').onclick=changeTheme;
function isFocusWithinAssistant(e){
 const panel=$('#assistant');
 if(!panel||panel.hidden||state.assistantMinimized)return false;
 const active=document.activeElement;
 const target=e?.target;
 const check=node=>{
  if(!node||node===document||node===document.body||node===document.documentElement)return false;
  if(node===panel)return true;
  if(typeof panel.contains==='function'&&panel.contains(node))return true;
  let cur=node.parentElement||node.parentNode;
  while(cur){if(cur===panel)return true;cur=cur.parentElement||cur.parentNode;}
  if(typeof node.closest==='function'){
   const anc=node.closest('#assistant');
   if(anc===panel)return true;
  }
  return false;
 };
 return check(active)||check(target);
}
function isNestedPopupControl(node,panel){
 if(!node||node===document||node===document.body||node===document.documentElement||node===panel)return false;
 const matchNode=el=>{
  if(!el||el===panel||el===document||el===document.body||el===document.documentElement)return false;
  const role=typeof el.getAttribute==='function'?el.getAttribute('role'):el.role;
  if(role==='menu'||role==='listbox')return true;
  if(String(el.tagName||'').toUpperCase()==='DETAILS'&&Boolean(el.open))return true;
  return false;
 };
 let cur=node;
 while(cur&&cur!==panel){
  if(matchNode(cur))return true;
  cur=cur.parentElement||cur.parentNode;
 }
 if(typeof node.closest==='function'){
  const anc=node.closest('[role="menu"],[role="listbox"],details[open]');
  if(anc&&anc!==node&&anc!==panel)return true;
  if(anc===node&&matchNode(anc))return true;
 }
 return false;
}
for(const dialog of $$('dialog')){
 let startedOutside=false;
 const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 dialog.addEventListener('pointerdown',e=>{startedOutside=e.target===dialog&&outside(e);});
 dialog.addEventListener('click',e=>{if(startedOutside&&e.target===dialog&&outside(e)){if(dialog.id==='kiko-preview-dialog')state.kikoPreview=null;dialog.close();}startedOutside=false;});
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(dialog.id==='kiko-preview-dialog')state.kikoPreview=null;dialog.close();});
 dialog.addEventListener('close',()=>{if(dialog.id==='kiko-preview-dialog')state.kikoPreview=null;lastFocus?.focus?.({preventScroll:true});});
}
document.addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&e.target?.matches?.('[data-row-node]')){e.preventDefault();navigateNode(e.target.dataset.rowNode);return;}
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if($('#search-dialog').open)closeDialog('search-dialog');else if(!$$('dialog').some(d=>d.open))openSearch();}
 const openModal=$$('dialog').find(d=>d.open);
 if(e.key==='Tab'&&openModal){
  const focusable=[...openModal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  if(focusable.length){
   const first=focusable[0],last=focusable.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();return;}
   if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();return;}
  }
 }
 if(e.key==='Escape'){
  if(e.defaultPrevented||e.isComposing||e.keyCode===229)return;
  if(openModal){
   e.preventDefault?.();
   if(openModal.id==='kiko-preview-dialog')state.kikoPreview=null;
   closeDialog(openModal.id);
   return;
  }
  const activeOrTarget=e.target&&e.target!==document&&e.target!==document.body?e.target:document.activeElement;
  if(isNestedPopupControl(activeOrTarget,$('#assistant')))return;
  if(isFocusWithinAssistant(e)){
   e.preventDefault?.();
   minimizeAssistant();
   return;
  }
  if($('#sidebar').classList.contains('open'))closeNavigation(true);
  else if(state.route==='graph'&&state.inspectorSheetOpen){state.inspectorSheetOpen=false;syncInspectorSheetClasses();$('#inspector [data-toggle-inspector-sheet]')?.setAttribute('aria-expanded','false');}
 }
 if(e.key==='Tab'&&$('#sidebar').classList.contains('open')){const focusable=$$('#sidebar a[href],#sidebar button:not([disabled])');const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
window.addEventListener('hashchange',()=>{const h=normalizeRoute(location.hash.slice(1));if(titles[h])state.route=h;if(base){render();$('#workspace-scroll')?.scrollTo?.({top:0,behavior:'instant'});}});
hydrateIcons();
state.lang=storage.get('language','zh')==='en'?'en':'zh';state.theme=storage.get('theme','light')==='dark'?'dark':'light';
if(document.documentElement){document.documentElement.lang=state.lang==='en'?'en':'zh-CN';document.documentElement.dataset.theme=state.theme;}
const savedKiko=storage.get('kiko','C1');state.kiko=isValidKiko(savedKiko)?savedKiko:'C1';
$$('#assistant img,#assistant-toggle img').forEach(img=>img.src=`/assets/kiko-${state.kiko}.png`);
state.assistantRect=loadStoredAssistantGeometry();
const savedWorkspace=storage.get('workspace','astronomy');await selectWorkspace(labs.some(l=>l.id===savedWorkspace)?savedWorkspace:'astronomy',{initial:true});
