import { parse } from "csv-parse/sync";
import { properties } from "@/data/properties";
import { mergeImportedReviews, previewImportedReviews, readImportedReviews } from "@/lib/server/review-store";
import { normalizeCsvRows } from "@/lib/validations/import";

const maximumUploadBytes = 5 * 1024 * 1024;
const maximumRequestBytes = maximumUploadBytes + 64 * 1024;

export async function GET() {
  try {
    const reviews = await readImportedReviews();
    return Response.json(
      { reviews, source: reviews.length ? "import" : "demo" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load local review data", error);
    return Response.json({ error: "Could not load imported review data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maximumRequestBytes) return Response.json({ error: "The CSV must be 5 MB or smaller." }, { status: 413 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Choose a CSV file and try again." }, { status: 400 });
  }

  const file = formData.get("file");
  const mode = formData.get("mode");
  if (mode !== "preview" && mode !== "commit") return Response.json({ error: "Choose whether to preview or confirm the import." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "A CSV file is required." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) return Response.json({ error: "Choose a file with a .csv extension." }, { status: 415 });
  if (file.size > maximumUploadBytes) return Response.json({ error: "The CSV must be 5 MB or smaller." }, { status: 413 });
  if (file.size === 0) return Response.json({ error: "The selected CSV is empty." }, { status: 400 });

  let rows: Array<Record<string, unknown>>;
  try {
    rows = parse(await file.text(), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, unknown>>;
  } catch {
    return Response.json({ error: "The CSV could not be read. Check its headers and quoting, then try again." }, { status: 400 });
  }

  if (rows.length === 0) return Response.json({ error: "The CSV has a header but no review rows." }, { status: 422 });

  const result = normalizeCsvRows(rows);
  if (result.issues.length > 0) {
    return Response.json({
      error: `Import cancelled because ${result.issues.length} row validation issue${result.issues.length === 1 ? "" : "s"} were found. No data was changed.`,
      issues: result.issues.slice(0, 50),
      totalIssues: result.issues.length,
    }, { status: 422 });
  }

  if (mode === "preview") {
    try {
      const preview = await previewImportedReviews(result.reviews);
      const rowsByProperty = new Map<string, number>();
      for (const review of result.reviews) rowsByProperty.set(review.propertyId, (rowsByProperty.get(review.propertyId) ?? 0) + 1);
      const propertyCounts = Array.from(rowsByProperty, ([propertyId, count]) => ({
        property: properties.find((property) => property.id === propertyId)?.name ?? propertyId,
        count,
      }));
      return Response.json({ preview: { ...preview, propertyCounts } });
    } catch (error) {
      console.error("Could not preview review import", error);
      return Response.json({ error: "Could not compare the CSV with the saved review data." }, { status: 500 });
    }
  }

  try {
    const report = await mergeImportedReviews(result.reviews);
    return Response.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Could not save imported review data", error);
    return Response.json({ error: "The reviews were validated, but could not be saved. Existing data was left unchanged." }, { status: 500 });
  }
}
