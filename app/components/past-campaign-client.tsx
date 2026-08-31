"use client";

import { useMemo, useState } from "react";

export type PastCampaignOption = {
  campaignName: string;
  startDate: string | null;
  endDate: string | null;
};

type MetricKey =
  | "cpp"
  | "organicImpressionPercent"
  | "averageViews"
  | "averageReach"
  | "ctr"
  | "engagementRate"
  | "averageEngagement";

type ActualMetricRow = {
  brand: string;
  platform: string;
  posts: number;
  spend: number;
  impressions: number;
  reach: number;
  videoViews: number;
  videoPosts: number;
  clicks: number;
  engagement: number;
  averageViews: number | null;
  averageReach: number | null;
  ctr: number | null;
  engagementRate: number | null;
  averageEngagement: number | null;
  organicImpressionPercent: number | null;
};

type SpecifiedBenchmark = {
  brand: string;
  mediaType: string;
  channel: string;
  platform: string;
  objective: string | null;
  funnel: "TOFU" | "MOFU" | "BOFU";
  metricKey: MetricKey;
  metric: string;
  benchmark: number;
  benchmarkYear: number;
};

export type PastCampaignScorecard = {
  metadata: {
    campaignName: string;
    campaignType: string;
    brands: string[];
    platforms: string[];
    startDate: string;
    endDate: string;
    lifespanDays: number;
    benchmarkYear: number;
    inferredObjective: string | null;
  };
  totals: {
    posts: number;
    spend: number;
    impressions: number;
    reach: number;
    videoViews: number;
    videoPosts: number;
    clicks: number;
    engagement: number;
    averageViews: number | null;
    averageReach: number | null;
    ctr: number | null;
  };
  cppByBrand: Record<string, number | null>;
  actuals: ActualMetricRow[];
  specifiedBenchmarks: SpecifiedBenchmark[];
};

const MNT_PER_USD = 3594;
const OBJECTIVES = ["Link_click", "Awareness", "Engagement"];
const METRIC_WEIGHTS: Record<MetricKey, number> = {
  cpp: 15,
  organicImpressionPercent: 0,
  averageViews: 5,
  averageReach: 5,
  ctr: 10,
  engagementRate: 2.5,
  averageEngagement: 2.5,
};

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

function formatMoney(value: number) {
  return `₮${formatCompact(value * MNT_PER_USD)}`;
}

function formatMetric(value: number | null, key: MetricKey) {
  if (value === null) return "Unavailable";
  if (key === "cpp") {
    return `₮${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value * MNT_PER_USD)}`;
  }
  if (
    key === "ctr" ||
    key === "engagementRate" ||
    key === "organicImpressionPercent"
  ) {
    return `${value.toFixed(2)}%`;
  }
  return formatCompact(value);
}

function metricScore(
  actual: number | null,
  benchmark: number,
  lowerIsBetter: boolean,
) {
  if (actual === null) return null;
  if (benchmark <= 0) return actual > 0 ? 100 : 0;
  if (lowerIsBetter) {
    if (actual <= 0) return 100;
    return Math.min(100, benchmark / actual * 100);
  }
  return Math.min(100, actual / benchmark * 100);
}

function actualMetricValue(
  source: ActualMetricRow | undefined,
  key: MetricKey,
) {
  if (!source || key === "cpp") return null;

  switch (key) {
    case "organicImpressionPercent":
      return source.organicImpressionPercent;
    case "averageViews":
      return source.averageViews;
    case "averageReach":
      return source.averageReach;
    case "ctr":
      return source.ctr;
    case "engagementRate":
      return source.engagementRate;
    case "averageEngagement":
      return source.averageEngagement;
  }

  return null;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function PointsSlider({
  label,
  value,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="flex items-center justify-between gap-4">
        <span>
          <span className="block font-semibold text-slate-950">{label}</span>
          <span className="mt-1 block text-xs text-slate-500">
            Assign points directly from 0 to {maximum}
          </span>
        </span>
        <strong className="text-2xl tabular-nums text-blue-700">
          {value} / {maximum}
        </strong>
      </span>
      <input
        type="range"
        min="0"
        max={maximum}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-5 w-full accent-blue-600"
      />
      <span className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
        <span>0</span><span>{Math.round(maximum / 2)}</span><span>{maximum}</span>
      </span>
    </label>
  );
}

export default function PastCampaignClient({
  initialScorecard,
  campaignOptions,
}: {
  initialScorecard: PastCampaignScorecard;
  campaignOptions: PastCampaignOption[];
}) {
  const detail = initialScorecard;
  const [objective, setObjective] = useState(
    detail.metadata.inferredObjective ?? "",
  );
  const [salesPoints, setSalesPoints] = useState(0);
  const [completionPoints, setCompletionPoints] = useState(0);

  const score = useMemo(() => {
    const applicable = detail.specifiedBenchmarks.filter(
      (benchmark) =>
        benchmark.platform !== "Meta" ||
        !objective ||
        benchmark.objective === objective,
    );
    const countByMetric = applicable.reduce<Record<string, number>>(
      (counts, benchmark) => {
        counts[benchmark.metricKey] =
          (counts[benchmark.metricKey] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const rows = applicable.map((benchmark) => {
      const source = detail.actuals.find(
        (actual) =>
          actual.brand === benchmark.brand &&
          actual.platform === benchmark.platform,
      );
      const actual = benchmark.metricKey === "cpp"
        ? detail.cppByBrand[benchmark.brand] ?? null
        : actualMetricValue(source, benchmark.metricKey);
      const waitingForObjective = benchmark.platform === "Meta" && !objective;
      const achievement = waitingForObjective
        ? null
        : metricScore(
            actual,
            benchmark.benchmark,
            benchmark.metricKey === "cpp",
          );
      const metricWeight = METRIC_WEIGHTS[benchmark.metricKey];
      const rowWeight = waitingForObjective
        ? 0
        : metricWeight /
          Math.max(1, countByMetric[benchmark.metricKey] ?? 1);

      return {
        ...benchmark,
        actual,
        achievement,
        waitingForObjective,
        rowWeight,
        points: achievement === null
          ? null
          : achievement * rowWeight / 100,
      };
    });
    const availableDataWeight = rows.reduce(
      (sum, row) =>
        sum + (row.achievement === null ? 0 : row.rowWeight),
      0,
    );
    const dataPoints = rows.reduce(
      (sum, row) => sum + (row.points ?? 0),
      0,
    );

    return {
      rows,
      availableWeight: 60 + availableDataWeight,
      earnedPoints: salesPoints + completionPoints + dataPoints,
    };
  }, [completionPoints, detail, objective, salesPoints]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px]">
        <a
          href="/insights/dashboard/campaign"
          className="mb-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          ← Back to dashboard
        </a>

        <section className="rounded-2xl bg-[#06245d] p-4 text-white shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Inspect Past Campaigns
              </p>
              <select
                value={detail.metadata.campaignName}
                onChange={(event) =>
                  window.location.assign(
                    `/insights/past-campaign?campaign=${encodeURIComponent(event.target.value)}`,
                  )
                }
                className="mt-1 h-11 w-full max-w-4xl rounded-lg border border-white/15 bg-white/10 px-3 text-lg font-semibold text-white outline-none"
              >
                {campaignOptions.map((campaign) => (
                  <option
                    className="text-slate-900"
                    key={campaign.campaignName}
                    value={campaign.campaignName}
                  >
                    {campaign.campaignName}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-blue-100">
                {detail.metadata.brands.join(", ") || "Unknown brand"} · {detail.metadata.platforms.join(", ")} · {detail.metadata.benchmarkYear} specified benchmarks
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                  Meta objective
                </span>
                <select
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  className="mt-1 min-w-44 bg-transparent text-sm font-semibold text-white outline-none"
                >
                  <option className="text-slate-900" value="">Choose objective</option>
                  {OBJECTIVES.map((item) => (
                    <option className="text-slate-900" key={item} value={item}>
                      {item.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-blue-50">
                <span className="block text-[10px] uppercase tracking-wider text-blue-200">
                  Campaign lifetime
                </span>
                {detail.metadata.startDate} → {detail.metadata.endDate}
                <span className="ml-2 text-xs font-medium text-blue-200">
                  ({detail.metadata.lifespanDays} days)
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Kpi label="Posts" value={formatCompact(detail.totals.posts)} />
          <Kpi label="Total Spend" value={formatMoney(detail.totals.spend)} />
          <Kpi label="Impressions" value={formatCompact(detail.totals.impressions)} />
          <Kpi label={`Avg Views · ${formatCompact(detail.totals.videoPosts)} video posts`} value={detail.totals.averageViews === null ? "—" : formatCompact(detail.totals.averageViews)} />
          <Kpi label="Average Reach" value={detail.totals.averageReach === null ? "—" : formatCompact(detail.totals.averageReach)} />
          <Kpi label="CTR" value={detail.totals.ctr === null ? "—" : `${detail.totals.ctr.toFixed(2)}%`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <PointsSlider
            label="Sales Target"
            value={salesPoints}
            maximum={35}
            onChange={setSalesPoints}
          />
          <PointsSlider
            label="Campaign Completion"
            value={completionPoints}
            maximum={25}
            onChange={setCompletionPoints}
          />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-950">
                Specified Benchmark
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Each metric is matched by brand, platform, objective where applicable, and funnel level. Average views uses video posts only. CPP is campaign total spend divided by average impressions per post.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    {["Brand", "Platform", "Objective", "Funnel", "Metric", "Actual", "Specified Benchmark", "Achievement", "Weight", "Points"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {score.rows.map((row) => (
                    <tr
                      key={`${row.brand}-${row.platform}-${row.objective ?? "all"}-${row.metricKey}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-slate-950">{row.brand}</td>
                      <td className="px-4 py-3">{row.platform}</td>
                      <td className="px-4 py-3">{row.objective?.replace("_", " ") ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row.funnel === "TOFU" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}`}>
                          {row.funnel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-950">{row.metric}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMetric(row.actual, row.metricKey)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMetric(row.benchmark, row.metricKey)}</td>
                      <td className="px-4 py-3 tabular-nums">{row.waitingForObjective ? "Select objective" : row.achievement === null ? "Not available" : `${row.achievement.toFixed(1)}%`}</td>
                      <td className="px-4 py-3 tabular-nums">{row.rowWeight ? `${row.rowWeight.toFixed(2)}%` : "Info"}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-950">{row.points === null ? "—" : row.points.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!score.rows.length && (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-sm text-slate-500">
                        No specified benchmark matches this campaign&apos;s brand and platform.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-blue-50/60">
                    <td className="px-4 py-3 text-slate-950" colSpan={4}>Manual score</td>
                    <td className="px-4 py-3 text-slate-950">Sales Target</td>
                    <td className="px-4 py-3 tabular-nums">{salesPoints} / 35</td>
                    <td className="px-4 py-3">Specified manually</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 tabular-nums">35%</td>
                    <td className="px-4 py-3 tabular-nums text-slate-950">{salesPoints.toFixed(2)}</td>
                  </tr>
                  <tr className="bg-blue-50/60">
                    <td className="px-4 py-3 text-slate-950" colSpan={4}>Manual score</td>
                    <td className="px-4 py-3 text-slate-950">Campaign Completion</td>
                    <td className="px-4 py-3 tabular-nums">{completionPoints} / 25</td>
                    <td className="px-4 py-3">Specified manually</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 tabular-nums">25%</td>
                    <td className="px-4 py-3 tabular-nums text-slate-950">{completionPoints.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <aside className="flex flex-col justify-between rounded-2xl bg-[#06245d] p-6 text-white shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Overall Score
              </p>
              <p className="mt-3 text-6xl font-bold tracking-tight">
                {score.earnedPoints.toFixed(1)}
              </p>
              <p className="mt-1 text-sm text-blue-100">out of 100</p>
            </div>
            <div className="mt-8 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-blue-200">Available score coverage</span>
                <strong>{score.availableWeight.toFixed(1)}%</strong>
              </div>
              {!objective && (
                <p className="border-t border-white/15 pt-3 text-xs leading-relaxed text-amber-200">
                  CPP is shown below. Choose the Meta objective to score the applicable 15-point benchmark.
                </p>
              )}
              <p className="border-t border-white/15 pt-3 text-xs leading-relaxed text-blue-100">
                Organic Imp% is shown for reference and remains unavailable until a true organic-impressions field is mapped; organic video views are not substituted.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
