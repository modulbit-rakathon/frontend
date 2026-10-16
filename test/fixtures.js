export const medication = {
  id: 'med_01', kind: 'drug', name: 'WAREARiN', active_substance: null,
  strength: '3MG', form: null, frequency: '1-0-0', amount: '1 tableta',
  source: 'note', sources: ['note', 'box'], note_style: 'handwritten',
  uncertain_fields: ['name'], conflicts: [],
};

export const analysis = (overrides = {}) => ({
  medications: [structuredClone(medication)], unreadable_items: 0, ...overrides,
});
