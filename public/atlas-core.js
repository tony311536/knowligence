/** Pure local knowledge helpers. No DOM, network, storage, LLM, or execution. */
const VERSION_KEYS = ['1.26', '2.0'];
const TYPES = ['source', 'claim', 'topic', 'asset'];
const TOPICS = {
  float_: { label: 'float_ / float64', pattern: /(^|[^a-z0-9_])(?:np\.|numpy\.)?(?:float_|float64)(?![a-z0-9_])/i },
  complex_: { label: 'complex_ / complex128', pattern: /(^|[^a-z0-9_])(?:np\.|numpy\.)?(?:complex_|complex128)(?![a-z0-9_])/i },
  copy: { label: 'copy=False · 复制语义', pattern: /(^|[^a-z0-9_])copy\s*(?:=\s*(?:false|none)|\s+false)(?![a-z0-9_])|零拷贝|(?:numpy|np\.array|np\.asarray)[^\n]*(?:复制|拷贝)/i },
  promotion: { label: 'dtype promotion', pattern: /(^|[^a-z0-9_])(?:promotion|float32)(?![a-z0-9_])|nep\s*50|类型提升|dtype\s*提升/i },
  ptp: { label: 'ndarray.ptp · 极差', pattern: /(^|[^a-z0-9_])ptp(?![a-z0-9_])|极差/i },
};
const strings = value => Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
const unique = values => [...new Set(values)];
const clone = value => JSON.parse(JSON.stringify(value));
const localeOf = options => (typeof options === 'string' ? options : options?.locale) === 'en' ? 'en' : 'zh';
const isAstronomy = corpus => corpus?.metadata?.id === 'astronomy';
const isHospitality = corpus => corpus?.metadata?.id === 'hospitality';
const versionsFor = corpus => {
  const declared = (corpus?.metadata?.versions || []).map(item => typeof item === 'string' ? item : item.id).filter(id => typeof id === 'string' && id && id !== 'all' && id !== 'compare');
  return declared.length ? unique(declared) : [...VERSION_KEYS];
};
const topicDefinition = (corpus, topic) => (corpus?.metadata?.topics || []).find(item => item.id === topic);
const localized = (record, key, locale) => (locale === 'en' && record?.[`${key}_en`]) || record?.[key] || '';
// Keep original and translated prose searchable even after the UI localizes the corpus.
const searchableValues = (record, fields) => unique(fields.flatMap(key =>
  [record?.[key], record?.[`${key}_zh`], record?.[`${key}_en`]]
    .filter(value => typeof value === 'string' && value.trim())));
const topicLabel = (topic, corpus, locale = 'zh') => localized(topicDefinition(corpus, topic), 'label', locale) || TOPICS[topic]?.label || topic;
const detectTopics = (text, corpus) => {
  const declared = corpus?.metadata?.topics;
  if (!Array.isArray(declared) || !declared.some(item => Array.isArray(item.keywords))) return Object.entries(TOPICS).filter(([, def]) => def.pattern.test(text)).map(([key]) => key);
  const lower = text.toLocaleLowerCase();
  return declared.filter(item => strings(item.keywords).some(keyword => {
    const term = keyword.toLocaleLowerCase();
    if (/^[a-z0-9 -]+$/.test(term)) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lower);
    }
    return lower.includes(term);
  })).map(item => item.id);
};
const versionFields = versions => {
  const values = unique(versions.filter(x => typeof x === 'string' && x));
  return { versions: values, version: values.length === 1 ? values[0] : values.length ? 'multiple' : null };
};

function prepare(corpus) {
  if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) throw new TypeError('corpus 必须是对象');
  const warnings = [];
  const ids = new Set();
  function records(key) {
    if (corpus[key] !== undefined && !Array.isArray(corpus[key])) warnings.push(`${key} 不是数组，已忽略。`);
    return (Array.isArray(corpus[key]) ? corpus[key] : []).filter(record => {
      if (!record || typeof record.id !== 'string' || !record.id.trim()) {
        warnings.push(`${key} 中缺少有效 id 的记录已忽略。`); return false;
      }
      if (ids.has(record.id) || record.id.startsWith('topic:')) {
        warnings.push(`重复或保留 id 已忽略：${record.id}`); return false;
      }
      ids.add(record.id); return true;
    });
  }
  const sources = records('sources');
  const claims = records('claims');
  const assets = records('assets');
  const sourceMap = new Map(sources.map(source => [source.id, source]));
  const bound = claim => {
    const refs = unique(strings(claim.source_ids));
    return Boolean(claim.version && refs.length && refs.every(id => sourceMap.has(id) && sourceMap.get(id).version === claim.version));
  };
  for (const claim of claims) if (!bound(claim)) warnings.push(`声明 ${claim.id} 引用缺失或版本不一致，不能作为充分证据。`);
  for (const asset of assets) for (const id of strings(asset.source_ids)) {
    if (!sourceMap.has(id)) warnings.push(`资料 ${asset.id} 引用了不存在的来源 ${id}。`);
  }
  return { sources, claims, assets, sourceMap, bound, warnings };
}

function assetTopics(asset, corpus) {
  return unique([...strings(asset.topics), ...detectTopics(searchableValues(asset, ['title','question','code','text']).join('\n'), corpus)]);
}

export function buildGraph(corpus, options = {}) {
  const locale = localeOf(options);
  const data = prepare(corpus);
  const nodes = [];
  const edges = [];
  const topicSet = unique([
    ...data.claims.map(claim => claim.topic).filter(topic => typeof topic === 'string' && topic),
    ...data.assets.flatMap(asset => assetTopics(asset, corpus)),
  ]);
  const makeNode = (type, record, extra = {}) => ({ id: record.id, label: localized(record, 'title', locale) || record.id, label_en: record.title_en || record.title || record.id, type,
    searchTerms: searchableValues(record, ['title','text','excerpt','question']),
    ...versionFields(record.version ? [record.version] : []), sourceIds: unique(strings(record.source_ids)), topics: [], ...extra });
  const edge = (source, target, relation, extra = {}) => edges.push({
    id: `${relation}:${encodeURIComponent(source)}:${encodeURIComponent(target)}`,
    source, target, relation, sourceIds: [], ...extra,
  });

  for (const source of data.sources) {
    const topics = unique(data.claims.filter(claim => strings(claim.source_ids).includes(source.id)).map(claim => claim.topic).filter(Boolean));
    nodes.push(makeNode('source', source, { sourceIds: [source.id], topics,
      url: source.url || '', canonicalUrl: source.canonical_url || source.url || '',
      section: source.section || '', publisher: inferPublisher(source),
      excerpt: localized(source, 'excerpt', locale), excerpt_en: source.excerpt_en || source.excerpt || '', kind: source.kind || '',
      verifiedAt: source.verified_at || null }));
  }
  for (const claim of data.claims) {
    nodes.push(makeNode('claim', claim, { text: localized(claim, 'text', locale), text_en: claim.text_en || claim.text || '', topic: claim.topic || null,
      topics: claim.topic ? [claim.topic] : [], evidenceStatus: data.bound(claim) ? 'bound' : 'unverified' }));
    for (const sourceId of unique(strings(claim.source_ids))) {
      if (data.sourceMap.has(sourceId) && claim.version && data.sourceMap.get(sourceId).version === claim.version) {
        edge(sourceId, claim.id, 'supports', { sourceIds: [sourceId], evidenceStatus: 'bound' });
      }
    }
    if (claim.topic) edge(claim.id, `topic:${claim.topic}`, 'applies-to', { sourceIds: unique(strings(claim.source_ids)) });
  }
  for (const topic of topicSet) {
    const claims = data.claims.filter(claim => claim.topic === topic);
    const refs = unique(claims.flatMap(claim => strings(claim.source_ids)));
    nodes.push({ id: `topic:${topic}`, label: topicLabel(topic, corpus, locale), label_en: topicLabel(topic, corpus, 'en'), type: 'topic', topic, topics: [topic],
      searchTerms: searchableValues(topicDefinition(corpus, topic), ['label']),
      sourceIds: refs, ...versionFields(claims.map(claim => claim.version)) });
  }
  for (const asset of data.assets) {
    const topics = assetTopics(asset, corpus);
    const sourceIds = unique(strings(asset.source_ids));
    const versions = [asset.version, ...sourceIds.map(id => data.sourceMap.get(id)?.version)].filter(Boolean);
    nodes.push(makeNode('asset', asset, { ...versionFields(versions), topics, sourceIds,
      text: localized(asset, 'text', locale), text_en: asset.text_en || asset.text || '', code: asset.code || '', question: localized(asset, 'question', locale), question_en: asset.question_en || asset.question || '',
      tags: unique(strings(asset.tags)), wikilinks: unique(strings(asset.wikilinks)),
      origin: asset.origin || 'curated-example', kind: asset.kind || 'example',
      evidenceStatus: 'unverified', unverified: true }));
    for (const topic of topics) edge(`topic:${topic}`, asset.id, 'impacts', {
      sourceIds, evidenceStatus: 'candidate',
      reason: locale === 'en' ? 'The asset mentions this topic: a candidate relation for review, not a confirmed failure or causal impact.' : '资料提及该主题，属于待复核候选；不代表已证实失效或因果影响。',
    });
  }
  const nodeIds = new Set(nodes.map(node => node.id));
  return { nodes, edges: edges.filter(item => nodeIds.has(item.source) && nodeIds.has(item.target)), warnings: unique(data.warnings), versionKeys: versionsFor(corpus) };
}

function checkedVersion(version, keys = VERSION_KEYS) {
  if (version !== 'all' && !keys.includes(version)) throw new RangeError(`version 必须是 all 或当前资料范围：${keys.join('、')}`);
  return version;
}

export function filterGraph(graph, { version = 'all', search = '', types = [] } = {}) {
  checkedVersion(version, graph.versionKeys || VERSION_KEYS);
  if (typeof search !== 'string' || !Array.isArray(types) || types.some(type => !TYPES.includes(type))) {
    throw new TypeError('search 必须是文本，types 必须是有效节点类型数组');
  }
  const needle = search.trim().toLocaleLowerCase();
  const nodes = (graph.nodes || []).filter(node => {
    if (version !== 'all' && !(node.versions || []).includes(version)) return false;
    if (types.length && !types.includes(node.type)) return false;
    const text = [node.id, node.label, node.label_en, node.topic, node.text, node.text_en, node.excerpt, node.excerpt_en, node.question, node.question_en, node.code,
      ...strings(node.searchTerms),
      ...(node.topics || []), ...(node.tags || []), ...(node.wikilinks || [])].filter(Boolean).join('\n').toLocaleLowerCase();
    return !needle || text.includes(needle);
  });
  const ids = new Set(nodes.map(node => node.id));
  return { nodes: clone(nodes), edges: clone((graph.edges || []).filter(edge => ids.has(edge.source) && ids.has(edge.target))),
    warnings: [...(graph.warnings || [])], versionKeys: [...(graph.versionKeys || VERSION_KEYS)] };
}

function canonicalSourceKey(node) {
  return String(node?.canonicalUrl || node?.url || '').trim().split('#')[0] || node?.id || '';
}

function inferPublisher(source) {
  if (typeof source?.publisher === 'string' && source.publisher.trim()) return source.publisher.trim();
  try {
    const url = new URL(source?.url || '');
    if (url.protocol !== 'https:') return '';
    const { hostname, pathname } = url;
    if (hostname === 'science.nasa.gov' || hostname === 'www.nasa.gov') return 'NASA';
    if (hostname === 'esawebb.org' || hostname === 'www.esa.int') return 'ESA/Webb';
    if (hostname === 'www.energystar.gov' && (
      pathname.startsWith('/buildings/resources-audience/small-biz/lodging') ||
      pathname === '/sites/default/files/2024-06/Energy%20Checklist_Hotels_new_2024.pdf' ||
      decodeURI(pathname) === '/sites/default/files/2024-06/Energy Checklist_Hotels_new_2024.pdf'
    )) return 'U.S. EPA / ENERGY STAR';
    if (hostname === 'www.epa.gov' && (
      pathname.startsWith('/watersense/types-facilities') ||
      pathname === '/watersense/h2otel-challenge'
    )) return 'U.S. Environmental Protection Agency (EPA)';
    if ((hostname === 'numpy.org' && pathname.startsWith('/doc/')) ||
        (hostname === 'github.com' && /^\/numpy\/numpy(\/|$)/.test(pathname))) return 'NumPy';
  } catch {}
  return '';
}

function normalizePublisherLabel(publisher, allPublishers) {
  const raw = String(publisher || '').trim();
  if (!raw) return '';
  if (/^U\.S\.\s+EPA\s*\/\s*ENERGY\s+STAR$/i.test(raw) &&
      allPublishers.some(p => /\bEPA\b/i.test(p) && !/ENERGY\s+STAR/i.test(p))) {
    return 'ENERGY STAR';
  }
  return raw;
}

function counts(nodes, { countSourceRecords = false } = {}) {
  const sourceNodes = nodes.filter(node => node.type === 'source');
  const distinctDocs = new Set(sourceNodes.map(canonicalSourceKey).filter(Boolean)).size || sourceNodes.length;
  return {
    sources: countSourceRecords ? sourceNodes.length : distinctDocs,
    sourceRecords: sourceNodes.length,
    distinctDocuments: distinctDocs,
    claims: nodes.filter(node => node.type === 'claim').length,
    topics: nodes.filter(node => node.type === 'topic').length,
    assets: nodes.filter(node => node.type === 'asset').length,
  };
}

export function analyze(corpus, version = 'all', options = {}) {
  const keys = versionsFor(corpus);
  checkedVersion(version, keys);
  const countSourceRecords = Boolean(options && typeof options === 'object' && options.countSourceRecords);
  const graph = buildGraph(corpus, options);
  const selected = filterGraph(graph, { version });
  const claimNodes = selected.nodes.filter(node => node.type === 'claim');
  const allSourceIds = new Set(graph.nodes.filter(node => node.type === 'source').map(node => node.id));
  const withReferences = claimNodes.filter(node => node.sourceIds.length > 0).length;
  const fullyResolved = claimNodes.filter(node => node.sourceIds.length && node.sourceIds.every(id => allSourceIds.has(id))).length;
  const versionBound = claimNodes.filter(node => node.evidenceStatus === 'bound').length;
  const byVersion = Object.fromEntries(keys.map(key => {
    const c = counts(filterGraph(graph, { version: key }).nodes, { countSourceRecords });
    return [key, { sources: c.sources, claims: c.claims, topics: c.topics, assets: c.assets }];
  }));
  const unknownCounts = counts(graph.nodes.filter(node => !node.versions.length || !node.versions.some(v => keys.includes(v))), { countSourceRecords });
  byVersion.unknown = { sources: unknownCounts.sources, claims: unknownCounts.claims, topics: unknownCounts.topics, assets: unknownCounts.assets };
  const byTopic = Object.fromEntries(selected.nodes.filter(node => node.type === 'topic').map(node => {
    const members = selected.nodes.filter(member => member.type !== 'topic' && member.topics.includes(node.topic));
    const topicSources = members.filter(member => member.type === 'source');
    const topicDistinctDocs = new Set(topicSources.map(canonicalSourceKey).filter(Boolean)).size || topicSources.length;
    return [node.topic, { label: node.label, sources: countSourceRecords ? topicSources.length : topicDistinctDocs,
      sourceRecords: topicSources.length,
      distinctDocuments: topicDistinctDocs,
      claims: members.filter(member => member.type === 'claim').length, assets: members.filter(member => member.type === 'asset').length,
      versions: version === 'all' ? [...node.versions] : node.versions.filter(v => v === version) }];
  }));
  const selectedSourceNodes = selected.nodes.filter(node => node.type === 'source');
  const selectedSourceRecords = selectedSourceNodes.length;
  const distinctDocs = new Set(selectedSourceNodes.map(canonicalSourceKey).filter(Boolean)).size || selectedSourceRecords;
  const rawPublishers = unique(selectedSourceNodes.map(node => inferPublisher(node)).filter(Boolean));
  const distinctPublishers = unique(rawPublishers.map(pub => normalizePublisherLabel(pub, rawPublishers)).filter(Boolean));
  const topCounts = counts(selected.nodes, { countSourceRecords });
  return { version, sources: topCounts.sources, claims: topCounts.claims, topics: topCounts.topics, assets: topCounts.assets,
    sourceRecords: selectedSourceRecords, distinctDocuments: distinctDocs,
    publishers: distinctPublishers, publisherCount: distinctPublishers.length, byVersion, byTopic,
    citationCoverage: { totalClaims: claimNodes.length, withReferences, fullyResolved, versionBound,
      ratio: claimNodes.length ? versionBound / claimNodes.length : null },
    graph: { nodes: selected.nodes.length, edges: selected.edges.length }, warnings: [...graph.warnings] };
}

function officialVersionSource(source, corpus) {
  if (!source || !String(source.kind || '').startsWith('official')) return false;
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:') return false;
    if (isAstronomy(corpus)) return ['science.nasa.gov', 'www.nasa.gov', 'esawebb.org', 'www.esa.int'].includes(url.hostname);
    if (isHospitality(corpus)) {
      return (url.hostname === 'www.energystar.gov' && (
        url.pathname.startsWith('/buildings/resources-audience/small-biz/lodging') ||
        url.pathname === '/sites/default/files/2024-06/Energy%20Checklist_Hotels_new_2024.pdf' ||
        decodeURI(url.pathname) === '/sites/default/files/2024-06/Energy Checklist_Hotels_new_2024.pdf'
      )) ||
      (url.hostname === 'www.epa.gov' && (
        url.pathname.startsWith('/watersense/types-facilities') ||
        url.pathname === '/watersense/h2otel-challenge'
      ));
    }
    return (url.hostname === 'numpy.org' && url.pathname.startsWith(`/doc/${source.version}/`)) ||
      (url.hostname === 'github.com' && url.pathname.startsWith(`/numpy/numpy/blob/v${source.version}.`));
  } catch { return false; }
}

function scopeGaps(question, topics, version) {
  const q = question.toLowerCase();
  const gaps = [];
  const knownApis = new Set(['float_', 'float64', 'complex_', 'complex128', 'float32', 'array', 'asarray', 'ptp', 'ndarray.ptp']);
  const apiNames = [...q.matchAll(/(?:^|[^a-z0-9_])(?:np|numpy)\.([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*)/g)].map(match => match[1]);
  const unknown = unique(apiNames.filter(name => !knownApis.has(name)));
  if (unknown.length) gaps.push(`未覆盖这些 API：${unknown.map(name => `np.${name}`).join('、')}；已知符号不能替它们回答。`);
  if (/(?:^|[^a-z0-9_])(?:trapz|trapezoid|fft|lstsq|quantile|percentile|loadtxt|genfromtxt|int_)(?![a-z0-9_])/i.test(q)) gaps.push('问题含有当前五主题以外的 API 或能力。');
  const rules = [
    [/肯定安全|一定安全|安全吗|全部生产|生产作业|无风险|不会出错|100%|保证.{0,8}(?:可用|兼容|安全)|所有.{0,10}(?:兼容|安全|作业)|直接(?:升级|上线)|完整兼容|安全|生产|保证|safe|safety|guarantee|production/, '精选文档不能证明工程安全或完整兼容，缺少依赖、环境和回归验证。'],
    [/pandas|scipy|tensorflow|pytorch|matplotlib|sklearn|scikit-learn|numba|cupy|第三方|依赖兼容|其他库/, '未覆盖第三方库兼容矩阵。'],
    [/(?:读取|读入|导入|加载|写入|导出|保存|解析|读写).{0,30}(?:excel|csv|xlsx|json|文件|图片|数据库|pdf)|(?:excel|csv|xlsx|json|图片|数据库|pdf).{0,30}(?:读取|读入|导入|加载|写入|导出|保存|解析|读写)|excel|csv|xlsx|json|pdf|数据库|读文件|文件读写|加载文件|保存文件|绘图|画图|股票|股价|预测|模型训练|(?:read|load|write|parse).{0,20}(?:excel|csv|xlsx|json|file|database)/, '未覆盖该数据接入或实现任务。'],
    [/(?:内存|性能|速度|耗时|延迟|吞吐|qps|benchmark|memory|performance).{0,20}(?:多少|提升|降低|增加|节省|比较|percent|improv|reduc|how)|(?:快|慢|提升|提速|节省).{0,8}多少|how much.{0,20}(?:memory|faster|performance)|性能|内存|提速|节省|吞吐|耗时|延迟|qps|benchmark|performance|how much|快多少|慢多少/, '没有该项目的性能、内存或收益基准。'],
    [/我的环境|我们.{0,5}环境|本机|服务器|线上|生产环境|根因|崩溃|实际报错|这个报错|我的错误|这段代码.{0,8}(?:为什么|原因)|本地.{0,10}(?:错|崩溃|原因)|(?:my|our).{0,20}(?:environment|server|crash)/, '环境根因需要完整异常、依赖版本与最小复现，静态资料不能确认。'],
    [/windows|默认整数|c[- ]?api|c[- ]?abi|\babi\b|\bwheel\b|二进制|编译|pickle|序列化|线性代数|归一化/, '所问平台、二进制或其他行为没有纳入当前五主题证据。'],
    [/迁移清单|迁移概览|(?:numpy|升级|迁移).{0,15}有哪些.{0,8}(?:变化|风险|差异)|升级.{0,8}(?:注意|风险)|迁移.{0,15}注意|(?:所有|全部|完整|全面).{0,10}(?:变化|差异|迁移|兼容|审查)|所有|全部|完整|全面|一切|全部变化|(?:full|complete)\s+(?:migration|compatibility)|all\s+(?:changes|differences)|migration\s+(?:overview|checklist)/, '精选五主题不是完整迁移或项目审查。'],
    [/(?:项目|工程|仓库|清单|调用链路|影响链|代码资产).{0,25}(?:哪些|需要处理|受影响|失效|修改|更新|复核)|(?:fixture|清单|清单中).{0,25}(?:哪些|处理|引用|调用)|(?:笔记|脚本|代码|模块).{0,10}[a-z].{0,15}(?:引用|调用|依赖)|which\s+(?:knowledge|code|files?|scripts?|notes?|assets?).{0,30}(?:need|affect|handl|updat)|(?:project|repository|repo|fixture|inventory).{0,25}(?:which|affect|need\s+to\s+be\s+handled)/, '知识失效影响只能依据实际代码引用/调用证据判定；精选 API 事实不能单独推断具体项目代码或资产的影响范围。'],
  ];
  for (const [pattern, gap] of rules) if (pattern.test(q)) gaps.push(gap);
  const versionGroups = [...q.matchAll(/(?:numpy\s*(?:版本|version|v)?\s*|版本\s*|\bversion\s*|在\s*|\bin\s+v?)(\d+\.\d+(?:\.\d+)?(?:\s*(?:→|->|到|至|\/|与|和|\bvs\.?|\bversus\b|\bto\b|\band\b)\s*v?\d+\.\d+(?:\.\d+)?)*)/g)].map(match => match[1]).join(' ');
  const declared = unique([...versionGroups.matchAll(/\d+\.\d+(?:\.\d+)?/g)].map(match => match[0].split('.').slice(0, 2).join('.')));
  if (declared.some(value => !VERSION_KEYS.includes(value))) gaps.push('题目要求的版本超出 1.26 / 2.0 精选范围。');
  const comparisonIntent = /升级|迁移|对比|比较|区别|差异|upgrade|migrat|compar|differ|versus|\bvs\b/.test(q);
  if (version !== 'compare' && declared.some(value => value !== version) && !comparisonIntent) gaps.push('题目版本与所选版本不同，请先统一范围。');
  const shorthand = /^\s*(?:numpy\s*(?:1\.26(?:\.\d+)?|2\.0(?:\.\d+)?)?\s*)?(?:(?:np|numpy|ndarray)\.)?(?:float_|float64|complex_|complex128|float32|copy\s*=\s*(?:false|none)|copy\s+false|ptp|promotion|nep\s*50|dtype\s*promotion|类型提升|dtype\s*提升|极差|零拷贝)\s*[?？.。!！]*\s*$/.test(q);
  const taskRequest = /如何|怎样|怎么|how\s+(?:to|do|can|should)/.test(q);
  const taskIntent = /迁移|升级|替代|替换|改用|改写|怎么改|如何改|移除|弃用|定义|含义|是什么|什么是|区别|差异|变化|对比|比较|可用|还能用|能用吗|别名|同义|对应|报错|valueerror|复制|拷贝|零拷贝|类型提升|promotion|nep\s*50|精度|极差|available|availability|removed|removal|deprecated|deprecation|alias|aliases|synonym|changed|change|meaning|replace|replacement|migrat|upgrad|compar|differ|difference|raise|raises|raised|valueerror|what\s+is|what\s+are/.test(q);
  const supportedIntent = taskIntent || /copy\s*=|dtype|ptp|语义|行为|规则|behavior|semantics|rule/.test(q);
  if (taskRequest && !taskIntent) gaps.push('当前证据仅支持名称可用性、迁移替代、复制语义、类型提升和极差事实；未确认所问任务的实现方法。');
  else if (!supportedIntent && !shorthand) gaps.push('未确认问题属于已整理的迁移事实或 API 可用性意图。');
  if (!topics.length) gaps.push('未匹配到已核查的五类主题。');
  return unique(gaps);
}

function comparisons(claims, corpus, options = {}) {
  if (corpus?.metadata?.versionMode === 'collection') return [];
  const locale = localeOf(options);
  const [fromVersion, toVersion] = versionsFor(corpus);
  if (!fromVersion || !toVersion) return [];
  const results = [];
  for (const topic of unique(claims.map(claim => claim.topic).filter(Boolean))) {
    const old = claims.filter(claim => claim.topic === topic && claim.version === fromVersion);
    const next = claims.filter(claim => claim.topic === topic && claim.version === toVersion);
    if (old.length && next.length) results.push({ topic, title: `${topicLabel(topic, corpus, locale)} · ${locale === 'en' ? 'Version comparison' : '版本对照'}`,
      before: old.map(claim => localized(claim, 'text', locale)).join('\n'), after: next.map(claim => localized(claim, 'text', locale)).join('\n'),
      reason: locale === 'en' ? 'These sources apply to different versions and cannot be merged into a version-free answer.' : '资料适用版本不同，不能合并成不带版本条件的答案。',
      claimIds: [...old, ...next].map(claim => claim.id), sourceIds: unique([...old, ...next].flatMap(claim => strings(claim.source_ids))) });
  }
  return results;
}

function queryNumPy(corpus, question, version = 'compare', options = {}) {
  if (typeof question !== 'string' || !question.trim() || question.length > 3000) throw new TypeError('question 必须是 1–3000 字符的文本');
  const locale = localeOf(options);
  const targetVersion = version === 'all' ? 'compare' : version;
  const q = question.trim();
  const data = prepare(corpus);
  let topics = detectTopics(q, corpus);
  const overview = !topics.length && /numpy/i.test(q) && /有哪些.{0,8}(?:变化|风险|差异)|迁移概览|迁移清单|升级.{0,8}(?:注意|风险)|迁移.{0,15}注意|migration\s+(?:overview|checklist)|all\s+(?:changes|differences)|(?:full|complete)\s+(?:migration|compatibility)/i.test(q);
  if (overview) topics = Object.keys(TOPICS);
  const gaps = scopeGaps(q, topics, targetVersion);
  if (overview) gaps.push('只能返回当前精选主题，无法据此给出完整迁移概览。');
  const validVersion = targetVersion === 'compare' || VERSION_KEYS.includes(targetVersion);
  if (!validVersion) gaps.push('version 必须是 compare、all、1.26 或 2.0。');
  const candidates = data.claims.filter(claim => topics.includes(claim.topic) && (targetVersion === 'compare' || claim.version === targetVersion));
  const claims = validVersion ? candidates.filter(claim => data.bound(claim) && strings(claim.source_ids).every(id => officialVersionSource(data.sourceMap.get(id), corpus))) : [];
  if (claims.length !== candidates.length) gaps.push('部分声明缺少同版本官方来源，已从回答中排除。');
  if (!claims.length) gaps.push('当前没有足以回答的已整理声明。');
  for (const topic of topics) {
    if (!claims.some(claim => claim.topic === topic)) gaps.push(`缺少 ${topicLabel(topic)} 在请求版本的有效声明。`);
    if (targetVersion === 'compare' && VERSION_KEYS.some(value => !claims.some(claim => claim.topic === topic && claim.version === value))) gaps.push(`${topicLabel(topic)} 缺少完整双版本证据。`);
  }
  const sourceIds = new Set(claims.flatMap(claim => strings(claim.source_ids)));
  const sources = data.sources.filter(source => sourceIds.has(source.id));
  const status = gaps.length ? 'insufficient' : 'answered';
  const facts = claims.map(claim => `【NumPy ${claim.version} · ${localized(claim, 'title', locale) || claim.id}】\n${localized(claim, 'text', locale)} [${strings(claim.source_ids).join(', ')}]`).join('\n\n');
  const displayGaps = unique(gaps).map(gap => locale === 'en' ? englishGap(gap) : gap);
  return { status, answer: status === 'answered' ? facts : `${locale === 'en' ? 'Insufficient evidence for the requested scope. ' : '证据不足，不能对所问范围下结论。'}${displayGaps.join(' ')}${facts ? `\n\n${locale === 'en' ? 'Related curated facts only:' : '以下仅为相关精选事实：'}\n\n${facts}` : ''}`,
    claims: clone(claims), sources: clone(sources), conflicts: targetVersion === 'compare' ? comparisons(claims, corpus, options) : [],
    gaps: displayGaps, next_steps: status === 'insufficient' ? [locale === 'en' ? 'Add the missing official version-specific sources or narrow the question, then check citations and conditions.' : '补充缺失版本的官方资料或缩小问题，再核对引用与适用条件。'] : [locale === 'en' ? 'Verify behavior in an isolated project environment; curated evidence is not an execution test.' : '在隔离项目环境验证实际行为；精选证据不等于执行测试。'],
    trace: locale === 'en' ? [{step:'Scope',detail:`Requested scope: ${targetVersion}.`},{step:'Topics',detail:`Matched ${topics.length} curated topics.`},{step:'Citations',detail:`${claims.length} claims linked to ${sources.length} official sources from matching versions; no online model was called.`},{step:'Evidence threshold',detail:status === 'answered' ? 'Returns curated facts; no code was executed.' : 'Some conditions are outside the evidence scope.'}] : [{ step: '限定版本', detail: `请求范围：${targetVersion}。` },
      { step: '匹配主题', detail: `命中 ${topics.length} 个精选主题。` },
      { step: '引用边界', detail: `${claims.length} 条声明关联 ${sources.length} 个同版本官方来源；未调用在线模型。` },
      { step: '证据门槛', detail: status === 'answered' ? '返回已整理事实；未执行代码。' : '存在未覆盖条件，保持证据不足。' }],
    mode: 'curated-local', query: { question: q, version: targetVersion }, topics: [...topics] };
}

function visibleMarkdown(text) {
  let fence = null;
  const lines = text.split(/\r?\n/).map(line => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length) fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
  return lines.replace(/`+[^`\n]*`+/g, '').replace(/<([a-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]*>/g, '');
}

function localId(text) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const value of new TextEncoder().encode(text)) {
    first = Math.imul(first ^ value, 0x01000193) >>> 0;
    second = Math.imul(second ^ value, 0x85ebca6b) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}

export function parseMarkdown(name, text, corpus = null) {
  if (typeof name !== 'string' || !/\.(?:md|markdown|txt)$/i.test(name)) throw new TypeError('仅支持 md、markdown 或 txt 文件');
  if (typeof text !== 'string') throw new TypeError('正文必须是文本');
  if (new TextEncoder().encode(text).length > 1048576) throw new RangeError('文件超过 1 MiB UTF-8 限制');
  const filename = name.split(/[\\/]/).at(-1);
  const visible = visibleMarkdown(text);
  const title = visible.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || filename.replace(/\.(?:md|markdown|txt)$/i, '') || '未命名笔记';
  const wikilinks = unique([...visible.matchAll(/\[\[([^\]\n]+)\]\]/g)].map(match => match[1].split('|')[0].trim()).filter(Boolean));
  const tags = unique([...visible.matchAll(/(?:^|[\s([{:;,，；])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu)].map(match => match[1]));
  return { id: `LOCAL-${localId(`${filename}\0${text}`)}`, title, name: filename, text,
    origin: 'local-import', kind: 'local-note', version: null, source_ids: [],
    topics: detectTopics(visible, corpus), tags, wikilinks, unverified: true };
}

export function memoryEvents(corpus, options = {}) {
  if (corpus?.metadata?.versionMode === 'collection') return [];
  const locale = localeOf(options);
  const [fromVersion, toVersion] = versionsFor(corpus);
  const data = prepare(corpus);
  const claims = data.claims.filter(claim => data.bound(claim) && strings(claim.source_ids).every(id => officialVersionSource(data.sourceMap.get(id), corpus)));
  return comparisons(claims, corpus, options).map(pair => {
    const old = claims.filter(claim => pair.claimIds.includes(claim.id) && claim.version === fromVersion);
    const next = claims.filter(claim => pair.claimIds.includes(claim.id) && claim.version === toVersion);
    return { id: `change:${pair.topic}`, type: 'version-comparison', topic: pair.topic, title: pair.title,
      fromVersion, toVersion,
      before: { claimIds: old.map(claim => claim.id), text: pair.before, sourceIds: unique(old.flatMap(claim => strings(claim.source_ids))) },
      after: { claimIds: next.map(claim => claim.id), text: pair.after, sourceIds: unique(next.flatMap(claim => strings(claim.source_ids))) },
      sourceIds: [...pair.sourceIds], recordedAt: typeof corpus.metadata?.verified_at === 'string' ? corpus.metadata.verified_at : null,
      eventDate: null, dateLabel: locale === 'en' ? 'Version comparison; not an occurrence date' : '版本对照；不是发生日期' };
  });
}

function englishGap(gap) {
  const translations = {
    '问题含有当前五主题以外的 API 或能力。': 'The question includes an API or capability outside the five curated topics.',
    '精选文档不能证明工程安全或完整兼容，缺少依赖、环境和回归验证。': 'Curated documentation cannot establish production safety or full compatibility; dependency, environment, and regression checks are missing.',
    '未覆盖第三方库兼容矩阵。': 'Third-party library compatibility matrices are outside this sample.',
    '未覆盖该数据接入或实现任务。': 'This data-ingestion or implementation task is outside the sample.',
    '没有该项目的性能、内存或收益基准。': 'There are no project-specific performance, memory, or benefit benchmarks.',
    '环境根因需要完整异常、依赖版本与最小复现，静态资料不能确认。': 'Diagnosing an environment requires a full exception, dependency versions, and a minimal reproduction.',
    '所问平台、二进制或其他行为没有纳入当前五主题证据。': 'The requested platform, binary, or other behavior is outside the five-topic evidence scope.',
    '精选五主题不是完整迁移或项目审查。': 'Five curated topics are not a complete migration or project review.',
    '知识失效影响只能依据实际代码引用/调用证据判定；精选 API 事实不能单独推断具体项目代码或资产的影响范围。': 'Impact from obsolete knowledge requires verified citation/call evidence; curated API facts alone cannot determine affected project code or assets.',
    '题目要求的版本超出 1.26 / 2.0 精选范围。': 'The requested version is outside the curated 1.26 / 2.0 scope.',
    '题目版本与所选版本不同，请先统一范围。': 'The question and selected version differ; align the scope first.',
    '当前证据仅支持名称可用性、迁移替代、复制语义、类型提升和极差事实；未确认所问任务的实现方法。': 'The curated evidence covers only symbol availability, migration replacements, copy semantics, dtype promotion, and ptp range facts; implementation of the requested task is outside scope.',
    '未确认问题属于已整理的迁移事实或 API 可用性意图。': 'The question is not clearly about a curated migration fact or API availability.',
    '未匹配到已核查的五类主题。': 'No verified topic matched the question.',
    '只能返回当前精选主题，无法据此给出完整迁移概览。': 'Only curated topics can be returned, not a complete migration overview.',
    'version 必须是 compare、all、1.26 或 2.0。': 'Version must be compare, all, 1.26, or 2.0.',
    '部分声明缺少同版本官方来源，已从回答中排除。': 'Claims missing official sources from the matching version have been excluded.',
    '当前没有足以回答的已整理声明。': 'No curated claims adequately support an answer.'
  };
  if (translations[gap]) return translations[gap];
  if (gap.startsWith('未覆盖这些 API：')) return `Unsupported APIs: ${gap.split('：')[1].split('；')[0].replaceAll('、', ', ')}. A known symbol cannot answer for them.`;
  if (gap.startsWith('缺少 ')) return 'A matched topic lacks a valid claim in the requested version.';
  if (gap.includes('缺少完整双版本证据')) return 'A matched topic lacks evidence for both versions.';
  return 'Some requested conditions are outside the curated evidence scope.';
}

function queryAstronomy(corpus, question, version, options) {
  if (typeof question !== 'string' || !question.trim() || question.length > 3000) throw new TypeError('question 必须是 1–3000 字符的文本');
  const locale = localeOf(options);
  const say = (zh, en) => locale === 'en' ? en : zh;
  const q = question.trim();
  const selected = version === 'compare' ? 'all' : version;
  const data = prepare(corpus);
  const topics = detectTopics(q, corpus);
  const gaps = [];
  if (!topics.length) gaps.push(say('没有匹配到当前五类天文主题。', 'No topic matched the five-topic astronomy sample.'));
  if (!/是什么|什么是|如何|怎么|为什么|解释|介绍|定义|单位|距离|时间|光年|含义|方法|线索|证据|证明|信号|能否|是否|哪些|what|how|why|explain|define|meaning|method|evidence|signal|can |does |is a|is the|tell me|describe/i.test(q)) gaps.push(say('请把问题限定为已整理的概念、观测方法或证据边界。', 'Limit the question to a curated concept, observation method, or evidence boundary.'));
  const unsupported = [
    [/最新|实时|今天|昨天|今年|现在.{0,8}(?:多少|几颗|发现)|latest|live data|today|yesterday|this year|current (?:count|total)|how many/i, '此资料集不含实时观测、最新发现数量或持续更新目录。', 'This collection has no live observations, latest discovery counts, or continuously updated catalog.'],
    [/外星人|外星生命|生命存在|宜居|生物标志|alien|life|habitab|biosignature/i, '这些精选材料不能证明生命存在或判定某颗行星宜居。', 'These curated sources cannot establish life or determine that a planet is habitable.'],
    [/预测|预报|今晚|观星|方位|天气|股票|总统|代码|编程|下载数据|数据接口|原始数据|拟合|predict|forecast|tonight|weather|stock|president|write code|download|raw data|fit (?:a|the)|calculate (?:a|the)/i, '该预测、数据处理或非天文任务超出了当前科普样例。', 'The prediction, data-processing, or non-astronomy task is outside this explanatory sample.'],
    [/黑洞|暗物质|暗能量|引力波|超新星|中子星|太阳耀斑|black hole|dark matter|dark energy|gravitational wave|supernova|neutron star|solar flare/i, '问题还包含未整理的天文主题，不能由一个已知主题代答。', 'The question includes an uncurated astronomy topic; a known topic cannot answer for it.'],
    [/所有|全部|完整|一切|everything|complete catalog|all discoveries/i, '当前是五主题精选资料，不是完整天文学知识库。', 'This is a five-topic selection, not a complete astronomy knowledge base.']
  ];
  for (const [pattern, zh, en] of unsupported) if (pattern.test(q)) gaps.push(say(zh, en));
  const valid = selected === 'all' || versionsFor(corpus).includes(selected);
  if (!valid) gaps.push(say('所选资料集不存在，请选择宇宙入门、观测方法或全部。', 'The selected collection does not exist; choose foundations, observation methods, or all.'));
  const candidates = data.claims.filter(claim => topics.includes(claim.topic) && (selected === 'all' || claim.version === selected));
  const claims = valid ? candidates.filter(claim => data.bound(claim) && strings(claim.source_ids).every(id => officialVersionSource(data.sourceMap.get(id), corpus))) : [];
  if (claims.length !== candidates.length) gaps.push(say('缺少同资料集官方来源的声明已排除。', 'Claims without official sources from the matching collection have been excluded.'));
  if (!claims.length) gaps.push(say('当前资料不足以回答该问题。', 'The current evidence does not support an answer.'));
  for (const topic of topics) if (!claims.some(claim => claim.topic === topic)) gaps.push(say(`所选资料集缺少「${topicLabel(topic, corpus)}」的有效声明。`, `The selected collection has no valid claim for ${topicLabel(topic, corpus, 'en')}.`));
  const sourceIds = new Set(claims.flatMap(claim => strings(claim.source_ids)));
  const sources = data.sources.filter(source => sourceIds.has(source.id));
  const facts = claims.map(claim => {
    const collection = corpus.metadata.versions.find(item => item.id === claim.version);
    return `【${localized(collection, 'label', locale) || claim.version} · ${localized(claim, 'title', locale)}】\n${localized(claim, 'text', locale)} [${strings(claim.source_ids).join(', ')}]`;
  }).join('\n\n');
  const status = gaps.length ? 'insufficient' : 'answered';
  return {status, answer: status === 'answered' ? facts : `${say('证据不足，不能对所问范围下结论。', 'Insufficient evidence for the requested scope. ')}${unique(gaps).join(' ')}${facts ? `\n\n${say('以下仅为相关精选事实：', 'Related curated facts only:')}\n\n${facts}` : ''}`,
    claims: clone(claims), sources: clone(sources), conflicts: [], gaps: unique(gaps),
    next_steps: [say('打开原始来源核对观测条件与材料日期；此样例没有实时抓取或执行科学计算。', 'Open the original sources to check observation conditions and dates; this sample does not fetch live data or run scientific calculations.')],
    trace: [{step:say('限定资料集','Collection scope'),detail:`${selected}`},{step:say('匹配主题','Topic matching'),detail:say(`匹配 ${topics.length} 个精选主题。`,`Matched ${topics.length} curated topics.`)},{step:say('核对来源','Source check'),detail:say(`${claims.length} 条声明关联 ${sources.length} 个同资料集官方来源；未调用在线模型。`,`${claims.length} claims link to ${sources.length} official sources in matching collections; no online model was called.`)}],
    mode:'curated-local',query:{question:q,version:selected},topics};
}

function queryHospitality(corpus, question, version, options) {
  if (typeof question !== 'string' || !question.trim() || question.length > 3000) throw new TypeError('question 必须是 1–3000 字符的文本');
  const locale = localeOf(options);
  const say = (zh, en) => locale === 'en' ? en : zh;
  const q = question.trim();
  const selected = version === 'compare' ? 'all' : version;
  const data = prepare(corpus);
  const topics = detectTopics(q, corpus);
  const gaps = [];
  if (!topics.length) gaps.push(say('没有匹配到当前五类酒店节能与运维主题。', 'No topic matched the five-topic hospitality sample.'));
  const hasOperationalIntent = /如何|怎么|怎样|哪些|什么(?:措施|建议|方法|区域|特点|机会|策略|步骤|计划|方式)|有何(?:建议|措施)|建议|措施|方法|定制|制定|管理|评估|规划|升级|控制|检查|排查|维护|修复|密封|处理|利用|采用|避免|节水|节能|结合.{0,6}物业|\b(?:how\s+(?:to|do|does|can|should)|what\s+(?:measures?|tips?|practices?|actions?|steps?|controls?|upgrades?|plans?|areas?|uses?|opportunities|ways?|guidance|recommendations?|should|can)|which\s+(?:areas?|measures?|tips?|practices?|controls?|uses?)|measures?|tips?|recommend|guidance|tailor|profile|assess|develop|upgrade|control|check|repair|seal|manage|address|handle|apply)\b/i.test(q);
  const hasHotelOrOperationalAnchor = /酒店|旅宿|宾馆|客房|大堂|走廊|物业|用能|能耗|能源|用水|节水|水管理|卫生间|洗衣|绿化|景观|厨房|餐饮|入住|感应|调光|定时|卫浴|热水|漏水|检漏|门窗|暖通|空调|缝隙|密封|\b(?:hotel|hotels|hospitality|lodging|property|properties|guest\s*-?\s*rooms?|lobbies|lobby|hallways?|corridors?|energy|water|watersense|restrooms?|bathrooms?|laundry|landscaping|kitchens?|food\s+service|occupancy|dimming|scheduling|fixtures?|leaks?|doors?|windows?|hvac)\b/i.test(q);
  const causalWhy = /为什么|为何|原因|\bwhy\b/i.test(q);
  const supportedCausalContext = /定制|因地制宜|物业|气候|设备|业务活动|全黑|黑暗|空置|无人|漏水|漏风|缝隙|\b(?:tailor|specific\s+property|climate|equipment|business\s+activity|dark\s+hallways?|unoccupied|air\s+leakage|water\s+loss)\b/i.test(q);
  if (causalWhy && !supportedCausalContext) {
    gaps.push(say('当前资料仅整理酒店节能与节水措施及适用因素，未提供所问因果机理的证据。', 'The curated sources summarize hotel efficiency measures and operational factors, not evidence for the requested causal mechanism.'));
  }
  // A bare topic is a request to browse related evidence, not a technical or financial claim.
  const lightingTopicOnly = /^(?:照明|客房照明|客房照明节能|lighting|hotel lighting|guest room lighting)[？?。.!！\s]*$/i.test(q);
  if ((!hasOperationalIntent || !hasHotelOrOperationalAnchor) && !lightingTopicOnly) {
    gaps.push(say('请将问题限定为已整理的酒店用能评估、照明控制、节水管理或维护建议。', 'Limit the question to curated hotel energy profiling, lighting controls, water management, or maintenance guidance.'));
  }
  const unsupported = [
    [/投资回报|回报期|回本|多少钱|多少元|成本|预算|费用|补贴|退税|电价|水价|账单|利率|净现值|\b(?:roi|payback|cost|costs|budget|price|prices|rebate|rebates|tax\s+credit|dollars?|utility\s+bills?|financial)\b|how\s+much\s+money/i, '此资料集不含投资回报率、回本周期、改造预算或财务金额测算。', 'This collection does not include ROI, payback period, project cost, or financial calculations.'],
    [/多少度电|多少吨水|节省多少|降低多少|百分比|比例|百分之|保证节|承诺节|确保节|\d+\s*%|\b(?:kwh|gallons?|liters?|cubic\s+meters?|guaranteed|guarantee|exact\s+savings|percentage|proportion)\b|how\s+much\s+(?:energy|water|electricity)/i, '此资料集不提供具体能耗/水量数值、节能量百分比或整店节能保底承诺。', 'This collection does not provide specific consumption figures, percentage breakdowns, or guaranteed whole-hotel savings.'],
    [/认证|合规|法规|法律|强制|罚款|牌照|达标|验收通过|\b(?:leed|iso\s*50001|ashrae|building\s+codes?|legal|laws?|mandates?|mandatory|regulations?|compliance|certified|certification|penalt(?:y|ies))\b/i, '此资料集仅整理公开节能与节水建议，不构成法规要求、建筑规范审查或合规认证。', 'This collection summarizes public guidance only and does not provide legal requirements, code compliance, or certification.'],
    [/我们酒店|这家酒店|我的酒店|实时|在线监控|传感器数据|电表读数|水表读数|\b(?:pms|bms|scada|iot|live\s+data|real-time|meter\s+readings?|our\s+hotel|my\s+hotel|connected\s+data)\b/i, '此实验场未连接任何真实酒店计量表计、BMS 或经营数据。', 'This lab is not connected to live hotel meters, BMS telemetry, or property operational data.'],
    [/失眠|睡眠|治好|治疗|疾病|健康|医疗|心理|生理|视力|节律|褪黑素|焦虑|头痛|杀菌|消毒|病毒|\b(?:insomnia|sleep|cure|cures|treat|treatment|medical|health|therapy|circadian|melatonin|disease|symptom|anxiety|headache|disinfect|virus|bacteria)\b/i, '此资料集不含医疗健康、睡眠生理或临床功效证据。', 'This collection contains no evidence on medical, health, sleep, or physiological effects.'],
    [/医院|诊所|工厂|车间|数据中心|算力|航班|机场|学校|商场|写字楼|住宅|公寓|半导体|炼钢|煤矿|农业|股票|总统|代码|编程|食谱|做饭|烘焙|天气|\b(?:hospitals?|clinics?|factor(?:y|ies)|data\s+centers?|airlines?|airports?|schools?|universit(?:y|ies)|malls?|office\s+buildings?|apartments?|residential|semiconductors?|mining|stocks?|presidents?|write\s+code|python|numpy|exoplanets?|black\s+holes?|weather|recipes?|baking)\b/i, '问题包含当前酒店样本以外的行业、非酒店设施或无关任务。', 'The question involves another industry, non-hotel facility, or unrelated task outside this hospitality sample.'],
    [/区别|差异|对比|比较|哪个更好|优缺点|选型计算|照度计算|流明|色温|显色指数|太阳能灯|太阳能路灯|光伏|太阳能板|风电|储能电池|充电桩|电梯|扶梯|泳池|温泉|水疗|冷媒替换|锅炉改造|热泵选型|风管设计|风道改造|白炽灯|卤素灯|荧光灯|\b(?:difference\s+between|compare|comparison|versus|vs\.?|which\s+is\s+better|pros\s+and\s+cons|solar\s+lighting|solar\s+lamps?|solar\s+panels?|photovoltaic|led\s+vs|lumens?|lux|kelvin|color\s+temperature|cri|wind\s+turbines?|battery\s+storage|ev\s+chargers?|elevators?|escalators?|swimming\s+pools?|spas?|chiller\s+replacement|boiler\s+sizing|ductwork|incandescent|halogen|cfl|t8|t12)\b/i, '问题包含当前精选来源未覆盖的技术对比、灯具/设备选型参数或专项工程改造内容。', 'The question asks for a technical comparison, lamp/equipment specification, or engineering retrofit not covered in the selected sources.'],
    [/所有|全部措施|完整清单|全部方案|一切|\b(?:everything|complete\s+checklist|all\s+measures|entire\s+hotel\s+plan)\b/i, '当前是五主题精选资料，不是完整的酒店工程审计或全专业改造手册。', 'This is a five-topic curated sample, not a complete hotel energy audit or engineering manual.']
  ];
  for (const [pattern, zh, en] of unsupported) if (pattern.test(q)) gaps.push(say(zh, en));
  const valid = selected === 'all' || versionsFor(corpus).includes(selected);
  if (!valid) gaps.push(say('所选资料集不存在，请选择基线与规划、运营与维护或全部。', 'The selected collection does not exist; choose baseline & planning, operations & maintenance, or all.'));
  const candidates = data.claims.filter(claim => topics.includes(claim.topic) && (selected === 'all' || claim.version === selected));
  const claims = valid ? candidates.filter(claim => data.bound(claim) && strings(claim.source_ids).every(id => officialVersionSource(data.sourceMap.get(id), corpus))) : [];
  if (claims.length !== candidates.length) gaps.push(say('缺少同资料集官方来源的声明已排除。', 'Claims without official sources from the matching collection have been excluded.'));
  if (!claims.length) gaps.push(say('当前资料不足以回答该问题。', 'The current evidence does not support an answer.'));
  for (const topic of topics) if (!claims.some(claim => claim.topic === topic)) gaps.push(say(`所选资料集缺少「${topicLabel(topic, corpus)}」的有效声明。`, `The selected collection has no valid claim for ${topicLabel(topic, corpus, 'en')}.`));
  const sourceIds = new Set(claims.flatMap(claim => strings(claim.source_ids)));
  const sources = data.sources.filter(source => sourceIds.has(source.id));
  const distinctDocCount = new Set(sources.map(source => String(source.canonical_url || source.url || '').split('#')[0]).filter(Boolean)).size || sources.length;
  const facts = claims.map(claim => {
    const collection = corpus.metadata.versions.find(item => item.id === claim.version);
    return `【${localized(collection, 'label', locale) || claim.version} · ${localized(claim, 'title', locale)}】\n${localized(claim, 'text', locale)} [${strings(claim.source_ids).join(', ')}]`;
  }).join('\n\n');
  const status = gaps.length ? 'insufficient' : 'answered';
  return { status, answer: status === 'answered' ? facts : `${say('证据不足，不能对所问范围下结论。', 'Insufficient evidence for the requested scope. ')}${unique(gaps).join(' ')}${facts ? `\n\n${say('以下仅为相关精选事实：', 'Related curated facts only:')}\n\n${facts}` : ''}`,
    claims: clone(claims), sources: clone(sources), conflicts: [], gaps: unique(gaps),
    next_steps: [say('结合目标酒店的实际气候、设备台账与分项计量核实条件；本样例不提供在线模型或工程收益测算。', 'Check actual property climate, equipment inventory, and sub-metering; this sample does not call a live model or estimate financial returns.')],
    trace: [{ step: say('限定资料集', 'Collection scope'), detail: `${selected}` }, { step: say('匹配主题', 'Topic matching'), detail: say(`匹配 ${topics.length} 个精选主题。`, `Matched ${topics.length} curated topics.`) }, { step: say('核对来源', 'Source check'), detail: say(`${claims.length} 条声明关联 ${sources.length} 条官方章节记录（对应 ${distinctDocCount} 份公开指南文档）；未调用在线模型。`, `${claims.length} claims link to ${sources.length} official section records (${distinctDocCount} public guidance documents); no online model was called.`) }],
    mode: 'curated-local', query: { question: q, version: selected }, topics };
}

/** Locale changes display text only; citations, collection boundaries, and IDs stay stable. */
export function queryEvidence(corpus, question, version = 'compare', options = {}) {
  const result = isAstronomy(corpus) ? queryAstronomy(corpus, question, version, options)
    : isHospitality(corpus) ? queryHospitality(corpus, question, version, options)
    : queryNumPy(corpus, question, version, options);
  if (localeOf(options) === 'en') for (const records of [result.claims, result.sources]) for (const record of records) {
    for (const key of ['title', 'text', 'excerpt', 'question']) if (record[`${key}_en`]) record[key] = record[`${key}_en`];
  }
  return result;
}

/** Count crossings only between adjacent ontology lanes; shared endpoints do not cross. */
export function crossingCount(graph, lanes) {
  const rank=new Map(lanes.flatMap((ids,lane)=>ids.map((id,row)=>[id,{lane,row}])));
  const edges=graph.edges.map(e=>({a:rank.get(e.source),b:rank.get(e.target)})).filter(e=>e.a&&e.b&&e.b.lane===e.a.lane+1);
  let count=0;
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const a=edges[i],b=edges[j];if(a.a.lane===b.a.lane&&(a.a.row-b.a.row)*(a.b.row-b.b.row)<0)count++;
  }
  return count;
}

/** Barycentric sweeps retain the best ordering, so layout never adds crossings. */
export function layoutGraph(graph, {width=900,height=620}={}) {
  const kinds=['source','claim','topic','asset'];
  let lanes=kinds.map(kind=>graph.nodes.filter(n=>n.type===kind).map(n=>n.id));
  let best=lanes.map(ids=>[...ids]),score=crossingCount(graph,lanes);
  for(let sweep=0;sweep<12;sweep++){
    const forward=sweep%2===0,indices=forward?[1,2,3]:[2,1,0];
    for(const lane of indices){
      const neighbor=lane+(forward?-1:1),ranks=new Map(lanes[neighbor].map((id,i)=>[id,i]));
      const current=new Map(lanes[lane].map((id,i)=>[id,i]));
      const bary=id=>{const values=graph.edges.flatMap(e=>e.source===id&&ranks.has(e.target)?[ranks.get(e.target)]:e.target===id&&ranks.has(e.source)?[ranks.get(e.source)]:[]);return values.length?values.reduce((a,b)=>a+b,0)/values.length:current.get(id);};
      lanes[lane].sort((a,b)=>bary(a)-bary(b)||current.get(a)-current.get(b));
    }
    const next=crossingCount(graph,lanes);if(next<score){score=next;best=lanes.map(ids=>[...ids]);}
  }
  lanes=best;
  // An adjacent exchange resolves ties left by the average-neighbor sweeps.
  for(let pass=0;pass<3;pass++)for(const lane of lanes)for(let i=0;i<lane.length-1;i++){
    [lane[i],lane[i+1]]=[lane[i+1],lane[i]];const next=crossingCount(graph,lanes);
    if(next<score)score=next;else [lane[i],lane[i+1]]=[lane[i+1],lane[i]];
  }
  const w=Math.max(600,Number(width)||900),maxLane=Math.max(...lanes.map(x=>x.length),1);
  const h=Math.max(Number(height)||620,120+maxLane*50);
  const columns=kinds.map((type,i)=>({type,x:w*(.12+i*.2533)}));
  const points=lanes.flatMap((ids,lane)=>ids.map((id,i)=>({id,x:columns[lane].x,y:68+(i+.5)*(h-116)/Math.max(ids.length,1),lane})));
  return {width:w,height:h,columns,points,lanes,crossings:score};
}

/** Ancestors and descendants of one node form its evidence path, not a whole component. */
export function evidencePath(graph,id) {
  if(!graph.nodes.some(n=>n.id===id))return {nodeIds:[],edgeIds:[]};
  const selected=new Set([id]);
  for(const reverse of [false,true]){
    const seen=new Set([id]),queue=[id];
    while(queue.length){const current=queue.shift();for(const e of graph.edges){const from=reverse?e.target:e.source,to=reverse?e.source:e.target;if(from===current&&!seen.has(to)){seen.add(to);selected.add(to);queue.push(to);}}}
  }
  return {nodeIds:[...selected],edgeIds:graph.edges.filter(e=>selected.has(e.source)&&selected.has(e.target)).map(e=>e.id)};
}
