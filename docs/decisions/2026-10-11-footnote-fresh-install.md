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
