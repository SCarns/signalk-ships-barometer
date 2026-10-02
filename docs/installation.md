# Installation and migration

Ship's Barometer is a separate plugin (`signalk-ships-barometer`) with a separate settings/data directory. The release tarball contains its runtime dependencies. It preserves the old forecast paths for existing displays, not the old plugin ID.

1. Keep your normal Signal K settings/data backup.
2. Install the release tarball from the Signal K user directory.
3. Disable the original **Barometer Trend** plugin; both must not publish concurrently.
4. Restart Signal K and enable **Ship's Barometer**. Re-enter the desired pressure sample rate and altitude correction because settings belong to the new plugin ID.
5. Enable **Local weather assessment** if wanted. Inspect `environment.outside.weather.assessment` in Data Browser; new fields do not automatically create dashboard widgets.

The old plugin's history/configuration are not deleted or silently copied. With a new data directory, forecast history and the optional assessment start filling from new observations. If retaining history is important, stop both plugins and copy the old plugin data directory's `offline.json` into the new plugin's data directory; optional assessment history is `local-assessment.json`. Locate the actual directories from your Signal K installation instead of assuming a path. Only copy your own local history, not a package's empty `offline.json`. The saved file formats remain compatible with the tested local `2.3.4-tbd.3` build; legacy radians are converted once on loading.

## Assessment sources

Use exact IDs from Data Browser. In the development boat's archive, useful IDs were pressure/temperature **Outside**, true wind **AdvancedWind**, and humidity **signalk-node-red**. These are installation-specific suggestions, not defaults or proof of current IDs.

The water input is `environment.water.temperature`. Select the speed transducer's source if several local water sources exist. For a sensor two feet below the surface, enter **0.6096** in the water-depth field. Leave depth unset when unknown; the assessment does not claim to measure surface temperature.

Freshness limits: wind five minutes; air temperature, humidity and supplied dew point ten minutes; pressure twenty-five minutes; water thirty minutes. Original timestamps/source IDs are required. Pressure/wind comparisons use trailing thirty-minute medians and require continuity with no gaps over ten minutes. Expect roughly ninety minutes for wind-change history and three and a half hours for pressure-change history.

Temperature/humidity and supplied dew point must agree in time within two minutes. A supplied dew point above air temperature by over 0.5 °C, or disagreeing with the synchronized local temperature/humidity estimate by over 2 °C, is flagged. Moisture/fog context then becomes unknown. These are experimental quality thresholds, not calibrated sensor specifications.

`fogContext: cooling_to_saturation_possible` means air is warmer than measured water and measured water is at/below the usable air dew point. It depends on surface water being similar to the transducer measurement. Fog is not confirmed. `cooling_to_saturation_not_indicated` concerns only this mechanism, not all possible fog types.

## Rollback

Disable Ship's Barometer and re-enable the old plugin. Its original settings/data remain in its separate directory. Do not enable both simultaneously. Returning to stock 2.3.4 after using corrected degree history requires restoring the old pre-correction history or waiting for that mixed history to expire; a corrected `2.3.4-tbd.*` version is the cleaner rollback baseline.

If npm reports a missing tarball for another installed plugin, restore that plugin's referenced tarball or repair its dependency reference first. npm resolves the shared dependency list during installation even when installing a different plugin.
