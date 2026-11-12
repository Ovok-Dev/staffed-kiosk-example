# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite for the kiosk, Supabase (self-hosted, open source) for the patient register and its Edge Function.

## Users

Nurses and care assistants at a shared measurement station on a ward or in a clinic. One nurse signs in at the start of a shift; patients never sign in. Developers use the app as an example of running Ovok without storing patient details in Ovok.

## Product Purpose

Record a patient's blood pressure at a shared tablet: scan the patient's card, check the patient's identity, enter the reading, and save it to Ovok for that patient.

## Positioning

An example of the staffed kiosk setup on Ovok. The patient register (names, birth dates, card codes) lives in the customer's own Supabase. Ovok holds only a pseudonymous Patient and the readings, so every Ovok service (measurements, Signals, EHR connections) works without patient details.

## Operating Context

- A tablet or touchscreen in landscape or portrait, read at arm's length, often with gloves.
- Many patients per shift, one after another. The screen must never show the previous patient to the next one.
- A barcode scanner types the card code and presses Enter; typing the code by hand works the same way.
- Nurses check two identifiers (name and date of birth) before recording, as ward practice requires.

## Boundaries

- No patient sign-in, no patient-facing screens.
- No alerts, thresholds or interpretation of readings. Signals in Ovok decides alerts; this app only records.
- No patient details in Ovok, in logs, in browser storage or in URLs.
- One Ovok project and one Supabase project.

## Brand

The Vitaliva clinician dashboard's look: Open Sans, the lavender primary with dark text, white outlined cards with no shadows, and light and dark themes. Larger type and targets than the dashboard, because this is a touch station.
