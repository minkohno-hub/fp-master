import { readFile } from 'node:fs/promises';
import { auditContent, parseContentImport } from '../src/content/audit.ts';

// Inspection only: no network request, file writes, imports into the app, or automatic verification.
const filename = process.argv[2];
if (!filename || process.argv.length !== 3) {
  process.stderr.write('Usage: node scripts/audit-content.ts <candidate.json>\n');
  process.exitCode = 2;
} else {
  try {
    const report = auditContent(parseContentImport(await readFile(filename, 'utf8')));
    process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
    process.exitCode = report.issues.length || report.publicationBlocks.length ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : '候補JSONの監査に失敗しました'}\n`);
    process.exitCode = 2;
  }
}
