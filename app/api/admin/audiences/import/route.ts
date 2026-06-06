import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canBulkImportCandidates, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

// Expected CSV columns: nickname,realName,email,preferredLanguage,teamId
// preferredLanguage: EN | FRA | RU | TR | ITA (optional, defaults to EN)
// teamId: optional

// GET: return a sample CSV for download
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canBulkImportCandidates(session)) return forbidden();

  const sample = [
    'nickname,realName,email,preferredLanguage,teamId',
    'Agent Istanbul 1,John Smith,john.smith@example.com,EN,',
    'Agent Ankara 2,Jane Doe,jane.doe@example.com,TR,',
  ].join('\n');

  return new Response(sample, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="candidate-import-template.csv"',
    },
  });
}

// POST: Upload CSV body (text/plain or application/octet-stream), parse and import
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canBulkImportCandidates(session)) return forbidden();

  const text = await req.text();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) return apiError('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const requiredHeaders = ['nickname', 'email'];
  for (const h of requiredHeaders) {
    if (!headers.includes(h)) return apiError(`Missing required column: ${h}`);
  }

  const col = (row: string[], name: string) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] || '').trim() : '';
  };

  const rows = lines.slice(1).map((line) => line.split(','));

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nickname = col(row, 'nickname');
    const realName = col(row, 'realname') || col(row, 'real_name') || col(row, 'realname');
    const email = col(row, 'email').toLowerCase();
    const preferredLanguage = col(row, 'preferredlanguage') || col(row, 'language') || 'EN';
    const teamId = col(row, 'teamid') || col(row, 'team_id') || null;

    if (!nickname || !email) {
      results.errors.push(`Row ${i + 2}: nickname and email are required`);
      continue;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.errors.push(`Row ${i + 2}: invalid email "${email}"`);
      continue;
    }

    // Validate language
    const validLangs = ['EN', 'FRA', 'RU', 'TR', 'ITA'];
    const lang = preferredLanguage.toUpperCase();
    if (!validLangs.includes(lang)) {
      results.errors.push(`Row ${i + 2}: invalid language "${preferredLanguage}". Use EN, FRA, RU, TR, or ITA`);
      continue;
    }

    // Verify team exists if provided
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        results.errors.push(`Row ${i + 2}: team "${teamId}" not found`);
        continue;
      }
    }

    // Skip if email already exists (active record)
    const existing = await prisma.audience.findFirst({
      where: { email, isArchived: false },
    });
    if (existing) {
      results.skipped++;
      continue;
    }

    try {
      await prisma.audience.create({
        data: {
          name: nickname,       // name field holds nickname for display
          nickname,
          realName: realName || null,
          email,
          preferredLanguage: lang,
          teamId: teamId || null,
        },
      });
      results.created++;
    } catch {
      results.errors.push(`Row ${i + 2}: failed to create candidate for "${email}"`);
    }
  }

  await logAudit(session, 'import', 'audience', undefined, {
    created: results.created,
    skipped: results.skipped,
    errors: results.errors.length,
  });

  return apiSuccess(results);
}
