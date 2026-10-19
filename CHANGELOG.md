# Changes

## 0.3.0

- Add an optional, default-off pressure comparison using only Signal K’s existing default Weather API provider. No new service, account, dependency or provider registration.
- Draw saved forecasts as a solid underlay and current future forecasts as a dotted line, with Now, provenance and issue times. Preserve boat observations in front.
- Require verifiable per-record issue times, recent position and fresh forecasts; omit unavailable/stale future data. Standard Weather API does not guarantee the required optional issuedAt metadata.
- Freeze original forecasts before their valid time, retain a bounded separate archive, and never backfill or revise historical predictions.
- Preserve onboard pressure, tendency, assessment and forecast calculations unchanged. Add comparison lifecycle, persistence, chart and isolation tests.

## 0.2.0

- Add an independent, minute-bounded pressure recorder with at most 72 hours / 4,320 samples, atomic persistence and automatic expiration.
- Add an offline responsive webapp with current pressure, measured three-hour delta, existing tendency and forecasts, and 6/12/24/48-hour charts with visible gaps.
- Add Day, Night, Red and vessel-based Auto themes, matching Endurance controls; retain browser theme choice.
- Show freshness, source and storage status; support an explicit history pressure source.
- Preserve barometer.js, map.js and assessment.js calculations unchanged. No external forecast overlay or database dependency.
- Version 0.2.0 follows the existing 0.1.0 release, replacing the provisional 1.5.0 plan.

## 0.1.0

Independent Ship's Barometer release, derived from oyve/signalk-barometer-trend v2.3.4.

- Convert Signal K true-wind angles from radians to normalized degrees; migrate legacy saved angles once without changing pressure history.
- Add opt-in, offline pressure/wind/moisture assessment with source IDs, original timestamps, history continuity and missing-data flags.
- Add transducer-depth water temperature context and conservative moisture-consistency checks.
- Keep all 21 legacy forecast paths; add one structured assessment path.
- Retain Derived Data as an optional dew-point provider and use synchronized local temperature/humidity as fallback.
- Add maritime barometer artwork, an independent package/plugin ID, explicit source/depth settings and install guidance.
- Guard malformed/irrelevant deltas and invalid pressure inputs.

Modified inherited files: index.js, barometer.js, package.json, schema.json, meta.json, README.md; new assessment.js and assessment/wind/water/lifecycle tests. The upstream mapping file and original LICENSE are retained. No forecast probability or new automatic alarm is introduced.
