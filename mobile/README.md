# ClaimPulse mobile

## Local bill timeline and deadline reminders

The timeline in this branch is stored in the app's encrypted, on-device SQLite database (`claimpulse-local.db`). Its encryption key is stored in the device's secure storage. Provider names, service and received dates, estimated deadlines, status changes, and timeline events are not submitted to the backend or Tiger Data. Tiger Data remains available for non-patient benchmark data only.

When you add a bill, the app starts two editable estimates:

- Collections date: 120 days after the bill received date.
- Credit warning date: 180 days after the service date.
- Payment due date: optional, entered from the bill or notice; the app does not guess it.

The two calculated dates are planning estimates, not a statement of a legal or billing deadline. Confirm dates against the actual bill or notice. The app schedules local phone notifications 30, 14, 7, and 1 day before each saved date and on the date itself. Notifications require device permission; they are scheduled on the phone and do not require backend push notifications.

### Run on an Android phone

1. From `mobile/`, install dependencies with `npm install`.
2. Connect the phone and enable USB debugging, or start an Android emulator.
3. Run `npx expo run:android` to build and install the development app. SQLCipher encryption is not supported in Expo Go, so use this development build.
4. Add a synthetic bill, allow notifications, and verify the case stays visible after closing and reopening the app.
5. Set one or both dates a few days ahead and verify the notification appears at the configured reminder time. You can also use an emulator; don't use real patient data for a demo.

The date estimates are editable in the timeline. Marking a case resolved cancels that case's pending deadline notifications.
