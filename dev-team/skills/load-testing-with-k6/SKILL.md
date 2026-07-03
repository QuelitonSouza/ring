---
name: ring:load-testing-with-k6
description: "Load-testing an ASP.NET Core (or any HTTP/gRPC) API with k6: scaffolds a reusable client, smoke/load/stress/soak scenarios with thresholds, reads VUs/duration from env, exports handleSummary, and verifies a local k6 run against a .NET endpoint. Use when new API endpoints or throughput-path changes need SLO validation under load, or a CI load gate is required. Skip when no network-facing endpoints are affected or changes are config-only or non-code."
---

# k6 Load Testing

## When to use
- After integration testing passes
- Before production deploy of performance-sensitive changes
- New API/gRPC endpoints or significant throughput-path changes on a .NET service
- Need to validate SLOs under load (latency, error rate, throughput)
- CI pipeline requires a load-test gate

## Skip when
- Task is documentation-only, configuration-only, or non-code
- No HTTP/gRPC endpoints affected by the change
- Changes limited to static assets, configs, or non-runtime code
- Service has no network-facing interface

## Related
**Complementary:** ring:dev-implementation, ring:implementing-readyz, ring:reviewing-operational-risk


This skill generates k6 load tests for an ASP.NET Core API. k6 is
language-agnostic (test scripts are JavaScript regardless of the service
language); only the target endpoints and payloads are .NET-specific here.

## Deployment context
The API under test may run on AKS or on a VPS with Docker. Point k6 at whichever
base URL you are validating (`-e TARGET_URL=...`) — the scripts read it from an
env var, so the same scenario runs against a local container, the VPS, or a
staging cluster without edits.

## Block conditions
- Test script missing `handleSummary` export = FAIL (no results collected)
- `test.js` doesn't read `VUS`/`DURATION` from `__ENV` = FAIL
- No `check()` on responses = FAIL
- No `thresholds` defined in `options` = FAIL

## Step 1: Validate Input

Required:
- `service` — service name in lowercase (e.g., `payments`, `ledger`)
- `endpoints` — list of endpoints to test, each with method, path, and optional payload
- `base_port` — local dev port for the service (ASP.NET Core defaults: `8080` in-container, `5000`/`5001` on `dotnet run`)

Optional:
- `scenario_types` — which scenarios to generate (default: `[smoke, load, stress]`)
- `auth_type` — `bearer` (default) | `api-key` | `none`
- `api_key_header` — header name for API key auth (default: `X-API-Key`)
- `custom_thresholds` — override default thresholds

## Step 2: Project layout

```
loadtests/
├── lib/
│   ├── client.js          # HTTP client scoped to the service base URL
│   └── utils.js           # checkResponse(), sleepWithJitter(), summaryToStdout()
└── scenarios/
    ├── smoke.js
    ├── load.js
    └── stress.js
```

Keep the client and helpers separate so every scenario shares one place for
base-URL resolution, auth headers, and response assertions.

## Step 3: Create the client and helpers

### lib/client.js

```javascript
import http from 'k6/http';

const BASE_URL = __ENV.TARGET_URL || `http://localhost:${__ENV.BASE_PORT || 8080}`;
const API_VERSION = __ENV.API_VERSION || 'v1';

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (__ENV.AUTH_TOKEN) headers['Authorization'] = `Bearer ${__ENV.AUTH_TOKEN}`;
  if (__ENV.API_KEY) headers[__ENV.API_KEY_HEADER || 'X-API-Key'] = __ENV.API_KEY;
  return headers;
}

export function apiUrl(path) {
  return `${BASE_URL}/${API_VERSION}${path}`;
}

export function get(path, params = {}) {
  const { headers: extra, ...rest } = params;
  return http.get(apiUrl(path), { ...rest, headers: { ...authHeaders(), ...extra } });
}

export function post(path, body, params = {}) {
  const { headers: extra, ...rest } = params;
  return http.post(apiUrl(path), JSON.stringify(body), { ...rest, headers: { ...authHeaders(), ...extra } });
}

export function patch(path, body, params = {}) {
  const { headers: extra, ...rest } = params;
  return http.patch(apiUrl(path), JSON.stringify(body), { ...rest, headers: { ...authHeaders(), ...extra } });
}

export function del(path, params = {}) {
  const { headers: extra, ...rest } = params;
  return http.del(apiUrl(path), null, { ...rest, headers: { ...authHeaders(), ...extra } });
}

// Hits the ASP.NET Core readiness probe (see ring:implementing-readyz)
export function readyz() {
  return http.get(`${BASE_URL}/readyz`, { tags: { name: 'readyz' } });
}
```

**Key rules for the client:**
- `__ENV.TARGET_URL` is the primary URL — always include a localhost fallback
- Never hardcode auth credentials — read from `__ENV`
- Point the readiness helper at `/readyz` so a smoke test can gate on the service being ready

### lib/utils.js

```javascript
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('custom_error_rate');
const reqDuration = new Trend('custom_request_duration', true);

export function checkResponse(res, expectedStatus = 200, label = 'request') {
  const ok = check(res, {
    [`${label}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${label}: duration < 5s`]: (r) => r.timings.duration < 5000,
  });
  errorRate.add(!ok);
  reqDuration.add(res.timings.duration);
  return ok;
}

export function sleepWithJitter(base = 1, jitter = 0.3) {
  return base + Math.random() * jitter;
}

export function summaryToStdout(data) {
  return { stdout: JSON.stringify(data, null, 2), 'summary.json': JSON.stringify(data) };
}
```

## Step 4: Create scenario files

### Default values per scenario type

| Type | VUs | Duration | Thresholds |
|------|-----|----------|------------|
| smoke | 3-5 | 1m | p(95)<500 |
| load | 50 | 10m | p(95)<300, p(99)<500 |
| stress | 100-200 | 5m | p(95)<500, p(99)<1000 |
| soak | 30 | 30m-2h | p(95)<300, p(99)<500 |

### scenarios/smoke.js

```javascript
import { sleep } from 'k6';
import { get, readyz } from '../lib/client.js';
import { checkResponse, sleepWithJitter, summaryToStdout } from '../lib/utils.js';

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 5,
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Readiness check (ASP.NET Core /readyz)
  checkResponse(readyz(), 200, 'readyz');

  // Representative API call for this service
  const res = get('/payments');
  checkResponse(res, 200, 'list payments');

  sleep(sleepWithJitter(1));
}

// MANDATORY: results collection
export function handleSummary(data) {
  return summaryToStdout(data);
}
```

### scenarios/load.js (with ramp-up stages)

```javascript
import { sleep } from 'k6';
import { get, post } from '../lib/client.js';
import { checkResponse, sleepWithJitter, summaryToStdout } from '../lib/utils.js';

const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 50;
const DURATION = __ENV.DURATION || '10m';
const RAMP_UP = __ENV.RAMP_UP || '2m';

export const options = {
  stages: [
    { duration: RAMP_UP, target: VUS },
    { duration: DURATION, target: VUS },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Example .NET API flow: list → get detail → create
  const listRes = get('/payments');
  checkResponse(listRes, 200, 'list payments');

  if (listRes.status === 200) {
    const body = JSON.parse(listRes.body);
    const items = body.items || body;
    if (Array.isArray(items) && items.length > 0) {
      const id = items[0].id;
      const detailRes = get(`/payments/${id}`);
      checkResponse(detailRes, 200, 'get payment');
    }
  }

  const createRes = post('/payments', { amount: 100, currency: 'BRL' });
  checkResponse(createRes, 201, 'create payment');

  sleep(sleepWithJitter(0.5, 0.3));
}

export function handleSummary(data) {
  return summaryToStdout(data);
}
```

### scenarios/stress.js

```javascript
import { sleep } from 'k6';
import { get, post } from '../lib/client.js';
import { checkResponse, sleepWithJitter, summaryToStdout } from '../lib/utils.js';

const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 100;
const DURATION = __ENV.DURATION || '5m';
const RAMP_UP = __ENV.RAMP_UP || '1m';

export const options = {
  stages: [
    { duration: RAMP_UP, target: VUS },
    { duration: DURATION, target: VUS },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  // Higher-intensity mixed read/write flow — adapt to the service's critical path
  checkResponse(get('/payments'), 200, 'list payments');
  checkResponse(post('/payments', { amount: 5, currency: 'BRL' }), 201, 'create payment');
  sleep(sleepWithJitter(0.3, 0.2));
}

export function handleSummary(data) {
  return summaryToStdout(data);
}
```

## Step 5: Build and verify

k6 runs the scripts directly — no bundler needed. With the .NET service running
locally (or in a container):

```bash
# Run the service first, e.g.:
#   dotnet run --project src/Payments.Api        # listens on :5000/:5001
#   docker run -p 8080:8080 myorg/payments        # listens on :8080

# Smoke against local dotnet run:
k6 run -e TARGET_URL=http://localhost:5000 loadtests/scenarios/smoke.js

# Smoke against the container port:
k6 run -e TARGET_URL=http://localhost:8080 loadtests/scenarios/smoke.js

# Override VUs / duration:
k6 run -e TARGET_URL=http://localhost:8080 -e VUS=20 -e DURATION=2m loadtests/scenarios/load.js
```

A run exits non-zero if any `threshold` is breached — that non-zero exit is what
a CI load gate keys off of.

## Step 6: Mandatory checklist

Before marking complete, verify ALL items:

- [ ] `loadtests/lib/client.js` exists with a `TARGET_URL` fallback and no hardcoded credentials
- [ ] `loadtests/lib/utils.js` exports `checkResponse`, `sleepWithJitter`, and a summary helper
- [ ] At least `scenarios/smoke.js` exists
- [ ] Every scenario reads `VUS` and `DURATION` from `__ENV`
- [ ] Every scenario defines `thresholds` in `options`
- [ ] Every scenario calls `checkResponse()` (or `check()`) on responses
- [ ] Every scenario exports `handleSummary`
- [ ] Smoke test runs locally: `k6 run -e TARGET_URL=http://localhost:{port} loadtests/scenarios/smoke.js`
- [ ] The smoke scenario asserts `/readyz` returns 200 before exercising the API

## Environment variables reference

| Variable | Description |
|----------|-------------|
| `TARGET_URL` | Base URL of the .NET service under test |
| `BASE_PORT` | Fallback local port when `TARGET_URL` is unset (default 8080) |
| `API_VERSION` | URL path version segment (default `v1`) |
| `VUS` | Number of virtual users |
| `DURATION` | Test duration (e.g., `30s`, `5m`) |
| `RAMP_UP` | Ramp-up duration for staged scenarios |
| `AUTH_TOKEN` | Bearer token (priority) |
| `API_KEY` / `API_KEY_HEADER` | API-key auth value + header name |

## Output report

```markdown
## Load Test Summary

| Metric | Value |
|--------|-------|
| Result | PASS |
| Service | {service} |
| Scenarios Created | smoke, load, stress |
| Target | {TARGET_URL} |

## Files Created

| File | Purpose |
|------|---------|
| `loadtests/lib/client.js` | HTTP client + readyz helper |
| `loadtests/lib/utils.js` | checkResponse / jitter / summary |
| `loadtests/scenarios/smoke.js` | Smoke test |
| `loadtests/scenarios/load.js` | Load test |
| `loadtests/scenarios/stress.js` | Stress test |

## Verification
- Local run verified: ✅ (smoke @ {TARGET_URL})
- Thresholds enforced (non-zero exit on breach): ✅

## Next Steps
- Wire the smoke scenario into CI as a load gate (fail the pipeline on threshold breach)
- Run load/stress against a staging deploy (AKS or VPS) before production
```
