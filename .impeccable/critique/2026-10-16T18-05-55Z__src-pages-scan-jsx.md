---
target: src/pages/Scan.jsx
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/home/jonas/_PROJEKTY/rakathon/frontend/src/pages/Scan.jsx"
target_fingerprint: "sha256:9662a7feab207ed7347aef4d3fddbe087ac8cb8fa592a126d90dcf3dee41cef2"
target_path: /home/jonas/_PROJEKTY/rakathon/frontend/src/pages/Scan.jsx
timestamp: 2026-10-16T18-05-55Z
slug: src-pages-scan-jsx
---
# Critique: /vyfotit (src/pages/Scan.jsx)
Method: dual-agent (A design review, B detector and browser evidence)

## Design Health Score: 25/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Nothing confirms a resolved choice |
| 2 | Match System / Real World | 3 | Latin names leak in; no photo crop on conflicts |
| 3 | User Control and Freedom | 2 | Re-sending photos or using the bottom nav drops resolutions; no undo for Odebrat |
| 4 | Consistency and Standards | 2 | 5 button styles; Upravit údaje = Opravit |
| 5 | Error Prevention | 2 | Strength choice keeps the wrong catalog product |
| 6 | Recognition Rather Than Recall | 3 | No photo next to "Co platí?" |
| 7 | Flexibility and Efficiency | 3 | Resolved rows stay open, page about 3,400 px |
| 8 | Aesthetic and Minimalist Design | 2 | Table on a phone, 6 options per decision |
| 9 | Error Recovery | 3 | "Zkusit znovu" resends the same photos on nothing_found |
| 10 | Help and Documentation | 2 | No why/who explanation |

## Design Specificity
Logic is specific to PillGaze (honest conflicts, unknowns kept). The visuals are generic and drift from the brand: white background instead of cream, mint-700 buttons, and amber warnings throughout the patient flow, although design README:88 reserves amber/coral for interactions.
Detector: CLI 0 findings. Browser, review state: nested cards (.review-question in .review-detail, ReviewDetail.jsx:86/100, index.css:1943/1965; half a false positive) and overused font (Plus Jakarta Sans is the brand font; false positive). Pick and error states clean. All inspection at desktop width (about 1,500 px).

## Priority Issues
- [P0] Review table overflows at phone width (409 px table in a 358 px column), clipping status, questions and conflict cards; worse with the Velké/Extra velké text size. Fix: card per medicine on the patient side. (/impeccable layout, adapt)
- [P0] resolveConflict (review.js:122) changes strength but keeps draft.product: panel shows Warfarin Orion 5 mg with a green check after choosing 3 mg; catalog_id is saved for 5 mg (review.js:183). Fix: re-match or clear the product; no green check above an open conflict. (/impeccable harden)
- [P1] Amber warning styling on every question, row and button contradicts the brand and PRODUCT principle 3. Fix: neutral mint/cream prompts with an ink border and a question-mark icon. (/impeccable colorize, quieter)
- [P1] Too many options per decision (6 for Pantomil), Odebrat 10 px from Upravit, no one-at-a-time flow, no progress. Fix: candidates + Jiný lék; one "Něco nesedí?" control; collapse and move to the next item; flag strength mismatches on candidates. (/impeccable distill)
- [P1] Lost work: re-sending photos and the bottom nav drop resolutions; on nothing_found the primary action resends the same photos. Fix: sessionStorage draft, nav guard, "Vyfotit znovu" as primary, name the failed photo. (/impeccable harden)

## Persona Red Flags
- Jordan: accordion hidden in an underlined table name; "Nevím – nechat" unclear; send button about 1,046 px down.
- Sam: no focus management between steps; table with colSpan accordion rows; silent conflict resolution; clipping at 130% zoom.
- Casey: about 3,400 px page with no progress; bottom nav drops state; no undo.
- Oncology patient with a tremor: Odebrat directly under Upravit; Je to správně next to Opravit; up to 15 decisions; no "leave it to the doctor" escape.

## Minor Observations
Paralen "Sedí" with dosage nepřečteno; Warfarin "1 tbl" without timing should ask "Kdy ho berete?"; awkward "Nevím – nechat" phrasing; .review-toggle looks like a link; README:41 lists interactions as a patient feature; tiny loading thumbnails.

## Questions to Consider
- Card stack with photo crops instead of a table?
- Let the patient pass the conflict to /doc unresolved?
- What does "the camera read this" look like on this screen?
