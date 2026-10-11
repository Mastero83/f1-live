import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { Driver } from '../api';
import { T, teamColour } from '../theme';

export default function DriverChips({ drivers, selected, onSelect, allowAll }: { drivers: Driver[]; selected: number | null; onSelect: (n: number | null) => void; allowAll?: boolean }) {
  return (
    <ScrollView horizontal style={s.wrap} contentContainerStyle={{ padding: 8, gap: 6 }} showsHorizontalScrollIndicator={false}>
      {allowAll && <Pressable onPress={() => onSelect(null)} style={[s.chip, selected == null && s.on]}><Text style={s.t}>Alle</Text></Pressable>}
      {drivers.map(d => (
        <Pressable key={d.driver_number} onPress={() => onSelect(d.driver_number)}
          style={[s.chip, { borderColor: teamColour(d.team_colour) }, selected === d.driver_number && { backgroundColor: teamColour(d.team_colour) }]}>
          <Text style={s.t}>{d.name_acronym}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  wrap: { flexGrow: 0, flexShrink: 0, minHeight: 46, backgroundColor: T.bg },
  chip: { borderWidth: 1.5, borderColor: T.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: T.card },
  on: { backgroundColor: T.red, borderColor: T.red }, t: { color: T.text, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
});
