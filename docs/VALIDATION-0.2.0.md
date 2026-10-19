# 0.2.0 local validation

- `npm test`: 76 passing tests, including the inherited forecast, input, assessment and wind-unit suites.
- New history tests verify minute and 72-hour bounds, invalid timestamps, stale current data, source locking, persistence, pruning, corrupt files, write failure/retry, real three-hour baselines and chart gap splitting.
- Integration test verifies the local vessel subscription, endpoint range validation, stopped status, orderly save and restart restoration.
- `barometer.js`, `map.js`, `assessment.js`, `meta.json` and runtime dependencies remain unchanged from repository commit `3ca70df`.
- Browser inspection uses explicitly synthetic data, including a pressure outage; it does not establish sensor accuracy or onboard forecasting performance.
- Theme tests confirm vessel-based Auto rules and manual overrides match Endurance. Phone browser checks confirm the manual cycle and 48-hour range selection.
- External forecasts and database connections are absent.

## Aboard acceptance

1. Back up the existing plugin data directory and configuration, then install the local tarball and restart Signal K.
2. Enable the plugin. Check its displayed pressure source against your onboard sensor. Select an exact source in Plugin Config if necessary.
3. Verify current pressure, existing forecast/tendency and all four chart ranges. Check phone and helm displays with Day, Night, Red and Auto themes.
4. Leave the plugin collecting for three hours; check its measured delta once a real baseline is available.
5. Stop the pressure feed for at least five minutes. Verify stale status, hidden current readings and a visible chart gap after observations resume.
6. Restart Signal K; confirm timestamps and recorded points survive. A sudden power loss may lose up to three minutes.
7. Compare existing Signal K forecast outputs with your prior build. The recorder never supplies inputs to the forecast engine.

Initial onboard review on TBD: the user confirmed normal use after letting the build run and supplied a 24-hour history screenshot on October 18, 2026. This establishes onboard operation and historical collection, not forecast accuracy or completion of every acceptance check.
