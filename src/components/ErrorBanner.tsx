import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { T } from '../theme';

export default function ErrorBanner({ msg, onRetry, hasData }: { msg?: string; onRetry?: () => void; hasData?: boolean }) {
  if (!msg) return null;
  return (
    <View style={s.box}>
      <Text style={s.title}>⚠︎ {hasData ? 'Live-updates gepauzeerd' : 'Gegevens niet beschikbaar'}</Text>
      <Text style={s.msg}>{msg}</Text>
      {onRetry && <Pressable onPress={onRetry} style={s.btn}><Text style={s.btnT}>Opnieuw proberen</Text></Pressable>}
    </View>
  );
}
const s = StyleSheet.create({
  box: { marginHorizontal: 10, marginVertical: 6, padding: 12, borderRadius: T.radius, backgroundColor: '#2a1a0a', borderWidth: 1, borderColor: '#7a4a10' },
  title: { color: '#ffc04d', fontWeight: '800', fontSize: 13 },
  msg: { color: '#f0d8b0', fontSize: 12, marginTop: 4, lineHeight: 17 },
  btn: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: T.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnT: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
