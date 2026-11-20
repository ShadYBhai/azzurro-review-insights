import type { Review, ReviewTopic, Sentiment } from "@/lib/types";

const topicRules: Array<[ReviewTopic, RegExp]> = [
  ["Cleanliness", /clean|dirty|dust|stain|hygiene|shower|bathroom/i],
  ["Check-in", /check.?in|check.?out|reception|arrival|key card/i],
  ["Staff", /staff|team|receptionist|helpful|service/i],
  ["Noise", /noise|noisy|loud|traffic|hallway|sleep/i],
  ["Facilities", /facility|facilities|air conditioning|wi-?fi|lift|elevator/i],
  ["Location", /location|walk|nearby|station|transport|neighbourhood|neighborhood/i],
  ["Room condition", /room|bed|dated|maintenance|furniture|small/i],
  ["Value for money", /price|value|cost|expensive|worth/i],
];

export function getSentiment(rating: number): Sentiment {
  if (rating >= 8) return "positive";
  if (rating < 7) return "negative";
  return "neutral";
}

export function classifyTopics(text: string): ReviewTopic[] {
  return topicRules.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
}

function dateKeyInSydney(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWeekRanges(now = new Date()) {
  const today = dateKeyInSydney(now);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const currentStart = addDays(today, -daysSinceMonday);
  const previousStart = addDays(currentStart, -7);

  return {
    current: { start: currentStart, end: addDays(currentStart, 6) },
    previous: { start: previousStart, end: addDays(currentStart, -1) },
  };
}

function averageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
}

export function getWeeklySummary(reviews: Review[], now = new Date()) {
  const ranges = getWeekRanges(now);
  const current = reviews.filter((review) => review.date >= ranges.current.start && review.date <= ranges.current.end);
  const previous = reviews.filter((review) => review.date >= ranges.previous.start && review.date <= ranges.previous.end);
  const currentAverage = averageRating(current);
  const previousAverage = averageRating(previous);

  return {
    ranges,
    currentAverage,
    previousAverage,
    ratingChange: currentAverage === null || previousAverage === null ? null : currentAverage - previousAverage,
    currentCount: current.length,
    previousCount: previous.length,
    positiveCount: current.filter((review) => getSentiment(review.rating) === "positive").length,
    negativeCount: current.filter((review) => getSentiment(review.rating) === "negative").length,
  };
}

export function getPropertyWeeklyRatings(reviews: Review[], now = new Date()) {
  const { ranges } = getWeekRanges(now);

  return new Map(
    Array.from(new Set(reviews.map((review) => review.propertyId))).map((propertyId) => {
      const propertyReviews = reviews.filter((review) => review.propertyId === propertyId);
      const current = propertyReviews.filter((review) => review.date >= ranges.current.start && review.date <= ranges.current.end);
      const previous = propertyReviews.filter((review) => review.date >= ranges.previous.start && review.date <= ranges.previous.end);

      return [propertyId, {
        average: averageRating(current),
        previousAverage: averageRating(previous),
        reviewCount: current.length,
      }] as const;
    }),
  );
}

export function getTopicShares(reviews: Review[]) {
  const negativeReviews = reviews.filter((review) => getSentiment(review.rating) === "negative");
  const topicCounts = new Map<ReviewTopic, number>();

  for (const review of negativeReviews) {
    for (const topic of classifyTopics(review.text)) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  return Array.from(topicCounts, ([topic, count]) => ({
    topic,
    count,
    share: negativeReviews.length ? count / negativeReviews.length : 0,
  })).sort((left, right) => right.count - left.count);
}

