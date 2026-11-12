---
name: Ovok Staffed Kiosk
description: A touch measurement station in the Vitaliva clinician dashboard's visual system.
colors:
  background: "#F7F8F8"
  foreground: "#0F1419"
  card: "#FFFFFF"
  primary: "#B2A5CD"
  primary-foreground: "#17181C"
  primary-text: "#766C8A"
  muted: "#F0EDF3"
  muted-foreground: "#536471"
  border: "#E1EAEF"
  ring: "#766C8A"
  destructive: "#D7192A"
  success: "#3B7359"
  warning: "#A8752B"
  wordmark: "#253C52"
dark:
  background: "#000000"
  foreground: "#E7E9EA"
  card: "#17181C"
  primary-text: "#B8AEC9"
  muted: "#1B1821"
  muted-foreground: "#72767A"
  border: "#242628"
typography:
  family: '"Open Sans Variable", "Open Sans", sans-serif (self-hosted with @fontsource-variable/open-sans)'
  page-title: "clamp(1.875rem, 3vw, 2.375rem) / 600 / -0.03em"
  patient-name: "clamp(2rem, 4vw, 2.75rem) / 600"
  field-label: "0.75rem / 600 / uppercase / 0.06em"
  reading: "2.25rem / 600 / tabular-nums"
rounded:
  card: "1.3125rem"
  control: "0.75rem"
  button: "0.875rem"
  pill: "999px"
  board: "12px"
  tile: "14px"
  inset: "10px"
  mark: "4px"
spacing:
  target: "3rem minimum height; 4rem for the card field and Find patient"
motion:
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  press: "scale(0.97), 140ms"
  unfold: "clip-path reveal of the reading form, 260ms; opacity only under reduced motion"
---

# Design

The kiosk uses the Vitaliva clinician dashboard's visual system (`packages/theme` and `apps/clinician-dashboard/src/app/globals.css` in Actimi/vitaliva), scaled for a shared touch station. The wordmark stays Ovok's: this is an Ovok example.

- **Home is the station board** (the dashboard's station overview, chosen in an Impeccable surface round, seed c3d2842f).
  - A small "Home" title with the date, and "Register patient" as an outline button.
  - On the left, one outlined board: three metric tiles (readings this shift, patients this shift, blood-pressure readings today in Ovok) in muted insets, then "This shift" with a Show/Hide names toggle and the patient tiles.
  - The patient tiles are the dashboard's station tiles: a muted header with the name, or "Patient · Details hidden"; the latest reading with relative time and the exact time on hover; and a footer of BP, pulse and reading count.
  - On the right, a sticky 360px scan rail: the scan card, whose field sits in a viewfinder with four lavender corner marks, and a numbered list of the three steps. Under 1100px the rail comes first.
- **Sign-in is the dashboard's split layout.** An intro on the left (wordmark, a heading with one accent word, a description, a platform note) and the form on a white panel on the right; one column under 820px.
- **Outlined cards, no shadows.** White cards with a 1px `border` and the 1.3125rem radius; fields and tables use the 0.75rem control radius.
- **The patient header follows the dashboard's.** A back link in `primary-text`, the name as the largest text, and uppercase field labels for date of birth and card, so the two-identifier check reads at a glance.
- **Buttons.** Primary is lavender with dark text; secondary actions are outline buttons; links are `primary-text`.
- **Readings use the dashboard's table.** Date, Reading and Value columns, a muted header row, right-aligned tabular values with small muted units, and the dashboard's empty state.
- **One authored motion.** Confirming the identity unfolds the reading form; buttons press to 0.97. Nothing else moves.
- **Light and dark** follow the system setting, with the dashboard's dark tokens.
