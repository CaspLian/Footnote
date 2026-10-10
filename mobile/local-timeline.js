import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const databasePromise = (async () => {
  let key = await SecureStore.getItemAsync('claimpulse.local-database-key');
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), value => value.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync('claimpulse.local-database-key', key);
  }
  const db = await SQLite.openDatabaseAsync('claimpulse-local.db');
  await db.execAsync(`PRAGMA key = '${key}';`);
  return db;
})();
const offsets = [30, 14, 7, 1, 0];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function datePlusDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function daysUntil(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export async function initializeLocalTimeline() {
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_cases (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      service_date TEXT NOT NULL,
      received_date TEXT NOT NULL,
      payment_due_date TEXT,
      collection_deadline TEXT NOT NULL,
      credit_warning_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_timeline_events (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES local_cases(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL
    );
  `);
  const columns = await db.getAllAsync('PRAGMA table_info(local_cases)');
  if (!columns.some(column => column.name === 'payment_due_date')) {
    await db.execAsync('ALTER TABLE local_cases ADD COLUMN payment_due_date TEXT');
  }
  return db;
}

export async function listLocalCases() {
  const db = await initializeLocalTimeline();
  const cases = await db.getAllAsync('SELECT * FROM local_cases ORDER BY created_at DESC');
  const events = await db.getAllAsync('SELECT * FROM local_timeline_events ORDER BY occurred_at DESC');
  return cases.map(item => ({ ...item, events: events.filter(event => event.case_id === item.id) }));
}

async function recordEvent(db, caseId, eventType, details = '') {
  await db.runAsync(
    'INSERT INTO local_timeline_events (id, case_id, event_type, details, occurred_at) VALUES (?, ?, ?, ?, ?)',
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    caseId,
    eventType,
    details,
    new Date().toISOString(),
  );
}

export async function addLocalCase({ provider, serviceDate, receivedDate, paymentDueDate }) {
  const db = await initializeLocalTimeline();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO local_cases (id, provider, service_date, received_date, payment_due_date, collection_deadline, credit_warning_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      provider.trim(),
      serviceDate,
      receivedDate,
      paymentDueDate || null,
      datePlusDays(receivedDate, 120),
      datePlusDays(serviceDate, 180),
      new Date().toISOString(),
    );
    await recordEvent(db, id, 'bill_received', `Bill received ${receivedDate}`);
    if (paymentDueDate) await recordEvent(db, id, 'payment_due_date_added', `Payment due date from notice: ${paymentDueDate}`);
    await recordEvent(db, id, 'deadlines_estimated', 'Estimated from the dates entered; confirm against the bill or notice.');
  });
  return id;
}

export async function updateLocalDeadline(caseId, field, date) {
  if (!['payment_due_date', 'collection_deadline', 'credit_warning_date'].includes(field)) throw new Error('Invalid deadline field.');
  if (date === null && field !== 'payment_due_date') throw new Error('Only an optional payment date can be cleared.');
  const db = await initializeLocalTimeline();
  const current = await db.getFirstAsync('SELECT * FROM local_cases WHERE id = ?', caseId);
  if (!current) throw new Error('Case not found.');
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE local_cases SET ${field} = ? WHERE id = ?`, date, caseId);
    const label = field === 'payment_due_date' ? 'Payment due' : field === 'collection_deadline' ? 'Collections estimate' : 'Credit warning estimate';
    await recordEvent(db, caseId, date === null ? 'payment_due_date_removed' : 'deadline_edited', date === null ? 'Payment due date removed' : `${label} date changed to ${date}`);
  });
  await refreshLocalNotifications();
}

export async function recordLocalEvent(caseId, eventType, details) {
  if (!['overcharge_flagged', 'dispute_letter_generated'].includes(eventType)) throw new Error('Invalid event type.');
  const db = await initializeLocalTimeline();
  await recordEvent(db, caseId, eventType, details);
}

export async function updateLocalStatus(caseId, status) {
  if (!['open', 'dispute_in_progress', 'resolved'].includes(status)) throw new Error('Invalid case status.');
  const db = await initializeLocalTimeline();
  const current = await db.getFirstAsync('SELECT status FROM local_cases WHERE id = ?', caseId);
  if (!current) throw new Error('Case not found.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE local_cases SET status = ? WHERE id = ?', status, caseId);
    await recordEvent(db, caseId, 'status_changed', `${current.status} → ${status}`);
  });
  await refreshLocalNotifications();
}

export async function requestLocalAlertPermission() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bill-deadlines', {
      name: 'Bill deadline reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function refreshLocalNotifications() {
  if (Platform.OS === 'web') return;
  const permission = await Notifications.getPermissionsAsync();
  const permitted = permission.granted;
  const db = await initializeLocalTimeline();
  const cases = await db.getAllAsync("SELECT * FROM local_cases WHERE status != 'resolved'");
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of existing) {
    if (notification.content.data?.scope === 'claimpulse-deadline') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
  if (!permitted) return;
  for (const item of cases) {
    for (const [field, label] of [['payment_due_date', 'Payment due date'], ['collection_deadline', 'Estimated collections date'], ['credit_warning_date', 'Estimated credit warning date']]) {
      const deadline = item[field];
      if (!deadline) continue;
      const remaining = daysUntil(deadline);
      for (const offset of offsets) {
        if (remaining < offset || remaining <= 0 && offset !== 0) continue;
        const alertDate = new Date(`${datePlusDays(deadline, -offset)}T09:00:00`);
        if (alertDate.getTime() <= Date.now()) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: label,
            body: offset === 0 ? `The saved estimate is today (${deadline}). Check the actual notice.` : `${offset} day${offset === 1 ? '' : 's'} remain by this saved estimate. Open the app to review it.`,
            data: { scope: 'claimpulse-deadline', caseId: item.id, field },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: alertDate,
            ...(Platform.OS === 'android' ? { channelId: 'bill-deadlines' } : {}),
          },
        });
      }
    }
  }
}
