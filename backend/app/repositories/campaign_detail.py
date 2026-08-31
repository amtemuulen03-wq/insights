from collections import defaultdict
from datetime import date, datetime

from app.database import get_pool


# These values intentionally stand in for datasets that are not connected yet.
# Keeping them in one named block prevents demo data from being mistaken for DB data.
DEMO_METRICS = {
    "salesTotal": 712,
    "completionRate": 68.4,
    "salesSeries": [140, 300, 480, 150, 580, 500, 986, 700],
}


CAMPAIGN_METADATA_SQL = """
SELECT CAMPAIGN_NAME, RESPONSIBLE, CAMPAIGN_TYPE, BRAND, BUDGET_CODE,
       MIN(CAMPAIGN_START_DATE), MAX(CAMPAIGN_END_DATE), PLATFORM
FROM (
    SELECT p.CAMPAIGN_NAME, p.RESPONSIBLE, p.CAMPAIGN_TYPE,
           CASE LOWER(p.PAGE_NAME)
               WHEN 'unitelofficial' THEN 'Unitel'
               WHEN 'looktvmnofficial' THEN 'LookTV'
               WHEN 'univisionmn' THEN 'Univision'
               WHEN 'univision mongolia' THEN 'Univision'
               ELSE p.PAGE_NAME
           END AS BRAND,
           p.BUDGET_CODE, p.CAMPAIGN_START_DATE, p.CAMPAIGN_END_DATE,
           'Facebook' AS PLATFORM
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
    WHERE p.CAMPAIGN_NAME = :CAMPAIGN_NAME

    UNION ALL

    SELECT p.CAMPAIGN_NAME, p.RESPONSIBLE, p.CAMPAIGN_TYPE,
           CASE LOWER(p.USERNAME)
               WHEN 'unitelofficial' THEN 'Unitel'
               WHEN 'looktvmnofficial' THEN 'LookTV'
               WHEN 'looktvmn' THEN 'LookTV'
               WHEN 'univisionmn' THEN 'Univision'
               WHEN 'univision mongolia' THEN 'Univision'
               ELSE p.USERNAME
           END,
           p.BUDGET_CODE, p.CAMPAIGN_START_DATE, p.CAMPAIGN_END_DATE,
           'Instagram'
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
    WHERE p.CAMPAIGN_NAME = :CAMPAIGN_NAME

    UNION ALL

    SELECT p.CAMPAIGN_NAME, p.RESPONSIBLE, p.CAMPAIGN_TYPE,
           CASE LOWER(p.PAGE_NAME)
               WHEN 'unitelofficial' THEN 'Unitel'
               WHEN 'looktvmnofficial' THEN 'LookTV'
               WHEN 'univisionmn' THEN 'Univision'
               WHEN 'univision mongolia' THEN 'Univision'
               ELSE p.PAGE_NAME
           END,
           p.BUDGET_CODE, p.CAMPAIGN_START_DATE, p.CAMPAIGN_END_DATE,
           'YouTube'
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
    WHERE p.CAMPAIGN_NAME = :CAMPAIGN_NAME
)
WHERE CAMPAIGN_START_DATE IS NOT NULL
  AND CAMPAIGN_END_DATE IS NOT NULL
  AND CAMPAIGN_START_DATE >= DATE '1900-01-01'
  AND CAMPAIGN_END_DATE >= DATE '1900-01-01'
GROUP BY CAMPAIGN_NAME, RESPONSIBLE, CAMPAIGN_TYPE, BRAND, BUDGET_CODE,
         PLATFORM
ORDER BY PLATFORM
"""


# Snapshot metrics are cumulative. The *_latest CTEs deliberately keep the
# newest row for each post instead of averaging historical snapshots. REACH is
# left nullable so an unavailable metric is not misrepresented as a real zero;
# NVL is used for supported counters that participate in arithmetic. Facebook
# TOTAL_CLICKS is retained for KPIs/rates/cost metrics, while LINK_CLICKS is
# retained separately for the four click-source visuals in Campaign Inspect.
POST_METRICS_SQL = """
WITH
facebook_posts AS (
    SELECT p.META_POST_ID AS POST_ID,
           CAST(p.PERMALINK_URL AS VARCHAR2(4000)) AS POST_URL,
           CAST(p.DESCRIPTION AS VARCHAR2(4000)) AS CAPTION,
           CASE
               WHEN UPPER(TRIM(NVL(p.POST_TYPE, 'UNKNOWN'))) IN ('REEL', 'REELS') THEN 'Reel'
               WHEN UPPER(TRIM(NVL(p.POST_TYPE, 'UNKNOWN'))) = 'VIDEO' THEN 'Video'
               WHEN UPPER(TRIM(NVL(p.POST_TYPE, 'UNKNOWN'))) IN ('CAROUSEL', 'CAROUSEL_ALBUM', 'CAROUSEL ALBUM') THEN 'Carousel Album'
               WHEN UPPER(TRIM(NVL(p.POST_TYPE, 'UNKNOWN'))) IN ('PHOTO', 'IMAGE') THEN 'Image'
               WHEN UPPER(TRIM(NVL(p.POST_TYPE, 'UNKNOWN'))) IN ('STATUS', 'TEXT') THEN 'Text'
               ELSE INITCAP(REPLACE(NVL(p.POST_TYPE, 'Unknown'), '_', ' '))
           END AS CONTENT_TYPE,
           ROW_NUMBER() OVER (
               PARTITION BY p.META_POST_ID
               ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST, p.ROWID DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
    WHERE p.META_POST_ID IS NOT NULL
      AND p.CAMPAIGN_NAME = :CAMPAIGN_NAME
),
instagram_posts AS (
    -- Instagram source column: DESCRIPTION
    SELECT p.IG_POST_ID AS POST_ID,
           p.OWNER_ID || '_' || p.IG_POST_ID AS AD_POST_ID,
           CAST(p.PERMALINK AS VARCHAR2(4000)) AS POST_URL,
           CAST(p.DESCRIPTION AS VARCHAR2(4000)) AS CAPTION,
           p.MEDIA_TYPE,
           CASE
               WHEN UPPER(TRIM(NVL(p.MEDIA_CATEGORY, '-'))) = 'VIDEO_REEL' THEN 'Reel'
               WHEN UPPER(TRIM(NVL(p.MEDIA_CATEGORY, '-'))) = 'PHOTO_CAROUSEL'
                AND UPPER(TRIM(NVL(p.MEDIA_TYPE, '-'))) IN ('CAROUSEL_ALBUM', 'CAROUSEL ALBUM')
                 THEN 'Carousel Album'
               WHEN UPPER(TRIM(NVL(p.MEDIA_CATEGORY, '-'))) = 'PHOTO_CAROUSEL'
                AND UPPER(TRIM(NVL(p.MEDIA_TYPE, '-'))) = 'IMAGE'
                 THEN 'Image'
               WHEN UPPER(TRIM(NVL(p.MEDIA_TYPE, '-'))) IN ('REEL', 'REELS') THEN 'Reel'
               WHEN UPPER(TRIM(NVL(p.MEDIA_TYPE, '-'))) = 'VIDEO' THEN 'Video'
               WHEN UPPER(TRIM(NVL(p.MEDIA_TYPE, '-'))) IN ('CAROUSEL_ALBUM', 'CAROUSEL ALBUM') THEN 'Carousel Album'
               WHEN UPPER(TRIM(NVL(p.MEDIA_TYPE, '-'))) = 'IMAGE' THEN 'Image'
               ELSE INITCAP(REPLACE(NVL(p.MEDIA_TYPE, 'Unknown'), '_', ' '))
           END AS CONTENT_TYPE,
           ROW_NUMBER() OVER (
               PARTITION BY p.IG_POST_ID
               ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST, p.ROWID DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
    WHERE p.IG_POST_ID IS NOT NULL
      AND p.CAMPAIGN_NAME = :CAMPAIGN_NAME
),
youtube_posts AS (
    -- YouTube source column: TITLE
    SELECT p.POST_UUID AS POST_ID,
           CAST(p.PERMALINK_URL AS VARCHAR2(4000)) AS POST_URL,
           CAST(p.TITLE AS VARCHAR2(4000)) AS CAPTION,
           CASE
               WHEN UPPER(TRIM(NVL(p.MEDIA_TYPE, 'UNKNOWN'))) IN ('REEL', 'REELS', 'SHORT', 'SHORTS') THEN 'Short'
               WHEN UPPER(TRIM(NVL(p.MEDIA_TYPE, 'UNKNOWN'))) = 'VIDEO' THEN 'Video'
               ELSE INITCAP(REPLACE(NVL(p.MEDIA_TYPE, 'Unknown'), '_', ' '))
           END AS CONTENT_TYPE,
           ROW_NUMBER() OVER (
               PARTITION BY p.POST_UUID
               ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST, p.ROWID DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
    WHERE p.POST_UUID IS NOT NULL
      AND p.CAMPAIGN_NAME = :CAMPAIGN_NAME
),
facebook_latest AS (
    SELECT s.*,
           ROW_NUMBER() OVER (
               PARTITION BY s.META_POST_ID ORDER BY s.SNAPSHOT_DATE DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST_METRICS_SNAPSHOT s
    WHERE s.META_POST_ID IS NOT NULL
),
instagram_latest AS (
    SELECT s.*,
           ROW_NUMBER() OVER (
               PARTITION BY s.IG_POST_ID ORDER BY s.SNAPSHOT_DATE DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST_METRICS_SNAPSHOT s
    WHERE s.IG_POST_ID IS NOT NULL
),
youtube_latest AS (
    SELECT s.*,
           ROW_NUMBER() OVER (
               PARTITION BY s.POST_UUID ORDER BY s.SNAPSHOT_DATE DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST_METRICS_SNAPSHOT s
    WHERE s.POST_UUID IS NOT NULL
),
ad_spend AS (
    SELECT PAGE_ID || '_' || POST_ID AS POST_ID, SUM(NVL(SPEND, 0)) AS SPEND
    FROM UNI_DIGITAL_CHANNEL_ETL.T_META_ADS_INSIGHTS
    GROUP BY PAGE_ID || '_' || POST_ID
)
SELECT 'Facebook' AS PLATFORM, p.POST_ID, p.POST_URL, p.CONTENT_TYPE, p.CAPTION,
       NVL(s.TOTAL_IMPRESSIONS, 0) AS IMPRESSIONS,
       s.REACH,
       NVL(s.CLICKS, 0) AS TOTAL_CLICKS,
       NVL(s.LINK_CLICKS, 0) AS LINK_CLICKS,
       1 AS CLICKS_SUPPORTED,
       NVL(s.CLICKS, 0) + NVL(s.TOTAL_REACTIONS, 0)
         + NVL(s.COMMENTS_COUNT, 0) + NVL(s.SHARES_COUNT, 0) AS ENGAGEMENT,
       NVL(s.VIDEO_IMPRESSIONS, 0) AS VIDEO_VIEWS,
       NVL(a.SPEND, 0) AS SPEND
FROM facebook_posts p
LEFT JOIN facebook_latest s ON s.META_POST_ID = p.POST_ID AND s.RN = 1
LEFT JOIN ad_spend a ON a.POST_ID = p.POST_ID
WHERE p.RN = 1

UNION ALL

SELECT 'Instagram', p.POST_ID, p.POST_URL, p.CONTENT_TYPE, p.CAPTION,
       NVL(s.TOTAL_VIEWS, 0), s.REACH,
       NVL(s.LIKES, 0) + NVL(s.COMMENTS, 0) + NVL(s.SAVED, 0)
         + NVL(s.SHARES, 0),
       NVL(s.LIKES, 0) + NVL(s.COMMENTS, 0) + NVL(s.SAVED, 0)
         + NVL(s.SHARES, 0),
       1, NVL(s.TOTAL_INTERACTIONS, 0),
       CASE WHEN UPPER(NVL(p.MEDIA_TYPE, '-')) = 'VIDEO'
            THEN NVL(s.TOTAL_VIEWS, 0) ELSE 0 END,
       NVL(a.SPEND, 0)
FROM instagram_posts p
LEFT JOIN instagram_latest s ON s.IG_POST_ID = p.POST_ID AND s.RN = 1
LEFT JOIN ad_spend a ON a.POST_ID = p.AD_POST_ID
WHERE p.RN = 1

UNION ALL

SELECT 'YouTube', p.POST_ID, p.POST_URL, p.CONTENT_TYPE, p.CAPTION,
       NVL(s.VIEWS, 0), CAST(NULL AS NUMBER),
       NVL(s.LIKES, 0) + NVL(s.DISLIKES, 0) + NVL(s.SHARES, 0)
         + NVL(s.SUBSCRIBERS_GAINED, 0)
         + NVL(s.SUBSCRIBERS_LOST, 0),
       NVL(s.LIKES, 0) + NVL(s.DISLIKES, 0) + NVL(s.SHARES, 0)
         + NVL(s.SUBSCRIBERS_GAINED, 0)
         + NVL(s.SUBSCRIBERS_LOST, 0),
       1,
       NVL(s.LIKES, 0) + NVL(s.DISLIKES, 0) + NVL(s.COMMENTS, 0)
         + NVL(s.SHARES, 0) + NVL(s.SUBSCRIBERS_GAINED, 0)
         + NVL(s.SUBSCRIBERS_LOST, 0),
       NVL(s.VIEWS, 0), 0
FROM youtube_posts p
LEFT JOIN youtube_latest s ON s.POST_UUID = p.POST_ID AND s.RN = 1
WHERE p.RN = 1
"""


PUBLISHER_PLATFORM_SQL = """
WITH post_map AS (
    SELECT DISTINCT p.META_POST_ID AS AD_POST_ID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
    WHERE p.CAMPAIGN_NAME = :CAMPAIGN_NAME
      AND p.META_POST_ID IS NOT NULL

    UNION

    SELECT DISTINCT p.OWNER_ID || '_' || p.IG_POST_ID AS AD_POST_ID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
    WHERE p.CAMPAIGN_NAME = :CAMPAIGN_NAME
      AND p.IG_POST_ID IS NOT NULL
)
SELECT LOWER(TRIM(NVL(a.PUBLISHER_PLATFORM, 'unknown'))) AS PUBLISHER_PLATFORM,
       NVL(SUM(a.SPEND), 0) AS SPEND
FROM UNI_DIGITAL_CHANNEL_ETL.T_META_ADS_INSIGHTS a
JOIN post_map p
  ON p.AD_POST_ID = a.PAGE_ID || '_' || a.POST_ID
WHERE LOWER(TRIM(NVL(a.PUBLISHER_PLATFORM, 'unknown'))) <> 'unknown'
GROUP BY LOWER(TRIM(NVL(a.PUBLISHER_PLATFORM, 'unknown')))
ORDER BY SPEND DESC, PUBLISHER_PLATFORM
"""


DAILY_METRICS_SQL = """
WITH
posts AS (
    SELECT 'Facebook' AS PLATFORM, p.META_POST_ID AS POST_ID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
    WHERE p.META_POST_ID IS NOT NULL
      AND p.CAMPAIGN_NAME = :CAMPAIGN_NAME

    UNION

    SELECT 'Instagram', p.IG_POST_ID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
    WHERE p.IG_POST_ID IS NOT NULL
      AND p.CAMPAIGN_NAME = :CAMPAIGN_NAME

    UNION

    SELECT 'YouTube', p.POST_UUID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
    WHERE p.POST_UUID IS NOT NULL
      AND p.CAMPAIGN_NAME = :CAMPAIGN_NAME
),
daily AS (
    SELECT 'Facebook' AS PLATFORM, s.META_POST_ID AS POST_ID,
           TRUNC(s.SNAPSHOT_DATE) AS SNAPSHOT_DAY,
           MAX(NVL(s.TOTAL_IMPRESSIONS, 0)) AS IMPRESSIONS,
           MAX(NVL(s.CLICKS, 0)) AS TOTAL_CLICKS,
           MAX(NVL(s.LINK_CLICKS, 0)) AS LINK_CLICKS,
           MAX(NVL(s.CLICKS, 0) + NVL(s.TOTAL_REACTIONS, 0)
             + NVL(s.COMMENTS_COUNT, 0) + NVL(s.SHARES_COUNT, 0)) AS ENGAGEMENT
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST_METRICS_SNAPSHOT s
    JOIN posts p ON p.PLATFORM = 'Facebook' AND p.POST_ID = s.META_POST_ID
    WHERE s.SNAPSHOT_DATE < :END_DATE + 1
    GROUP BY s.META_POST_ID, TRUNC(s.SNAPSHOT_DATE)

    UNION ALL

    SELECT 'Instagram', s.IG_POST_ID, TRUNC(s.SNAPSHOT_DATE),
           MAX(NVL(s.TOTAL_VIEWS, 0)),
           MAX(NVL(s.LIKES, 0) + NVL(s.COMMENTS, 0)
             + NVL(s.SAVED, 0) + NVL(s.SHARES, 0)),
           MAX(NVL(s.LIKES, 0) + NVL(s.COMMENTS, 0)
             + NVL(s.SAVED, 0) + NVL(s.SHARES, 0)),
           MAX(NVL(s.TOTAL_INTERACTIONS, 0))
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST_METRICS_SNAPSHOT s
    JOIN posts p ON p.PLATFORM = 'Instagram' AND p.POST_ID = s.IG_POST_ID
    WHERE s.SNAPSHOT_DATE < :END_DATE + 1
    GROUP BY s.IG_POST_ID, TRUNC(s.SNAPSHOT_DATE)

    UNION ALL

    SELECT 'YouTube', s.POST_UUID, TRUNC(s.SNAPSHOT_DATE),
           MAX(NVL(s.VIEWS, 0)),
           MAX(NVL(s.LIKES, 0) + NVL(s.DISLIKES, 0)
             + NVL(s.SHARES, 0) + NVL(s.SUBSCRIBERS_GAINED, 0)
             + NVL(s.SUBSCRIBERS_LOST, 0)),
           MAX(NVL(s.LIKES, 0) + NVL(s.DISLIKES, 0)
             + NVL(s.SHARES, 0) + NVL(s.SUBSCRIBERS_GAINED, 0)
             + NVL(s.SUBSCRIBERS_LOST, 0)),
           MAX(NVL(s.LIKES, 0) + NVL(s.DISLIKES, 0) + NVL(s.COMMENTS, 0)
             + NVL(s.SHARES, 0) + NVL(s.SUBSCRIBERS_GAINED, 0)
             + NVL(s.SUBSCRIBERS_LOST, 0))
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST_METRICS_SNAPSHOT s
    JOIN posts p ON p.PLATFORM = 'YouTube' AND p.POST_ID = s.POST_UUID
    WHERE s.SNAPSHOT_DATE < :END_DATE + 1
    GROUP BY s.POST_UUID, TRUNC(s.SNAPSHOT_DATE)
),
with_baseline AS (
    SELECT d.*,
           MAX(CASE WHEN SNAPSHOT_DAY < :START_DATE THEN SNAPSHOT_DAY END)
             OVER (PARTITION BY PLATFORM, POST_ID) AS BASELINE_DAY
    FROM daily d
),
selected AS (
    SELECT PLATFORM, POST_ID, SNAPSHOT_DAY, IMPRESSIONS,
           TOTAL_CLICKS, LINK_CLICKS, ENGAGEMENT
    FROM with_baseline
    WHERE SNAPSHOT_DAY >= :START_DATE OR SNAPSHOT_DAY = BASELINE_DAY
),
monotonic AS (
    SELECT PLATFORM, POST_ID, SNAPSHOT_DAY,
           MAX(IMPRESSIONS) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS IMPRESSIONS,
           MAX(TOTAL_CLICKS) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS TOTAL_CLICKS,
           MAX(LINK_CLICKS) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LINK_CLICKS,
           MAX(ENGAGEMENT) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ENGAGEMENT
    FROM selected
),
lagged AS (
    SELECT m.*,
           LAG(IMPRESSIONS) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY) AS PREV_IMPRESSIONS,
           LAG(TOTAL_CLICKS) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY) AS PREV_TOTAL_CLICKS,
           LAG(LINK_CLICKS) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY) AS PREV_LINK_CLICKS,
           LAG(ENGAGEMENT) OVER (
             PARTITION BY PLATFORM, POST_ID ORDER BY SNAPSHOT_DAY) AS PREV_ENGAGEMENT
    FROM monotonic m
)
SELECT TO_CHAR(SNAPSHOT_DAY, 'YYYY-MM-DD') AS SERIES_DATE, PLATFORM,
       SUM(CASE WHEN PREV_IMPRESSIONS IS NULL THEN 0
                ELSE GREATEST(IMPRESSIONS - PREV_IMPRESSIONS, 0) END),
       SUM(CASE WHEN PREV_LINK_CLICKS IS NULL THEN 0
                ELSE GREATEST(LINK_CLICKS - PREV_LINK_CLICKS, 0) END),
       SUM(CASE WHEN PREV_TOTAL_CLICKS IS NULL THEN 0
                ELSE GREATEST(TOTAL_CLICKS - PREV_TOTAL_CLICKS, 0) END),
       SUM(CASE WHEN PREV_ENGAGEMENT IS NULL THEN 0
                ELSE GREATEST(ENGAGEMENT - PREV_ENGAGEMENT, 0) END)
FROM lagged
WHERE SNAPSHOT_DAY >= :START_DATE
GROUP BY SNAPSHOT_DAY, PLATFORM
ORDER BY SNAPSHOT_DAY, PLATFORM
"""


def _date_value(value):
    if isinstance(value, datetime):
        return value.date()
    return value


def _unique(values):
    return sorted({str(value) for value in values if value is not None})


def get_campaign_detail(
    campaign_name: str,
):
    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                CAMPAIGN_METADATA_SQL,
                {"CAMPAIGN_NAME": campaign_name},
            )
            metadata_rows = cursor.fetchall()

            if not metadata_rows:
                return None

            campaign_start = min(
                _date_value(row[5])
                for row in metadata_rows
                if row[5] is not None
            )
            campaign_end = max(
                _date_value(row[6])
                for row in metadata_rows
                if row[6] is not None
            )
            binds = {
                "CAMPAIGN_NAME": campaign_name,
                "START_DATE": campaign_start,
                "END_DATE": campaign_end,
            }

            cursor.execute(
                POST_METRICS_SQL,
                {"CAMPAIGN_NAME": campaign_name},
            )
            metric_rows = cursor.fetchall()

            cursor.execute(
                PUBLISHER_PLATFORM_SQL,
                {"CAMPAIGN_NAME": campaign_name},
            )
            publisher_rows = cursor.fetchall()

            cursor.execute(DAILY_METRICS_SQL, binds)
            daily_rows = cursor.fetchall()

    posts = []
    for row in metric_rows:
        impressions = int(row[5] or 0)
        total_clicks = int(row[7] or 0) if row[9] else None
        link_clicks = int(row[8] or 0) if row[9] else None
        spend = round(float(row[12] or 0), 2)
        posts.append(
            {
                "platform": row[0],
                "postId": row[1],
                "postUrl": str(row[2]) if row[2] is not None else None,
                "contentType": str(row[3] or "Unknown"),
                "caption": str(row[4]) if row[4] is not None else None,
                "impressions": impressions,
                "reach": int(row[6]) if row[6] is not None else None,
                "totalClicks": total_clicks,
                "linkClicks": link_clicks,
                "clicksSupported": bool(row[9]),
                "engagement": int(row[10] or 0),
                "videoViews": int(row[11] or 0),
                "spend": spend,
                "ctr": (
                    round((total_clicks / impressions) * 100, 2)
                    if total_clicks is not None and impressions > 0
                    else None
                ),
                "cpc": (
                    round(spend / total_clicks, 6)
                    if total_clicks is not None and total_clicks > 0 else None
                ),
                "cpm": (
                    round((spend / impressions) * 1000, 6)
                    if impressions > 0 else None
                ),
            }
        )

    posts.sort(key=lambda item: item["engagement"], reverse=True)

    total_impressions = sum(item["impressions"] for item in posts)
    total_engagement = sum(item["engagement"] for item in posts)
    total_reach = sum(item["reach"] or 0 for item in posts)
    total_video_views = sum(item["videoViews"] for item in posts)
    total_spend = round(sum(item["spend"] for item in posts), 2)
    click_eligible = [item for item in posts if item["clicksSupported"]]
    total_clicks = sum(item["totalClicks"] or 0 for item in click_eligible)
    total_link_clicks = sum(item["linkClicks"] or 0 for item in click_eligible)
    click_impressions = sum(item["impressions"] for item in click_eligible)

    daily_by_date = defaultdict(
        lambda: {
            "impressions": 0,
            "clicks": 0,
            "totalClicks": 0,
            "engagement": 0,
        }
    )
    weekly = defaultdict(
        lambda: defaultdict(
            lambda: {
                "impressions": 0,
                "clicks": 0,
                "totalClicks": 0,
                "engagement": 0,
            }
        )
    )
    platform_mix_totals = defaultdict(
        lambda: {"impressions": 0, "clicks": 0, "engagement": 0}
    )

    # The donut is based on the latest lifetime post totals. This makes the
    # POST_METRICS_SQL source formulas authoritative instead of relying on
    # daily deltas, whose first snapshot is intentionally treated as baseline.
    for item in posts:
        platform_values = platform_mix_totals[item["platform"]]
        platform_values["impressions"] += item["impressions"]
        platform_values["clicks"] += item["linkClicks"] or 0
        platform_values["engagement"] += item["engagement"]

    for row in daily_rows:
        day = row[0]
        platform = row[1]
        impressions = int(row[2] or 0)
        clicks = int(row[3] or 0)
        total_clicks_delta = int(row[4] or 0)
        engagement = int(row[5] or 0)
        values = {
            "impressions": impressions,
            "clicks": clicks,
            "totalClicks": total_clicks_delta,
            "engagement": engagement,
        }

        for metric, value in values.items():
            daily_by_date[day][metric] += value

        parsed_day = date.fromisoformat(day)
        iso_year, iso_week, _ = parsed_day.isocalendar()
        week_key = f"{iso_year}-W{iso_week:02d}"
        for metric, value in values.items():
            weekly[week_key][platform][metric] += value

    daily = []
    for index, day in enumerate(sorted(daily_by_date)):
        daily.append(
            {
                "date": day,
                **daily_by_date[day],
                "sales": DEMO_METRICS["salesSeries"][
                    index % len(DEMO_METRICS["salesSeries"])
                ],
            }
        )

    weekly_rows = []
    for week in sorted(weekly):
        for platform in sorted(weekly[week]):
            weekly_rows.append(
                {
                    "week": week,
                    "platform": platform,
                    **weekly[week][platform],
                }
            )

    return {
        "period": {
            "start": campaign_start.isoformat(),
            "end": campaign_end.isoformat(),
        },
        "metadata": {
            "campaignName": campaign_name,
            "budgetCodes": _unique(row[4] for row in metadata_rows),
            "campaignTypes": _unique(row[2] for row in metadata_rows),
            "responsibles": _unique(row[1] for row in metadata_rows),
            "brands": _unique(row[3] for row in metadata_rows),
            "platforms": _unique(row[7] for row in metadata_rows),
            "startDate": campaign_start.isoformat(),
            "endDate": campaign_end.isoformat(),
            "lifespanDays": (campaign_end - campaign_start).days + 1,
        },
        "totals": {
            "posts": len(posts),
            "spend": total_spend,
            "impressions": total_impressions,
            "clicks": total_clicks,
            "linkClicks": total_link_clicks,
            "reach": total_reach,
            "videoViews": total_video_views,
            "engagement": total_engagement,
            "ctr": round((total_clicks / click_impressions) * 100, 2)
            if click_impressions > 0
            else 0,
            "engagementRate": round(
                (total_engagement / total_impressions) * 100, 2
            )
            if total_impressions > 0
            else 0,
            "completionRate": DEMO_METRICS["completionRate"],
            "sales": DEMO_METRICS["salesTotal"],
        },
        "placeholderMetrics": ["sales", "completionRate"],
        "daily": daily,
        "weekly": weekly_rows,
        "publisherPlatformMix": [
            {
                "platform": str(row[0] or "unknown"),
                "spend": round(float(row[1] or 0), 2),
            }
            for row in publisher_rows
        ],
        "platformMix": [
            {"platform": platform, **values}
            for platform, values in sorted(platform_mix_totals.items())
        ],
        "posts": posts,
    }
