/** Trading 212 v0, read-only boundary. Raw records go to review, never the ledger. */
export interface BrokerCredentials { apiKey: string; apiSecret: string }
export interface BrokerRecord { external_id: string; kind: 'position' | 'order' | 'dividend' | 'transaction'; data: Record<string, unknown> }
export interface BrokerSnapshot { summary: Record<string, unknown>; records: BrokerRecord[]; fetchedAt: string }
interface Options {
  environment: 'live' | 'demo'; credentials: BrokerCredentials;
  context: { traceId: string; correlationId: string };
  beforeRequest?: () => Promise<void>;
  fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>;
}
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('TRADING212_SCHEMA');
  return v as Record<string, any>;
};
const identity = (v: unknown): string => {
  if ((typeof v !== 'string' || !v) && (typeof v !== 'number' || !Number.isSafeInteger(v))) throw new Error('TRADING212_SCHEMA_ID');
  return String(v);
};
export class Trading212Adapter {
  private options: Options;
  private request: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  constructor(options: Options) {
    if (!['live', 'demo'].includes(options.environment)) throw new Error('TRADING212_ENVIRONMENT');
    this.options = options; this.request = options.fetch || fetch;
    this.sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }
  private async get(path: string): Promise<unknown> {
    const { credentials, context, environment } = this.options;
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.options.beforeRequest?.();
      let response: Response;
      try {
        response = await this.request(`https://${environment}.trading212.com${path}`, {
          method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
          headers: { Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}`,
            Accept: 'application/json', 'X-Trace-ID': context.traceId, 'X-Correlation-ID': context.correlationId }
        });
      } catch { throw new Error('TRADING212_NETWORK'); }
      if ((response.status === 429 || response.status >= 500 || response.status === 408) && attempt < 2) {
        const retry = response.headers.get('retry-after');
        const reset = response.headers.get('x-ratelimit-reset');
        const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000) : reset && /^\d+$/.test(reset) ? Math.max(0, Number(reset) - Date.now() / 1000) : response.status === 429 ? 60 : 2 ** attempt;
        // Do not retry earlier than the server allows; very long delays remain a visible failure.
        if (!Number.isFinite(seconds) || seconds > 120) throw new Error(`TRADING212_HTTP_${response.status}`);
        await response.body?.cancel();
        await this.sleep(Math.max(1000, Math.ceil(seconds * 1000))); continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`TRADING212_HTTP_${response.status}`); }
      try { return await response.json(); } catch { throw new Error('TRADING212_SCHEMA'); }
    }
    throw new Error('TRADING212_RETRY_EXHAUSTED');
  }
  async sync(): Promise<BrokerSnapshot> {
    const summary = object(await this.get('/api/v0/equity/account/summary'));
    identity(summary.id);
    if (!/^[A-Z]{3}$/.test(summary.currency) || !Number.isFinite(summary.totalValue) || !Number.isFinite(summary.cash?.availableToTrade)) throw new Error('TRADING212_SCHEMA');
    const positions = await this.get('/api/v0/equity/positions');
    if (!Array.isArray(positions)) throw new Error('TRADING212_SCHEMA');
    const records: BrokerRecord[] = positions.map(value => {
      const data = object(value); const ticker = identity(data.instrument?.ticker);
      if (!Number.isFinite(data.quantity) || !Number.isFinite(data.currentPrice)) throw new Error('TRADING212_SCHEMA');
      return { external_id: `position:${ticker}`, kind: 'position', data };
    });
    for (const [endpoint, kind] of [['orders', 'order'], ['dividends', 'dividend'], ['transactions', 'transaction']] as const) {
      const base = `/api/v0/equity/history/${endpoint}`;
      let path: string | null = `${base}?limit=50`;
      const seen = new Set<string>();
      while (path) {
        if (seen.has(path) || seen.size >= 100) throw new Error('TRADING212_PAGINATION_LIMIT');
        if (!path.startsWith(`${base}?`)) throw new Error('TRADING212_PAGINATION_UNSAFE');
        const url = new URL(path, 'https://live.trading212.com');
        if (url.pathname !== base || [...url.searchParams.keys()].some(k => !['cursor','limit','time','ticker'].includes(k))) throw new Error('TRADING212_PAGINATION_UNSAFE');
        seen.add(path);
        const page = object(await this.get(path));
        if (!Array.isArray(page.items) || !('nextPagePath' in page) || (page.nextPagePath !== null && typeof page.nextPagePath !== 'string')) throw new Error('TRADING212_SCHEMA');
        for (const value of page.items) {
          const data = object(value);
          const id = kind === 'order' ? `${identity(data.order?.id)}:${identity(data.fill?.id)}` : identity(data.reference);
          if (kind === 'order' ? !Number.isFinite(data.fill?.quantity) : !Number.isFinite(data.amount)) throw new Error('TRADING212_SCHEMA');
          records.push({ external_id: `${kind}:${id}`, kind, data });
        }
        path = page.nextPagePath || null;
        if (path) await this.sleep(3100);
      }
    }
    return { summary, records, fetchedAt: new Date().toISOString() };
  }
}
