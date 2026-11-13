# Ovok staffed kiosk with Supabase

[![npm: @ovok/core](https://img.shields.io/npm/v/@ovok/core?label=%40ovok%2Fcore)](https://www.npmjs.com/package/@ovok/core)
[![CI](https://github.com/Ovok-Dev/staffed-kiosk-example/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Ovok-Dev/staffed-kiosk-example/actions)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-self--hosted-3FCF8E?logo=supabase)
![Node](https://img.shields.io/badge/Node-24%2B-339933?logo=node.js)
![Status](https://img.shields.io/badge/example-not_for_clinical_use-orange)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

A shared measurement station for a ward or clinic. A nurse signs in once per shift, scans each patient's card, checks the patient's name and date of birth, and saves a blood-pressure reading to Ovok. Patients never sign in.

The patient register lives in your own self-hosted [Supabase](https://supabase.com). Ovok holds a Patient that carries only a pseudonym, plus the readings, so names and dates of birth never reach Ovok.

The step-by-step guide is [Run a staffed measurement kiosk](https://docs.ovok.com/guides/staffed-kiosk) on docs.ovok.com.

## What each part holds

| | Supabase (yours) | Ovok |
| --- | --- | --- |
| Patient | Name, date of birth, card code, pseudonym (`patients.id`) | A Patient with only `identifier` = the pseudonym |
| Readings | Nothing | Blood-pressure Observations on that Patient |
| Staff | Nothing | Practitioner accounts; each reading names the nurse who saved it |

- `supabase/migrations/`: the `patients` table, with row level security on and no grants to `anon` or `authenticated`.
- `supabase/functions/patients/`: the only way into the register. It checks the nurse's Ovok token with `GET /v1/auth/me`, serves the register, and creates each patient's Ovok Patient with a conditional create.
- `src/`: the kiosk. It signs nurses in with `@ovok/core`, looks patients up through the function, and saves readings with `ovok.measurements.save({ patientId })`.

## Run locally

Requirements: Node.js 24 or newer, npm, and Docker.

```sh
npm ci
npm run supabase -- start
```

`supabase start` runs Postgres, the API gateway and the Edge Functions runtime, applies the migration and serves the function.

Configure the function and the kiosk:

```sh
cp supabase/functions/.env.example supabase/functions/.env
cp .env.example .env.local
```

| File | Variable | Value |
| --- | --- | --- |
| `supabase/functions/.env` | `OVOK_BASE_URL` | `https://api.sandbox.ovok.com` |
| | `OVOK_PROJECT_ID` | Your sandbox project's id (`project.id` from `GET /v1/auth/me`) |
| | `PATIENT_IDENTIFIER_SYSTEM` | A URL you control that names your register |
| `.env.local` | `VITE_OVOK_TENANT_CODE` | Your sandbox project's tenant code |
| | `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` |
| | `VITE_STATION_NAME` | The name shown in the kiosk header |

Restart Supabase after changing the function's `.env`, then start the kiosk:

```sh
npm run supabase -- stop && npm run supabase -- start
npm run dev
```

Open http://localhost:5173 and sign in with a practitioner account of the project.

## Prepare the Ovok project

1. Create a sandbox project and keep practitioner login on. Patient login and registration can stay off.
2. Give kiosk staff an access policy that allows Patient read and create, and Observation read and create.
3. Confirm the `transaction-bundles` feature is on; each reading is saved as one transaction.

Details: [Configure the Ovok project](https://docs.ovok.com/guides/staffed-kiosk/configure-the-ovok-project).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the kiosk on port 5173. |
| `npm test` | Run the function and parser tests. |
| `npm run typecheck` | Run the strict TypeScript check. |
| `npm run build` | Type-check and build the kiosk. |
| `npm run check` | Run the tests and the build. |
| `npm run supabase -- <command>` | Run the Supabase CLI, for example `start`, `stop` or `db reset`. |

## Receive readings over HL7 v2 (optional)

Your Supabase can take every reading back from Ovok as an HL7 v2 message, through Ovok's HL7 agent. The register then holds the readings next to the people, as a hospital system would.

```text
Ovok ──wss──▶ HL7 agent ──MLLP──▶ receiver/ ──▶ Supabase readings
```

- The agent is Medplum's open-source `@medplum/agent`. It runs on your side and connects out to Ovok, so you open no inbound port.
- `receiver/` is a small MLLP server. It files each numeric value from Ovok's IHE PCD-01 `ORU^R01` into the `readings` table and answers `AA`. It answers `AR` for a malformed message or an unknown patient, and `AE` when a retry may work. A resend carries the same control id, so it never stores a reading twice.
- Make the connection with the register's identifier system as its patient identifier system. `PID-3` then carries the pseudonym, and the receiver files the reading under the right patient without any other ID.

1. As a project admin, create the connection. Send only the panel and the heart rate, so each reading arrives once:

   ```sh
   curl -X POST https://api.sandbox.ovok.com/v1/hl7-connections \
     -H "Authorization: Bearer $OVOK_ADMIN_TOKEN" -H 'Content-Type: application/json' \
     -d '{"name":"Kiosk CIS","destination":"mllp://127.0.0.1:2575",
          "patientIdentifierSystem":"https://kiosk.example.org/patient-id",
          "criteria":"Observation?code=http://loinc.org|85354-9,http://loinc.org|8867-4"}'
   ```

2. Copy `.env.receiver.example` to `.env.receiver.local`, set the service role key from `npm run supabase -- status`, and start the receiver with `npm run receiver`.
3. Run the agent in its own folder, with the four values the connection answered once in `agent.properties` (`baseUrl`, `clientId`, `clientSecret`, `agentId`, one `key=value` per line):

   ```sh
   npm install @medplum/agent@5.0.13
   node node_modules/@medplum/agent/dist/cjs/index.cjs
   ```

   The agent signs in and opens `wss://api.sandbox.ovok.com/ws/agent`. On Windows, use Medplum's agent installer instead.

Details: [Receive readings over HL7 v2](https://docs.ovok.com/guides/staffed-kiosk/receive-readings-over-hl7).

## Self-hosting

Run Supabase on your own servers with its Docker Compose setup, apply `supabase/migrations`, and deploy `supabase/functions/patients` to the functions service with the same three variables. Serve the kiosk's `dist/` over HTTPS. See [Run it on the ward](https://docs.ovok.com/guides/staffed-kiosk/run-it-on-the-ward).

> **Example only.** This application is not for clinical use. Use test records, and verify your project, policies, devices and applicable requirements before you use real data.

## License

Apache-2.0. See [LICENSE](LICENSE).
