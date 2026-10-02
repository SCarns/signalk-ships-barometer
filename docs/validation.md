# Validation and limits

The local `signalk-barometer-trend@2.3.4-tbd.3` foundation passed 61 tests and an offline tarball installation. Ship's Barometer reuses that foundation with a new package/plugin identity, generic source settings, configurable water-sensor depth, distribution metadata and malformed/irrelevant-delta guards. The independent release installed offline and passed all 64 tests against the installed tarball; its npm publishing dry run succeeded.

The assessment was previously replayed through 8,968 chronological, ten-minute archive bins. Those bins are aligned summaries, not original live timestamps or a gust record. No private boat telemetry is distributed with this repository.

A wind-angle replay reproduced 8,405 of 8,414 comparable archived outputs (99.89%) and changed 5,776 after radians-to-degrees conversion. That supports the integration diagnosis, not a claim of improved boat-local rain accuracy. Regional precipitation was a proxy; explicit local rainfall truth was not available.

Exploratory pressure/wind rules were unstable across chronology and decision-window alignment. Accordingly the optional assessment labels actual wind changes, with `windOutlook: uncalibrated`. It does not translate pressure into a promised future speed or alarm.

Water comparison tests cover warmer/colder water, stale/missing inputs, explicit depth, source selection, impossible/disagreeing dew point and timestamp preservation. No archived boat-water series or independent fog observations were available for a sea-temperature/fog performance score. Mixing and surface-temperature effects remain contextual hypotheses.

Software checks do not establish boat runtime. After installation verify plugin startup, source IDs, incoming original timestamps, the structured assessment in Data Browser, saved history files and archival behavior. Existing data collectors may need configuration to retain a structured object or its fields.

This independent codebase is derived from the published v2.3.4 lineage; it does not incorporate upstream main's unreleased interface/path restructuring. The working original forecast mapping is retained. An upstream pull request was prepared locally but was not submitted after the decision to release independently.
