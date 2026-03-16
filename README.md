# Esvita Exam System

Multilingual, OTP-authenticated Exam & Assessment Platform for Esvita Clinic Medical Advisors.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env.local` with your settings:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# SMTP (Gmail example)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Esvita Exam <no-reply@esvitaclinic.com>"
```

### 3. Set up database
```bash
DATABASE_URL="file:./dev.db" npx prisma db push
DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts
```

### 4. Start development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default admin login:** `admin@esvitaclinic.com`

> In development, OTP codes are printed to the terminal console.

---

## Features

| Feature | Details |
|---|---|
| **Auth** | Passwordless OTP via email. Domain-locked to @esvitaclinic.com / @esvita.clinic |
| **External Invites** | Admins send time-limited (72h) exam links + OTP to any email |
| **Multi-language** | EN, FRA, RU, TR, ITA — only filled languages shown to candidates |
| **Question Types** | Single entry, bulk text import, PDF/JSON file upload |
| **Randomization** | Unique question order per candidate (Fisher-Yates shuffle) |
| **Timer** | Per-question timer, auto-submits when time runs out |
| **Results Email** | Auto-sent with score, wrong answers + explanations |
| **Reports** | Admin dashboard with charts + CSV export |
| **Candidate Profiles** | Exam history + score trend chart |
| **Multi-admin** | Multiple admin / super-admin roles |

## Database Commands

```bash
# View DB in browser UI
DATABASE_URL="file:./dev.db" npx prisma studio

# Reset DB
DATABASE_URL="file:./dev.db" npx prisma db push --force-reset
DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts
```

## Production Deployment

1. Switch to PostgreSQL: update `DATABASE_URL` and change `provider = "postgresql"` in `prisma/schema.prisma`
2. Set a strong `JWT_SECRET`
3. Configure real SMTP credentials
4. Run `npx prisma migrate deploy`

## Question Import Format (Text)

```
Q: What is the primary mechanism of ACE inhibitors?
A: Block calcium channels
B: Inhibit angiotensin-converting enzyme
C: Block beta receptors
D: Stimulate aldosterone
ANSWER: B
EXPLANATION: ACE inhibitors block the enzyme that converts angiotensin I to angiotensin II...
```

## Question Import Format (JSON)

```json
[
  {
    "questionEn": "What is...",
    "questionTr": "Ne olduğunu...",
    "optionsEn": [
      {"key": "A", "value": "Option A"},
      {"key": "B", "value": "Option B"}
    ],
    "optionsTr": [...],
    "correctAnswer": "B",
    "explanationEn": "Because...",
    "explanationTr": "Çünkü..."
  }
]
```
