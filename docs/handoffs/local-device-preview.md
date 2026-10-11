# Local device preview instructions

- Status: done (documentation)
- Owner: Codex with Nimesh
- Branch: Backend-Frontend-Connection-V1
- Last updated: 2026-10-11

## Objective

Document the user's corrected sharing setup: testers clone Footnote, host the API
and Metro on their own computer, and use a phone on the same reachable Wi-Fi or
an Android emulator on that computer. Application code must remain untouched
while Claude works.

## Done

- Added `README-LOCAL-TESTING.md`, with Windows/macOS setup, server-side service
  requirements, phone/emulator addresses, native development build instructions,
  demo checks, and troubleshooting.
- Added a link from the repository README.
- Updated the external sharing plan to reflect local hosting instead of a public
  HTTPS deployment. The earlier hosting-account question is superseded.
- Read-only GitHub inspection confirmed `merged-v1` exists at `989ecf5` and has
  the native mobile client and four backend sample documents. Published `main`
  is older. The new local demo document pack was not present on `merged-v1` at
  inspection, so this guide links samples verified to exist there.
- Documented that the app's API URL is bundled environment configuration, with
  no runtime address editor, and that a generic standalone APK cannot select
  arbitrary testers' local backend addresses automatically.

## Verification

- Inspected the current backend routes/settings, mobile backend boundary,
  Settings screen, package scripts/configuration, agent provisioning and
  Snowflake loader. No provider keys were read or printed.
- Installed Expo CLI `start --help` and `run:android --help` confirmed the flags
  used for local Android/Metro instructions; these commands did not start servers.
- Checked documentation links/targets and the final documentation diff.
- No application tests, paid provider calls, fresh phone build or device journey
  were run for this documentation change. Earlier verification reports are
  separate evidence; this guide does not claim a new native test passed.

## Interfaces and source changes

Documentation only. No application code, environment files, dependencies, native
configuration, routes or database schemas were changed. Existing Claude changes
were preserved. No commit, push, deployment, release or APK upload was performed.

## Remaining

- Review and publish these documentation files on the desired sharing branch.
- A downloadable compatible development APK still needs packaging/verification
  if the team wants to save Android testers a local native compilation step.
- A standalone release APK for local HTTP needs address and platform network
  configuration verification. iPhone testing needs signing and a physical device.
