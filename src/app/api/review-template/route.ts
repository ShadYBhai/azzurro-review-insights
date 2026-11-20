import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const template = await readFile(path.join(process.cwd(), "docs", "review-import-template.csv"), "utf8");
    return new Response(template, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=review-import-template.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "The import template is unavailable." }, { status: 500 });
  }
}
