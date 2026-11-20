"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Compass,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createDemoReviews } from "@/data/demo-reviews";
import { properties } from "@/data/properties";
import {
  getPropertyWeeklyRatings,
  classifyTopics,
  getSentiment,
  getTopicShares,
  getWeeklySentimentTrend,
  getWeeklySummary,
} from "@/lib/analytics";
import type { Review, ReviewTopic, Sentiment } from "@/lib/types";

type ViewName = "Overview" | "Reviews" | "Properties" | "Insights";
type SentimentFilter = "all" | Sentiment;

const navigation: Array<{ name: ViewName; icon: typeof LayoutDashboard }> = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Reviews", icon: MessageSquareText },
  { name: "Properties", icon: Building2 },
  { name: "Insights", icon: Sparkles },
];

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Sydney",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00.000Z`));
}

function formatRange(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00.000Z`);
  const endDate = new Date(`${end}T12:00:00.000Z`);
  const startText = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Sydney" }).format(startDate);
  const endText = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" }).format(endDate);
  return `${startText} – ${endText}`;
}

function ratingTone(rating: number) {
  if (rating >= 8) return "positive";
  if (rating < 7) return "negative";
  return "neutral";
}

function SentimentBadge({ rating }: { rating: number }) {
  const sentiment = getSentiment(rating);
  const Icon = sentiment === "positive" ? ThumbsUp : sentiment === "negative" ? ThumbsDown : MessageSquareText;
  return (
    <span className={`sentiment-badge ${sentiment}`}>
      <Icon size={12} /> {sentiment}
    </span>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const property = properties.find((item) => item.id === review.propertyId);
  const tone = ratingTone(review.rating);
  const topics = classifyTopics(review.text);

  return (
    <article className="review-row">
      <div className={`review-score ${tone}`}>{review.rating.toFixed(1)}</div>
      <div className="review-copy">
        <div className="review-meta">
          <strong>{review.guest}</strong>
          <span>{review.country}</span>
          <span className="meta-dot">·</span>
          <span>{review.travelType}</span>
        </div>
        <h3>{review.title}</h3>
        <p>{review.text}</p>
        <div className="review-bottomline">
          <span><Building2 size={12} /> {property?.name ?? "Unknown property"}</span>
          <span><CalendarDays size={12} /> {formatDate(review.date)}</span>
        </div>
        {topics.length > 0 && <div className="review-topic-tags">{topics.slice(0, 3).map((topic) => <span key={topic}>{topic}</span>)}</div>}
      </div>
      <SentimentBadge rating={review.rating} />
    </article>
  );
}

function SentimentChart({ reviews, now }: { reviews: Review[]; now: Date }) {
  const trend = getWeeklySentimentTrend(reviews, 6, now);
  const chartPoints = (key: "positiveShare" | "negativeShare") => trend.map((week, index) => {
    const x = 38 + (index * 524) / Math.max(1, trend.length - 1);
    const y = 180 - (week[key] / 100) * 140;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i className="legend-dot positive-dot" /> Positive</span>
        <span><i className="legend-dot negative-dot" /> Negative</span>
        <span className="chart-unit">Share of weekly reviews</span>
      </div>
      <svg className="sentiment-chart" viewBox="0 0 600 220" role="img" aria-label="Positive and negative review share over the last six weeks">
        {[40, 80, 120, 160, 200].map((y, index) => (
          <g key={y}>
            <line x1="38" x2="570" y1={y} y2={y} className="chart-gridline" />
            <text x="4" y={y + 4} className="chart-axis-label">{100 - index * 25}%</text>
          </g>
        ))}
        <polyline points={chartPoints("positiveShare")} className="chart-line positive-line" />
        <polyline points={chartPoints("negativeShare")} className="chart-line negative-line" />
        {trend.map((week, index) => {
          const x = 38 + (index * 524) / Math.max(1, trend.length - 1);
          return (
            <g key={week.start}>
              <circle cx={x} cy={180 - (week.positiveShare / 100) * 140} r="4" className="chart-point positive-point" />
              <circle cx={x} cy={180 - (week.negativeShare / 100) * 140} r="4" className="chart-point negative-point" />
              <text x={x} y="217" textAnchor="middle" className="chart-date-label">{week.label}</text>
            </g>
          );
        })}
      </svg>
      {trend.every((week) => week.reviewCount === 0) && (
        <div className="chart-empty">Weekly sentiment trends will appear when reviews are available.</div>
      )}
    </div>
  );
}

function Overview({
  selectedProperty,
  reviews,
  now,
  source,
  onOpenReviews,
}: {
  selectedProperty: string;
  reviews: Review[];
  now: Date;
  source: "demo" | "import";
  onOpenReviews: () => void;
}) {
  const summary = getWeeklySummary(reviews, now);
  const weeklyRatings = getPropertyWeeklyRatings(reviews, now);
  const currentWeekReviews = reviews.filter((review) => review.date >= summary.ranges.current.start && review.date <= summary.ranges.current.end);
  const topics = getTopicShares(currentWeekReviews);
  const positiveShare = summary.currentCount ? (summary.positiveCount / summary.currentCount) * 100 : 0;
  const negativeShare = summary.currentCount ? (summary.negativeCount / summary.currentCount) * 100 : 0;
  const topTopic = topics[0];

  return (
    <>
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">OPERATIONS / OVERVIEW</div>
          <h1>Guest experience, at a glance</h1>
          <p className="page-description">A weekly view of ratings, sentiment and recurring guest feedback.</p>
        </div>
        <div className="range-chip"><CalendarDays size={15} /> {formatRange(summary.ranges.current.start, summary.ranges.current.end)}</div>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <div className="stat-topline"><span>Average rating</span><span className="stat-icon"><Star size={16} /></span></div>
          <div className="stat-value-row"><strong>{summary.currentAverage?.toFixed(1) ?? "—"}</strong><span className="stat-denominator">/ 10</span></div>
          <div className={`stat-foot ${summary.ratingChange === null ? "muted" : summary.ratingChange >= 0 ? "up" : "down"}`}>
            {summary.ratingChange === null ? <span>No previous-week data</span> : <><span className="stat-change-icon">{summary.ratingChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span>{Math.abs(summary.ratingChange).toFixed(1)} vs previous week</>}
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-topline"><span>Reviews this week</span><span className="stat-icon mint"><MessageSquareText size={16} /></span></div>
          <div className="stat-value-row"><strong>{summary.currentCount}</strong><span className="stat-denominator">reviews</span></div>
          <div className="stat-foot muted"><span>{summary.previousCount} in the previous week</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-topline"><span>Positive sentiment</span><span className="stat-icon green"><ThumbsUp size={16} /></span></div>
          <div className="stat-value-row"><strong>{summary.currentCount ? `${Math.round(positiveShare)}%` : "—"}</strong></div>
          <div className="stat-foot up"><span>{summary.positiveCount} positive {summary.positiveCount === 1 ? "review" : "reviews"}</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-topline"><span>Negative mentions</span><span className="stat-icon coral"><ThumbsDown size={16} /></span></div>
          <div className="stat-value-row"><strong>{summary.currentCount ? `${Math.round(negativeShare)}%` : "—"}</strong></div>
          <div className="stat-foot down"><span>{topTopic ? `${Math.round(topTopic.share * 100)}% mention ${topTopic.topic.toLowerCase()}` : "No recurring topics yet"}</span></div>
        </article>
      </div>

      <div className="dashboard-grid overview-grid">
        <section className="panel sentiment-panel">
          <div className="panel-heading">
            <div><h2>Sentiment trend</h2><p>Positive and negative review share over time</p></div>
            <button className="icon-button" aria-label="Sentiment trend information" title="Share is based on review count per week"><CircleHelp size={17} /></button>
          </div>
          <SentimentChart reviews={reviews} now={now} />
        </section>
        <section className="panel topic-panel">
          <div className="panel-heading">
            <div><h2>Topics to watch</h2><p>Most common themes in negative reviews</p></div>
            <button className="text-button" onClick={onOpenReviews}>See reviews <ChevronRight size={14} /></button>
          </div>
          {topics.length ? <div className="topic-list">
            {topics.slice(0, 4).map((topic) => (
              <div className="topic-item" key={topic.topic}>
                <div className="topic-label-row"><span>{topic.topic}</span><strong>{Math.round(topic.share * 100)}%</strong></div>
                <div className="topic-track"><span style={{ width: `${Math.max(5, topic.share * 100)}%` }} /></div>
                <small>{topic.count} of {summary.negativeCount} negative {summary.negativeCount === 1 ? "review" : "reviews"}</small>
              </div>
            ))}
          </div> : <div className="empty-state compact"><span className="empty-icon"><Sparkles size={18} /></span><strong>No negative topics this week</strong><p>New themes will show here as reviews arrive.</p></div>}
        </section>
      </div>

      <section className="panel property-panel">
        <div className="panel-heading">
          <div><h2>Property performance</h2><p>Average guest rating for the current week</p></div>
          <button className="text-button" onClick={() => onOpenReviews()}>View all <ChevronRight size={14} /></button>
        </div>
        <div className="property-performance-list">
          {properties.filter((property) => selectedProperty === "all" || property.id === selectedProperty).map((property, index) => {
            const stats = weeklyRatings.get(property.id);
            const rating = stats?.average;
            return (
              <div className="property-performance-row" key={property.id}>
                <span className={`property-avatar property-avatar-${index + 1}`}>{property.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <div className="property-name-block"><strong>{property.name}</strong><small>{property.city}</small></div>
                <div className="property-bar-track"><span style={{ width: `${rating === null || rating === undefined ? 0 : rating * 10}%` }} /></div>
                <div className="property-rating">{rating === null || rating === undefined ? <span className="no-rating">—</span> : <><Star size={13} fill="currentColor" /> {rating.toFixed(1)}</>}</div>
                <span className="property-review-count">{stats?.reviewCount ?? 0} reviews</span>
                <a className="listing-link" href={property.listingUrl} target="_blank" rel="noreferrer" aria-label={`Open ${property.name} Booking.com listing`}><ExternalLink size={14} /></a>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2>Recent guest feedback</h2><p>Latest reviews across your selected properties</p></div>
          <button className="text-button" onClick={onOpenReviews}>Browse reviews <ChevronRight size={14} /></button>
        </div>
        <div className="recent-review-list">
          {[...reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((review) => <ReviewRow key={review.id} review={review} />)}
        </div>
      </section>
      <div className="data-provenance"><span className="demo-dot" />{source === "demo" ? "Sample workspace · review examples are fictional and for interface demonstration only" : "Imported review data · loaded from the local authorized CSV dataset"}</div>
    </>
  );
}

function ReviewsView({ reviews, source }: { reviews: Review[]; source: "demo" | "import" }) {
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [topicFilter, setTopicFilter] = useState<ReviewTopic | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "rating">("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const filtered = useMemo(() => reviews.filter((review) => {
    const matchesText = !search || `${review.title} ${review.text} ${review.guest}`.toLowerCase().includes(search.toLowerCase());
    const matchesProperty = propertyFilter === "all" || review.propertyId === propertyFilter;
    const matchesSentiment = sentimentFilter === "all" || getSentiment(review.rating) === sentimentFilter;
    const matchesTopic = topicFilter === "all" || classifyTopics(review.text).includes(topicFilter);
    return matchesText && matchesProperty && matchesSentiment && matchesTopic && (!dateFrom || review.date >= dateFrom) && (!dateTo || review.date <= dateTo);
  }).sort((left, right) => sort === "oldest" ? left.date.localeCompare(right.date) : sort === "rating" ? right.rating - left.rating : right.date.localeCompare(left.date)), [reviews, search, propertyFilter, sentimentFilter, topicFilter, dateFrom, dateTo, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const pageReviews = filtered.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const firstVisible = filtered.length ? (visiblePage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(visiblePage * pageSize, filtered.length);

  function exportCsv() {
    const headers = ["property", "review_id", "date", "rating", "sentiment", "guest", "country", "title", "review_text", "topics", "travel_type", "language", "source_url"];
    const rows = filtered.map((review) => {
      const property = properties.find((item) => item.id === review.propertyId);
      return [
        property?.name ?? review.propertyId,
        review.externalReviewId ?? review.id,
        review.date,
        review.rating.toFixed(1),
        getSentiment(review.rating),
        review.guest,
        review.country,
        review.title,
        review.text,
        classifyTopics(review.text).join("; "),
        review.travelType,
        review.language,
        review.sourceUrl ?? property?.listingUrl ?? "",
      ];
    });
    const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const contents = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const file = new Blob([`\uFEFF${contents}`], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `azzurro-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return (
    <>
      <div className="page-heading-row">
        <div><div className="eyebrow">OPERATIONS / REVIEWS</div><h1>Review inbox</h1><p className="page-description">Search and filter guest feedback across your properties.</p></div>
        <div className="review-heading-actions"><div className="review-total"><strong>{filtered.length}</strong><span>{filtered.length === 1 ? "review" : "reviews"}</span></div><button className="export-button" onClick={exportCsv} disabled={filtered.length === 0} title="Export all reviews matching the current filters"><Download size={14} /> Export filtered CSV</button></div>
      </div>
      <section className="panel reviews-panel">
        <div className="filter-toolbar">
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search reviews or guest names" /></label>
          <label className="filter-select"><Building2 size={14} /><select value={propertyFilter} onChange={(event) => { setPropertyFilter(event.target.value); setPage(1); }}><option value="all">All properties</option>{properties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}</select><ChevronDown size={14} /></label>
          <label className="filter-select"><Filter size={14} /><select value={sentimentFilter} onChange={(event) => { setSentimentFilter(event.target.value as SentimentFilter); setPage(1); }}><option value="all">All sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select><ChevronDown size={14} /></label>
          <label className="filter-select"><Tag size={14} /><select value={topicFilter} onChange={(event) => { setTopicFilter(event.target.value as ReviewTopic | "all"); setPage(1); }}><option value="all">All topics</option>{["Cleanliness", "Check-in", "Staff", "Noise", "Facilities", "Location", "Room condition", "Value for money"].map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select><ChevronDown size={14} /></label>
          <label className="filter-select sort-select"><SlidersHorizontal size={14} /><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating">Highest rating</option></select><ChevronDown size={14} /></label>
        </div>
        <div className="date-filter-row"><span>Date range</span><input aria-label="Start date" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /><span>to</span><input aria-label="End date" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
          {(dateFrom || dateTo || search || propertyFilter !== "all" || sentimentFilter !== "all" || topicFilter !== "all") && <button className="reset-button" onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); setPropertyFilter("all"); setSentimentFilter("all"); setTopicFilter("all"); setPage(1); }}>Clear filters</button>}
        </div>
        <div className="review-list">{filtered.length ? pageReviews.map((review) => <ReviewRow key={review.id} review={review} />) : <div className="empty-state"><span className="empty-icon"><Search size={18} /></span><strong>No reviews match those filters</strong><p>Try changing the property, dates or search terms.</p></div>}</div>
        {filtered.length > 0 && <div className="review-pagination"><span>Showing <strong>{firstVisible}–{lastVisible}</strong> of {filtered.length}</span><div className="pagination-controls"><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={8}>8</option><option value={16}>16</option><option value={32}>32</option></select></label><button aria-label="Previous page" disabled={visiblePage <= 1} onClick={() => setPage(visiblePage - 1)}><ChevronLeft size={15} /></button><span>Page {visiblePage} of {pageCount}</span><button aria-label="Next page" disabled={visiblePage >= pageCount} onClick={() => setPage(visiblePage + 1)}><ChevronRight size={15} /></button></div></div>}
      </section>
      <div className="data-provenance"><span className="demo-dot" />{source === "demo" ? "Sample workspace · review examples are fictional and for interface demonstration only" : "Imported review data · loaded from the local authorized CSV dataset"}</div>
    </>
  );
}

function PropertiesView({ reviews, now, source }: { reviews: Review[]; now: Date; source: "demo" | "import" }) {
  const stats = getPropertyWeeklyRatings(reviews, now);
  const summary = getWeeklySummary(reviews, now);

  return (
    <>
      <div className="page-heading-row"><div><div className="eyebrow">OPERATIONS / PROPERTIES</div><h1>Property performance</h1><p className="page-description">Compare weekly ratings and recurring themes across the portfolio.</p></div><div className="range-chip"><CalendarDays size={15} /> {formatRange(summary.ranges.current.start, summary.ranges.current.end)}</div></div>
      <div className="property-card-grid">
        {properties.map((property, index) => {
          const propertyReviews = reviews.filter((review) => review.propertyId === property.id);
          const rating = stats.get(property.id)?.average;
          const topics = getTopicShares(propertyReviews);
          return (
            <article className="panel property-card" key={property.id}>
              <div className="property-card-top"><span className={`property-avatar property-avatar-${index + 1}`}>{property.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><a className="listing-link" href={property.listingUrl} target="_blank" rel="noreferrer">Booking.com <ExternalLink size={13} /></a></div>
              <h2>{property.name}</h2><p>{property.city}</p>
              <div className="property-card-score"><span>{rating?.toFixed(1) ?? "—"}</span><small>/ 10 this week</small></div>
              <div className="property-card-stats"><span><MessageSquareText size={14} /> {stats.get(property.id)?.reviewCount ?? 0} this week</span><span><ClipboardList size={14} /> {propertyReviews.length} total examples</span></div>
              <div className="property-card-topics"><span className="small-label">COMMON NEGATIVE TOPICS</span>{topics.length ? topics.slice(0, 2).map((topic) => <div key={topic.topic}><span>{topic.topic}</span><strong>{Math.round(topic.share * 100)}%</strong></div>) : <small>No negative topic examples</small>}</div>
            </article>
          );
        })}
      </div>
      <div className="data-provenance"><span className="demo-dot" />{source === "demo" ? "Weekly statistics use fictional sample reviews." : "Weekly statistics use imported review data."}</div>
    </>
  );
}

function InsightsView({ reviews, now, source }: { reviews: Review[]; now: Date; source: "demo" | "import" }) {
  const summary = getWeeklySummary(reviews, now);
  const currentReviews = reviews.filter((review) => review.date >= summary.ranges.current.start && review.date <= summary.ranges.current.end);
  const negativeReviews = currentReviews.filter((review) => getSentiment(review.rating) === "negative");
  const topics = getTopicShares(currentReviews);
  const topTopic = topics[0];

  return (
    <>
      <div className="page-heading-row"><div><div className="eyebrow">OPERATIONS / INSIGHTS</div><h1>Patterns worth a closer look</h1><p className="page-description">Topic-level signals from negative reviews this week.</p></div><div className="range-chip"><CalendarDays size={15} /> {formatRange(summary.ranges.current.start, summary.ranges.current.end)}</div></div>
      {topTopic ? <section className="insight-callout"><span className="insight-spark"><Sparkles size={18} /></span><div><span className="small-label">THIS WEEK’S LEADING THEME</span><h2>{Math.round(topTopic.share * 100)}% of negative reviews mention {topTopic.topic.toLowerCase()}</h2><p>{topTopic.count} of {negativeReviews.length} negative reviews matched this topic using simple keyword rules.</p></div><Compass className="callout-art" size={86} strokeWidth={0.9} /></section> : <div className="panel empty-state"><span className="empty-icon"><Sparkles size={18} /></span><strong>No negative themes to report this week</strong><p>When negative reviews appear, topic patterns will be summarized here.</p></div>}
      <section className="panel insight-list-panel"><div className="panel-heading"><div><h2>Negative review topics</h2><p>A review may mention more than one topic.</p></div></div>{topics.length ? <div className="insight-topic-list">{topics.map((topic) => <div className="insight-topic" key={topic.topic}><div className="insight-topic-heading"><div><span className="topic-rank">{String(topics.indexOf(topic) + 1).padStart(2, "0")}</span><strong>{topic.topic}</strong></div><span>{topic.count} {topic.count === 1 ? "review" : "reviews"}</span></div><div className="topic-track"><span style={{ width: `${Math.max(4, topic.share * 100)}%` }} /></div><small>{Math.round(topic.share * 100)}% of negative reviews this week</small></div>)}</div> : null}</section>
      <section className="panel recent-panel"><div className="panel-heading"><div><h2>Reviews behind the signals</h2><p>Read the guest comments included in this week’s analysis.</p></div></div>{negativeReviews.length ? <div className="recent-review-list">{negativeReviews.map((review) => <ReviewRow key={review.id} review={review} />)}</div> : <div className="empty-state compact"><strong>No negative reviews this week</strong></div>}</section>
      <p className="method-note"><CircleHelp size={15} /> Topic tagging uses keyword rules and can miss context, sarcasm, spelling variations and languages other than English.</p>
      <div className="data-provenance"><span className="demo-dot" />{source === "demo" ? "Sample workspace · insights are illustrative, not operational findings" : "Imported review data · topic tags are keyword-based estimates"}</div>
    </>
  );
}

type ImportReport = { added: number; updated: number; duplicateRows: number; total: number };

function ImportReviewsDialog({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Array<{ row: number; message: string }>>([]);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function submitImport() {
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }

    setBusy(true);
    setError("");
    setIssues([]);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/reviews", { method: "POST", body });
      const result = await response.json() as { error?: string; issues?: Array<{ row: number; message: string }>; report?: ImportReport };
      if (!response.ok || !result.report) {
        setError(result.error ?? "The import could not be completed.");
        setIssues(result.issues ?? []);
        return;
      }

      setReport(result.report);
      await onImported();
    } catch {
      setError("Could not reach the local review service. Try again when the app is running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
        <div className="dialog-heading">
          <div className="dialog-title-icon"><FileSpreadsheet size={19} /></div>
          <div><h2 id="import-dialog-title">Import review data</h2><p>Upload an authorized CSV export for these properties.</p></div>
          <button className="dialog-close" onClick={onClose} aria-label="Close import dialog"><X size={18} /></button>
        </div>
        {report ? <div className="import-success">
          <span className="success-icon"><CheckCircle2 size={22} /></span>
          <h3>Import complete</h3>
          <p>{report.added} added · {report.updated} updated · {report.duplicateRows} duplicate rows skipped</p>
          <button className="import-primary" onClick={onClose}>Done</button>
        </div> : <>
          <label className={`upload-dropzone ${file ? "has-file" : ""}`} htmlFor="review-csv-file">
            <span className="upload-icon"><Upload size={19} /></span>
            <strong>{file ? file.name : "Choose a CSV file"}</strong>
            <small>{file ? `${(file.size / 1024).toFixed(0)} KB · CSV` : "CSV only · Maximum file size 5 MB"}</small>
            <input id="review-csv-file" type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); setIssues([]); }} />
          </label>
          <a className="template-download" href="/api/review-template"><FileSpreadsheet size={14} /> Download the CSV template</a>
          <p className="import-guidance">The file is checked before it is saved. If any row is invalid, the import is cancelled and existing data stays unchanged.</p>
          {error && <div className="import-error" role="alert"><strong>{error}</strong>{issues.length > 0 && <ul>{issues.slice(0, 8).map((issue, index) => <li key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</li>)}</ul>}</div>}
          <div className="dialog-actions"><button className="import-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="import-primary" onClick={submitImport} disabled={busy || !file}>{busy ? "Checking file…" : "Import reviews"}</button></div>
        </>}
      </section>
    </div>
  );
}

export default function DashboardApp() {
  const [view, setView] = useState<ViewName>("Overview");
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [workspace, setWorkspace] = useState<{ now: Date; reviews: Review[]; source: "demo" | "import" } | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new Date();
      setWorkspace({ now: current, reviews: createDemoReviews(current), source: "demo" });
      fetch("/api/reviews", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Local review data is unavailable");
          return response.json() as Promise<{ reviews?: Review[] }>;
        })
        .then((data) => {
          if (Array.isArray(data.reviews) && data.reviews.length > 0) {
            setWorkspace({ now: current, reviews: data.reviews, source: "import" });
          }
        })
        .catch(() => setDataNotice("Could not load the local import file. Showing fictional examples instead."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const referenceDate = workspace?.now;
  const source = workspace?.source ?? "demo";
  const scopedReviews = useMemo(() => {
    const allReviews = workspace?.reviews ?? [];
    return selectedProperty === "all" ? allReviews : allReviews.filter((review) => review.propertyId === selectedProperty);
  }, [selectedProperty, workspace]);

  if (!referenceDate) {
    return <div className="dashboard-loading"><span className="brand-mark"><span /></span><p>Preparing your review workspace…</p></div>;
  }

  async function refreshImportedReviews() {
    const response = await fetch("/api/reviews", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh imported reviews");
    const data = await response.json() as { reviews?: Review[] };
    if (Array.isArray(data.reviews) && data.reviews.length > 0) {
      setWorkspace({ now: new Date(), reviews: data.reviews, source: "import" });
      setDataNotice(null);
    }
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand-lockup" href="#overview" onClick={() => setView("Overview")}>
          <span className="brand-mark"><span /></span>
          <span className="brand-name">azzurro<span>HOTELS</span></span>
        </a>
        <div className="workspace-card"><span className="workspace-icon"><Building2 size={17} /></span><span><strong>Azzurro Collection</strong><small>Operations workspace</small></span><ChevronDown size={14} /></div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? "active" : ""}`} onClick={() => setView(name)}><Icon size={17} strokeWidth={1.8} /><span>{name}</span>{name === "Insights" && <span className="nav-new">NEW</span>}</button>)}
        </nav>
        <div className="sidebar-section-label property-nav-label">YOUR PROPERTIES <span>{properties.length}</span></div>
        <div className="sidebar-properties">{properties.map((property, index) => <button key={property.id} onClick={() => { setSelectedProperty(property.id); setView("Overview"); }}><span className={`property-nav-dot dot-${index + 1}`} />{property.name}</button>)}</div>
        <div className="sidebar-bottom">
        <div className="data-source-card"><span className="live-dot" /><div><strong>{source === "demo" ? "Demo workspace" : "Imported reviews"}</strong><small>{source === "demo" ? "Sample review data" : "Local CSV dataset"}</small></div></div>
          <button className="sidebar-help"><CircleHelp size={16} /> Help &amp; guidance <ChevronRight size={14} /></button>
          <div className="user-card"><span className="user-avatar">AM</span><span><strong>Alex Morgan</strong><small>Operations manager</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{view}</strong></div>
          <div className="topbar-controls">
            <button className="import-open-button" onClick={() => setImportOpen(true)}><Upload size={14} /><span>Import reviews</span></button>
            <span className={`demo-status ${source === "import" ? "imported" : ""}`}><i /> {source === "demo" ? "DEMO DATA" : "IMPORTED DATA"}</span>
            <label className="top-property-select"><Building2 size={15} /><select aria-label="Filter dashboard by property" value={selectedProperty} onChange={(event) => setSelectedProperty(event.target.value)}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><ChevronDown size={14} /></label>
            <button className="topbar-avatar" aria-label="User profile">AM</button>
          </div>
        </header>
        <div className="content-area">
          {dataNotice && <div className="data-warning" role="status">{dataNotice}</div>}
          {view === "Overview" && <Overview selectedProperty={selectedProperty} reviews={scopedReviews} now={referenceDate} source={source} onOpenReviews={() => setView("Reviews")} />}
          {view === "Reviews" && <ReviewsView reviews={scopedReviews} source={source} />}
          {view === "Properties" && <PropertiesView reviews={scopedReviews} now={referenceDate} source={source} />}
          {view === "Insights" && <InsightsView reviews={scopedReviews} now={referenceDate} source={source} />}
          <footer className="app-footer"><span>AZZURRO REVIEW INTELLIGENCE</span><span>Designed for clearer guest experience decisions</span></footer>
        </div>
      </main>
      {importOpen && <ImportReviewsDialog onClose={() => setImportOpen(false)} onImported={refreshImportedReviews} />}
    </div>
  );
}
