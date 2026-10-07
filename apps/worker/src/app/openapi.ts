import { SITE_ORIGIN } from "../web/layout";

/** One query parameter of an endpoint. Names are the ones app/params.ts reads. */
interface Param {
  name: string;
  description: string;
  type?: "string" | "integer" | "number" | "boolean";
  in?: "path" | "query";
  required?: boolean;
}

/** One read-only endpoint. The spec and the /docs page are both built from this list. */
export interface Endpoint {
  path: string;
  summary: string;
  params: Param[];
}

const asset: Param = {
  name: "asset",
  in: "path",
  required: true,
  description: "Base asset, for example BTC. A non-crypto class goes before it: equity/BB.",
};

/** Every public endpoint of the API. Keep it in step with the routes in app/app.ts. */
export const ENDPOINTS: Endpoint[] = [
  {
    path: "/v1/health",
    summary: "Whether the collector has reported recently. Answers 503 when it has not.",
    params: [],
  },
  { path: "/v1/venues", summary: "Every exchange airrates reads, with its type.", params: [] },
  {
    path: "/v1/screener",
    summary: "Funding-rate spreads between exchanges for the same asset, widest first.",
    params: [
      { name: "min_oi", description: "Minimum open interest in USD on the thinner leg." },
      { name: "min_vol", description: "Minimum 24h volume in USD." },
      { name: "venues", description: "Comma-separated exchange ids to include." },
      { name: "types", description: "Comma-separated exchange types to include." },
      { name: "extremes", description: "Set to 1 to keep rates above the usual APR ceiling." },
      {
        name: "quote",
        description: "Set to same to require the same quote currency on both legs.",
      },
      { name: "sort", description: "Sort key." },
      { name: "limit", type: "integer", description: "Rows to return." },
    ],
  },
  { path: "/v1/exchanges", summary: "A summary of each exchange's live markets.", params: [] },
  {
    path: "/v1/exchanges/{exchange}",
    summary: "Every live market on one exchange.",
    params: [{ name: "exchange", in: "path", required: true, description: "Exchange id." }],
  },
  {
    path: "/v1/verified",
    summary: "Pairs that the last replay shows could actually have been held.",
    params: [],
  },
  {
    path: "/v1/rates",
    summary: "Annualised funding rate of each asset on each exchange.",
    params: [
      { name: "tf", description: "Timeframe: now, 7d, 30d or 60d." },
      { name: "limit", type: "integer", description: "Assets per page." },
      { name: "offset", type: "integer", description: "Assets to skip." },
    ],
  },
  {
    path: "/v1/status",
    summary: "Whether each exchange's data is fresh, and the price-identity checks.",
    params: [],
  },
  {
    path: "/v1/liquidations",
    summary: "Liquidations by asset and exchange over a window.",
    params: [
      { name: "window", description: "Time window." },
      { name: "venue", description: "One exchange id, or all." },
      { name: "assets", description: "Comma-separated assets." },
    ],
  },
  {
    path: "/v1/arbitrage",
    summary: "Price gaps where one exchange's bid sits above another's ask.",
    params: [
      { name: "min_bps", type: "number", description: "Minimum gap in basis points." },
      { name: "min_depth", description: "Minimum depth in USD." },
      { name: "limit", type: "integer", description: "Rows to return." },
    ],
  },
  {
    path: "/v1/assets/{asset}",
    summary: "Every live market for one asset.",
    params: [asset],
  },
  {
    path: "/v1/price-pair/{asset}",
    summary: "Quotes for one asset on each exchange that publishes them.",
    params: [asset],
  },
  {
    path: "/v1/pairs/{asset}/backtest",
    summary: "What a long/short funding pair paid over past days. Rate limited per address.",
    params: [
      asset,
      { name: "long", required: true, description: "Exchange id of the long leg." },
      { name: "short", required: true, description: "Exchange id of the short leg." },
      { name: "size", type: "number", description: "Position size in USD." },
      { name: "days", type: "integer", description: "Days of history." },
      { name: "fee_long", type: "number", description: "Taker fee in bps on the long leg." },
      { name: "fee_short", type: "number", description: "Taker fee in bps on the short leg." },
    ],
  },
];

/** The OpenAPI 3.1 description of the API, built from ENDPOINTS. */
export function openApiSpec(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const endpoint of ENDPOINTS) {
    paths[endpoint.path] = {
      get: {
        summary: endpoint.summary,
        parameters: endpoint.params.map((p) => ({
          name: p.name,
          in: p.in ?? "query",
          required: p.required ?? false,
          description: p.description,
          schema: { type: p.type ?? "string" },
        })),
        responses: {
          "200": {
            description: "JSON. Objects carry `attribution` and `source` fields.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "404": { description: "Unknown asset or exchange." },
          "503": { description: "Data unavailable. Retry after the delay in Retry-After." },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "airrates API",
      version: "1",
      description:
        "Read-only funding-rate and market data across perpetual-futures exchanges. Free to read; please credit and link https://airrates.net when you reuse it.",
    },
    servers: [{ url: SITE_ORIGIN }],
    externalDocs: { url: `${SITE_ORIGIN}/docs` },
    paths,
  };
}

/** RFC 9727 catalog: one entry, the API, pointing at its spec, its docs and its health check. */
export function apiCatalog(): Record<string, unknown> {
  return {
    linkset: [
      {
        anchor: `${SITE_ORIGIN}/v1`,
        "service-desc": [{ href: `${SITE_ORIGIN}/v1/openapi.json`, type: "application/json" }],
        "service-doc": [{ href: `${SITE_ORIGIN}/docs`, type: "text/html" }],
        status: [{ href: `${SITE_ORIGIN}/v1/health`, type: "application/json" }],
      },
    ],
  };
}
