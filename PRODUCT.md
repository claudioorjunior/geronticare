# GerontiCare — Product Context

## Product Purpose

Open-source electronic health record (EHR) for Brazilian elderly care facilities (ILPIs - Instituições de Longa Permanência para Pessoas Idosas). Regulated by RDC 502/2021 (ANVISA) and LGPD. Self-hosted, MIT licensed.

## Users

- **Administrador** (admin): full access — manages institution, users, patients, all clinical data
- **Profissional** (medico, enfermeiro, fisioterapeuta, nutricionista): clinical access — patients, AGA, registros, sinais vitais, anexos
- **Usuario** (cadastral/admin staff): limited access — patient cadastral data only, no clinical records

## Register

Product (dashboard UI). Design serves the product. Clarity over decoration. Healthcare professionals scanning data on desktop monitors in well-lit clinical offices.

## Tone

Sober, professional, trustworthy. Healthcare, not startup. Clinical precision. Portuguese (pt-BR) for all UI text.

## Anti-references

- Not a SaaS dashboard with purple gradients and glassmorphism
- Not a consumer wellness app with rounded blobs and cheerful illustrations
- Not a hospital enterprise system from 2008 with dense tables and no whitespace
- Not "AI slop" — no gradient text, no decorative cards, no fake metrics

## Strategic Principles

1. **Data legibility first** — professionals scan, not read. Numbers and names must pop.
2. **Calm interface** — healthcare workers are stressed. The UI should reduce cognitive load, not add visual noise.
3. **Restrained color** — one accent (teal) for actions/highlights, semantic colors (red/amber/green) only for clinical status. Neutrals do everything else.
4. **Desktop-first** — 1440px+ monitors. No mobile constraints yet.
5. **Open-source self-service** — someone clones the repo, runs `npm install`, registers, and manages their ILPI. The UI must be intuitive without a manual.
