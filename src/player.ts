import { Platform } from 'react-native';
import { Audio } from 'expo-av';

type Done = () => void;
let webAudio: HTMLAudioElement | null = null;
let native: Audio.Sound | null = null;

export async function stop() {
  if (webAudio) { webAudio.pause(); webAudio = null; }
  if (native) { await native.unloadAsync().catch(() => {}); native = null; }
}
export async function play(url: string, onDone: Done) {
  await stop();
  if (Platform.OS === 'web') {
    const a = new (globalThis as any).Audio(url) as HTMLAudioElement;
    a.onended = onDone; a.onerror = onDone; webAudio = a;
    await a.play(); // must be called from a tap on iOS Safari
    return;
  }
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
  native = sound;
  sound.setOnPlaybackStatusUpdate(st => { if (st.isLoaded && st.didJustFinish) onDone(); });
}
