/**
 * web/atlas-impact.js - ES Module for C2 Evidence-Backed Impact Graph UI.
 *
 * Provides:
 *  - Deterministic data loading and validation for data/impact-demo.json (or web/assets/impact-demo.json)
 *  - State management for impact graph sub-view (target version 1.26 vs 2.0, selected node, selected edge)
 *  - Responsive SVG graph rendering with mobile (390px) adaptation, compact/vertical card layouts,
 *    role="group", aria-label, and text >= 12px
 *  - Separate directional edge interaction: B->A (author ref) vs A->B (derived review candidate)
 *  - Node/Edge details panel rendering with exact line numbers, excerpts, claim mappings, official source links,
 *    static AST findings, and limitations
 *  - Review record export (JSON) containing exact provenance, version, relative paths, and embedded official sources
 *  - Bilingual (zh/en) label and status helpers with neutral unconfirmed status (never green safe)
 *  - Safe HTML escaping and safe HTTPS URL checks.
 */

export const IMPACT_STORAGE_KEY = 'knowligence:impact_version';

/** Safe HTML escape */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate safe HTTPS url */
export function safeHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Validate impact demo data against exact supported schema.
 * Throws TypeError / Error if data is invalid.
 * Returns the validated data for chaining.
 *
 * Checks:
 *  - Non-null plain object root with schema_version, fixture_id, fixture_title,
 *    fixture_disclaimer (zh and en non-empty strings), available_versions, default_version,
 *    official_sources, versions, provenance, limitations.
 *  - official_sources: map with keys matching source.id, valid https URL, title, excerpt/summary strings.
 *  - available_versions: array containing at least '1.26' and '2.0'.
 *  - versions: object containing both '1.26' and '2.0' VersionGraph objects with matching target_version.
 *  - per-version nodes: array with unique string IDs, non-empty label, path, format ('markdown'|'python'),
 *    valid status ('review_required'|'no_confirmed_impact'), string status_reason, array curated_claims,
 *    array static_findings, array author_declared_references, string file_content.
 *  - curated_claims: non-null object with valid claim_id, topic, version, title, statement, source_ids (non-empty array referencing existing official_sources),
 *    line_start, line_end (non-boolean integers >= 1).
 *  - static_findings: non-null object with symbol, line (integer >= 1), line_text, before, after, reason, source_ids (referencing existing official_sources).
 *  - author_declared_references: non-null object with target_node_id (must reference existing node ID in same version), target_file, line (integer >= 1), marker.
 *  - per-version edges: array with unique string IDs, source/target referencing valid node IDs in same version,
 *    type ('author_declared_reference'|'derived_review_candidate'), semantics, non-null evidence object.
 *  - edge endpoints must not point to nonexistent nodes.
 *  - derived_review_candidate evidence must reference defined official_sources, valid trigger_claim_id, etc.
 */
export function validateImpactDemo(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Impact demo data must be a non-null object');
  }

  if (typeof data.schema_version !== 'string' || !data.schema_version.trim()) {
    throw new Error('Impact demo data missing or invalid schema_version');
  }
  if (typeof data.fixture_id !== 'string' || !data.fixture_id.trim()) {
    throw new Error('Impact demo data missing or invalid fixture_id');
  }
  if (typeof data.fixture_title !== 'string' || !data.fixture_title.trim()) {
    throw new Error('Impact demo data missing or invalid fixture_title');
  }
  if (!data.fixture_disclaimer || typeof data.fixture_disclaimer !== 'object' || Array.isArray(data.fixture_disclaimer)) {
    throw new Error('Impact demo data missing or invalid fixture_disclaimer');
  }
  if (typeof data.fixture_disclaimer.zh !== 'string' || !data.fixture_disclaimer.zh.trim() ||
      typeof data.fixture_disclaimer.en !== 'string' || !data.fixture_disclaimer.en.trim()) {
    throw new Error('fixture_disclaimer must contain non-empty zh and en strings');
  }

  if (!Array.isArray(data.available_versions) ||
      !data.available_versions.includes('1.26') ||
      !data.available_versions.includes('2.0')) {
    throw new Error('available_versions must include "1.26" and "2.0"');
  }
  if (data.default_version !== '1.26' && data.default_version !== '2.0') {
    throw new Error('default_version must be "1.26" or "2.0"');
  }

  // official_sources validation
  if (!data.official_sources || typeof data.official_sources !== 'object' || Array.isArray(data.official_sources)) {
    throw new Error('official_sources must be a non-null object mapping');
  }
  const officialSourceIds = new Set();
  for (const [key, src] of Object.entries(data.official_sources)) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) {
      throw new Error(`official_source "${key}" must be an object`);
    }
    if (typeof src.id !== 'string' || src.id !== key) {
      throw new Error(`official_source "${key}" id mismatch or invalid`);
    }
    if (typeof src.url !== 'string' || !safeHttpsUrl(src.url)) {
      throw new Error(`official_source "${key}" url must be a valid https URL`);
    }
    if (typeof src.title !== 'string' || !src.title.trim()) {
      throw new Error(`official_source "${key}" title must be non-empty`);
    }
    officialSourceIds.add(key);
  }

  // versions validation
  if (!data.versions || typeof data.versions !== 'object' || Array.isArray(data.versions)) {
    throw new Error('versions must be a non-null object');
  }
  for (const expectedVer of ['1.26', '2.0']) {
    const vg = data.versions[expectedVer];
    if (!vg || typeof vg !== 'object' || Array.isArray(vg)) {
      throw new Error(`versions must contain object for "${expectedVer}"`);
    }
    if (vg.target_version !== expectedVer) {
      throw new Error(`version "${expectedVer}" target_version mismatch`);
    }
    if (!Array.isArray(vg.nodes) || vg.nodes.length === 0) {
      throw new Error(`version "${expectedVer}" nodes must be a non-empty array`);
    }
    if (!Array.isArray(vg.edges)) {
      throw new Error(`version "${expectedVer}" edges must be an array`);
    }

    const nodeIds = new Set();
    for (const node of vg.nodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        throw new Error(`version "${expectedVer}" contains invalid node`);
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        throw new Error(`version "${expectedVer}" node missing valid id`);
      }
      if (nodeIds.has(node.id)) {
        throw new Error(`version "${expectedVer}" contains duplicate node id "${node.id}"`);
      }
      nodeIds.add(node.id);

      if (typeof node.label !== 'string' || !node.label.trim()) {
        throw new Error(`node "${node.id}" missing valid label`);
      }
      if (typeof node.path !== 'string' || !node.path.trim()) {
        throw new Error(`node "${node.id}" missing valid path`);
      }
      if (node.format !== 'markdown' && node.format !== 'python') {
        throw new Error(`node "${node.id}" invalid format: ${node.format}`);
      }
      if (node.status !== 'review_required' && node.status !== 'no_confirmed_impact') {
        throw new Error(`node "${node.id}" invalid status: ${node.status}`);
      }
      if (typeof node.status_reason !== 'string') {
        throw new Error(`node "${node.id}" missing status_reason`);
      }
      if (typeof node.file_content !== 'string') {
        throw new Error(`node "${node.id}" missing file_content string`);
      }

      // curated_claims
      if (!Array.isArray(node.curated_claims)) {
        throw new Error(`node "${node.id}" curated_claims must be an array`);
      }
      for (const claim of node.curated_claims) {
        if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
          throw new Error(`node "${node.id}" has invalid claim object`);
        }
        if (typeof claim.claim_id !== 'string' || !claim.claim_id.trim()) {
          throw new Error(`node "${node.id}" claim missing claim_id`);
        }
        if (typeof claim.line_start !== 'number' || typeof claim.line_end !== 'number' ||
            typeof claim.line_start === 'boolean' || typeof claim.line_end === 'boolean' ||
            !Number.isInteger(claim.line_start) || !Number.isInteger(claim.line_end) ||
            claim.line_start < 1 || claim.line_end < claim.line_start) {
          throw new Error(`node "${node.id}" claim "${claim.claim_id}" invalid line bounds`);
        }
        if (!Array.isArray(claim.source_ids) || claim.source_ids.length === 0) {
          throw new Error(`node "${node.id}" claim "${claim.claim_id}" source_ids must be non-empty array`);
        }
        for (const sid of claim.source_ids) {
          if (typeof sid !== 'string' || !Object.prototype.hasOwnProperty.call(data.official_sources, sid)) {
            throw new Error(`node "${node.id}" claim "${claim.claim_id}" references unknown source "${sid}"`);
          }
        }
      }

      // static_findings
      if (!Array.isArray(node.static_findings)) {
        throw new Error(`node "${node.id}" static_findings must be an array`);
      }
      for (const f of node.static_findings) {
        if (!f || typeof f !== 'object' || Array.isArray(f)) {
          throw new Error(`node "${node.id}" has invalid static finding`);
        }
        if (typeof f.symbol !== 'string' || !f.symbol.trim()) {
          throw new Error(`node "${node.id}" finding missing symbol`);
        }
        if (typeof f.line !== 'number' || typeof f.line === 'boolean' || !Number.isInteger(f.line) || f.line < 1) {
          throw new Error(`node "${node.id}" finding missing valid line number`);
        }
        if (typeof f.line_text !== 'string') {
          throw new Error(`node "${node.id}" finding missing line_text`);
        }
        if (typeof f.before !== 'string' || typeof f.after !== 'string') {
          throw new Error(`node "${node.id}" finding missing before/after symbol`);
        }
        if (typeof f.reason !== 'string') {
          throw new Error(`node "${node.id}" finding missing reason`);
        }
        if (!Array.isArray(f.source_ids)) {
          throw new Error(`node "${node.id}" finding source_ids must be an array`);
        }
        for (const sid of f.source_ids) {
          if (typeof sid !== 'string' || !Object.prototype.hasOwnProperty.call(data.official_sources, sid)) {
            throw new Error(`node "${node.id}" finding references unknown source "${sid}"`);
          }
        }
      }

      // author_declared_references
      if (!Array.isArray(node.author_declared_references)) {
        throw new Error(`node "${node.id}" author_declared_references must be an array`);
      }
      for (const ref of node.author_declared_references) {
        if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
          throw new Error(`node "${node.id}" has invalid author reference`);
        }
        if (typeof ref.target_node_id !== 'string' || !ref.target_node_id.trim()) {
          throw new Error(`node "${node.id}" author ref missing target_node_id`);
        }
        if (typeof ref.line !== 'number' || typeof ref.line === 'boolean' || !Number.isInteger(ref.line) || ref.line < 1) {
          throw new Error(`node "${node.id}" author ref missing valid line number`);
        }
      }
    }

    // Now validate author_declared_references target_node_id points to existing node
    for (const node of vg.nodes) {
      for (const ref of node.author_declared_references) {
        if (!nodeIds.has(ref.target_node_id)) {
          throw new Error(`node "${node.id}" author reference targets nonexistent node "${ref.target_node_id}"`);
        }
      }
    }

    // edges validation
    const edgeIds = new Set();
    for (const edge of vg.edges) {
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        throw new Error(`version "${expectedVer}" contains invalid edge`);
      }
      if (typeof edge.id !== 'string' || !edge.id.trim()) {
        throw new Error(`version "${expectedVer}" edge missing valid id`);
      }
      if (edgeIds.has(edge.id)) {
        throw new Error(`version "${expectedVer}" contains duplicate edge id "${edge.id}"`);
      }
      edgeIds.add(edge.id);

      if (!nodeIds.has(edge.source)) {
        throw new Error(`edge "${edge.id}" source "${edge.source}" does not exist in version "${expectedVer}"`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new Error(`edge "${edge.id}" target "${edge.target}" does not exist in version "${expectedVer}"`);
      }
      if (edge.type !== 'author_declared_reference' && edge.type !== 'derived_review_candidate') {
        throw new Error(`edge "${edge.id}" invalid type: ${edge.type}`);
      }
      if (typeof edge.semantics !== 'string') {
        throw new Error(`edge "${edge.id}" missing semantics string`);
      }
      if (!edge.evidence || typeof edge.evidence !== 'object' || Array.isArray(edge.evidence)) {
        throw new Error(`edge "${edge.id}" missing evidence object`);
      }

      if (edge.type === 'derived_review_candidate') {
        const ev = edge.evidence;
        if (typeof ev.trigger_claim_id !== 'string' || !ev.trigger_claim_id.trim()) {
          throw new Error(`edge "${edge.id}" missing valid trigger_claim_id`);
        }
        if (!Array.isArray(ev.official_source_ids) || ev.official_source_ids.length === 0) {
          throw new Error(`edge "${edge.id}" official_source_ids must be a non-empty array`);
        }
        for (const sid of ev.official_source_ids) {
          if (typeof sid !== 'string' || !Object.prototype.hasOwnProperty.call(data.official_sources, sid)) {
            throw new Error(`edge "${edge.id}" references unknown official source "${sid}"`);
          }
        }
        if (!ev.reference_declaration || typeof ev.reference_declaration !== 'object' || Array.isArray(ev.reference_declaration)) {
          throw new Error(`edge "${edge.id}" missing reference_declaration object`);
        }
        if (typeof ev.reference_declaration.source_file !== 'string' ||
            typeof ev.reference_declaration.line !== 'number' ||
            typeof ev.reference_declaration.line === 'boolean' ||
            !Number.isInteger(ev.reference_declaration.line) ||
            ev.reference_declaration.line < 1 ||
            typeof ev.reference_declaration.marker !== 'string') {
          throw new Error(`edge "${edge.id}" malformed reference_declaration`);
        }
        if (!Array.isArray(ev.static_findings) || ev.static_findings.length === 0) {
          throw new Error(`edge "${edge.id}" static_findings must be a non-empty array`);
        }
        for (const f of ev.static_findings) {
          if (!f || typeof f !== 'object' || Array.isArray(f)) {
            throw new Error(`edge "${edge.id}" has invalid static finding item`);
          }
          if (typeof f.symbol !== 'string' || !f.symbol.trim()) {
            throw new Error(`edge "${edge.id}" finding missing symbol`);
          }
          if (typeof f.line !== 'number' || typeof f.line === 'boolean' || !Number.isInteger(f.line) || f.line < 1) {
            throw new Error(`edge "${edge.id}" finding missing line number`);
          }
          if (typeof f.before !== 'string' || typeof f.after !== 'string') {
            throw new Error(`edge "${edge.id}" finding missing before/after`);
          }
        }
      } else if (edge.type === 'author_declared_reference') {
        const ev = edge.evidence;
        if (typeof ev.source_file !== 'string' || typeof ev.target_file !== 'string' ||
            typeof ev.line !== 'number' || typeof ev.line === 'boolean' || !Number.isInteger(ev.line) || ev.line < 1 ||
            typeof ev.marker !== 'string') {
          throw new Error(`edge "${edge.id}" malformed author_declared_reference evidence`);
        }
      }
    }
  }

  // provenance & limitations validation
  if (!data.provenance || typeof data.provenance !== 'object' || Array.isArray(data.provenance)) {
    throw new Error('provenance must be a non-null object');
  }
  if (!Array.isArray(data.limitations) || data.limitations.length === 0) {
    throw new Error('limitations must be a non-empty array of strings');
  }
  for (let i = 0; i < data.limitations.length; i++) {
    if (typeof data.limitations[i] !== 'string' || !data.limitations[i].trim()) {
      throw new Error(`limitations[${i}] must be a non-empty string`);
    }
  }

  return data;
}

/** Format line or line range, singular when start === end. Rejects invalid or missing input without fabricating lines. */
export function formatLineRange(start, end = start, lang = 'zh') {
  const parseLine = (v) => {
    if (v === undefined || v === null) return null;
    const str = String(v).trim();
    if (!str) return null;
    const num = Number(str);
    if (!Number.isInteger(num) || num <= 0) return null;
    return num;
  };

  const s = parseLine(start);
  const e = parseLine(end);

  if (s === null && e === null) return '';
  if (s !== null && e === null) {
    return lang === 'en' ? `Line ${s}` : `第 ${s} 行`;
  }
  if (s === null && e !== null) {
    return lang === 'en' ? `Line ${e}` : `第 ${e} 行`;
  }
  if (s === e) {
    return lang === 'en' ? `Line ${s}` : `第 ${s} 行`;
  }
  return lang === 'en' ? `Lines ${s}-${e}` : `第 ${s}–${e} 行`;
}

/** Format node status label - Neutral unconfirmed, never safe */
export function formatNodeStatus(status, lang = 'zh') {
  if (status === 'review_required') {
    return lang === 'en' ? 'Review Required' : '需要人工复核';
  }
  if (status === 'no_confirmed_impact') {
    return lang === 'en' ? 'No Confirmed Impact' : '尚无已证实影响';
  }
  return status || '—';
}

/** Format edge type label */
export function formatEdgeType(type, lang = 'zh') {
  if (type === 'author_declared_reference') {
    return lang === 'en' ? 'Author-Declared Reference (B → A)' : '作者声明引用 (B → A)';
  }
  if (type === 'derived_review_candidate') {
    return lang === 'en' ? 'Derived Review Candidate (A → B)' : '建议复核 (A → B)';
  }
  return type;
}

/**
 * Filter and project graph for selected target version.
 * Rejects mixing edges from different versions.
 */
export function getVersionGraph(impactData, version) {
  if (!impactData || !impactData.versions) return null;
  const targetVer = version === '1.26' ? '1.26' : '2.0';
  const vdata = impactData.versions[targetVer];
  if (!vdata) return null;
  return {
    version: targetVer,
    summary: vdata.summary || {},
    nodes: Array.isArray(vdata.nodes) ? vdata.nodes : [],
    edges: Array.isArray(vdata.edges) ? vdata.edges : [],
    official_sources: impactData.official_sources || {},
    fixture_disclaimer: impactData.fixture_disclaimer || {},
    provenance: impactData.provenance || {},
    limitations: impactData.limitations || [],
  };
}

/**
 * Compute 2D coordinates for the 3 demo nodes (A, B, C).
 * Fully responsive: adapts layout for mobile (width < 600) vs desktop.
 */
export function layoutImpactNodes(nodes, width = 760, height = 440) {
  const w = Math.max(width, 360);
  const isMobile = w < 600;

  let posMap;
  if (isMobile) {
    // Vertical stacked layout on mobile to prevent clipping and fit 390px
    posMap = {
      A: { x: Math.round(w * 0.30), y: 70 },
      B: { x: Math.round(w * 0.30), y: 220 },
      C: { x: Math.round(w * 0.74), y: 145 },
    };
  } else {
    // Desktop layout with compact top margin
    const h = Math.max(height, 360);
    posMap = {
      A: { x: Math.round(w * 0.28), y: Math.round(h * 0.28) },
      B: { x: Math.round(w * 0.28), y: Math.round(h * 0.72) },
      C: { x: Math.round(w * 0.74), y: Math.round(h * 0.50) },
    };
  }

  return nodes.map((node) => {
    const coords = posMap[node.id] || { x: Math.round(w * 0.5), y: Math.round(height * 0.5) };
    return {
      ...node,
      x: coords.x,
      y: coords.y,
    };
  });
}

/**
 * Render SVG graph markup for impact view.
 * Handles two distinctly directed edges between A and B:
 *   - B -> A (author reference): upward dashed arrow, slate blue
 *   - A -> B (derived review candidate): downward solid bold arrow, crimson
 * Node C sits alone with neutral unconfirmed styling.
 */
export function renderImpactSvg(versionGraph, options = {}) {
  const {
    width = 760,
    height = 440,
    selectedNodeId = null,
    selectedEdgeId = null,
    hoverId = null,
    lang = 'zh',
  } = options;

  const w = Math.max(width, 360);
  const isMobile = w < 600;
  const svgHeight = isMobile ? 320 : Math.max(height, 360);

  const nodesWithPos = layoutImpactNodes(versionGraph.nodes, w, svgHeight);
  const nodeMap = new Map(nodesWithPos.map((n) => [n.id, n]));

  // SVG markers and defs
  const defs = `
    <defs>
      <marker id="marker-author" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--impact-edge-author, #4a72b2)" />
      </marker>
      <marker id="marker-derived" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--impact-edge-derived, #c93b2b)" />
      </marker>
      <marker id="marker-author-selected" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--impact-edge-selected, #2866d1)" />
      </marker>
      <marker id="marker-derived-selected" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--impact-edge-selected, #2866d1)" />
      </marker>
    </defs>
  `;

  // Draw edges
  let edgesMarkup = '';
  for (const edge of versionGraph.edges) {
    const sNode = nodeMap.get(edge.source);
    const tNode = nodeMap.get(edge.target);
    if (!sNode || !tNode) continue;

    const isSelected = selectedEdgeId === edge.id;
    const isHovered = hoverId === edge.id;
    const isAuthor = edge.type === 'author_declared_reference';

    let pathD = '';
    const curveOffset = isMobile ? 32 : 46;
    if (edge.source === 'B' && edge.target === 'A') {
      // Curve to the right
      const mx = sNode.x + curveOffset;
      const my = (sNode.y + tNode.y) / 2;
      pathD = `M ${sNode.x + 12} ${sNode.y - 14} Q ${mx} ${my} ${tNode.x + 12} ${tNode.y + 18}`;
    } else if (edge.source === 'A' && edge.target === 'B') {
      // Curve to the left
      const mx = sNode.x - curveOffset;
      const my = (sNode.y + tNode.y) / 2;
      pathD = `M ${sNode.x - 12} ${sNode.y + 18} Q ${mx} ${my} ${tNode.x - 12} ${tNode.y - 14}`;
    } else {
      pathD = `M ${sNode.x} ${sNode.y} L ${tNode.x} ${tNode.y}`;
    }

    const markerId = isAuthor
      ? isSelected
        ? 'marker-author-selected'
        : 'marker-author'
      : isSelected
      ? 'marker-derived-selected'
      : 'marker-derived';

    const edgeClasses = [
      'impact-edge',
      `edge-${edge.type}`,
      isSelected ? 'selected' : '',
      isHovered ? 'hovered' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const titleText = isAuthor
      ? lang === 'en'
        ? `Author Reference: ${edge.source} -> ${edge.target} (${edge.evidence?.marker || ''})`
        : `作者声明引用：${edge.source} -> ${edge.target} (${edge.evidence?.marker || ''})`
      : lang === 'en'
      ? `Review Candidate: ${edge.source} -> ${edge.target} (NumPy 2.0 removes float_)`
      : `建议复核：${edge.source} -> ${edge.target} (NumPy 2.0 移除 np.float_)`;

    edgesMarkup += `
      <g class="${edgeClasses}" data-impact-edge="${esc(edge.id)}" tabindex="0" role="button" aria-label="${esc(titleText)}">
        <title>${esc(titleText)}</title>
        <path class="impact-edge-hit" d="${pathD}" fill="none" stroke="transparent" stroke-width="28" />
        <path class="impact-edge-path" d="${pathD}" fill="none" marker-end="url(#${markerId})" />
      </g>
    `;
  }

  // Draw nodes
  let nodesMarkup = '';
  for (const node of nodesWithPos) {
    const isSelected = selectedNodeId === node.id;
    const isHovered = hoverId === node.id;

    const nodeClasses = [
      'impact-node',
      `status-${node.status}`,
      isSelected ? 'selected' : '',
      isHovered ? 'hovered' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const statusBadgeText = formatNodeStatus(node.status, lang);
    const ariaLabel = `${node.id}: ${node.path} (${statusBadgeText})`;

    // Dynamic badge width for English labels to prevent overflow
    const badgeW = lang === 'en' ? (node.status === 'review_required' ? 120 : 144) : 98;
    const badgeHalfW = Math.round(badgeW / 2);

    nodesMarkup += `
      <g class="${nodeClasses}" data-impact-node="${esc(node.id)}" transform="translate(${node.x}, ${node.y})" tabindex="0" role="button" aria-label="${esc(ariaLabel)}">
        <title>${esc(ariaLabel)}</title>
        <circle class="impact-node-ring" r="34" />
        <circle class="impact-node-circle" r="24" />
        <text class="impact-node-id" y="5" text-anchor="middle">${esc(node.id)}</text>
        <text class="impact-node-file" y="44" text-anchor="middle">${esc(node.path)}</text>
        <g class="impact-node-badge" transform="translate(0, -32)">
          <rect class="badge-bg" x="-${badgeHalfW}" y="-11" width="${badgeW}" height="22" rx="4" />
          <text class="badge-text" y="4" text-anchor="middle">${esc(statusBadgeText)}</text>
        </g>
      </g>
    `;
  }

  const svgAriaLabel = lang === 'en'
    ? `Impact graph for NumPy ${versionGraph.version}. 3 demo files, ${versionGraph.edges.length} directional paths.`
    : `NumPy ${versionGraph.version} 影响路径图谱。3 个自建演示文件，${versionGraph.edges.length} 条有向关系。`;

  return `
    <svg class="impact-svg" role="group" aria-label="${esc(svgAriaLabel)}" viewBox="0 0 ${w} ${svgHeight}" width="100%" height="${svgHeight}" preserveAspectRatio="xMidYMid meet">
      ${defs}
      <g class="impact-edges-layer" role="group" aria-label="${lang === 'en' ? 'Impact path connections' : '影响关系连接'}">${edgesMarkup}</g>
      <g class="impact-nodes-layer" role="group" aria-label="${lang === 'en' ? 'Impact demo files' : '演示文件节点'}">${nodesMarkup}</g>
    </svg>
  `;
}

/**
 * Render Inspector Panel for Impact View (Node details or Edge details).
 */
export function renderImpactInspector(versionGraph, selection = {}, lang = 'zh') {
  const { selectedNodeId, selectedEdgeId } = selection;

  if (selectedEdgeId) {
    const edge = versionGraph.edges.find((e) => e.id === selectedEdgeId);
    if (edge) return renderEdgeInspector(edge, versionGraph, lang);
  }

  if (selectedNodeId) {
    const node = versionGraph.nodes.find((n) => n.id === selectedNodeId);
    if (node) return renderNodeInspector(node, versionGraph, lang);
  }

  // Default empty state
  return `
    <div class="empty">
      <p><strong>${lang === 'en' ? 'Select a node or connection path' : '请点击节点或影响关系路径'}</strong></p>
      <p class="muted">${lang === 'en' ? 'Click A, B, C or an arrow in the graph to inspect exact evidence line numbers, official documentation, AST findings and limitations.' : '点击图谱中的 A、B、C 节点或连接连线，即可查看对应文件行号、官方文献、AST 静态定位及分析限制。'}</p>
    </div>
  `;
}

function renderNodeInspector(node, versionGraph, lang) {
  const isReview = node.status === 'review_required';
  const statusLabel = formatNodeStatus(node.status, lang);
  const statusColorClass = isReview ? 'status-tag-review' : 'status-tag-neutral';

  // Connected edges
  const connectedEdges = versionGraph.edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  // Curated claims HTML
  let claimsHtml = '';
  if (node.curated_claims && node.curated_claims.length > 0) {
    claimsHtml = `
      <div class="detail-section">
        <h4>${lang === 'en' ? 'Curated Official Claims' : '精选版本声明'}</h4>
        <div class="claim-list">
          ${node.curated_claims
            .map((c) => {
              const src = versionGraph.official_sources[c.source_ids?.[0]] || {};
              const safeUrl = safeHttpsUrl(src.url);
              const claimTitle = lang === 'en' ? c.title_en || c.title : c.title;
              const claimStmt = lang === 'en' ? c.statement_en || c.statement : c.statement;
              return `
                <div class="claim-item">
                  <div class="claim-head">
                    <span class="tag purple mono">${esc(c.claim_id)}</span>
                    <strong>${esc(claimTitle)}</strong>
                    <span class="line-badge mono">${formatLineRange(c.line_start, c.line_end, lang)}</span>
                  </div>
                  ${claimStmt ? `<p class="claim-stmt muted">${esc(claimStmt)}</p>` : ''}
                  <pre class="code-excerpt"><code>${esc(c.line_excerpt)}</code></pre>
                  ${src.title ? `
                    <div class="source-link-row">
                      <span class="source-title">${esc(lang === 'en' ? src.title_en || src.title : src.title)}</span>
                      ${safeUrl ? `<a class="text-link" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${lang === 'en' ? 'Official Source' : '官方文献'} ↗</a>` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // Static AST findings HTML
  let findingsHtml = '';
  if (node.static_findings && node.static_findings.length > 0) {
    findingsHtml = `
      <div class="detail-section">
        <h4>${lang === 'en' ? 'Static AST Findings (EvidenceEngine)' : 'AST 静态调用定位 (EvidenceEngine)'}</h4>
        <div class="finding-list">
          ${node.static_findings
            .map((f) => {
              const src = versionGraph.official_sources[f.source_ids?.[0]] || {};
              const safeUrl = safeHttpsUrl(src.url);
              return `
                <div class="finding-item">
                  <div class="finding-head">
                    <span class="symbol-name mono"><code>${esc(f.symbol)}</code></span>
                    <span class="line-badge mono">${formatLineRange(f.line, f.line, lang)}</span>
                    <span class="migration-arrow mono"><code>${esc(f.before)}</code> → <code>${esc(f.after)}</code></span>
                  </div>
                  <pre class="code-excerpt"><code>${esc(f.line_text)}</code></pre>
                  <p class="finding-reason muted">${esc(lang === 'en' ? 'NumPy 2.0 removes np.float_; review the official replacement np.float64.' : f.reason)}</p>
                  ${src.title ? `
                    <div class="source-link-row">
                      <span class="source-title">${esc(lang === 'en' ? src.title_en || src.title : src.title)}</span>
                      ${safeUrl ? `<a class="text-link" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${lang === 'en' ? 'Migration Guide' : '迁移指引'} ↗</a>` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // Author declared references HTML
  let referencesHtml = '';
  if (node.author_declared_references && node.author_declared_references.length > 0) {
    referencesHtml = `
      <div class="detail-section">
        <h4>${lang === 'en' ? 'Author-Declared Reference Marker' : '作者显式声明引用标记'}</h4>
        <div class="reference-list">
          ${node.author_declared_references
            .map(
              (r) => `
              <div class="ref-item">
                <div class="ref-head">
                  <strong class="mono">${esc(r.target_file)}</strong>
                  <span class="line-badge mono">${formatLineRange(r.line, r.line, lang)}</span>
                </div>
                <pre class="code-excerpt"><code>${esc(r.marker)}</code></pre>
                <small class="muted">${lang === 'en' ? 'Author annotation in file comment; not a dynamic runtime dependency.' : '文件注释中的作者声明标记；非动态运行时依赖。'}</small>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // Related edge links (e.g. for Node B: review candidate A->B and author ref B->A)
  let edgeLinksHtml = '';
  if (connectedEdges.length > 0) {
    edgeLinksHtml = `
      <div class="detail-section">
        <h4>${lang === 'en' ? 'Related Impact Paths' : '关联影响路径'}</h4>
        <div class="edge-link-buttons">
          ${connectedEdges
            .map((e) => {
              const label = formatEdgeType(e.type, lang);
              return `<button class="relation-link" data-select-edge="${esc(e.id)}"><span class="tag ${e.type === 'derived_review_candidate' ? 'status-tag-review' : 'blue'}">${esc(label)}</span></button>`;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // Node C special explanation
  let noticeHtml = '';
  if (node.id === 'C') {
    noticeHtml = `
      <div class="notice-callout neutral">
        <strong>${lang === 'en' ? 'Conservative Soundness Boundary' : '可信拒答与保守研判边界'}</strong>
        <p>${lang === 'en' ? 'Note C contains general numerical precision analysis. No deprecated API calls or references to legacy advice were found. Note: Absence of confirmed impact does NOT imply full compatibility guarantee.' : '资料 C 讨论通用数值精度规范，未包含任何已废弃 API 或对旧建议的引用。“尚无已证实影响”严守证据不足边界，不代表生产环境兼容性承诺。'}</p>
      </div>
    `;
  } else if (node.ast_notice) {
    noticeHtml = `
      <div class="notice-callout">
        <p>${esc(lang === 'en' ? 'Static analysis only: no code is executed, imported or rewritten. Dynamic behavior and runtime compatibility require separate review.' : node.ast_notice)}</p>
      </div>
    `;
  }

  const localizedReason = lang === 'en'
    ? node.status_reason_en || node.status_reason || statusLabel
    : node.status_reason || statusLabel;

  return `
    <div class="impact-inspector-body">
      <div class="type-line">
        <span class="tag ${statusColorClass}">${esc(statusLabel)}</span>
        <span class="tag grey">${esc(node.format.toUpperCase())}</span>
      </div>
      <h3>${esc(node.id)}: ${esc(node.path)}</h3>
      <p class="node-desc muted">${esc(lang === 'en' ? node.description : ({A:'自建旧建议笔记：记录 NumPy 1.26 的 float_ 用法，并标注官方版本声明。',B:'自建处理脚本：显式引用 A.md，并在第 10 行使用 np.float_。',C:'自建数值精度笔记：没有发现旧建议引用或已移除 API 的使用。'}[node.id] || node.description))}</p>

      <dl class="property-list">
        <dt>${lang === 'en' ? 'Target Version' : '目标适用版本'}</dt>
        <dd>NumPy ${esc(versionGraph.version)}</dd>
        <dt>${lang === 'en' ? 'Review Status' : '研判结论'}</dt>
        <dd>${esc(localizedReason)}</dd>
        <dt>${lang === 'en' ? 'Connected Paths' : '关联图谱路径'}</dt>
        <dd>${connectedEdges.length} ${lang === 'en' ? 'edges' : '条关系'}</dd>
      </dl>

      ${noticeHtml}
      ${claimsHtml}
      ${findingsHtml}
      ${referencesHtml}
      ${edgeLinksHtml}

      <div class="inspector-actions">
        <button class="button small" data-view-excerpt="${esc(node.id)}">
          ${lang === 'en' ? 'View Original File Excerpt' : '查看原件完整内容'}
        </button>
        <button class="button small ghost" data-export-review="${esc(node.id)}">
          ${lang === 'en' ? 'Download Review Record' : '导出复核记录 (JSON)'}
        </button>
      </div>
    </div>
  `;
}

function renderEdgeInspector(edge, versionGraph, lang) {
  const isAuthor = edge.type === 'author_declared_reference';
  const edgeTypeLabel = formatEdgeType(edge.type, lang);
  const ev = edge.evidence || {};

  let detailsHtml = '';
  if (isAuthor) {
    const lineLabel = formatLineRange(ev.line, ev.line, lang);
    const lineSuffix = lineLabel ? ` (${lineLabel})` : '';
    detailsHtml = `
      <div class="detail-section">
        <h4>${lang === 'en' ? 'Explicit Declaration Evidence' : '作者声明引用证据'}</h4>
        <dl class="property-list">
          <dt>${lang === 'en' ? 'Referencing File' : '引用方文件'}</dt>
          <dd class="mono">${esc(ev.source_file)}${lineSuffix}</dd>
          <dt>${lang === 'en' ? 'Target File' : '被引用文件'}</dt>
          <dd class="mono">${esc(ev.target_file)}</dd>
          <dt>${lang === 'en' ? 'Marker Type' : '声明形式'}</dt>
          <dd>${esc(ev.marker_type || 'Python comment')}</dd>
        </dl>
        <pre class="code-excerpt"><code>${esc(ev.marker)}</code></pre>
        <p class="muted">${lang === 'en' ? 'Explicit file annotation declaring knowledge origin. Not a runtime package import or module execution.' : '代码/文档注释中的显式知识来源声明。非动态包导入，亦未执行文件代码。'}</p>
      </div>
    `;
  } else {
    // Derived review candidate
    const triggerClaimId = ev.trigger_claim_id;
    const officialSrc = versionGraph.official_sources[ev.official_source_ids?.[0]] || {};
    const safeUrl = safeHttpsUrl(officialSrc.url);

    // Look up Node A line excerpt for old advice
    const nodeA = versionGraph.nodes.find((n) => n.id === 'A') || {};
    const oldAdviceClaim = (nodeA.curated_claims || []).find((c) => c.claim_id === 'C126-FLOAT') || {};
    const triggerClaim = (nodeA.curated_claims || []).find((c) => c.claim_id === triggerClaimId) || {};

    const claimTitle = lang === 'en'
      ? triggerClaim.title_en || ev.trigger_title_en || ev.trigger_title || triggerClaimId
      : triggerClaim.title || ev.trigger_title || triggerClaimId;

    const claimStmt = lang === 'en'
      ? triggerClaim.statement_en || ev.trigger_statement_en || ev.trigger_statement || ''
      : triggerClaim.statement || ev.trigger_statement || '';

    const refDecl = ev.reference_declaration || {};

    const oldAdviceRange = formatLineRange(oldAdviceClaim.line_start, oldAdviceClaim.line_end, lang);
    const oldAdviceSuffix = oldAdviceRange ? ` (${oldAdviceRange})` : '';

    const refDeclRange = formatLineRange(refDecl.line, refDecl.line, lang);
    const refDeclSuffix = refDeclRange ? ` (${refDeclRange})` : '';

    detailsHtml = `
      <div class="detail-section">
        <h4>${lang === 'en' ? 'Derived Review Candidate Evidence' : '复核建议推导证据链'}</h4>
        <dl class="property-list">
          <dt>${lang === 'en' ? 'Origin Advice' : '上游旧建议'}</dt>
          <dd>${esc(edge.source)} (A.md)</dd>
          <dt>${lang === 'en' ? 'Downstream Consumer' : '下游受影响脚本'}</dt>
          <dd>${esc(edge.target)} (B.py)</dd>
          <dt>${lang === 'en' ? 'Selected Target Version' : '当前目标版本'}</dt>
          <dd>NumPy ${esc(versionGraph.version)}</dd>
        </dl>

        <!-- Upstream Legacy Advice Excerpt -->
        <div class="evidence-sub-block">
          <strong>${lang === 'en' ? `1. Upstream Legacy Guidance in A.md${oldAdviceSuffix}:` : `1. A.md 中的上游旧指导建议${oldAdviceSuffix}：`}</strong>
          <pre class="code-excerpt"><code>${esc(oldAdviceClaim.line_excerpt || 'val = np.float_(42.0)')}</code></pre>
        </div>

        <!-- Official Claim Trigger -->
        <div class="evidence-sub-block">
          <strong>${lang === 'en' ? '2. Triggering Official Version Claim:' : '2. 触发研判的官方版本声明：'}</strong>
          <div class="claim-item" style="margin-top:6px">
            <span class="tag purple mono">${esc(triggerClaimId)}</span>
            <strong>${esc(claimTitle)}</strong>
            ${claimStmt ? `<p class="muted" style="margin:4px 0">${esc(claimStmt)}</p>` : ''}
          </div>
        </div>

        <!-- Author Reference in Consumer -->
        <div class="evidence-sub-block">
          <strong>${lang === 'en' ? `3. Author Reference in ${refDecl.source_file || 'B.py'}${refDeclSuffix}:` : `3. ${refDecl.source_file || 'B.py'} 中的作者引用声明${refDeclSuffix}：`}</strong>
          <pre class="code-excerpt"><code>${esc(refDecl.marker || '# knowledge-source: A.md')}</code></pre>
        </div>

        <!-- Downstream Static AST Usage -->
        <div class="evidence-sub-block">
          <strong>${lang === 'en' ? '4. Downstream Static AST Usage:' : '4. 下游代码静态 AST 调用定位：'}</strong>
          ${(ev.static_findings || [])
            .map(
              (f) => `
              <div class="finding-item" style="margin-top:6px">
                <span class="symbol-name mono"><code>${esc(f.symbol)}</code></span>
                <span class="line-badge mono">${formatLineRange(f.line, f.line, lang)}</span>
                <span class="migration-arrow mono"><code>${esc(f.before)}</code> → <code>${esc(f.after)}</code></span>
              </div>
            `
            )
            .join('')}
        </div>

        ${safeUrl ? `
          <div class="source-link-row" style="margin-top:10px">
            <span class="source-title">${esc(lang === 'en' ? officialSrc.title_en || officialSrc.title : officialSrc.title)}</span>
            <a class="text-link" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${lang === 'en' ? 'Open Official Guide' : '查看官方迁移指引'} ↗</a>
          </div>
        ` : ''}

        <div class="notice-callout neutral" style="margin-top:12px">
          <strong>${lang === 'en' ? 'Analysis Limitations' : '分析局限与已知边界'}</strong>
          <p>${lang === 'en' ? 'Derived review candidate is a recommended manual audit direction, not a runtime failure proof. Static AST analysis does not perform dynamic runtime execution.' : '建议复核属于推荐人工审计方向，非运行时必然报错断言。静态 AST 分析不执行真实代码。'}</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="impact-inspector-body">
      <div class="type-line">
        <span class="tag ${isAuthor ? 'blue' : 'status-tag-review'}">${esc(edgeTypeLabel)}</span>
      </div>
      <h3>${esc(edge.source)} → ${esc(edge.target)}</h3>
      <p class="node-desc muted">${esc(lang === 'en' ? edge.semantics : isAuthor ? 'B 的注释明确声明知识来源为 A；这是作者引用，不是运行时依赖。' : 'A 的旧建议与目标版本变化、B 的显式引用及静态使用共同支持人工复核；不代表运行时必然失败。')}</p>

      ${detailsHtml}

      <div class="inspector-actions">
        <button class="button small ghost" data-export-review="${esc(edge.id)}">
          ${lang === 'en' ? 'Download Review Record' : '导出复核记录 (JSON)'}
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate Review Record JSON for export.
 * Contains selected item, version, relative paths only, provenance, exact embedded official sources,
 * and zero sensitive data.
 */
export function buildReviewExport(versionGraph, selectedId) {
  const isEdge = selectedId.includes(':') || selectedId.includes('->');
  const record = {
    export_type: isEdge ? 'impact_edge_review_record' : 'impact_node_review_record',
    target_version: versionGraph.version,
    selected_id: selectedId,
    exported_at: new Date().toISOString(),
    fixture_disclaimer: versionGraph.fixture_disclaimer,
    provenance: versionGraph.provenance,
    limitations: versionGraph.limitations,
    official_sources: {},
  };

  if (isEdge) {
    const edge = versionGraph.edges.find((e) => e.id === selectedId);
    if (!edge) throw new Error(`Edge ${selectedId} not found`);
    record.edge = edge;

    // Embed both source and target node objects with original file_content and mapped claims
    const sourceNode = versionGraph.nodes.find((n) => n.id === edge.source);
    const targetNode = versionGraph.nodes.find((n) => n.id === edge.target);
    record.source_node = sourceNode || null;
    record.target_node = targetNode || null;

    // Embed all source objects referenced by edge, source_node, or target_node
    const sids = new Set(edge.evidence?.official_source_ids || []);
    for (const node of [sourceNode, targetNode]) {
      if (!node) continue;
      for (const c of node.curated_claims || []) {
        for (const sid of c.source_ids || []) sids.add(sid);
      }
      for (const f of node.static_findings || []) {
        for (const sid of f.source_ids || []) sids.add(sid);
      }
    }
    for (const sid of sids) {
      if (versionGraph.official_sources[sid]) {
        record.official_sources[sid] = versionGraph.official_sources[sid];
      }
    }
  } else {
    const node = versionGraph.nodes.find((n) => n.id === selectedId);
    if (!node) throw new Error(`Node ${selectedId} not found`);
    record.node = node;

    // For Node B, include related review edges and corresponding source node data (A)
    const relatedEdges = versionGraph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );
    record.related_edges = relatedEdges;
    const relatedNodeIds = new Set(
      relatedEdges.map((e) => (e.source === node.id ? e.target : e.source))
    );
    record.related_nodes = versionGraph.nodes.filter((n) => relatedNodeIds.has(n.id));

    // Embed all source objects referenced in claims, static findings, or related edges
    const sids = new Set();
    for (const c of node.curated_claims || []) {
      for (const sid of c.source_ids || []) sids.add(sid);
    }
    for (const f of node.static_findings || []) {
      for (const sid of f.source_ids || []) sids.add(sid);
    }
    for (const e of relatedEdges) {
      for (const sid of e.evidence?.official_source_ids || []) sids.add(sid);
    }
    for (const related of record.related_nodes) {
      for (const claim of related.curated_claims || []) {
        for (const sid of claim.source_ids || []) sids.add(sid);
      }
      for (const finding of related.static_findings || []) {
        for (const sid of finding.source_ids || []) sids.add(sid);
      }
    }
    for (const sid of sids) {
      if (versionGraph.official_sources[sid]) {
        record.official_sources[sid] = versionGraph.official_sources[sid];
      }
    }
  }

  return record;
}
