from datetime import date

from app.database import get_pool
from app.repositories.dashboard import add_list_filter


CAMPAIGN_RANKINGS_SQL = """
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
            ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST,
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
            ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST,
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
            ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST,
                     p.CAMPAIGN_START_DATE DESC NULLS LAST,
                     p.ROWID DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
    WHERE p.POST_UUID IS NOT NULL
),
post_metadata AS (
    SELECT 'Facebook' AS PLATFORM, POST_ID, CAMPAIGN_NAME, RESPONSIBLE,
           CAMPAIGN_TYPE, BRAND, BUDGET_CODE, CAMPAIGN_START_DATE,
           CAMPAIGN_END_DATE, MEDIA_TYPE
    FROM facebook_posts_ranked
    WHERE RN = 1

    UNION ALL

    SELECT 'Instagram', POST_ID, CAMPAIGN_NAME, RESPONSIBLE,
           CAMPAIGN_TYPE, BRAND, BUDGET_CODE, CAMPAIGN_START_DATE,
           CAMPAIGN_END_DATE, MEDIA_TYPE
    FROM instagram_posts_ranked
    WHERE RN = 1

    UNION ALL

    SELECT 'YouTube', POST_ID, CAMPAIGN_NAME, RESPONSIBLE,
           CAMPAIGN_TYPE, BRAND, BUDGET_CODE, CAMPAIGN_START_DATE,
           CAMPAIGN_END_DATE, MEDIA_TYPE
    FROM youtube_posts_ranked
    WHERE RN = 1
),
filtered_posts AS (
    SELECT *
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
facebook_latest AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY s.META_POST_ID
            ORDER BY s.SNAPSHOT_DATE DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST_METRICS_SNAPSHOT s
    WHERE s.META_POST_ID IS NOT NULL
),
instagram_latest AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY s.IG_POST_ID
            ORDER BY s.SNAPSHOT_DATE DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST_METRICS_SNAPSHOT s
    WHERE s.IG_POST_ID IS NOT NULL
),
youtube_latest AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY s.POST_UUID
            ORDER BY s.SNAPSHOT_DATE DESC
        ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST_METRICS_SNAPSHOT s
    WHERE s.POST_UUID IS NOT NULL
),
post_metrics AS (
    SELECT
        p.CAMPAIGN_NAME,
        NVL(s.TOTAL_IMPRESSIONS, 0) AS IMPRESSIONS,
        s.VIDEO_IMPRESSIONS AS VIDEO_VIEWS,
        CASE WHEN s.VIDEO_IMPRESSIONS IS NOT NULL THEN 1 ELSE 0 END AS VIDEO_SUPPORTED,
        NVL(s.CLICKS, 0)
        + NVL(s.TOTAL_REACTIONS, 0)
        + NVL(s.COMMENTS_COUNT, 0)
        + NVL(s.SHARES_COUNT, 0) AS ENGAGEMENT
    FROM filtered_posts p
    JOIN facebook_latest s
      ON p.PLATFORM = 'Facebook'
     AND p.POST_ID = s.META_POST_ID
     AND s.RN = 1

    UNION ALL

    SELECT
        p.CAMPAIGN_NAME,
        NVL(s.TOTAL_VIEWS, 0),
        CASE
            WHEN UPPER(NVL(p.MEDIA_TYPE, '-')) = 'VIDEO'
            THEN s.TOTAL_VIEWS
            ELSE CAST(NULL AS NUMBER)
        END,
        CASE
            WHEN UPPER(NVL(p.MEDIA_TYPE, '-')) = 'VIDEO' THEN 1
            ELSE 0
        END,
        NVL(s.TOTAL_INTERACTIONS, 0)
    FROM filtered_posts p
    JOIN instagram_latest s
      ON p.PLATFORM = 'Instagram'
     AND p.POST_ID = s.IG_POST_ID
     AND s.RN = 1

    UNION ALL

    SELECT
        p.CAMPAIGN_NAME,
        NVL(s.VIEWS, 0),
        s.VIEWS,
        CASE WHEN s.VIEWS IS NOT NULL THEN 1 ELSE 0 END,
        NVL(s.LIKES, 0)
        + NVL(s.DISLIKES, 0)
        + NVL(s.COMMENTS, 0)
        + NVL(s.SHARES, 0)
        + NVL(s.SUBSCRIBERS_GAINED, 0)
        + NVL(s.SUBSCRIBERS_LOST, 0)
    FROM filtered_posts p
    JOIN youtube_latest s
      ON p.PLATFORM = 'YouTube'
     AND p.POST_ID = s.POST_UUID
     AND s.RN = 1
),
campaign_averages AS (
    SELECT
        CAMPAIGN_NAME,
        COUNT(*) AS POST_COUNT,
        AVG(IMPRESSIONS) AS IMPRESSIONS_AVG,
        SUM(VIDEO_SUPPORTED) AS VIDEO_POST_COUNT,
        CASE
            WHEN SUM(VIDEO_SUPPORTED) > 0
            THEN SUM(VIDEO_VIEWS) / SUM(VIDEO_SUPPORTED)
        END AS VIDEO_VIEWS_AVG,
        AVG(ENGAGEMENT) AS ENGAGEMENT_AVG
    FROM post_metrics
    GROUP BY CAMPAIGN_NAME
)
SELECT
    CAMPAIGN_NAME,
    POST_COUNT,
    IMPRESSIONS_AVG,
    AVG(IMPRESSIONS_AVG) OVER () AS IMPRESSIONS_BENCHMARK,
    VIDEO_POST_COUNT,
    VIDEO_VIEWS_AVG,
    AVG(VIDEO_VIEWS_AVG) OVER () AS VIDEO_VIEWS_BENCHMARK,
    ENGAGEMENT_AVG,
    AVG(ENGAGEMENT_AVG) OVER () AS ENGAGEMENT_BENCHMARK
FROM campaign_averages
ORDER BY CAMPAIGN_NAME
"""


def _metric_result(rows, value_index, count_index, benchmark_index):
    eligible = [row for row in rows if row[value_index] is not None]
    ordered = sorted(
        eligible,
        key=lambda row: float(row[value_index]),
        reverse=True,
    )[:4]

    benchmark = (
        float(eligible[0][benchmark_index])
        if eligible and eligible[0][benchmark_index] is not None
        else 0.0
    )

    return {
        "benchmark": round(benchmark, 2),
        "items": [
            {
                "campaign": row[0],
                "value": round(float(row[value_index] or 0), 2),
                "postCount": int(row[count_index] or 0),
            }
            for row in ordered
        ],
    }


def get_campaign_rankings(
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

    sql = CAMPAIGN_RANKINGS_SQL.format(filter_clauses=filter_sql)

    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, binds)
            rows = cursor.fetchall()

    return {
        "impressions": _metric_result(rows, 2, 1, 3),
        "videoViews": _metric_result(rows, 5, 4, 6),
        "engagement": _metric_result(rows, 7, 1, 8),
    }
