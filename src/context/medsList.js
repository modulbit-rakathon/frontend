export function restoreRemovedItem(items, { item, index }) {
  if (items.some((current) => current.id === item.id)) return items;
  const restored = [...items];
  restored.splice(Math.min(index, restored.length), 0, item);
  return restored;
}
