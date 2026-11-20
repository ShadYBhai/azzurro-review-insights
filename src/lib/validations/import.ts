import { z } from "zod";
import { properties } from "@/data/properties";
import type { Review } from "@/lib/types";

const csvReviewRowSchema = z.object({
  property: z.string().trim().min(1, "Property is required").max(300),
  review_id: z.string().trim().max(200).default(""),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD"),
  rating: z.coerce.number().finite().min(1).max(10),
  guest: z.string().trim().max(120).default(""),
  country: z.string().trim().max(100).default(""),
  title: z.string().trim().max(300).default(""),
  review_text: z.string().trim().max(12000).default(""),
  positive_text: z.string().trim().max(12000).default(""),
  negative_text: z.string().trim().max(12000).default(""),
  travel_type: z.string().trim().max(100).default(""),
  language: z.string().trim().max(80).default(""),
  source_url: z.string().trim().max(2000).default(""),
}).superRefine((row, context) => {
  const reviewDate = new Date(`${row.date}T00:00:00.000Z`);
  if (Number.isNaN(reviewDate.getTime()) || reviewDate.toISOString().slice(0, 10) !== row.date) {
    context.addIssue({ code: "custom", path: ["date"], message: "Date is not a valid calendar date" });
  }

  if (!row.review_text && !row.positive_text && !row.negative_text) {
    context.addIssue({ code: "custom", path: ["review_text"], message: "Provide review_text or positive_text/negative_text" });
  }

  if (row.source_url) {
    try {
      const url = new URL(row.source_url);
      if (url.protocol !== "https:") throw new Error("Only HTTPS source URLs are accepted");
    } catch (error) {
      context.addIssue({ code: "custom", path: ["source_url"], message: error instanceof Error ? error.message : "Enter a valid HTTPS URL" });
    }
  }
});

export type ImportIssue = { row: number; message: string };

function findProperty(value: string) {
  const needle = value.trim().toLocaleLowerCase();
  return properties.find((property) => [property.id, property.name, property.listingUrl].some((candidate) => candidate.toLocaleLowerCase() === needle));
}

export function normalizeCsvRows(rows: Array<Record<string, unknown>>) {
  const reviews: Review[] = [];
  const issues: ImportIssue[] = [];

  rows.forEach((input, index) => {
    const result = csvReviewRowSchema.safeParse(input);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ row: index + 2, message: issue.message });
      }
      return;
    }

    const row = result.data;
    const property = findProperty(row.property);
    if (!property) {
      issues.push({ row: index + 2, message: `Unknown property "${row.property}"; use a listed property name, ID, or Booking.com URL` });
      return;
    }

    const text = [
      row.review_text,
      row.positive_text ? `Positive: ${row.positive_text}` : "",
      row.negative_text ? `Negative: ${row.negative_text}` : "",
    ].filter(Boolean).join("\n\n");

    reviews.push({
      id: row.review_id || "",
      propertyId: property.id,
      guest: row.guest || "Guest",
      country: row.country || "Unknown",
      date: row.date,
      rating: row.rating,
      title: row.title || "Guest review",
      text,
      travelType: row.travel_type || "Unknown",
      language: row.language || "Unknown",
      source: "import",
      ...(row.review_id ? { externalReviewId: row.review_id } : {}),
      ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    });
  });

  return { reviews, issues };
}
