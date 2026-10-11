import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { T } from '../theme';

const W = 58, H = 40;
const CX = 29, CY = 30, R = 24;
const RPM_MAX = 13000, RED = 11000;

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  // angles in degrees, 0 = left (-180° from CSS), sweep clockwise along bottom-up semicircle: -200° .. 20°
  const rad = (d: number) => (d * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** Compact steering-wheel style gauge: RPM arc + gear centre + speed digits. */
function TelemetryGauge({ speed, rpm, gear }: { speed?: number | null; rpm?: number | null; gear?: number | null }) {
  if (speed == null && rpm == null && (gear == null || gear <= 0)) return null;
  const spd = Math.max(0, Math.round(speed ?? 0));
  const rev = Math.max(0, Math.min(RPM_MAX, rpm ?? 0));
  const g = gear != null && gear > 0 ? String(gear) : 'N';
  // Arc from 200° to 340° (220° sweep) — open at bottom
  const A0 = 200, SWEEP = 140;
  const t = rev / RPM_MAX;
  const aEnd = A0 + SWEEP * t;
  const redStart = A0 + SWEEP * (RED / RPM_MAX);
  const rpmColor = rev >= RED ? '#ff3b30' : rev >= 9000 ? '#ffc04d' : '#4cd964';

  return (
    <View style={s.wrap} accessibilityLabel={`${spd} km/u, ${rev} tpm, versnelling ${g}`}>
      <Svg width={W} height={H}>
        {/* track */}
        <Path d={arc(CX, CY, R, A0, A0 + SWEEP)} stroke="#2a2a36" strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* red zone track */}
        <Path d={arc(CX, CY, R, redStart, A0 + SWEEP)} stroke="#5a1a1a" strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* rpm value */}
        {t > 0.02 && <Path d={arc(CX, CY, R, A0, aEnd)} stroke={rpmColor} strokeWidth={5} fill="none" strokeLinecap="round" />}
        {/* gear hub */}
        <Circle cx={CX} cy={CY - 6} r={10} fill="#111118" stroke="#3a3a48" strokeWidth={1.5} />
        <SvgText x={CX} y={CY - 2} fill="#fff" fontSize={11} fontWeight="800" textAnchor="middle">{g}</SvgText>
      </Svg>
      <Text style={s.spd}>{spd}<Text style={s.unit}> km/u</Text></Text>
    </View>
  );
}

export default memo(TelemetryGauge);

const s = StyleSheet.create({
  wrap: { width: W + 4, alignItems: 'center', marginLeft: 4 },
  spd: { color: T.text, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: -4 },
  unit: { color: T.dim, fontSize: 8, fontWeight: '600' },
});
