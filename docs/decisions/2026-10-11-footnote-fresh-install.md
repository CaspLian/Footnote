# Fresh Footnote installation

- Status: accepted; supersedes the installation/storage compatibility portion of the 2026-10-10 identity decision
- Date: 2026-10-11, America/New_York
- Requested by: Nimesh

Nimesh explicitly requested an emulator data wipe and said backward compatibility with the earlier name is no
longer needed. Use `org.hackknights.footnote` for Android and iOS and only Footnote storage keys, document
directories and browser document storage. Remove the earlier-name migration fallback. The testing emulator is
reset with the Android emulator's `-wipe-data` option and receives a fresh app installation.

This replaces the previous request to retain the app ID and migrate saved bills. The published `merged-v1`
snapshot remains unchanged; these updates belong to the integration branch. No team database, provider agent,
Git history or remote repository is reset or renamed by wiping the Android device.

## Update: app ID from merged-v1

Integrating `merged-v1` (commit 3ad973c) took Aarush's app ID, `footnote.compare`, for Android and iOS in place of
`org.hackknights.footnote`. The rest of this decision stands: Footnote-only storage keys, no earlier-name fallback,
fresh installs. A native build made before the merge still carries the old ID, so regenerate the native project
(`npx expo prebuild --clean`) before the next device install.
