"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type FilterRow = {
  campaignName: string | null;
  responsible: string | null;
  campaignType: string | null;
  brand: string | null;
  budgetCode: string | null;
  platform: string | null;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
};

export type PastCampaignOption = {
  campaignName: string;
  startDate: string | null;
  endDate: string | null;
};

type PlatformSummary = {
  posts: number;
  campaigns: number;
  impressions: number;
  reach: number | null;
  reachSupported: boolean;
  clicks: number;
  engagement: number;
  adSpend: number;
};

export type DashboardSummary = {
  period: { start: string; end: string };
  campaigns: number;
  impressions: number;
  engagement: number;
  adSpend: number;
  ctr: number | null;
  reach: {
    value: number | null;
    includedPlatforms: string[];
    excludedPlatforms: string[];
  };
  platforms: Record<string, PlatformSummary>;
};

export type TimeSeriesPoint = {
  date: string;
  campaign: string;
  impressions: number;
  videoViews: number;
  engagement: number;
};

export type DashboardTimeSeries = {
  period: { start: string; end: string };
  campaigns: string[];
  points: TimeSeriesPoint[];
};

type RankingItem = {
  campaign: string;
  value: number;
  postCount: number;
};

type RankingMetric = {
  benchmark: number;
  items: RankingItem[];
};

export type DashboardRankings = {
  impressions: RankingMetric;
  videoViews: RankingMetric;
  engagement: RankingMetric;
};

type ChartMetric = "impressions" | "videoViews" | "engagement";
type DatePreset =
  | "custom"
  | "lastWeek"
  | "lastTwoWeeks"
  | "lastMonth"
  | "lastQuarter"
  | "lastSixMonths"
  | "lastYear";

type FilterSelection = {
  budgetCode: string[];
  brand: string[];
  campaign: string[];
  campaignType: string[];
  responsible: string[];
  platform: string[];
};

const EMPTY_FILTERS: FilterSelection = {
  budgetCode: [],
  brand: [],
  campaign: [],
  campaignType: [],
  responsible: [],
  platform: [],
};

const MNT_PER_USD = 3594;

const CHART_METRICS: Array<{ key: ChartMetric; label: string }> = [
  { key: "impressions", label: "Impressions" },
  { key: "videoViews", label: "Video views" },
  { key: "engagement", label: "Engagement" },
];

const DATE_PRESETS: Array<{
  key: Exclude<DatePreset, "custom">;
  label: string;
  days: number;
}> = [
  { key: "lastWeek", label: "Last Week", days: 7 },
  { key: "lastTwoWeeks", label: "Last 2 Weeks", days: 14 },
  { key: "lastMonth", label: "Last Month", days: 30 },
  { key: "lastQuarter", label: "Last Quarter", days: 90 },
  { key: "lastSixMonths", label: "Last 6 Months", days: 180 },
  { key: "lastYear", label: "Last Year", days: 365 },
];

const FILTER_ROW_KEYS: Record<
  keyof FilterSelection,
  keyof FilterRow
> = {
  budgetCode: "budgetCode",
  brand: "brand",
  campaign: "campaignName",
  campaignType: "campaignType",
  responsible: "responsible",
  platform: "platform",
};

function formatNumber(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US").format(Math.round(value));
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

function formatMoney(value: number) {
  return `₮${formatCompact(value * MNT_PER_USD)}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function previousPeriod(start: string, end: string) {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  const dayMilliseconds = 86_400_000;
  const periodDays =
    Math.round(
      (endDate.getTime() - startDate.getTime()) / dayMilliseconds,
    ) + 1;
  const previousEnd = new Date(startDate.getTime() - dayMilliseconds);
  const previousStart = new Date(
    previousEnd.getTime() - (periodDays - 1) * dayMilliseconds,
  );

  return {
    start: formatIsoDate(previousStart),
    end: formatIsoDate(previousEnd),
  };
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function campaignColor(campaign: string) {
  let hash = 0;
  for (let index = 0; index < campaign.length; index += 1) {
    hash = campaign.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360} 68% 46%)`;
}

function MetricCard({
  label,
  value,
  note,
  currency = false,
  percentage = false,
  delta,
}: {
  label: string;
  value: number | null;
  note?: string;
  currency?: boolean;
  percentage?: boolean;
  delta?: number | null;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {value === null
          ? "—"
          : currency
            ? formatMoney(value)
            : percentage
              ? `${value.toFixed(2)}%`
            : formatCompact(value)}
      </p>
      {delta !== undefined && (
        <p
          className={`mt-2 text-xs font-bold ${
            delta === null || delta > 0
              ? "text-emerald-600"
              : delta < 0
                ? "text-red-600"
                : "text-slate-500"
          }`}
        >
          {delta === null
            ? "↑ New"
            : `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(delta).toFixed(1)}%`}
          <span className="ml-1 font-medium text-slate-500">
            vs previous period
          </span>
        </p>
      )}
      {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
    </article>
  );
}

function MultiSelectFilter({
  label,
  values,
  options,
  onToggle,
  onClear,
}: {
  label: string;
  values: string[];
  options: string[];
  onToggle: (value: string, checked: boolean) => void;
  onClear: () => void;
}) {
  const summary = values.length === 0
    ? "All"
    : values.length === 1
      ? values[0]
      : `${values.length} selected`;

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <details className="group relative">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition marker:hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
          <span className="truncate">{summary}</span>
          <span className="ml-2 text-xs text-slate-400 transition group-open:rotate-180">▼</span>
        </summary>
        <div className="absolute left-0 z-30 mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <button type="button" onClick={onClear} className="mb-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50">Clear selection</button>
          {!options.length && <p className="px-2 py-3 text-xs text-slate-500">No available options</p>}
          {options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <input type="checkbox" checked={values.includes(option)} onChange={(event) => onToggle(option, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              <span className="truncate" title={option}>{option}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function TrendChart({
  timeSeries,
  metric,
}: {
  timeSeries: DashboardTimeSeries;
  metric: ChartMetric;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 1000;
  const height = 400;
  const margin = { top: 20, right: 24, bottom: 48, left: 72 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const dates = Array.from(
    new Set(timeSeries.points.map((point) => point.date)),
  ).sort();
  const totals = new Map<string, number>();

  for (const point of timeSeries.points) {
    totals.set(
      point.campaign,
      (totals.get(point.campaign) ?? 0) + point[metric],
    );
  }

  const visibleCampaigns = [...timeSeries.campaigns]
    .sort((left, right) => (totals.get(right) ?? 0) - (totals.get(left) ?? 0))
    .slice(0, 10);
  const pointMap = new Map(
    timeSeries.points.map((point) => [
      `${point.date}|${point.campaign}`,
      point,
    ] as const),
  );
  const series = visibleCampaigns.map((campaign) => ({
    campaign,
    values: dates.map(
      (day) => pointMap.get(`${day}|${campaign}`)?.[metric] ?? 0,
    ),
  }));
  const maximum = Math.max(1, ...series.flatMap((item) => item.values));
  const x = (index: number) =>
    dates.length <= 1
      ? margin.left + plotWidth / 2
      : margin.left + (index / (dates.length - 1)) * plotWidth;
  const y = (value: number) =>
    margin.top + plotHeight - (value / maximum) * plotHeight;
  const smoothPath = (values: number[]) => {
    const points = values.map((value, index) => ({
      x: x(index),
      y: y(value),
    }));

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    const tension = 0.72;

    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = points[index - 1] ?? points[index];
      const current = points[index];
      const next = points[index + 1];
      const following = points[index + 2] ?? next;
      const minimumY = Math.min(current.y, next.y);
      const maximumY = Math.max(current.y, next.y);
      const controlOneX =
        current.x + ((next.x - previous.x) / 6) * tension;
      const controlTwoX =
        next.x - ((following.x - current.x) / 6) * tension;
      const controlOneY = Math.max(
        minimumY,
        Math.min(
          maximumY,
          current.y + ((next.y - previous.y) / 6) * tension,
        ),
      );
      const controlTwoY = Math.max(
        minimumY,
        Math.min(
          maximumY,
          next.y - ((following.y - current.y) / 6) * tension,
        ),
      );

      path += ` C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`;
    }

    return path;
  };
  const peakPoints = series
    .flatMap((item) =>
      item.values.map((value, index) => ({
        campaign: item.campaign,
        index,
        value,
      })),
    )
    .filter((point) => point.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3);
  const yTicks = Array.from({ length: 5 }, (_, index) => ({
    value: maximum * (1 - index / 4),
    y: margin.top + (index / 4) * plotHeight,
  }));
  const xTickCount = Math.min(6, dates.length);
  const xTicks = Array.from(
    new Set(
      Array.from({ length: xTickCount }, (_, index) =>
        xTickCount === 1
          ? 0
          : Math.round((index * (dates.length - 1)) / (xTickCount - 1)),
      ),
    ),
  );

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (!dates.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = Math.max(
      0,
      Math.min(1, (viewX - margin.left) / plotWidth),
    );
    setHoverIndex(Math.round(ratio * (dates.length - 1)));
  }

  if (!dates.length || !series.length) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-slate-500">
        No daily campaign data matches the current filters.
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label={`Daily ${metric} by campaign`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={tick.y}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray="4 5"
              />
              <text
                x={margin.left - 12}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#64748b"
              >
                {formatCompact(tick.value)}
              </text>
            </g>
          ))}
          {xTicks.map((index) => (
            <text
              key={dates[index]}
              x={x(index)}
              y={height - 15}
              textAnchor="middle"
              fontSize="12"
              fill="#64748b"
            >
              {formatChartDate(dates[index])}
            </text>
          ))}
          {series.map((item) => (
            <path
              key={item.campaign}
              d={smoothPath(item.values)}
              fill="none"
              stroke={campaignColor(item.campaign)}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {peakPoints.map((point, index) => {
            const pointX = x(point.index);
            const pointY = y(point.value);
            const color = campaignColor(point.campaign);
            const labelY = pointY < margin.top + 22
              ? pointY + 20
              : pointY - 10;

            return (
              <g key={`${point.campaign}-${point.index}-${index}`}>
                <circle
                  cx={pointX}
                  cy={pointY}
                  r="5.5"
                  fill="white"
                  stroke={color}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={pointX}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#0f172a"
                  stroke="white"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {formatCompact(point.value)}
                </text>
              </g>
            );
          })}
          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={margin.top}
              y2={margin.top + plotHeight}
              stroke="#94a3b8"
              strokeDasharray="3 4"
            />
          )}
        </svg>
        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 max-h-64 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur"
            style={{
              left: `${(x(hoverIndex) / width) * 100}%`,
              transform:
                hoverIndex < dates.length * 0.2
                  ? "translateX(0)"
                  : hoverIndex > dates.length * 0.8
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            <p className="mb-2 font-semibold text-slate-900">{dates[hoverIndex]}</p>
            {series.map((item) => (
              <div
                key={item.campaign}
                className="mt-1 flex items-center justify-between gap-5"
              >
                <span className="max-w-36 truncate text-slate-600">{item.campaign}</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatNumber(item.values[hoverIndex])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex max-h-20 flex-wrap justify-center gap-x-4 gap-y-2 overflow-auto px-2">
        {series.map((item) => (
          <span
            key={item.campaign}
            className="flex max-w-52 items-center gap-2 text-xs font-medium text-slate-600"
          >
            <i
              className="h-0.5 w-7 shrink-0 rounded-full"
              style={{ backgroundColor: campaignColor(item.campaign) }}
            />
            <span className="truncate" title={item.campaign}>
              {item.campaign}
            </span>
          </span>
        ))}
      </div>
      {timeSeries.campaigns.length > visibleCampaigns.length && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Showing the 10 highest-volume campaigns. Select a campaign to inspect another line.
        </p>
      )}
    </div>
  );
}

function RankingChart({ title, data }: { title: string; data: RankingMetric }) {
  const maximum = Math.max(
    1,
    data.benchmark,
    ...data.items.map((item) => item.value),
  );

  return (
    <article className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">Top 4 campaign averages</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          benchmark {formatCompact(data.benchmark)}
        </span>
      </div>
      <div className="space-y-2">
        {!data.items.length && (
          <p className="py-4 text-sm text-slate-500">No eligible campaigns.</p>
        )}
        {data.items.map((item) => {
          const above = item.value >= data.benchmark;
          return (
            <div key={item.campaign}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-slate-700" title={item.campaign}>
                  {item.campaign} ({item.postCount})
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {formatCompact(item.value)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${above ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ width: `${Math.max(2, (item.value / maximum) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function DashboardClient({
  initialSummary,
  initialPreviousSummary,
  initialTimeSeries,
  initialRankings,
  filterRows,
  pastCampaigns,
}: {
  initialSummary: DashboardSummary;
  initialPreviousSummary: DashboardSummary;
  initialTimeSeries: DashboardTimeSeries;
  initialRankings: DashboardRankings;
  filterRows: FilterRow[];
  pastCampaigns: PastCampaignOption[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [previousSummary, setPreviousSummary] = useState(
    initialPreviousSummary,
  );
  const [timeSeries, setTimeSeries] = useState(initialTimeSeries);
  const [rankings, setRankings] = useState(initialRankings);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("impressions");
  const [startDate, setStartDate] = useState(initialSummary.period.start);
  const [endDate, setEndDate] = useState(initialSummary.period.end);
  const [datePreset, setDatePreset] = useState<DatePreset>("custom");
  const [includeDailyContent, setIncludeDailyContent] = useState(false);
  const [selection, setSelection] = useState<FilterSelection>(EMPTY_FILTERS);
  const [inspectCampaign, setInspectCampaign] = useState("");
  const [pastCampaign, setPastCampaign] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  const activeFilterRows = useMemo(
    () =>
      filterRows.filter((row) => {
        if (!row.campaignStartDate || !row.campaignEndDate) return false;
        const overlapsPeriod =
          row.campaignStartDate <= endDate &&
          row.campaignEndDate >= startDate;
        const dailyContentAllowed =
          includeDailyContent || row.campaignType !== "Daily Content";

        return overlapsPeriod && dailyContentAllowed;
      }),
    [filterRows, startDate, endDate, includeDailyContent],
  );

  const options = useMemo(() => {
    function unique(targetKey: keyof FilterSelection) {
      const rowKey = FILTER_ROW_KEYS[targetKey];
      const matchingRows = activeFilterRows.filter((row) =>
        (Object.keys(selection) as Array<keyof FilterSelection>).every(
          (filterKey) => {
            const selectedValues = selection[filterKey];
            if (filterKey === targetKey || selectedValues.length === 0) {
              return true;
            }
            const rowValue = row[FILTER_ROW_KEYS[filterKey]];
            return typeof rowValue === "string" && selectedValues.includes(rowValue);
          },
        ),
      );

      return Array.from(
        new Set(
          matchingRows
            .map((row) => row[rowKey])
            .filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
            ),
        ),
      ).sort((left, right) => left.localeCompare(right));
    }
    return {
      budgetCode: unique("budgetCode"),
      brand: unique("brand"),
      campaign: unique("campaign"),
      campaignType: unique("campaignType"),
      responsible: unique("responsible"),
      platform: unique("platform"),
    };
  }, [activeFilterRows, selection]);

  useEffect(() => {
    setSelection((current) => {
      let changed = false;
      const next = { ...current };

      (Object.keys(current) as Array<keyof FilterSelection>).forEach(
        (key) => {
          const validValues = current[key].filter((value) =>
            options[key].includes(value),
          );
          if (validValues.length !== current[key].length) {
            next[key] = validValues;
            changed = true;
          }
        },
      );

      return changed ? next : current;
    });
    setInspectCampaign((current) =>
      current && !options.campaign.includes(current) ? "" : current,
    );
  }, [options]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setError("The start date must be before the end date.");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const query = new URLSearchParams({
        start: startDate,
        end: endDate,
        includeDailyContent: String(includeDailyContent),
      });
      Object.entries(selection).forEach(([key, values]) => {
        values.forEach((value) => query.append(key, value));
      });
      const previous = previousPeriod(startDate, endDate);
      const previousQuery = new URLSearchParams({
        start: previous.start,
        end: previous.end,
        includeDailyContent: String(includeDailyContent),
      });
      Object.entries(selection).forEach(([key, values]) => {
        values.forEach((value) => previousQuery.append(key, value));
      });
      setIsLoading(true);
      setError(null);

      try {
        const responses = await Promise.all([
          fetch(`/insights/api/dashboard/summary?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/insights/api/dashboard/timeseries?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/insights/api/dashboard/rankings?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/insights/api/dashboard/summary?${previousQuery}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        const failed = responses.find((response) => !response.ok);
        if (failed) throw new Error(`Dashboard API returned ${failed.status}`);
        const [
          nextSummary,
          nextTimeSeries,
          nextRankings,
          nextPreviousSummary,
        ] = await Promise.all([
          responses[0].json() as Promise<DashboardSummary>,
          responses[1].json() as Promise<DashboardTimeSeries>,
          responses[2].json() as Promise<DashboardRankings>,
          responses[3].json() as Promise<DashboardSummary>,
        ]);
        setSummary(nextSummary);
        setTimeSeries(nextTimeSeries);
        setRankings(nextRankings);
        setPreviousSummary(nextPreviousSummary);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Dashboard request failed.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [startDate, endDate, includeDailyContent, selection]);

  function updateFilter(
    key: keyof FilterSelection,
    value: string,
    checked: boolean,
  ) {
    setSelection((current) => ({
      ...current,
      [key]: checked
        ? Array.from(new Set([...current[key], value]))
        : current[key].filter((item) => item !== value),
    }));
    if (key === "campaign" && checked) setInspectCampaign(value);
  }

  function clearFilter(key: keyof FilterSelection) {
    setSelection((current) => ({ ...current, [key]: [] }));
  }

  function resetFilters() {
    setStartDate(initialSummary.period.start);
    setEndDate(initialSummary.period.end);
    setDatePreset("custom");
    setIncludeDailyContent(false);
    setSelection(EMPTY_FILTERS);
  }

  function applyDatePreset(value: DatePreset) {
    setDatePreset(value);
    if (value === "custom") return;

    const preset = DATE_PRESETS.find((item) => item.key === value);
    if (!preset) return;

    const presetEnd = parseIsoDate(initialSummary.period.end);
    const presetStart = new Date(
      presetEnd.getTime() - (preset.days - 1) * 86_400_000,
    );
    setStartDate(formatIsoDate(presetStart));
    setEndDate(formatIsoDate(presetEnd));
  }

  const inspectHref = inspectCampaign
    ? `/insights/campaign?campaign=${encodeURIComponent(inspectCampaign)}`
    : "#";
  const pastCampaignHref = pastCampaign
    ? `/insights/past-campaign?campaign=${encodeURIComponent(pastCampaign)}`
    : "#";
  const comparisonPeriod = previousPeriod(startDate, endDate);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">Digital performance</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Insights Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">{summary.period.start} to {summary.period.end}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {isLoading && <span className="text-blue-600">Updating…</span>}
            <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100">Reset filters</button>
          </div>
        </header>

        <div className="mb-6 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-950">Main filters</h2>
              <p className="mt-1 text-xs text-slate-500">
                Options cascade automatically and only show campaigns active in the selected period.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</span>
                <input type="date" value={startDate} max={endDate} onChange={(event) => { setStartDate(event.target.value); setDatePreset("custom"); }} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">End date</span>
                <input type="date" value={endDate} min={startDate} onChange={(event) => { setEndDate(event.target.value); setDatePreset("custom"); }} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <MultiSelectFilter label="Platform" values={selection.platform} options={options.platform} onToggle={(value, checked) => updateFilter("platform", value, checked)} onClear={() => clearFilter("platform")} />
              <MultiSelectFilter label="Brand" values={selection.brand} options={options.brand} onToggle={(value, checked) => updateFilter("brand", value, checked)} onClear={() => clearFilter("brand")} />
              <MultiSelectFilter label="Campaign" values={selection.campaign} options={options.campaign} onToggle={(value, checked) => updateFilter("campaign", value, checked)} onClear={() => clearFilter("campaign")} />
              <MultiSelectFilter label="Campaign type" values={selection.campaignType} options={options.campaignType} onToggle={(value, checked) => updateFilter("campaignType", value, checked)} onClear={() => clearFilter("campaignType")} />
              <MultiSelectFilter label="Responsible" values={selection.responsible} options={options.responsible} onToggle={(value, checked) => updateFilter("responsible", value, checked)} onClear={() => clearFilter("responsible")} />
              <MultiSelectFilter label="Budget code" values={selection.budgetCode} options={options.budgetCode} onToggle={(value, checked) => updateFilter("budgetCode", value, checked)} onClear={() => clearFilter("budgetCode")} />
            </div>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={includeDailyContent} onChange={(event) => setIncludeDailyContent(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Include Daily Content</span>
            </label>
          </section>

          <aside className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Quick range</h2>
            <p className="mt-1 text-xs text-slate-600">
              Rolling periods ending {initialSummary.period.end}.
            </p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Period</span>
              <select value={datePreset} onChange={(event) => applyDatePreset(event.target.value as DatePreset)} className="h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="custom">Custom dates</option>
                {DATE_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
              </select>
            </label>
            <div className="mt-5 rounded-xl border border-blue-100 bg-white px-3 py-3 text-xs font-medium text-slate-700">
              {startDate}<br />to {endDate}
            </div>
          </aside>
        </div>

        <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Inspect campaign</span>
            <select value={inspectCampaign} onChange={(event) => setInspectCampaign(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">Choose a campaign</option>
              {options.campaign.map((campaign) => <option key={campaign} value={campaign}>{campaign}</option>)}
            </select>
          </label>
          <a href={inspectHref} aria-disabled={!inspectCampaign} className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${inspectCampaign ? "bg-blue-600 text-white hover:bg-blue-500" : "pointer-events-none bg-slate-100 text-slate-400"}`}>Open campaign →</a>
        </section>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="mb-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Campaigns" value={summary.campaigns} />
          <MetricCard label="Ad spend" value={summary.adSpend} currency delta={percentChange(summary.adSpend, previousSummary.adSpend)} />
          <MetricCard label="Impressions" value={summary.impressions} delta={percentChange(summary.impressions, previousSummary.impressions)} />
          <MetricCard label="Engagement" value={summary.engagement} delta={percentChange(summary.engagement, previousSummary.engagement)} />
          <MetricCard
            label="CTR"
            value={summary.ctr}
            percentage
            delta={
              summary.ctr !== null && previousSummary.ctr !== null
                ? percentChange(summary.ctr, previousSummary.ctr)
                : undefined
            }
          />
        </section>
        <p className="mb-6 text-right text-xs font-medium text-slate-500">
          Deltas compare against {comparisonPeriod.start} to {comparisonPeriod.end}, the immediately preceding equivalent period.
        </p>

        <section className="mb-6 grid items-stretch gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(300px,1fr)]">
          <article className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Daily Performance</h2>
                <p className="mt-1 text-sm text-slate-500">One line per campaign · daily change from cumulative snapshots</p>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1">
                {CHART_METRICS.map((item) => (
                  <button key={item.key} type="button" onClick={() => setChartMetric(item.key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${chartMetric === item.key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>
                ))}
              </div>
            </div>
            <TrendChart timeSeries={timeSeries} metric={chartMetric} />
          </article>
          <div className="grid h-full grid-rows-3 gap-3">
            <RankingChart title="Average impressions" data={rankings.impressions} />
            <RankingChart title="Average video views" data={rankings.videoViews} />
            <RankingChart title="Average engagement" data={rankings.engagement} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">Platform summary</h2>
            <p className="mt-1 text-sm text-slate-500">Latest known snapshot for posts in the selected campaigns</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{["Platform", "Posts", "Campaigns", "Impressions", "Ad Spend", "Clicks", "Engagement"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(summary.platforms).map(([platform, values]) => (
                  <tr key={platform} className="text-slate-700 hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-semibold text-slate-950">{platform}</td>
                    <td className="px-5 py-4 tabular-nums">{formatNumber(values.posts)}</td>
                    <td className="px-5 py-4 tabular-nums">{formatNumber(values.campaigns)}</td>
                    <td className="px-5 py-4 tabular-nums">{formatNumber(values.impressions)}</td>
                    <td className="px-5 py-4 tabular-nums">{formatMoney(values.adSpend)}</td>
                    <td className="px-5 py-4 tabular-nums">{formatNumber(values.clicks)}</td>
                    <td className="px-5 py-4 tabular-nums">{formatNumber(values.engagement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Inspect Past Campaigns
            </span>
            <select
              value={pastCampaign}
              onChange={(event) => setPastCampaign(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Choose an ended Promotion campaign</option>
              {pastCampaigns.map((campaign) => (
                <option
                  key={campaign.campaignName}
                  value={campaign.campaignName}
                >
                  {campaign.campaignName}
                  {campaign.endDate ? ` · ended ${campaign.endDate}` : ""}
                </option>
              ))}
            </select>
          </label>
          <a
            href={pastCampaignHref}
            aria-disabled={!pastCampaign}
            className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
              pastCampaign
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "pointer-events-none bg-slate-100 text-slate-400"
            }`}
          >
            Compare campaign →
          </a>
        </section>
      </div>
    </main>
  );
}
