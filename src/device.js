// Je pacient na telefonu (tabletu), nebo na počítači?
//
// Díváme se, čím se ovládá obrazovka: telefon = prst (pointer: coarse) a nejde
// "najet myší" (hover: none). Notebook s dotykovou obrazovkou má hlavně myš/touchpad,
// takže se počítá jako počítač – a to chceme (fotky má v průzkumníku souborů).
export function isPhone() {
  return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
}
