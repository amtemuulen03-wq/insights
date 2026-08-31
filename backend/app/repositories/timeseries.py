from datetime import date

from app.database import get_pool
from app.repositories.dashboard import add_list_filter


TIME_SERIES_SQL = """
WITH
facebook_posts_ranked AS (
    SELECT
        p.META_POST_ID AS POST_ID,
        p.CAMPAIGN_NAME,
        p.RESPONSIBLE,
        p.CAMPAIGN_TYPE,
        CASE LOWER(p.PAGE_NAME)
            WHEN 'unitelofficial' THEN 'Unitel'
            WHEN 'looktvmnofficial' THEN 'LookTV'
            WHEN 'univisionmn' THEN 'Univision'
            WHEN 'univision mongolia' THEN 'Univision'
            ELSE p.PAGE_NAME
        END AS BRAND,
        p.BUDGET_CODE,
        p.CAMPAIGN_START_DATE,
        p.CAMPAIGN_END_DATE,
        CAST(NULL AS VARCHAR2(30)) AS MEDIA_TYPE,
        ROW_NUMBER() OVER (
            PARTITION BY p.META_POST_ID
            ORDER BY
                p.CAMPAIGN_END_DATE DESC NULLS LAST,
                p.CAMPAIGN_START_DATE DESC NULLS LAST,
                p.ROWID DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
    WHERE p.META_POST_ID IS NOT NULL
),
instagram_posts_ranked AS (
    SELECT
        p.IG_POST_ID AS POST_ID,
        p.CAMPAIGN_NAME,
        p.RESPONSIBLE,
        p.CAMPAIGN_TYPE,
        CASE LOWER(p.USERNAME)
            WHEN 'unitelofficial' THEN 'Unitel'
            WHEN 'looktvmnofficial' THEN 'LookTV'
            WHEN 'looktvmn' THEN 'LookTV'
            WHEN 'univisionmn' THEN 'Univision'
            WHEN 'univision mongolia' THEN 'Univision'
            ELSE p.USERNAME
        END AS BRAND,
        p.BUDGET_CODE,
        p.CAMPAIGN_START_DATE,
        p.CAMPAIGN_END_DATE,
        p.MEDIA_TYPE,
        ROW_NUMBER() OVER (
            PARTITION BY p.IG_POST_ID
            ORDER BY
                p.CAMPAIGN_END_DATE DESC NULLS LAST,
                p.CAMPAIGN_START_DATE DESC NULLS LAST,
                p.ROWID DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
    WHERE p.IG_POST_ID IS NOT NULL
),
youtube_posts_ranked AS (
    SELECT
        p.POST_UUID AS POST_ID,
        p.CAMPAIGN_NAME,
        p.RESPONSIBLE,
        p.CAMPAIGN_TYPE,
        CASE LOWER(p.PAGE_NAME)
            WHEN 'unitelofficial' THEN 'Unitel'
            WHEN 'looktvmnofficial' THEN 'LookTV'
            WHEN 'univisionmn' THEN 'Univision'
            WHEN 'univision mongolia' THEN 'Univision'
            ELSE p.PAGE_NAME
        END AS BRAND,
        p.BUDGET_CODE,
        p.CAMPAIGN_START_DATE,
        p.CAMPAIGN_END_DATE,
        CAST('VIDEO' AS VARCHAR2(30)) AS MEDIA_TYPE,
        ROW_NUMBER() OVER (
            PARTITION BY p.POST_UUID
            ORDER BY
                p.CAMPAIGN_END_DATE DESC NULLS LAST,
                p.CAMPAIGN_START_DATE DESC NULLS LAST,
                p.ROWID DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
    WHERE p.POST_UUID IS NOT NULL
),
post_metadata AS (
    SELECT
        'Facebook' AS PLATFORM,
        POST_ID,
        CAMPAIGN_NAME,
        RESPONSIBLE,
        CAMPAIGN_TYPE,
        BRAND,
        BUDGET_CODE,
        CAMPAIGN_START_DATE,
        CAMPAIGN_END_DATE,
        MEDIA_TYPE
    FROM facebook_posts_ranked
    WHERE RN = 1

    UNION ALL

    SELECT
        'Instagram',
        POST_ID,
        CAMPAIGN_NAME,
        RESPONSIBLE,
        CAMPAIGN_TYPE,
        BRAND,
        BUDGET_CODE,
        CAMPAIGN_START_DATE,
        CAMPAIGN_END_DATE,
        MEDIA_TYPE
    FROM instagram_posts_ranked
    WHERE RN = 1

    UNION ALL

    SELECT
        'YouTube',
        POST_ID,
        CAMPAIGN_NAME,
        RESPONSIBLE,
        CAMPAIGN_TYPE,
        BRAND,
        BUDGET_CODE,
        CAMPAIGN_START_DATE,
        CAMPAIGN_END_DATE,
        MEDIA_TYPE
    FROM youtube_posts_ranked
    WHERE RN = 1
),
filtered_posts AS (
    SELECT
        PLATFORM,
        POST_ID,
        CAMPAIGN_NAME,
        RESPONSIBLE,
        CAMPAIGN_TYPE,
        BRAND,
        BUDGET_CODE,
        MEDIA_TYPE
    FROM post_metadata
    WHERE CAMPAIGN_NAME IS NOT NULL
      AND CAMPAIGN_START_DATE IS NOT NULL
      AND CAMPAIGN_END_DATE IS NOT NULL
      AND CAMPAIGN_START_DATE >= DATE '1900-01-01'
      AND CAMPAIGN_END_DATE >= DATE '1900-01-01'
      AND CAMPAIGN_START_DATE < :END_DATE + 1
      AND CAMPAIGN_END_DATE >= :START_DATE
      AND (
          :INCLUDE_DAILY = 1
          OR NVL(CAMPAIGN_TYPE, '-') <> 'Daily Content'
      )
      {filter_clauses}
),
facebook_daily AS (
    SELECT
        'Facebook' AS PLATFORM,
        p.CAMPAIGN_NAME,
        s.META_POST_ID AS POST_ID,
        TRUNC(s.SNAPSHOT_DATE) AS SNAPSHOT_DAY,
        MAX(NVL(s.TOTAL_IMPRESSIONS, 0)) AS IMPRESSIONS,
        MAX(NVL(s.VIDEO_IMPRESSIONS, 0)) AS VIDEO_VIEWS,
        MAX(
            NVL(s.CLICKS, 0)
            + NVL(s.TOTAL_REACTIONS, 0)
            + NVL(s.COMMENTS_COUNT, 0)
            + NVL(s.SHARES_COUNT, 0)
        ) AS ENGAGEMENT
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST_METRICS_SNAPSHOT s
    JOIN filtered_posts p
      ON p.PLATFORM = 'Facebook'
     AND p.POST_ID = s.META_POST_ID
    WHERE s.SNAPSHOT_DATE < :END_DATE + 1
    GROUP BY p.CAMPAIGN_NAME, s.META_POST_ID, TRUNC(s.SNAPSHOT_DATE)
),
instagram_daily AS (
    SELECT
        'Instagram' AS PLATFORM,
        p.CAMPAIGN_NAME,
        s.IG_POST_ID AS POST_ID,
        TRUNC(s.SNAPSHOT_DATE) AS SNAPSHOT_DAY,
        MAX(NVL(s.TOTAL_VIEWS, 0)) AS IMPRESSIONS,
        MAX(
            CASE
                WHEN UPPER(NVL(p.MEDIA_TYPE, '-')) = 'VIDEO'
                THEN NVL(s.TOTAL_VIEWS, 0)
                ELSE 0
            END
        ) AS VIDEO_VIEWS,
        MAX(NVL(s.TOTAL_INTERACTIONS, 0)) AS ENGAGEMENT
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST_METRICS_SNAPSHOT s
    JOIN filtered_posts p
      ON p.PLATFORM = 'Instagram'
     AND p.POST_ID = s.IG_POST_ID
    WHERE s.SNAPSHOT_DATE < :END_DATE + 1
    GROUP BY p.CAMPAIGN_NAME, s.IG_POST_ID, TRUNC(s.SNAPSHOT_DATE)
),
youtube_daily AS (
    SELECT
        'YouTube' AS PLATFORM,
        p.CAMPAIGN_NAME,
        s.POST_UUID AS POST_ID,
        TRUNC(s.SNAPSHOT_DATE) AS SNAPSHOT_DAY,
        MAX(NVL(s.VIEWS, 0)) AS IMPRESSIONS,
        MAX(NVL(s.VIEWS, 0)) AS VIDEO_VIEWS,
        MAX(
            NVL(s.LIKES, 0)
            + NVL(s.DISLIKES, 0)
            + NVL(s.COMMENTS, 0)
            + NVL(s.SHARES, 0)
            + NVL(s.SUBSCRIBERS_GAINED, 0)
            + NVL(s.SUBSCRIBERS_LOST, 0)
        ) AS ENGAGEMENT
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST_METRICS_SNAPSHOT s
    JOIN filtered_posts p
      ON p.PLATFORM = 'YouTube'
     AND p.POST_ID = s.POST_UUID
    WHERE s.SNAPSHOT_DATE < :END_DATE + 1
    GROUP BY p.CAMPAIGN_NAME, s.POST_UUID, TRUNC(s.SNAPSHOT_DATE)
),
daily_snapshots AS (
    SELECT PLATFORM, CAMPAIGN_NAME, POST_ID, SNAPSHOT_DAY,
           IMPRESSIONS, VIDEO_VIEWS, ENGAGEMENT
    FROM facebook_daily

    UNION ALL

    SELECT PLATFORM, CAMPAIGN_NAME, POST_ID, SNAPSHOT_DAY,
           IMPRESSIONS, VIDEO_VIEWS, ENGAGEMENT
    FROM instagram_daily

    UNION ALL

    SELECT PLATFORM, CAMPAIGN_NAME, POST_ID, SNAPSHOT_DAY,
           IMPRESSIONS, VIDEO_VIEWS, ENGAGEMENT
    FROM youtube_daily
),
snapshots_with_baseline AS (
    SELECT
        d.*,
        MAX(
            CASE
                WHEN d.SNAPSHOT_DAY < :START_DATE THEN d.SNAPSHOT_DAY
            END
        ) OVER (
            PARTITION BY d.PLATFORM, d.POST_ID
        ) AS BASELINE_DAY
    FROM daily_snapshots d
),
selected_snapshots AS (
    SELECT PLATFORM, CAMPAIGN_NAME, POST_ID, SNAPSHOT_DAY,
           IMPRESSIONS, VIDEO_VIEWS, ENGAGEMENT
    FROM snapshots_with_baseline
    WHERE SNAPSHOT_DAY >= :START_DATE
       OR SNAPSHOT_DAY = BASELINE_DAY
),
monotonic_snapshots AS (
    SELECT
        PLATFORM,
        CAMPAIGN_NAME,
        POST_ID,
        SNAPSHOT_DAY,
        MAX(IMPRESSIONS) OVER (
            PARTITION BY PLATFORM, POST_ID
            ORDER BY SNAPSHOT_DAY
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS IMPRESSIONS,
        MAX(VIDEO_VIEWS) OVER (
            PARTITION BY PLATFORM, POST_ID
            ORDER BY SNAPSHOT_DAY
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS VIDEO_VIEWS,
        MAX(ENGAGEMENT) OVER (
            PARTITION BY PLATFORM, POST_ID
            ORDER BY SNAPSHOT_DAY
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS ENGAGEMENT
    FROM selected_snapshots
),
lagged_snapshots AS (
    SELECT
        PLATFORM,
        CAMPAIGN_NAME,
        POST_ID,
        SNAPSHOT_DAY,
        IMPRESSIONS,
        VIDEO_VIEWS,
        ENGAGEMENT,
        LAG(IMPRESSIONS) OVER (
            PARTITION BY PLATFORM, POST_ID
            ORDER BY SNAPSHOT_DAY
        ) AS PREVIOUS_IMPRESSIONS,
        LAG(VIDEO_VIEWS) OVER (
            PARTITION BY PLATFORM, POST_ID
            ORDER BY SNAPSHOT_DAY
        ) AS PREVIOUS_VIDEO_VIEWS,
        LAG(ENGAGEMENT) OVER (
            PARTITION BY PLATFORM, POST_ID
            ORDER BY SNAPSHOT_DAY
        ) AS PREVIOUS_ENGAGEMENT
    FROM monotonic_snapshots
),
post_deltas AS (
    SELECT
        CAMPAIGN_NAME,
        SNAPSHOT_DAY,
        CASE
            WHEN PREVIOUS_IMPRESSIONS IS NULL THEN 0
            ELSE GREATEST(IMPRESSIONS - PREVIOUS_IMPRESSIONS, 0)
        END AS IMPRESSIONS,
        CASE
            WHEN PREVIOUS_VIDEO_VIEWS IS NULL THEN 0
            ELSE GREATEST(VIDEO_VIEWS - PREVIOUS_VIDEO_VIEWS, 0)
        END AS VIDEO_VIEWS,
        CASE
            WHEN PREVIOUS_ENGAGEMENT IS NULL THEN 0
            ELSE GREATEST(ENGAGEMENT - PREVIOUS_ENGAGEMENT, 0)
        END AS ENGAGEMENT
    FROM lagged_snapshots
    WHERE SNAPSHOT_DAY >= :START_DATE
),
daily_totals AS (
    SELECT
        CAMPAIGN_NAME,
        SNAPSHOT_DAY,
        NVL(SUM(IMPRESSIONS), 0) AS IMPRESSIONS,
        NVL(SUM(VIDEO_VIEWS), 0) AS VIDEO_VIEWS,
        NVL(SUM(ENGAGEMENT), 0) AS ENGAGEMENT
    FROM post_deltas
    GROUP BY CAMPAIGN_NAME, SNAPSHOT_DAY
),
date_spine AS (
    SELECT :START_DATE + LEVEL - 1 AS SNAPSHOT_DAY
    FROM DUAL
    CONNECT BY LEVEL <= (:END_DATE - :START_DATE) + 1
),
selected_campaigns AS (
    SELECT DISTINCT CAMPAIGN_NAME
    FROM filtered_posts
)
SELECT
    TO_CHAR(d.SNAPSHOT_DAY, 'YYYY-MM-DD') AS SERIES_DATE,
    c.CAMPAIGN_NAME,
    NVL(t.IMPRESSIONS, 0) AS IMPRESSIONS,
    NVL(t.VIDEO_VIEWS, 0) AS VIDEO_VIEWS,
    NVL(t.ENGAGEMENT, 0) AS ENGAGEMENT
FROM date_spine d
CROSS JOIN selected_campaigns c
LEFT JOIN daily_totals t
  ON t.SNAPSHOT_DAY = d.SNAPSHOT_DAY
 AND t.CAMPAIGN_NAME = c.CAMPAIGN_NAME
ORDER BY d.SNAPSHOT_DAY, c.CAMPAIGN_NAME
"""


def get_dashboard_timeseries(
    start_date: date,
    end_date: date,
    include_daily_content: bool,
    budget_codes: list[str],
    brands: list[str],
    campaigns: list[str],
    campaign_types: list[str],
    responsibles: list[str],
    platforms: list[str],
):
    binds = {
        "START_DATE": start_date,
        "END_DATE": end_date,
        "INCLUDE_DAILY": 1 if include_daily_content else 0,
    }
    clauses: list[str] = []

    add_list_filter(
        clauses, binds, "BUDGET_CODE", "BUDGET_CODE", budget_codes
    )
    add_list_filter(clauses, binds, "BRAND", "BRAND", brands)
    add_list_filter(
        clauses, binds, "CAMPAIGN_NAME", "CAMPAIGN", campaigns
    )
    add_list_filter(
        clauses,
        binds,
        "CAMPAIGN_TYPE",
        "CAMPAIGN_TYPE",
        campaign_types,
    )
    add_list_filter(
        clauses, binds, "RESPONSIBLE", "RESPONSIBLE", responsibles
    )
    add_list_filter(clauses, binds, "PLATFORM", "PLATFORM", platforms)

    filter_sql = ""
    if clauses:
        filter_sql = "\nAND " + "\nAND ".join(clauses)

    sql = TIME_SERIES_SQL.format(filter_clauses=filter_sql)

    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, binds)
            rows = cursor.fetchall()

    points = [
        {
            "date": row[0],
            "campaign": row[1],
            "impressions": int(row[2] or 0),
            "videoViews": int(row[3] or 0),
            "engagement": int(row[4] or 0),
        }
        for row in rows
    ]

    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "campaigns": sorted({point["campaign"] for point in points}),
        "points": points,
    }
