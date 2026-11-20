import { readImportedReviews } from "@/lib/server/review-store";

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
