export interface RunnerDef {
  /** Also the Durable Object name. The hint is baked in because hints only apply on first creation. */
  name: string;
  locationHint: DurableObjectLocationHint | null;
  description: string;
}

export const CRON_RUNNER: RunnerDef = {
  name: "cron",
  locationHint: null,
  description: "Inline in the scheduled handler (location not controllable)",
};

export const HINTED_RUNNERS: readonly RunnerDef[] = [
  {
    name: "do@wnam",
    locationHint: "wnam",
    description: "Durable Object hinted to Western North America",
  },
  {
    name: "do@enam",
    locationHint: "enam",
    description: "Durable Object hinted to Eastern North America",
  },
  { name: "do@weur", locationHint: "weur", description: "Durable Object hinted to Western Europe" },
  { name: "do@eeur", locationHint: "eeur", description: "Durable Object hinted to Eastern Europe" },
  {
    name: "do@apac-ne",
    locationHint: "apac-ne",
    description: "Durable Object hinted to Northeast Asia (Tokyo-adjacent)",
  },
  {
    name: "do@apac-se",
    locationHint: "apac-se",
    description: "Durable Object hinted to Southeast Asia (Singapore-adjacent)",
  },
];

export const ALL_RUNNERS: readonly RunnerDef[] = [CRON_RUNNER, ...HINTED_RUNNERS];

export function runnerStub(env: Env, runner: RunnerDef) {
  const id = env.PROBE.idFromName(runner.name);
  return runner.locationHint
    ? env.PROBE.get(id, { locationHint: runner.locationHint })
    : env.PROBE.get(id);
}
