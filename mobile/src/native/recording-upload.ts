import { File } from 'expo-file-system';
export async function recordingBlob(uri: string): Promise<Blob> { const file = new File(uri); return { name: 'question.m4a', size: file.size, type: 'audio/mp4', bytes: () => file.bytes() } as unknown as Blob; }
