import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T } from '../theme';

const RPM_MAX = 13000, RED = 11000;

/** Compact, labelled telemetry: speed (main) + gear badge + RPM bar. */
function TelemetryGauge({ speed, rpm, gear }: { speed?: number | null; rpm?: number | null; gear?: number | null }) {
  if (speed == null && rpm == null && (gear == null || gear <= 0)) return null;
  const spd = Math.max(0, Math.round(speed ?? 0));
  const rev = Math.max(0, Math.min(RPM_MAX, rpm ?? 0));
  const g = gear != null && gear > 0 ? `V${gear}` : 'N';
  const pct = Math.min(100, (rev / RPM_MAX) * 100);
  const barColor = rev >= RED ? '#ff3b30' : rev >= 9000 ? '#ffc04d' : '#4cd964';
  const rpmLabel = rev >= 1000 ? `${(rev / 1000).toFixed(1)}k tpm` : `${rev} tpm`;

  return (
    <View style={s.wrap} accessibilityLabel={`Snelheid ${spd} km/u, versnelling ${g}, toerental ${rpmLabel}`}>
      <View style={s.top}>
        <Text style={s.spd}>{spd}<Text style={s.unit}> km/u</Text></Text>
        <View style={s.gear}><Text style={s.gearT}>{g}</Text></View>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` as `${number}%`, backgroundColor: barColor }]} />
        <View style={[s.redZone, { left: `${(RED / RPM_MAX) * 100}%` as `${number}%` }]} />
      </View>
      <Text style={s.rpmT}>{rpmLabel}</Text>
    </View>
  );
}

export default memo(TelemetryGauge);

const s = StyleSheet.create({
  wrap: { width: 80, marginLeft: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  spd: { color: T.text, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  unit: { color: T.dim, fontSize: 9, fontWeight: '600' },
  gear: { backgroundColor: '#1f1f2a', borderWidth: 1, borderColor: '#5a5a68', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  gearT: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#2a2a36', overflow: 'hidden', position: 'relative', marginTop: 3 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  redZone: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(255,59,48,0.28)' },
  rpmT: { color: T.dim, fontSize: 9, fontWeight: '700', marginTop: 1, fontVariant: ['tabular-nums'] },
});
