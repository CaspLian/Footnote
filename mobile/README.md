# ClaimPulse mobile

## Bill audits and deadline reminders

Scanned bills and manually entered tracking cases use the backend API. Scans are sent to Gemini for extraction; both flows save the case, deadlines, status, and timeline in Tiger Data. The app keeps only audit IDs in encrypted, on-device SQLite so it can fetch the current audit and event timeline from the backend when it opens or is refreshed. Deadline edits and status/action changes are also sent to the backend. The phone does not connect directly to Tiger Data.

The app no longer creates or displays phone-only cases. Older local-only cases from previous app builds are left untouched in the encrypted database and are not automatically migrated; re-enter them as manual cases if needed.

To point the app at a backend, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`. Use the computer's LAN IP address for a physical phone; `localhost` on a phone refers to the phone itself. The Android emulator can use `http://10.0.2.2:8000`. Keep database credentials and other secrets on the backend; `EXPO_PUBLIC_` values are included in the app bundle.

**Prototype only:** the current backend audit routes do not authenticate users. Do not connect this app to real patient bills or deploy it publicly until authentication and per-user audit access are implemented.

This branch's backend scan route currently accepts one JPEG, PNG, or WebP image per request. It does not yet accept a PDF or multiple page images. Manually entered cases are tracking records; they are not analyzed for charges.

The backend creates two editable deadline estimates when the source dates are available:

- Collections date: 120 days after the bill received date.
- Credit warning date: 180 days after the service date.
- Payment due date: optional, entered from the bill or notice; the app does not guess it.

The two calculated dates are planning estimates, not a statement of a legal or billing deadline. Confirm dates against the actual bill or notice. The app schedules local phone notifications from Tiger Data's saved dates 30, 14, 7, and 1 day before each date and on the date itself. Notifications require device permission and are scheduled on the phone; the deadline values and edits remain in Tiger Data.

### Run on an Android phone

1. From `mobile/`, install dependencies with `npm install`.
2. Connect the phone and enable USB debugging, or start an Android emulator.
3. Run `npx expo run:android` to build and install the development app. SQLCipher encryption is not supported in Expo Go, so use this development build.
4. Add a synthetic case or bill, allow notifications, and verify the case stays visible after closing and reopening the app.
5. Set one or both dates a few days ahead and verify the notification appears at the configured reminder time. You can also use an emulator; don't use real patient data for a demo.

The date estimates are editable in the timeline. Marking a case resolved cancels that case's pending deadline notifications.
