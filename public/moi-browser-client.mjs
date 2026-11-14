// This adapter is not wired into the published static application yet.
// Calling it is an explicit, potentially billable online action.
export async function requestMoiSelection({ question, workspace, version, signal }, fetchImpl = fetch, timeoutMs = 35000) {
  if (typeof question !== 'string' || !question.trim() || question.length > 500 ||
      typeof workspace !== 'string' || !workspace || typeof version !== 'string' || !version)
    return { status: 'invalid_request' };
  if (signal?.aborted) return { status: 'cancelled' };
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl('/api/moi', {
      method: 'POST', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), workspace, version }), signal: controller.signal,
    });
    if (response.status === 403) return { status: 'unauthorized' };
    if (response.status === 429) return { status: 'quota_exceeded' };
    if (!response.ok) return { status: 'unavailable' };
    let data;
    try { data = await response.json(); } catch { return { status: controller.signal.aborted ? (timedOut ? 'timeout' : 'cancelled') : 'invalid_response' }; }
    if (data?.mode === 'curated' && data?.status === 'insufficient') return { status: 'insufficient' };
    if (data?.mode !== 'genesis' || data?.evidence_mode !== 'curated' ||
      !Array.isArray(data.claims) || !data.claims.length || !Array.isArray(data.sources) || !data.sources.length ||
      data.claims.some(c => !c || typeof c.id !== 'string' || !Array.isArray(c.source_ids) || !c.source_ids.length) ||
      data.sources.some(s => !s || typeof s.id !== 'string')) return { status: 'invalid_response' };
    const sourceIds = new Set(data.sources.map(source => source.id));
    if (data.claims.some(claim => claim.source_ids.some(id => !sourceIds.has(id)))) return { status: 'invalid_response' };
    return { status: 'answered', mode: 'genesis', evidenceMode: 'curated', claims: data.claims, sources: data.sources };
  } catch { return { status: timedOut ? 'timeout' : signal?.aborted ? 'cancelled' : 'unavailable' }; }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}
