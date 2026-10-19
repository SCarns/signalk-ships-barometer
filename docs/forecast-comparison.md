# Weather API comparison contract

Version 0.3.0 uses only `app.weatherApi.getForecasts(position, 'point', {maxCount: 96})`
from the running Signal K server. It does not register a provider or contact an
external weather service directly. No credentials or service URLs are accepted.

The standard Weather API record has `type: "point"`, `date` (valid time), and optional
`outside.pressure` in Pa. For freshness this integration additionally requires
`issuedAt`, an ISO date-time with explicit timezone, on each record. That field is
optional provider metadata, not a guaranteed Weather API field. An optional string
`source` supplies a display label; otherwise the label is “Signal K default Weather
API provider”. Missing issue metadata means no comparison, never an assumed issue
time based on retrieval or valid time. No currently installed provider has been
verified aboard for these additional metadata requirements.

Accept only finite pressure from 80,000 through 110,000 Pa, a nonfuture issue time
at most six hours old, and future valid times no more than 48 hours ahead. Only the
newest issued run is displayed going forward. Limit to one actual supplied point
per valid hour. No values are resampled or filled. Lines break across source changes
or forecast gaps longer than three hours. The viewport displays at most 24 future
hours, limited further by the selected history duration.

Capture the first forecast received before each valid hour for that source and
location. Preserve its issue time, receipt time and requested position. Subsequent
runs cannot rewrite it. No historical Weather API observations or hindcasts are
imported. Each of the archive and latest collections is capped at 120 points; valid
times older than 72 hours expire. Requests use the boat position, requiring an
observation no more than five minutes old. Displayed points must be within 20 km.

`forecast-comparison.json` is separate from onboard history and analysis files.
Changed data is atomically replaced every three minutes and on orderly stop; abrupt
power loss may lose those three minutes. Restart restores archived comparisons but
requires a successful current provider request before showing future predictions.
Requests run every 15 minutes, time out after ten seconds, and do not overlap.
Provider failure hides future predictions; recorded historical predictions remain
available for comparison if the position is still relevant. Disabling the option
stops requests; an existing saved comparison file is not deleted.

Pressure reference is unspecified by the API. Do not treat forecast pressure as
sensor pressure, correct it to match the boat, or feed it to tendency, assessment,
alerts or forecast analysis. This release adds no pressure decision logic.

Software tests use synthetic provider responses. They verify behavior and isolation,
not live provider compatibility or forecast accuracy. Enable and check aboard
before deciding whether your configured provider offers a useful comparison.
