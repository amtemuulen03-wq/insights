"use client";

import { useMemo, useState } from "react";

type CampaignPost = {
  platform: string;
  postId: string;
  postUrl: string | null;
  contentType: string;
  caption: string | null;
  impressions: number;
  reach: number | null;
  totalClicks: number | null;
  linkClicks: number | null;
  clicksSupported: boolean;
  engagement: number;
  videoViews: number;
  spend: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

type DailyPoint = {
  date: string;
  impressions: number;
  clicks: number;
  totalClicks: number;
  engagement: number;
  sales: number;
};

type WeeklyPoint = {
  week: string;
  platform: string;
  impressions: number;
  clicks: number;
  totalClicks: number;
  engagement: number;
};

type PlatformMix = {
  platform: string;
  impressions: number;
  clicks: number;
  engagement: number;
};

type PublisherPlatformMix = {
  platform: string;
  spend: number;
};

export type CampaignDetail = {
  period: { start: string; end: string };
  metadata: {
    campaignName: string;
    budgetCodes: string[];
    campaignTypes: string[];
    responsibles: string[];
    brands: string[];
    platforms: string[];
    startDate: string;
    endDate: string;
    lifespanDays: number;
  };
  totals: {
    posts: number;
    spend: number;
    impressions: number;
    clicks: number;
    linkClicks: number;
    reach: number;
    videoViews: number;
    engagement: number;
    ctr: number;
    engagementRate: number;
    completionRate: number;
    sales: number;
  };
  placeholderMetrics: string[];
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  publisherPlatformMix: PublisherPlatformMix[];
  platformMix: PlatformMix[];
  posts: CampaignPost[];
};

type PostSortKey =
  | "platform"
  | "contentType"
  | "spend"
  | "impressions"
  | "totalClicks"
  | "ctr"
  | "engagement"
  | "cpc"
  | "cpm";

type SortDirection = "asc" | "desc";

const PLATFORM_COLORS: Record<string, string> = {
  Facebook: "#2563eb",
  Instagram: "#db2777",
  YouTube: "#dc2626",
};

const PUBLISHER_PLATFORM_COLORS: Record<string, string> = {
  facebook: "#2563eb",
  instagram: "#db2777",
  threads: "#94a3b8",
  audience_network: "#fb923c",
  messenger: "#06b6d4",
  whatsapp: "#22c55e",
};

const MNT_PER_USD = 3594;

function formatNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatCompact(value: number) {
  const absolute = Math.abs(value);
  const units = [
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "k" },
  ];
  const unit = units.find((item) => absolute >= item.threshold);

  if (!unit) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  const scaled = Math.trunc((value / unit.threshold) * 10) / 10;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(scaled)}${unit.suffix}`;
}

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return `₮${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value * MNT_PER_USD)}`;
}

function formatCompactMoney(value: number) {
  return `₮${formatCompact(value * MNT_PER_USD)}`;
}

function truncateText(value: string, maximum = 50) {
  return value.length > maximum ? `${value.slice(0, maximum)}...` : value;
}

function publisherPlatformLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DemoBadge() {
  return <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Demo</span>;
}

function Kpi({ label, value, demo = false }: { label: string; value: string; demo?: boolean }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}{demo && <DemoBadge />}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function PublisherPlatformBar({ values }: { values: PublisherPlatformMix[] }) {
  const visibleValues = values.filter(
    (item) => item.platform.toLowerCase() !== "unknown" && item.spend > 0,
  );
  const totalSpend = visibleValues.reduce((sum, item) => sum + item.spend, 0);

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Platform Spend Distribution</h2>

      {totalSpend > 0 ? (
        <>
          <div className="mt-4 flex h-10 w-full overflow-hidden rounded-lg bg-slate-100">
            {visibleValues.map((item) => {
              const percentage = (item.spend / totalSpend) * 100;
              const normalizedPlatform = item.platform.toLowerCase();
              const useDarkText = normalizedPlatform === "threads" || normalizedPlatform === "audience_network";
              return (
                <div
                  key={item.platform}
                  title={`${publisherPlatformLabel(item.platform)} · ${percentage.toFixed(1)}% · ${formatCompactMoney(item.spend)}`}
                  className={`flex h-full items-center justify-center overflow-hidden border-r border-white/70 px-1 text-[11px] font-bold last:border-r-0 ${useDarkText ? "text-slate-900" : "text-white"}`}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: PUBLISHER_PLATFORM_COLORS[normalizedPlatform] ?? "#64748b",
                  }}
                >
                  {percentage >= 7 && <span className="truncate">{formatCompactMoney(item.spend)}</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
            {visibleValues.map((item) => {
              const normalizedPlatform = item.platform.toLowerCase();
              const percentage = (item.spend / totalSpend) * 100;
              return (
                <span key={item.platform} className="inline-flex items-center gap-2">
                  <i
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: PUBLISHER_PLATFORM_COLORS[normalizedPlatform] ?? "#64748b" }}
                  />
                  <strong>{publisherPlatformLabel(item.platform)}</strong>
                  <span className="tabular-nums text-slate-500">{percentage.toFixed(1)}% · {formatCompactMoney(item.spend)}</span>
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No publisher-platform spend data was returned for this campaign.
        </div>
      )}
    </section>
  );
}

function LineComparison({
  title,
  points,
  primaryKey,
  primaryLabel,
}: {
  title: string;
  points: DailyPoint[];
  primaryKey: "impressions" | "clicks";
  primaryLabel: string;
}) {
  const width = 700;
  const height = 280;
  const margin = { top: 24, right: 58, bottom: 38, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const primaryMaximum = Math.max(1, ...points.map((point) => point[primaryKey]));
  const salesMaximum = Math.max(1, ...points.map((point) => point.sales));
  const x = (index: number) => points.length <= 1 ? margin.left + plotWidth / 2 : margin.left + (index / (points.length - 1)) * plotWidth;
  const primaryY = (value: number) => margin.top + plotHeight - (value / primaryMaximum) * plotHeight;
  const salesY = (value: number) => margin.top + plotHeight - (value / salesMaximum) * plotHeight;
  const barWidth = Math.max(3, Math.min(24, (plotWidth / Math.max(points.length, 1)) * 0.68));
  const salesPath = points.reduce((result, point, index) => {
    const currentX = x(index);
    const currentY = salesY(point.sales);
    if (index === 0) return `M ${currentX} ${currentY}`;

    const previousX = x(index - 1);
    const previousY = salesY(points[index - 1].sales);
    const controlX = (previousX + currentX) / 2;
    return `${result} C ${controlX} ${previousY}, ${controlX} ${currentY}, ${currentX} ${currentY}`;
  }, "");

  return (
    <article className="h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <div className="flex gap-3 text-xs text-slate-500">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-500/70" />{primaryLabel}</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-500" />Sales (demo)</span>
        </div>
      </div>
      {!points.length ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">No daily snapshot changes in this period.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
          {[0, 1, 2, 3, 4].map((index) => {
            const tickY = margin.top + (index / 4) * plotHeight;
            const primaryValue = primaryMaximum * (1 - index / 4);
            const salesValue = salesMaximum * (1 - index / 4);
            return (
              <g key={index}>
                <line x1={margin.left} x2={width - margin.right} y1={tickY} y2={tickY} stroke="#e2e8f0" />
                <text x={margin.left - 8} y={tickY + 4} textAnchor="end" fontSize="11" fill="#4f46e5">{formatCompact(primaryValue)}</text>
                <text x={width - margin.right + 8} y={tickY + 4} textAnchor="start" fontSize="11" fill="#0891b2">{formatCompact(salesValue)}</text>
              </g>
            );
          })}
          {points.map((point, index) => (
            <rect
              key={`${point.date}-${primaryKey}`}
              x={x(index) - barWidth / 2}
              y={primaryY(point[primaryKey])}
              width={barWidth}
              height={Math.max(0, margin.top + plotHeight - primaryY(point[primaryKey]))}
              rx="2"
              fill="#6366f1"
              fillOpacity="0.62"
            />
          ))}
          <path d={salesPath} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => (
            <circle key={`${point.date}-sales`} cx={x(index)} cy={salesY(point.sales)} r="3" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
          ))}
          {points.map((point, index) => index % Math.max(1, Math.ceil(points.length / 5)) === 0 ? <text key={point.date} x={x(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="#64748b">{point.date.slice(5)}</text> : null)}
        </svg>
      )}
    </article>
  );
}

function Funnel({ detail }: { detail: CampaignDetail }) {
  const rows = [
    { label: "Impressions", value: detail.totals.impressions, width: "100%", color: "#4f46e5", demo: false },
    { label: "Clicks", value: detail.totals.linkClicks, width: "78%", color: "#0284c7", demo: false },
    { label: "Sales", value: detail.totals.sales, width: "56%", color: "#0891b2", demo: true },
  ];
  return (
    <article className="h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Performance Funnel</h2>
      <div className="mt-5 flex flex-col items-center gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex h-[70px] items-center justify-center text-white" style={{ width: row.width, backgroundColor: row.color, clipPath: "polygon(4% 0, 96% 0, 88% 100%, 12% 100%)" }}>
            <div className="text-center"><p className="text-xl font-semibold">{formatCompact(row.value)}</p><p className="text-xs text-white/80">{row.label}{row.demo && " · demo"}</p></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function PlatformDonut({ values }: { values: PlatformMix[] }) {
  const total = values.reduce((sum, item) => sum + item.clicks, 0);
  let progress = 0;
  const segments = values.map((item) => {
    const start = progress;
    const length = total ? (item.clicks / total) * 100 : 0;
    progress += length;
    return { ...item, start, length };
  });
  return (
    <article className="h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Clicks by Source</h2>
      <p className="mt-1 text-xs font-medium text-slate-600">Facebook uses link clicks; Instagram and YouTube use the configured source-interaction proxy.</p>
      <div className="mt-5 grid min-h-56 grid-cols-[128px_minmax(0,1fr)] items-center gap-3">
        <svg viewBox="0 0 120 120" className="h-32 w-32 max-w-full justify-self-center -rotate-90" role="img" aria-label="Clicks by platform">
          <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" strokeWidth="20" />
          {segments.map((item) => <circle key={item.platform} cx="60" cy="60" r="42" fill="none" stroke={PLATFORM_COLORS[item.platform] ?? "#64748b"} strokeWidth="20" pathLength="100" strokeDasharray={`${item.length} ${100 - item.length}`} strokeDashoffset={-item.start} />)}
        </svg>
        <div className="w-full space-y-2">
          {values.map((item) => <div key={item.platform} className="flex justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-medium text-slate-800"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[item.platform] ?? "#64748b" }} />{item.platform}</span><span className="font-bold tabular-nums text-slate-950">{formatNumber(item.clicks)}</span></div>)}
          {!total && <p className="text-xs text-slate-500">No click-capable source returned clicks.</p>}
        </div>
      </div>
    </article>
  );
}

function WeeklyBars({ title, rows, metric }: { title: string; rows: WeeklyPoint[]; metric: "impressions" | "clicks" }) {
  const weeks = Array.from(new Set(rows.map((row) => row.week))).sort();
  const totals = weeks.map((week) => rows.filter((row) => row.week === week).reduce((sum, row) => sum + row[metric], 0));
  const maximum = Math.max(1, ...totals);
  return (
    <article className="h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <div className="mt-5 flex h-56 items-end gap-3 border-b border-slate-200 px-2">
        {!weeks.length && <p className="m-auto text-sm text-slate-500">No weekly snapshot changes.</p>}
        {weeks.map((week, weekIndex) => {
          const weekRows = rows.filter((row) => row.week === week);
          return <div key={week} className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${Math.max(2, (totals[weekIndex] / maximum) * 88)}%` }}>{weekRows.map((row) => <div key={row.platform} title={`${row.platform}: ${formatNumber(row[metric])}`} style={{ height: `${totals[weekIndex] ? (row[metric] / totals[weekIndex]) * 100 : 0}%`, backgroundColor: PLATFORM_COLORS[row.platform] ?? "#64748b" }} />)}</div><span className="mt-2 truncate text-center text-[10px] text-slate-500">{week}</span></div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">{Object.entries(PLATFORM_COLORS).map(([platform, color]) => <span key={platform}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{platform}</span>)}</div>
    </article>
  );
}

function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string;
  column: PostSortKey;
  activeColumn: PostSortKey;
  direction: SortDirection;
  onSort: (column: PostSortKey) => void;
}) {
  const isActive = activeColumn === column;
  const arrow = isActive ? (direction === "asc" ? "↑" : "↓") : "↕";

  return (
    <th className="px-4 py-3 font-bold">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-blue-700"
        aria-label={`Sort ${label} ${isActive && direction === "asc" ? "descending" : "ascending"}`}
      >
        {label}
        <span className={isActive ? "text-blue-700" : "text-slate-400"}>{arrow}</span>
      </button>
    </th>
  );
}

export default function CampaignDetailClient({
  initialDetail,
  campaignOptions,
}: {
  initialDetail: CampaignDetail;
  campaignOptions: string[];
}) {
  const detail = initialDetail;
  const [sortColumn, setSortColumn] = useState<PostSortKey>("engagement");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAllPosts, setShowAllPosts] = useState(false);

  const sortedPosts = useMemo(() => {
    return [...detail.posts].sort((leftPost, rightPost) => {
      const left = leftPost[sortColumn];
      const right = rightPost[sortColumn];

      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;

      const comparison = typeof left === "string" && typeof right === "string"
        ? left.localeCompare(right)
        : Number(left) - Number(right);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [detail.posts, sortColumn, sortDirection]);

  const visiblePosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, 5);

  const handleSort = (column: PostSortKey) => {
    if (column === sortColumn) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortColumn(column);
    setSortDirection(column === "platform" || column === "contentType" ? "asc" : "desc");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px]">
        <a href="/insights/dashboard/campaign" className="mb-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800">← Back to dashboard</a>
        <section className="rounded-2xl bg-[#06245d] p-4 text-white shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Inspect Campaign</p><select value={detail.metadata.campaignName} onChange={(event) => window.location.assign(`/insights/campaign?campaign=${encodeURIComponent(event.target.value)}`)} className="mt-1 h-11 w-full max-w-4xl rounded-lg border border-white/15 bg-white/10 px-3 text-lg font-semibold text-white outline-none"><option className="text-slate-900" value={detail.metadata.campaignName}>{detail.metadata.campaignName}</option>{campaignOptions.filter((campaign) => campaign !== detail.metadata.campaignName).map((campaign) => <option className="text-slate-900" key={campaign} value={campaign}>{campaign}</option>)}</select><p className="mt-2 text-xs text-blue-100">Budget: {detail.metadata.budgetCodes.join(", ") || "—"} · Type: {detail.metadata.campaignTypes.join(", ") || "—"} · Responsible: {detail.metadata.responsibles.join(", ") || "—"}</p></div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-blue-50"><span className="block text-[10px] uppercase tracking-wider text-blue-200">Campaign lifetime</span>{detail.metadata.startDate} → {detail.metadata.endDate}<span className="ml-2 text-xs font-medium text-blue-200">({detail.metadata.lifespanDays} days)</span></div>
          </div>
        </section>

        <section className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Kpi label="Posts" value={formatCompact(detail.totals.posts)} />
          <Kpi label="Total Spend" value={formatCompactMoney(detail.totals.spend)} />
          <Kpi label="Impressions" value={formatCompact(detail.totals.impressions)} />
          <Kpi label="CTR" value={`${detail.totals.ctr.toFixed(2)}%`} />
          <Kpi label="Engagement Rate" value={`${detail.totals.engagementRate.toFixed(2)}%`} />
          <Kpi label="Completion Rate" value={`${detail.totals.completionRate.toFixed(1)}%`} demo />
        </section>

        <PublisherPlatformBar values={detail.publisherPlatformMix} />

        <section className="space-y-4">
          <div className="grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]">
            <div className="min-w-0 [&>*]:h-full"><Funnel detail={detail} /></div>
            <div className="min-w-0 [&>*]:h-full"><LineComparison title="Impressions vs Sales" points={detail.daily} primaryKey="impressions" primaryLabel="Impressions" /></div>
            <div className="min-w-0 lg:col-span-2 xl:col-span-1 [&>*]:h-full"><LineComparison title="Clicks vs Sales" points={detail.daily} primaryKey="clicks" primaryLabel="Clicks" /></div>
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]">
            <div className="min-w-0 [&>*]:h-full"><PlatformDonut values={detail.platformMix} /></div>
            <div className="min-w-0 [&>*]:h-full"><WeeklyBars title="Impressions by Week and Source" rows={detail.weekly} metric="impressions" /></div>
            <div className="min-w-0 lg:col-span-2 xl:col-span-1 [&>*]:h-full"><WeeklyBars title="Clicks by Week and Source" rows={detail.weekly} metric="clicks" /></div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Posts Performance</h2>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Showing {showAllPosts || detail.posts.length <= 5 ? detail.posts.length : 5} of {detail.posts.length} posts. Click a column arrow to change the sort order.
              </p>
            </div>
            {detail.posts.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllPosts((current) => !current)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
                aria-expanded={showAllPosts}
              >
                {showAllPosts ? "Show top 5" : `Show all ${detail.posts.length}`}
                <span aria-hidden="true">{showAllPosts ? "↑" : "↓"}</span>
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm text-slate-650">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-800">
                <tr>
                  <SortableHeader label="Source" column="platform" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Content Type" column="contentType" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <th className="px-4 py-3 font-bold">Caption</th>
                  <SortableHeader label="Amount Spent" column="spend" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Impressions" column="impressions" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Clicks" column="totalClicks" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="CTR" column="ctr" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Engagement" column="engagement" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="CPC" column="cpc" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="CPM" column="cpm" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                {visiblePosts.map((post) => {
                  const fullCaption = post.caption?.trim() || "No caption";
                  const visibleCaption = truncateText(fullCaption);
                  return (
                    <tr key={`${post.platform}-${post.postId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-650">{post.platform}</td>
                      <td className="px-4 py-3 text-slate-650">{post.contentType}</td>
                      <td className="max-w-80 px-4 py-3 text-xs font-semibold text-slate-650" title={fullCaption}>
                        {post.postUrl ? (
                          <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">
                            {visibleCaption}
                          </a>
                        ) : visibleCaption}
                      </td>
                      <td className="bg-amber-50 px-4 py-3 tabular-nums text-slate-650">{formatMoney(post.spend)}</td>
                      <td className="bg-slate-50 px-4 py-3 tabular-nums text-slate-650">{formatNumber(post.impressions)}</td>
                      <td className="bg-sky-50 px-4 py-3 tabular-nums text-slate-650">{formatNumber(post.totalClicks)}</td>
                      <td className="bg-emerald-50 px-4 py-3 tabular-nums text-slate-650">{post.ctr === null ? "—" : `${post.ctr.toFixed(2)}%`}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-650">{formatNumber(post.engagement)}</td>
                      <td className="bg-fuchsia-50 px-4 py-3 tabular-nums text-slate-650">{formatMoney(post.cpc)}</td>
                      <td className="bg-rose-50 px-4 py-3 tabular-nums text-slate-650">{formatMoney(post.cpm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
