# Out-of-order status responses

## Reproduction and scope

Base: `aca7fbdeaa4704bb9dd035597d95bf9ab0215d29` (1.0.42).
The adapter can have overlapping API v1/v2 status requests and v1 write responses.
An older response arriving last can publish `allow_charging=0, ack=true` after a
newer response already published `allow_charging=1, ack=true`.

This is a reproducible offline component defect. It is not a claim that a
particular real installation's interruption was caused by this exact HTTP race.
There is no recorded HTTP/request provenance proving that historical attribution.

## Change

- Assign a monotonically increasing local generation when each HTTP request is
  dispatched, rather than when its response arrives.
- Order state publications per source field, including requests that are already
  processing other fields. A delayed state write cannot complete after and
  overwrite the publication of a newer generation for the same field.
- A write request fences its directly addressed API field against pre-command
  poll responses. Sparse API v2 set responses still do not manufacture a charge
  acknowledgement; a subsequent status observation is required.
- Preserve unrelated fields and accept genuine OFF values from newer requests.
- Include the separate phase-status read and phase-command acknowledgement paths
  in the ordering, and recover the field's publication chain after a state-write
  rejection.

Request-dispatch order is not a device capture timestamp or a guarantee of
physical freshness. Indirect side effects of other API commands are not modeled
as writes to additional fields. Already-issued ioBroker state writes cannot be
cancelled. This change does not modify polling frequency, charging setpoints,
controller thresholds, or device safety timers.

## Offline regression tests

```sh
npm run test:status-order
```

The tests execute the actual `main.js` in an isolated VM. HTTP, ioBroker state
writes, schema validation and the queue dependency are mocked. No device,
ioBroker server, installation, credentials or network access are involved.

Nine regressions cover overlapping v1/v2 polls, genuine newer OFF, pre-command
polls, concurrent write responses, delayed write versus later poll, sparse v2 set
responses, delayed/rejected state writes, a command during ongoing response
processing, and phase status. Six selected regression criteria fail with the
unmodified base and pass with this change. The test source can be pointed at a
separately saved base file for comparison:

```sh
GOE_SOURCE_FILE=/absolute/path/to/base-main.js node --test \
  --test-name-pattern='older V1|pre-command|older write responses|later poll supersedes|V2 write fences|phase status polls' \
  test/regression/status-response-order.test.cjs
```

These tests verify the ordering contract only. Real device/integration acceptance
and a release remain separate maintainer decisions. No version bump is included.
