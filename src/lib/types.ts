export type Property = {
  id: string;
  name: string;
  city: string;
  listingUrl: string;
};

export type Review = {
  id: string;
  propertyId: string;
  guest: string;
  country: string;
  date: string;
  rating: number;
  title: string;
  text: string;
  travelType: string;
  language: string;
  source: "demo" | "import";
  externalReviewId?: string;
  sourceUrl?: string;
};

export type Sentiment = "positive" | "neutral" | "negative";

export type ReviewTopic =
  | "Cleanliness"
  | "Check-in"
  | "Staff"
  | "Noise"
  | "Facilities"
  | "Location"
  | "Room condition"
  | "Value for money";
