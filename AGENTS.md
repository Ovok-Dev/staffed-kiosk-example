# Repository guidance

A React + TypeScript + Vite kiosk and a Supabase Edge Function. Nurses record blood pressure at a shared station; the patient register stays in Supabase and Ovok holds only a pseudonymous Patient and the readings.

## Product boundaries

- No patient sign-in and no patient-facing screens.
- Patient details (names, dates of birth, card codes) never go to Ovok, logs, browser storage or URLs. Only `patients.id` (the pseudonym) and `ovok_patient_id` cross the boundary.
- The register is reached only through `supabase/functions/patients`. Keep row level security on with no grants to `anon` or `authenticated`.
- The kiosk records; it never interprets readings or raises alerts. Signals in Ovok decides alerts.
- The screen never shows the previous patient to the next one: keep the idle reset and "Next patient".

## Engineering conventions

- Use the installed `@ovok/core` and its TypeScript declarations as the API authority, and check the [Ovok docs](https://docs.ovok.com) before changing sign-in, measurements or FHIR calls.
- The function's logic lives in `handler.ts` and `ovok-gateway.ts`, which take their dependencies as arguments so the tests can run them. Keep Deno-only code in `index.ts`.
- Status codes follow RFC 9110: 401 with `WWW-Authenticate` for a missing or refused token, 403 for the wrong project or a non-practitioner, 409 for a taken card, 422 for invalid fields, 502 and 504 for Ovok failures.
- Logs are one JSON line per event with a stable message, and carry ids, never names or card codes.
- Use semantic HTML, labelled controls, visible focus, 56px touch targets and reduced-motion support.

## Validation

Run `npm run check` after code changes. After a user-facing change, run `npm run supabase -- start` and `npm run dev`, and walk through scan, identity check, save and next patient at desktop and phone widths.

## Files

- `PRODUCT.md`: product purpose and boundaries.
- `DESIGN.md`: the visual system.
- `supabase/migrations/`: the register schema.
- `supabase/functions/patients/`: the register's only door.
- `src/lib/`: Ovok client, register client, reading save and parsing.
- `src/components/`: the kiosk screens.
- `tests/`: function and parser tests.
