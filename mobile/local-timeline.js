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
    CREATE TABLE IF NOT EXISTS backend_audit_refs (
      audit_id TEXT PRIMARY KEY NOT NULL,
      saved_at TEXT NOT NULL
    );
  `);
  return db;
}

export async function listBackendAuditIds() {
  const db = await initializeLocalTimeline();
  const rows = await db.getAllAsync(
    'SELECT audit_id FROM backend_audit_refs ORDER BY saved_at DESC',
  );
  return rows.map(row => row.audit_id);
}

export async function saveBackendAuditId(auditId) {
  if (typeof auditId !== 'string' || !auditId.trim()) {
    throw new Error('A valid backend audit ID is required.');
  }
  const db = await initializeLocalTimeline();
  await db.runAsync(
    'INSERT OR IGNORE INTO backend_audit_refs (audit_id, saved_at) VALUES (?, ?)',
    auditId.trim(),
    new Date().toISOString(),
  );
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

export async function refreshLocalNotifications(audits = []) {
  if (Platform.OS === 'web') return;
  const permission = await Notifications.getPermissionsAsync();
  const permitted = permission.granted;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of existing) {
    if (notification.content.data?.scope === 'claimpulse-deadline') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
  if (!permitted) return;
  for (const item of audits) {
    if (item.status === 'resolved') continue;
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
            data: { scope: 'claimpulse-deadline', auditId: item.audit_id, field },
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
