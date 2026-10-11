export const T = {
  bg: '#0b0b10', card: '#17171f', card2: '#1f1f2a', border: '#2a2a36',
  red: '#e10600', text: '#f4f4f6', sub: '#9a9aa8', dim: '#6b6b78', green: '#2ecc71', purple: '#b04dff',
  radius: 12,
};
export const teamColour = (c?: string | null) => (c ? `#${c}` : '#666');
export const TYRE: Record<string, { c: string; l: string; nl: string }> = {
  SOFT: { c: '#e10600', l: 'S', nl: 'Zacht' }, MEDIUM: { c: '#ffd400', l: 'M', nl: 'Medium' }, HARD: { c: '#f0f0f0', l: 'H', nl: 'Hard' },
  INTERMEDIATE: { c: '#2ecc40', l: 'I', nl: 'Intermediate' }, WET: { c: '#1e90ff', l: 'W', nl: 'Regen' },
};
