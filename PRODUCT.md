# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: oncology patients**, often older, many of them on several medications at once. They use the patient part on their own phone, at home or in a waiting room. Their job is to get a complete, correct list of everything they take (prescription drugs, supplements, and their oncology treatment) without typing it, and hand it to their oncologist.

**Secondary: the oncologist at the clinic**, on a desktop computer, before or during a visit. Their job is to load the patient's list with a one-time code, see exactly what the patient takes, and spot possible interactions with the oncology treatment.

## Product Purpose

PillGaze turns photos of medicine boxes and doctor's notes into a verified medication list. The patient photographs up to 10 boxes or notes at once, AI reads them, the backend matches them against the drug catalog (optionally SÚKL), and the patient confirms or fixes each item ("Sedí to?"). The patient then generates a one-time code; the oncologist enters it in `/doc` and sees the medication table plus interaction findings.

Current stage: **Rakathon hackathon entry**. Success means a convincing live demo, on mock data, for the jury and the challenge owner (zadavatel).

## Positioning

The patient never types a list from memory. They photograph what they have, and the system cross-checks the box against the doctor's note and the catalog. Conflicts are shown, not silently resolved: if the note says 5 mg and the box says 3 mg, the patient chooses. Interactions are checked by **active ingredient**, not brand name, in three passes: every pair, shared risk groups (bleeding, QT, serotonin, sedation…), and duplicate ingredients. Results go only to the doctor.

## Operating Context

- Patient flow: Home → Vyfotit (camera / file picker, up to 10 photos) → review table "Sedí to?" → Moje léky → Zpráva (report) → Pin (one-time code for the doctor). Supplements (Doplňky) and oncology treatment (Onkologie) live in the same list as typed items.
- First run asks whether the patient is undergoing oncology treatment.
- Doctor flow (`/doc`): enter code → "Načíst" → medication table (lék, účinná látka, síla, dávkování, zdroj: krabička / lístek / ručně) → interactions preloaded in the background and shown in a collapsible bar below the table, sorted by severity, with a pair matrix and a data-source disclaimer.
- Backend contract: `POST /api/analyze` (v3), `GET /api/catalog?q=…`, `/api/share`; `VITE_MOCK_API=true` runs the full demo without a backend. Data lives in the browser's `localStorage`.
- FHIR R4 export and PDF download exist for hospital systems, in the doctor view only.

## Capabilities and Constraints

- Stack: React 18 + Vite, react-router-dom, plain CSS in `src/index.css`. No UI framework.
- **The patient part never shows interactions or medication warnings.** The challenge owner wants them only in `/doc`.
- **The doctor view shows medications only**: no patient name, birth year, or other identifying data. Its header holds only the title "Lékař" and the patient-code field.
- Doctor view may be denser than the patient part (desktop, seated user).
- The interaction bar in `/doc` is deliberately quiet and blends with the table. Its states and copy are fixed in the README: loading, count + "Zobrazit", none found ("…To neznamená, že žádné nejsou."), and error with "Zkusit znovu".
- Catalog matches are suggestions; nothing is auto-replaced with a different drug or strength. Unknown values stay unknown and are never invented.
- All UI copy is in Czech, in plain human language ("Jak často", not "Frekvence dávkování").

## Brand Commitments

- Name: **PillGaze**. Brand assets live in the sibling repo `../design` (logo with mark, wordmark and lockups, palette tokens, favicon, Plus Jakarta Sans). Concept: a capsule (medication) merged with an eye (the camera reading it), rotated 35°.
- Logo rules from `../design/README.md`: don't recolor the capsule halves, rotate only by 35°, no shadows or outlines, wordmark only in its own lettering, keep the clear zone.
- Voice: friendly, plain Czech, addressing the patient formally ("Dobrý den", "Co chcete udělat?").

## Evidence on Hand

- Mock scenarios in `src/mock/` that mirror the backend mock: Prestarium Neo (note + box match), Warfarin Orion (strength conflict 5 mg × 3 mg), Paralen 500 (not in catalog), Ibuprofen 400 and Pantomil (choose a product), and a photo named `chyba` for the read-error screen.
- `../core`: catalog check, conflict preservation, correction history, controlled export. All evidence there is synthetic technical proof, not measured OCR accuracy.
- **No real users, testimonials, clinical validation, accuracy figures, or partner institutions exist.** Don't invent them.

## Product Principles

1. **The patient confirms, the system never guesses.** Every AI-read value is reviewable, conflicts are surfaced, and unknowns stay blank.
2. **One clear action per screen for the patient.** Simplicity beats feature visibility.
3. **Warnings go to the oncologist, not the patient.** The patient part reassures and collects; the doctor part informs.
4. **Privacy by omission.** The doctor sees medications, not identity; sharing is a one-time code.
5. **Demo-true.** Everything shown in the demo works end to end on mock data; no fake screens.

## Accessibility & Inclusion

The patient part is built for older and possibly unwell users (fatigue, reduced vision, unsteady hands):

- buttons at least 56 px tall, large and colored; one primary action per screen;
- text at least 18 px everywhere, including labels and the bottom navigation;
- high contrast; color is never the only carrier of meaning (always an icon or text too);
- no gestures; everything works with a button;
- built-in font-size switch (Normální / Velké / Extra velké), read-aloud (speech synthesis), and voice input.
