import { z } from "zod";

export const reviewSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  guest: z.string(),
  country: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().min(1).max(10),
  title: z.string(),
  text: z.string().min(1),
  travelType: z.string(),
  language: z.string(),
  source: z.enum(["demo", "import"]),
  externalReviewId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

export const reviewListSchema = z.array(reviewSchema);
