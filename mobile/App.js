import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { addLocalCase, daysUntil, listLocalCases, recordLocalEvent, refreshLocalNotifications, requestLocalAlertPermission, updateLocalDeadline, updateLocalStatus } from './local-timeline';

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

function Countdown({ label, date }) {
  const days = daysUntil(date);
  const text = days < 0 ? `${Math.abs(days)} days past estimate` : days === 0 ? 'Estimated date is today' : `${days} days remaining`;
  return <View style={styles.countdown}><Text style={styles.countdownLabel}>{label}</Text><Text style={styles.date}>{date}</Text><Text style={styles.countdownText}>{text}</Text></View>;
}

export default function App() {
  const [cases, setCases] = useState([]);
  const [provider, setProvider] = useState('');
  const [serviceDate, setServiceDate] = useState(today());
  const [receivedDate, setReceivedDate] = useState(today());
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [busy, setBusy] = useState(true);
  const [edit, setEdit] = useState(null);

  const reload = useCallback(async () => {
    setCases(await listLocalCases());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await reload();
        await refreshLocalNotifications();
      } catch {
        Alert.alert('Could not open local timeline', 'The on-device database could not be initialized.');
      } finally {
        setBusy(false);
      }
    })();
  }, [reload]);

  async function addCase() {
    if (!provider.trim()) return Alert.alert('Add a provider', 'Enter the hospital or billing provider name.');
    if (!dateIsValid(serviceDate) || !dateIsValid(receivedDate)) return Alert.alert('Check the dates', 'Enter dates in YYYY-MM-DD format.');
    try {
      if (paymentDueDate && !dateIsValid(paymentDueDate)) return Alert.alert('Check the payment date', 'Enter a real date in YYYY-MM-DD format, or leave it blank.');
      await addLocalCase({ provider, serviceDate, receivedDate, paymentDueDate });
      setProvider('');
      setPaymentDueDate('');
      await requestLocalAlertPermission();
      await refreshLocalNotifications();
      await reload();
      Alert.alert('Saved on this phone', 'Your case and timeline are stored on this device. Tiger Data does not receive these details.');
    } catch {
      Alert.alert('Could not save', 'The case could not be saved to this phone.');
    }
  }

  async function saveDate() {
    if (!edit) return;
    const clearingOptionalDate = edit.field === 'payment_due_date' && edit.value.trim() === '';
    if (!clearingOptionalDate && !dateIsValid(edit.value)) return Alert.alert('Check the date', 'Enter a real date in YYYY-MM-DD format.');
    try {
      await updateLocalDeadline(edit.caseId, edit.field, clearingOptionalDate ? null : edit.value);
      setEdit(null);
      await reload();
    } catch {
      Alert.alert('Could not update', 'The date could not be saved on this phone.');
    }
  }

  async function changeStatus(item, status) {
    try {
      await updateLocalStatus(item.id, status);
      await reload();
    } catch {
      Alert.alert('Could not update', 'The timeline could not be updated on this phone.');
    }
  }

  async function addEvent(item, eventType, details) {
    try {
      await recordLocalEvent(item.id, eventType, details);
      await reload();
    } catch {
      Alert.alert('Could not record action', 'The event could not be saved on this phone.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>CLAIMPULSE · PRIVATE ON-DEVICE TRACKING</Text>
        <Text style={styles.title}>Your bill timeline</Text>
        <Text style={styles.intro}>Keep bill dates and actions on this phone. Countdown dates are estimates; verify actual deadlines on your bill or notice.</Text>

        <View style={styles.panel}>
          <Text style={styles.heading}>Add a bill</Text>
          <TextInput style={styles.input} value={provider} onChangeText={setProvider} placeholder="Hospital or provider" accessibilityLabel="Hospital or provider" />
          <TextInput style={styles.input} value={serviceDate} onChangeText={setServiceDate} placeholder="Service date · YYYY-MM-DD" accessibilityLabel="Service date YYYY-MM-DD" />
          <TextInput style={styles.input} value={receivedDate} onChangeText={setReceivedDate} placeholder="Bill received · YYYY-MM-DD" accessibilityLabel="Bill received date YYYY-MM-DD" />
          <TextInput style={styles.input} value={paymentDueDate} onChangeText={setPaymentDueDate} placeholder="Payment due date from bill · optional" accessibilityLabel="Payment due date from bill, optional" />
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={addCase}><Text style={styles.primaryText}>Save on this phone</Text></Pressable>
          <Text style={styles.privacy}>No provider, service date, bill date, status, or timeline event from this screen is sent to the backend.</Text>
          <Text style={styles.privacy}>Allow notifications when prompted to receive on-phone reminders. You can also change this in your phone's app notification settings.</Text>
        </View>

        <Text style={styles.heading}>Tracked bills</Text>
        {busy ? <Text style={styles.muted}>Loading on-device records…</Text> : cases.length === 0 ? <Text style={styles.empty}>No bills yet. Add one above to start a private timeline.</Text> : cases.map(item => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}><View style={{ flex: 1 }}><Text style={styles.provider}>{item.provider}</Text><Text style={styles.muted}>Service {item.service_date} · Received {item.received_date}</Text></View><Text style={styles.status}>{item.status.replaceAll('_', ' ')}</Text></View>
            {item.payment_due_date ? <><Countdown label="Payment due · from your bill or notice" date={item.payment_due_date} /><Pressable accessibilityRole="button" onPress={() => setEdit({ caseId: item.id, field: 'payment_due_date', value: item.payment_due_date })}><Text style={styles.link}>Edit payment due date</Text></Pressable></> : <Pressable accessibilityRole="button" onPress={() => setEdit({ caseId: item.id, field: 'payment_due_date', value: '' })}><Text style={styles.link}>Add payment due date from a notice</Text></Pressable>}
            <Countdown label="Estimated collections date · 120 days after receipt" date={item.collection_deadline} />
            <Pressable accessibilityRole="button" onPress={() => setEdit({ caseId: item.id, field: 'collection_deadline', value: item.collection_deadline })}><Text style={styles.link}>Edit collections estimate</Text></Pressable>
            <Countdown label="Estimated credit warning · 180 days after service" date={item.credit_warning_date} />
            <Pressable accessibilityRole="button" onPress={() => setEdit({ caseId: item.id, field: 'credit_warning_date', value: item.credit_warning_date })}><Text style={styles.link}>Edit credit warning estimate</Text></Pressable>

            <Text style={styles.timelineTitle}>Audit trail · stored on phone</Text>
            {item.events.map(event => <View key={event.id} style={styles.event}><Text style={styles.eventTitle}>{event.event_type.replaceAll('_', ' ')}</Text><Text style={styles.muted}>{new Date(event.occurred_at).toLocaleString()}</Text><Text style={styles.muted}>{event.details}</Text></View>)}
            <View style={styles.actions}>
              {item.status !== 'resolved' ? <Pressable style={styles.secondaryButton} onPress={() => addEvent(item, 'overcharge_flagged', 'Marked for follow-up by the user')}><Text style={styles.secondaryText}>Record charge flagged</Text></Pressable> : null}
              {item.status !== 'resolved' ? <Pressable style={styles.secondaryButton} onPress={() => addEvent(item, 'dispute_letter_generated', 'Dispute letter generated')}><Text style={styles.secondaryText}>Record letter generated</Text></Pressable> : null}
              {item.status === 'open' ? <Pressable style={styles.secondaryButton} onPress={() => changeStatus(item, 'dispute_in_progress')}><Text style={styles.secondaryText}>Mark dispute started</Text></Pressable> : null}
              {item.status !== 'resolved' ? <Pressable style={styles.secondaryButton} onPress={() => changeStatus(item, 'resolved')}><Text style={styles.secondaryText}>Mark resolved</Text></Pressable> : null}
            </View>
          </View>
        ))}

        {edit ? <View style={styles.modal}>
          <Text style={styles.heading}>Edit estimated date</Text>
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
