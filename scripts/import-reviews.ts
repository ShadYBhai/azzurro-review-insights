import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { mergeImportedReviews } from "@/lib/server/review-store";
import { normalizeCsvRows } from "@/lib/validations/import";

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run reviews:import -- <authorized-reviews.csv>");
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  const csvText = await readFile(absolutePath, "utf8");
  const rows = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, unknown>>;

  if (rows.length === 0) throw new Error("The CSV has no review rows.");

  const result = normalizeCsvRows(rows);
  if (result.issues.length > 0) {
    console.error(`Import cancelled. Found ${result.issues.length} validation issue${result.issues.length === 1 ? "" : "s"}:`);
    for (const issue of result.issues.slice(0, 30)) console.error(`  Row ${issue.row}: ${issue.message}`);
    if (result.issues.length > 30) console.error(`  ...and ${result.issues.length - 30} more.`);
    process.exitCode = 1;
    return;
  }

  const report = await mergeImportedReviews(result.reviews);
  console.log("Review import completed.");
  console.log(`  Added: ${report.added}`);
  console.log(`  Updated: ${report.updated}`);
  console.log(`  Duplicate rows ignored: ${report.duplicateRows}`);
  console.log(`  Reviews stored locally: ${report.total}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown import error";
  console.error(`Review import failed: ${message}`);
  process.exitCode = 1;
});
