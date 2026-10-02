# Publishing Ship's Barometer to the Signal K store

Signal K discovers plugins published to npm with the `signalk-node-server-plugin` keyword. Ship's Barometer already has that keyword, the weather category, its own package name (`signalk-ships-barometer`), display name and app icon metadata. GitHub publication alone does not make it available in the store.

The first release tarball is ready for npm publication. It installed offline and passed all 64 tests against the installed artifact. Its publish dry run succeeded. The development machine is not currently authenticated to npm; actual publication was not attempted with missing credentials.

## First publication

Use your own npm account, with publishing authentication/2FA configured. Download the exact release tarball to a computer with npm, then from the directory containing it:

```sh
npm login
npm whoami
npm publish ./signalk-ships-barometer-0.1.0.tgz --access public
npm view signalk-ships-barometer version
```

Complete npm's browser/login and publishing authentication prompts yourself; do not paste passwords or tokens into chat. The account that publishes first owns the npm package. The name was unclaimed at the pre-release registry check, but this can change until publication succeeds.

After successful publication, the store can discover the package through its npm metadata. Refresh/reopen the Signal K store and search for **Ship's Barometer**; index/cache refresh may not be immediate. Confirm it is published by your account and links to `SCarns/signalk-ships-barometer`.

Disable the old Barometer Trend plugin before enabling the new one, because both publish the legacy pressure/forecast paths. Existing dashboard paths are retained; settings/data belong to a separate plugin ID. See the GitHub README for migration.

## Future releases

Update the package/lockfile version, add release notes, run the tests and verify a fresh package install. Publish the resulting new version; npm does not allow replacing a previously published name/version. Create the matching GitHub release. Automated npm publishing can be configured later using npm's supported authentication/trusted-publishing setup; this release does not store an npm secret or enable unattended publishing.

References: [Signal K plugin registry/discovery](https://github.com/SignalK/signalk-plugin-registry), [npm publication authentication](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).
