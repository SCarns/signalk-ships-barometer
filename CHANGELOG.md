# Changes

## 0.3.0 (unpublished)

- Show wind-direction, pressure-only and seasonal forecasts separately using their existing published fields; distinguish measured conditions from forecasts without changing calculations.
- Remove the experimental Weather API comparison. No external forecast requests, comparison storage or provider settings remain in this build.

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
