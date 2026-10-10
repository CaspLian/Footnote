import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { daysUntil, listBackendAuditIds, refreshLocalNotifications, requestLocalAlertPermission, saveBackendAuditId } from './local-timeline';
import { createTigerDataApi } from './tigerdata-api.cjs';

const tigerDataApi = createTigerDataApi();

const today = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function dateIsValid(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function Countdown({ label, date, daysRemaining }) {
  const days = daysRemaining ?? daysUntil(date);
  const text = days < 0 ? `${Math.abs(days)} days past estimate` : days === 0 ? 'Estimated date is today' : `${days} days remaining`;
  return <View style={styles.countdown}><Text style={styles.countdownLabel}>{label}</Text><Text style={styles.date}>{date}</Text><Text style={styles.countdownText}>{text}</Text></View>;
}

export default function App() {
  const [backendAudits, setBackendAudits] = useState([]);
  const [provider, setProvider] = useState('');
  const [serviceDate, setServiceDate] = useState(today());
  const [receivedDate, setReceivedDate] = useState(today());
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState(null);

  const reload = useCallback(async () => {
    const auditIds = await listBackendAuditIds();
    const audits = await Promise.all(auditIds.map(id => tigerDataApi.getAudit(id)));
    setBackendAudits(audits);
    await refreshLocalNotifications(audits);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (error) {
        Alert.alert('Could not load cases', error.message);
      }
    })();
  }, [reload]);

  async function scanBill() {
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) return;

      const image = selection.assets[0];
      setUploading(true);
      const mimeType = image.mimeType || (
        image.name?.toLowerCase().endsWith('.png')
          ? 'image/png'
          : image.name?.toLowerCase().endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg'
      );
      const response = await tigerDataApi.uploadBill({
        uri: image.uri,
        name: image.name || 'bill-image',
        type: mimeType,
      });
      const auditId = response.audit?.audit_id;
      if (!auditId) throw new Error('The backend response did not include a saved audit ID.');
      await saveBackendAuditId(auditId);
      let reminderNotice = '';
      try {
        await requestLocalAlertPermission();
      } catch (error) {
        reminderNotice = ` Reminders could not be enabled: ${error.message}`;
      }
      await reload();
      Alert.alert('Bill analyzed', `The analysis and audit were saved through the backend. You can now view the audit timeline below.${reminderNotice}`);
    } catch (error) {
      Alert.alert('Could not analyze bill', error.message);
    } finally {
      setUploading(false);
    }
  }

  async function startDispute(auditId) {
    try {
      await tigerDataApi.updateStatus(auditId, 'dispute_in_progress');
      await reload();
    } catch (error) {
      Alert.alert('Could not update audit', error.message);
    }
  }

  async function logAuditAction(auditId, action, note) {
    try {
      await tigerDataApi.addAction(auditId, action, note);
      await reload();
    } catch (error) {
      Alert.alert('Could not log action', error.message);
    }
  }

  async function resolveAudit(auditId) {
    try {
      await tigerDataApi.updateStatus(auditId, 'resolved');
      await reload();
    } catch (error) {
      Alert.alert('Could not resolve case', error.message);
    }
  }

  async function addCase() {
    if (!provider.trim()) return Alert.alert('Add a provider', 'Enter the hospital or billing provider name.');
    if (!dateIsValid(serviceDate) || !dateIsValid(receivedDate)) return Alert.alert('Check the dates', 'Enter dates in YYYY-MM-DD format.');
    try {
      if (paymentDueDate && !dateIsValid(paymentDueDate)) return Alert.alert('Check the payment date', 'Enter a real date in YYYY-MM-DD format, or leave it blank.');
      const audit = await tigerDataApi.createManualCase({
        provider_name: provider.trim(),
        service_date: serviceDate,
        bill_received_date: receivedDate,
        payment_due_date: paymentDueDate || null,
      });
      if (!audit.audit_id) throw new Error('The backend response did not include a saved case ID.');
      await saveBackendAuditId(audit.audit_id);
      setProvider('');
      setPaymentDueDate('');
      let reminderNotice = '';
      try {
        await requestLocalAlertPermission();
      } catch (error) {
        reminderNotice = ` Reminders could not be enabled: ${error.message}`;
      }
      await reload();
      Alert.alert('Case saved', `Your case, deadlines, and timeline are saved through the backend in Tiger Data.${reminderNotice}`);
    } catch (error) {
      Alert.alert('Could not save case', error.message);
    }
  }

  async function saveDate() {
    if (!edit) return;
    const clearingOptionalDate = edit.field === 'payment_due_date' && edit.value.trim() === '';
    if (!clearingOptionalDate && !dateIsValid(edit.value)) return Alert.alert('Check the date', 'Enter a real date in YYYY-MM-DD format.');
    try {
      await tigerDataApi.updateDeadlines(edit.auditId, {
        [edit.field]: clearingOptionalDate ? null : edit.value,
      });
      setEdit(null);
      await reload();
    } catch (error) {
      Alert.alert('Could not update deadline', error.message);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>CLAIMPULSE · BILL AUDIT</Text>
        <Text style={styles.title}>Your bill timeline</Text>
        <Text style={styles.intro}>Scanned bills and manually added cases are saved through the backend in Tiger Data. The phone stores audit IDs for rediscovery and can schedule local deadline reminders.</Text>

        <View style={styles.panel}>
          <Text style={styles.heading}>Scan a bill for an audit</Text>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={scanBill} disabled={uploading}>
            <Text style={styles.primaryText}>{uploading ? 'Analyzing bill…' : 'Choose bill photo'}</Text>
          </Pressable>
          <Text style={styles.privacy}>The selected image is sent to the backend for Gemini analysis. Extracted audit details and timeline events are stored by the backend in Tiger Data.</Text>
        </View>

        <Text style={styles.heading}>Cases · Tiger Data</Text>
        <Pressable accessibilityRole="button" onPress={reload}><Text style={styles.link}>Refresh cases</Text></Pressable>
        {backendAudits.length === 0 ? <Text style={styles.empty}>No cases saved by this phone yet.</Text> : backendAudits.map(audit => (
          <View key={audit.audit_id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.provider}>{audit.provider?.name || 'Medical provider'}</Text>
                <Text style={styles.muted}>Service {audit.service_date || 'date unavailable'} · {audit.audit_id}</Text>
              </View>
              <Text style={styles.status}>{audit.status.replaceAll('_', ' ')}</Text>
            </View>
            {audit.case_type === 'manual_case'
              ? <Text style={styles.muted}>Manual tracking case · no bill analysis performed</Text>
              : <Text style={styles.muted}>Billed {audit.currency} {audit.total_billed} · Potential difference {audit.currency} {audit.overcharge_total}</Text>}
            {audit.payment_due_date ? <Countdown label="Payment due · from the bill or notice" date={audit.payment_due_date} /> : null}
            <Pressable accessibilityRole="button" onPress={() => setEdit({ auditId: audit.audit_id, field: 'payment_due_date', value: audit.payment_due_date || '' })}><Text style={styles.link}>{audit.payment_due_date ? 'Edit payment due date' : 'Add payment due date from a notice'}</Text></Pressable>
            {audit.collection_deadline ? <Countdown label={audit.collection_deadline_is_estimate ? 'Estimated collections date' : 'Collections date'} date={audit.collection_deadline} daysRemaining={audit.collection_days_remaining} /> : null}
            {audit.collection_deadline ? <Pressable accessibilityRole="button" onPress={() => setEdit({ auditId: audit.audit_id, field: 'collection_deadline', value: audit.collection_deadline })}><Text style={styles.link}>Edit collections date</Text></Pressable> : null}
            {audit.credit_warning_date ? <Countdown label={audit.credit_warning_date_is_estimate ? 'Estimated credit warning date' : 'Credit warning date'} date={audit.credit_warning_date} daysRemaining={audit.credit_warning_days_remaining} /> : null}
            {audit.credit_warning_date ? <Pressable accessibilityRole="button" onPress={() => setEdit({ auditId: audit.audit_id, field: 'credit_warning_date', value: audit.credit_warning_date })}><Text style={styles.link}>Edit credit warning date</Text></Pressable> : null}
            {['open', 'audit_complete'].includes(audit.status) ? <Pressable accessibilityRole="button" onPress={() => startDispute(audit.audit_id)}><Text style={styles.link}>Start dispute · save status to Tiger Data</Text></Pressable> : null}
            {audit.status !== 'resolved' ? <>
              <Pressable accessibilityRole="button" onPress={() => logAuditAction(audit.audit_id, 'Called provider', 'Logged from the mobile app.')}><Text style={styles.link}>Log a provider call</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => logAuditAction(audit.audit_id, 'Overcharge flagged', 'Marked for follow-up by the user.')}><Text style={styles.link}>Record charge flagged</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => logAuditAction(audit.audit_id, 'Dispute letter generated', 'Recorded from the mobile app.')}><Text style={styles.link}>Record letter generated</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => resolveAudit(audit.audit_id)}><Text style={styles.link}>Mark resolved · save status to Tiger Data</Text></Pressable>
            </> : null}
            <Text style={styles.timelineTitle}>Audit trail · from Tiger Data</Text>
            {(audit.events || []).map((event, index) => <View key={`${event.event_type}-${event.occurred_at}-${index}`} style={styles.event}><Text style={styles.eventTitle}>{event.event_type.replaceAll('_', ' ')}</Text><Text style={styles.muted}>{event.occurred_at}</Text>{event.details?.action ? <Text style={styles.muted}>{event.details.action}</Text> : null}{event.details?.note ? <Text style={styles.muted}>{event.details.note}</Text> : null}</View>)}
          </View>
        ))}

        <View style={styles.panel}>
          <Text style={styles.heading}>Add a manual case</Text>
          <TextInput style={styles.input} value={provider} onChangeText={setProvider} placeholder="Hospital or provider" accessibilityLabel="Hospital or provider" />
          <TextInput style={styles.input} value={serviceDate} onChangeText={setServiceDate} placeholder="Service date · YYYY-MM-DD" accessibilityLabel="Service date YYYY-MM-DD" />
          <TextInput style={styles.input} value={receivedDate} onChangeText={setReceivedDate} placeholder="Bill received · YYYY-MM-DD" accessibilityLabel="Bill received date YYYY-MM-DD" />
          <TextInput style={styles.input} value={paymentDueDate} onChangeText={setPaymentDueDate} placeholder="Payment due date from bill · optional" accessibilityLabel="Payment due date from bill, optional" />
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={addCase}><Text style={styles.primaryText}>Save case to Tiger Data</Text></Pressable>
          <Text style={styles.privacy}>The backend saves the case, dates, and timeline in Tiger Data. Manual cases are not analyzed for charges.</Text>
          <Text style={styles.privacy}>Allow notifications to receive reminders on this phone. You can also change this in your phone's app notification settings.</Text>
        </View>

        {edit ? <View style={styles.modal}>
          <Text style={styles.heading}>Edit deadline</Text>
          <TextInput style={styles.input} value={edit.value} onChangeText={value => setEdit({ ...edit, value })} accessibilityLabel="Estimated date YYYY-MM-DD" />
          <View style={styles.actions}><Pressable style={styles.primaryButton} onPress={saveDate}><Text style={styles.primaryText}>Save date</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => setEdit(null)}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
        </View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f4' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 56, maxWidth: 720, width: '100%', alignSelf: 'center', gap: 14 },
  eyebrow: { color: '#39705e', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#172a25', fontSize: 32, fontWeight: '700' },
  intro: { color: '#53635e', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  panel: { backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 10, marginBottom: 12 },
  heading: { color: '#172a25', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  input: { minHeight: 48, borderColor: '#d6dfda', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, color: '#172a25', backgroundColor: '#fff' },
  primaryButton: { backgroundColor: '#225f4d', paddingHorizontal: 16, minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  privacy: { color: '#53635e', fontSize: 12, lineHeight: 18 },
  empty: { color: '#53635e', backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  muted: { color: '#667570', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 12, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  provider: { fontSize: 18, fontWeight: '700', color: '#172a25', marginBottom: 4 },
  status: { color: '#225f4d', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  countdown: { backgroundColor: '#f4f6f4', borderRadius: 10, padding: 12, gap: 3 },
  countdownLabel: { color: '#53635e', fontSize: 12, fontWeight: '600' },
  date: { color: '#172a25', fontSize: 16, fontWeight: '700' },
  countdownText: { color: '#225f4d', fontSize: 14 },
  link: { color: '#225f4d', fontSize: 14, fontWeight: '700', paddingVertical: 4 },
  timelineTitle: { color: '#172a25', fontSize: 16, fontWeight: '700', marginTop: 8 },
  event: { borderLeftColor: '#96b4a8', borderLeftWidth: 2, paddingLeft: 10, gap: 2 },
  eventTitle: { color: '#172a25', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryButton: { borderColor: '#aebdb6', borderWidth: 1, borderRadius: 10, minHeight: 42, paddingHorizontal: 12, justifyContent: 'center' },
  secondaryText: { color: '#225f4d', fontWeight: '700' },
  modal: { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#d6dfda' },
});
