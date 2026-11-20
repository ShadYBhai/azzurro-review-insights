import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Review } from "@/lib/types";
import { reviewListSchema } from "@/lib/validations/review";

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "imported-reviews.json");

function reviewKey(review: Review): string {
  const property = review.propertyId.trim().toLowerCase();
  if (review.externalReviewId?.trim()) {
    return `${property}:external:${review.externalReviewId.trim().toLowerCase()}`;
  }

  const content = [property, review.date, review.rating.toFixed(1), review.text.trim().toLowerCase().replace(/\s+/g, " ")].join("\n");
  return `${property}:hash:${createHash("sha256").update(content).digest("hex")}`;
}

function stableId(key: string): string {
  return `booking-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

export async function readImportedReviews(): Promise<Review[]> {
  try {
    const contents = await readFile(dataFile, "utf8");
    return reviewListSchema.parse(JSON.parse(contents));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function mergeImportedReviews(incoming: Review[]) {
  const existing = await readImportedReviews();
  const merged = new Map(existing.map((review) => [reviewKey(review), review]));
  const seenInFile = new Set<string>();
  let added = 0;
  let updated = 0;
  let duplicateRows = 0;

  for (const review of incoming) {
    const key = reviewKey(review);
    if (seenInFile.has(key)) {
      duplicateRows += 1;
      continue;
    }
    seenInFile.add(key);

    const current = merged.get(key);
    merged.set(key, { ...review, id: current?.id ?? stableId(key), source: "import" });
    if (current) updated += 1;
    else added += 1;
  }

  const records = [...merged.values()];
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = path.join(dataDirectory, `.imported-reviews-${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryFile, `${JSON.stringify(records, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporaryFile, dataFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }

  return { added, updated, duplicateRows, total: records.length };
}
