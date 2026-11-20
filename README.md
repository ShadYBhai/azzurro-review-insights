# Azzurro Review Intelligence

A local operations dashboard for Booking.com review data from four Azzurro Hotels properties in Sydney. It gives staff a weekly rating summary, property comparisons, sentiment trends, a searchable review feed, and keyword-based topic insights.

## Properties

| Property | Booking.com listing |
| --- | --- |
| Olympic Hotel Paddington | https://www.booking.com/hotel/au/olympic-paddington.html |
| Potts Point | https://www.booking.com/hotel/au/venus-potts-point-sydney.html |
| Central Sydney | https://www.booking.com/hotel/au/venus-surry-hills.html |
| Darling Harbour | https://www.booking.com/hotel/au/chateau-de-venus.html |

## Requirements and installation

- Node.js 20 or later
- npm

```bash
npm install
npm run dev
```

Open http://localhost:3000. If that port is already in use, Next.js selects another available port and prints the URL in the terminal.

For a production build:

```bash
npm run lint
npm run build
npm start
```

## Review collection and imports

No Booking.com API access or written scraping permission was supplied. This project therefore does not scrape Booking.com pages. Use a review export or other source that you are authorized to use, then import it from CSV. The sample data shown before a real import is fictional and is only for demonstrating the interface.

The CSV template is [docs/review-import-template.csv](docs/review-import-template.csv). Required columns are `property`, `date`, `rating`, and at least one of `review_text`, `positive_text`, or `negative_text`. Optional columns are `review_id`, `guest`, `country`, `title`, `travel_type`, `language`, and `source_url`. Match `property` by the exact property name, property ID, or Booking.com listing URL. Dates must use `YYYY-MM-DD`; ratings must be from 1 to 10; source URLs must use HTTPS.

Import an authorized export:

```bash
npm run reviews:import -- "./path/to/authorized-reviews.csv"
```

Operations staff can also select **Import reviews** in the dashboard and upload the same CSV. The upload is limited to 5 MB. The app shows a preview of new, updated, and duplicate rows before saving; row-level validation errors cancel the import and keep the existing dataset unchanged. The template can be downloaded from the import dialog.

The importer validates the entire CSV before writing. Any invalid row cancels the import and reports its row number. It combines separate positive and negative text columns, skips duplicate rows within a file, and updates existing records when reimported. It identifies reviews by the source review ID when available, or by a SHA-256 fingerprint of property, date, rating, and normalized review text otherwise. Writes use a temporary file and atomic rename to avoid leaving a partial dataset after an interrupted write.

Imported records are stored locally in `data/imported-reviews.json`, which is ignored by Git because it may contain guest information. The dashboard reads this file through `GET /api/reviews`; CSV uploads use `POST /api/reviews`. If the file is empty or missing, the dashboard uses fictional demo records instead. A local lock prevents overlapping imports from replacing each other's updates, and a temporary lock older than 15 minutes is treated as stale.

## Architecture

- `src/app/` — Next.js App Router page, layout, and review data API route.
- `src/components/dashboard-app.tsx` — interactive overview, paginated review feed, property comparison, insights, filtered CSV export, and the CSV upload dialog.
- `src/data/properties.ts` — the four property names and listing links.
- `src/data/demo-reviews.ts` — fictional review examples for the interface.
- `src/lib/analytics.ts` — Sydney Monday-to-Sunday week ranges, ratings, sentiment, and topic rules.
- `src/lib/validations/` — review and CSV row validation.
- `src/lib/server/review-store.ts` — local JSON persistence and duplicate-safe updates.
- `scripts/import-reviews.ts` — command-line CSV importer.

## Insight methodology

Sentiment is derived from the Booking.com 1–10 rating: 8–10 is positive, 7–7.9 is neutral, and below 7 is negative. Topic tags use keyword rules for cleanliness, check-in, staff, noise, facilities, location, room condition, and value for money. Topic percentages use negative reviews in the selected week as the denominator. A review can match more than one topic, so percentages can add up to more than 100%.

Keyword matching can miss context, spelling variants, sarcasm, and non-English text. These insights are directional and should be checked against the original review text.

## Limitations and assumptions

- There are no authentic Booking.com reviews included. The 16 built-in examples are fictional, not collected data. Add an authorized export to demonstrate real property performance.
- There is no automated scraper. Page layout changes, bot checks, and permitted collection methods require property-owner authorization and a separate approved collector.
- The JSON file is intended for a single local workspace. It is not a shared database, has no user authentication, and should not be used as a multi-user hosted store. Replace it with a database and add access controls before deployment.
- The dashboard uses local sample data until imported records are present. The CSV import workflow is an update path for authorized exports, not a Booking.com integration.

Do not commit passwords, cookies, API keys, or imported guest data.
