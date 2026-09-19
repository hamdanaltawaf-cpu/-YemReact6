export const CATEGORIES = [
  { id: 'laugh', name: 'ضحك', color: '#f4c430' },
  { id: 'shock', name: 'صدمة', color: '#7c5cff' },
  { id: 'anger', name: 'غضب', color: '#c81e3a' },
  { id: 'surprise', name: 'استغراب', color: '#2cb6c4' },
  { id: 'embarrass', name: 'إحراج', color: '#f17fb2' },
  { id: 'approve', name: 'موافقة', color: '#4caf6d' },
  { id: 'reject', name: 'رفض', color: '#6e8296' },
  { id: 'sarcasm', name: 'سخرية', color: '#d98e04' },
  { id: 'hype', name: 'حماس', color: '#e8712e' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
