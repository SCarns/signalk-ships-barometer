# Changes

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
