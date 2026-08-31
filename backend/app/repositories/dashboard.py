from datetime import date

from app.database import get_pool


#PLATFORM_SUMMARY_SQL = """
#WITH
#facebook_latest AS (
    #SELECT
        #s.*,
        #ROW_NUMBER() OVER (
            #PARTITION BY s.META_POST_ID
            #ORDER BY s.SNAPSHOT_DATE DESC
        #) AS RN
    #FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST_METRICS_SNAPSHOT s
    #WHERE s.META_POST_ID IS NOT NULL
#),
#instagram_latest AS (
    #SELECT
        #s.*,
        #ROW_NUMBER() OVER (
            #PARTITION BY s.IG_POST_ID
            #ORDER BY s.SNAPSHOT_DATE DESC
        #) AS RN
    #FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST_METRICS_SNAPSHOT s
    #WHERE s.IG_POST_ID IS NOT NULL
#),
#youtube_latest AS (
    #SELECT
        #s.*,
        #ROW_NUMBER() OVER (
            #PARTITION BY s.POST_UUID
            #ORDER BY s.SNAPSHOT_DATE DESC
        #) AS RN
    #FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST_METRICS_SNAPSHOT s
    #WHERE s.POST_UUID IS NOT NULL
#),
#normalized AS (
    #SELECT
        #'Facebook' AS PLATFORM,
        #p.CAMPAIGN_NAME,
        #p.RESPONSIBLE,
        #p.CAMPAIGN_TYPE,
        #CASE LOWER(p.PAGE_NAME)
            #WHEN 'unitelofficial' THEN 'Unitel'
            #WHEN 'looktvmnofficial' THEN 'LookTV'
            #WHEN 'univisionmn' THEN 'Univision'
            #WHEN 'univision mongolia' THEN 'Univision'
            #ELSE p.PAGE_NAME
        #END AS BRAND,
        #p.BUDGET_CODE,
        #s.TOTAL_IMPRESSIONS AS IMPRESSIONS,
        #s.REACH,
        #1 AS REACH_SUPPORTED,
        #NVL(s.CLICKS, 0) AS CLICKS,
        #(
            #NVL(s.CLICKS, 0)
            #+ NVL(s.TOTAL_REACTIONS, 0)
            #+ NVL(s.COMMENTS_COUNT, 0)
            #+ NVL(s.SHARES_COUNT, 0)
        #) AS ENGAGEMENT 
    #FROM facebook_latest s
    #JOIN UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
        #ON p.META_POST_ID = s.META_POST_ID
    #WHERE s.RN = 1
      #AND p.CAMPAIGN_PUBLISH_TIME >= :START_DATE
      #AND p.CAMPAIGN_PUBLISH_TIME < :END_DATE + 1
      #AND (
          #:INCLUDE_DAILY = 1
          #OR NVL(p.CAMPAIGN_TYPE, '-') <> 'Daily Content'
      #)

    #UNION ALL

    #SELECT
        #'Instagram' AS PLATFORM,
        #p.CAMPAIGN_NAME,
        #p.RESPONSIBLE,
        #p.CAMPAIGN_TYPE,
        #CASE LOWER(p.USERNAME)
            #WHEN 'unitelofficial' THEN 'Unitel'
            #WHEN 'looktvmnofficial' THEN 'LookTV'
            #WHEN 'univisionmn' THEN 'Univision'
            #WHEN 'univision mongolia' THEN 'Univision'
            #ELSE p.PAGE_NAME
        #END AS BRAND,
        #p.BUDGET_CODE,
        #s.TOTAL_VIEWS,
        #s.REACH,
        #0,
        #s.TOTAL_INTERACTIONS as CLICKS,
        #NVL(s.TOTAL_INTERACTIONS, 0) as ENGAGEMENT
    #FROM instagram_latest s
    #JOIN UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
        #ON p.IG_POST_ID = s.IG_POST_ID
    #WHERE s.RN = 1
      #AND p.CAMPAIGN_PUBLISH_TIME >= :START_DATE
      #AND p.CAMPAIGN_PUBLISH_TIME < :END_DATE + 1
      #AND (
          #:INCLUDE_DAILY = 1
          #OR NVL(p.CAMPAIGN_TYPE, '-') <> 'Daily Content'
      #)

    #UNION ALL

    #SELECT
        #'YouTube',
        #p.CAMPAIGN_NAME,
        #p.RESPONSIBLE,
        #p.CAMPAIGN_TYPE,
        #CASE LOWER(p.PAGE_NAME)
            #WHEN 'unitelofficial' THEN 'Unitel'
            #WHEN 'looktvmnofficial' THEN 'LookTV'
            #WHEN 'univisionmn' THEN 'Univision'
            #WHEN 'univision mongolia' THEN 'Univision'
            #ELSE p.PAGE_NAME
        #END AS BRAND, 
        #p.BUDGET_CODE,
        #s.VIEWS as IMPRESSIONS,
        #CAST(NULL AS NUMBER),
        #0,
        #(
            #NVL(s.LIKES, 0)
            #+ NVL(s.DISLIKES, 0)
            #+ NVL(s.COMMENTS, 0)
            #+ NVL(s.SHARES, 0)
            #+ NVL(s.SUBSCRIBERS_GAINED, 0)
            #+ NVL(s.SUBSCRIBERS_LOST, 0)
        #) as CLICKS,
        #(
            #NVL(s.LIKES, 0)
            #+ NVL(s.DISLIKES, 0)
            #+ NVL(s.COMMENTS, 0)
            #+ NVL(s.SHARES, 0)
            #+ NVL(s.SUBSCRIBERS_GAINED, 0)
            #+ NVL(s.SUBSCRIBERS_LOST, 0)
        #) as ENGAGEMENT
    #FROM youtube_latest s
    #JOIN UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
        #ON p.POST_UUID = s.POST_UUID
    #WHERE s.RN = 1
      #AND p.PUBLISHED_AT >= :START_DATE
      #AND p.PUBLISHED_AT < :END_DATE + 1
      #AND (
          #:INCLUDE_DAILY = 1
          #OR NVL(p.CAMPAIGN_TYPE, '-') <> 'Daily Content'
      #)
#),
#platform_totals AS (
    #SELECT
        #PLATFORM,
        #COUNT(*) AS POST_COUNT,
        #COUNT(DISTINCT CAMPAIGN_NAME) AS CAMPAIGN_COUNT,
        #NVL(SUM(IMPRESSIONS), 0) AS IMPRESSIONS,
        #SUM(REACH) AS REACH,
        #MAX(REACH_SUPPORTED) AS REACH_SUPPORTED,
        #NVL(SUM(CLICKS), 0) AS CLICKS,
        #NVL(SUM(ENGAGEMENT), 0) AS ENGAGEMENT
    #FROM normalized
    #GROUP BY PLATFORM
#)
#SELECT
    #p.*,
    #(
        #SELECT COUNT(DISTINCT CAMPAIGN_NAME)
        #FROM normalized
        #WHERE CAMPAIGN_NAME IS NOT NULL
    #) AS TOTAL_CAMPAIGNS
#FROM platform_totals p
#ORDER BY p.PLATFORM
#"""
PLATFORM_SUMMARY_SQL = """
WITH
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
facebook_ad_spend AS (
    SELECT
        PAGE_ID || '_' || POST_ID AS META_POST_ID,
        SUM(NVL(SPEND, 0)) AS AD_SPEND
    FROM UNI_DIGITAL_CHANNEL_ETL.T_META_ADS_INSIGHTS
    WHERE DATE_START >= :START_DATE
      AND DATE_START < :END_DATE + 1
    GROUP BY PAGE_ID || '_' || POST_ID
),
normalized AS (
    SELECT
        'Facebook' AS PLATFORM,
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
        s.TOTAL_IMPRESSIONS AS IMPRESSIONS,
        s.REACH AS REACH,
        1 AS REACH_SUPPORTED,
        NVL(s.CLICKS, 0) AS CLICKS,
        (
            NVL(s.CLICKS, 0)
            + NVL(s.TOTAL_REACTIONS, 0)
            + NVL(s.COMMENTS_COUNT, 0)
            + NVL(s.SHARES_COUNT, 0)
        ) AS ENGAGEMENT,
        NVL(a.AD_SPEND, 0) AS AD_SPEND
    FROM facebook_latest s
    JOIN UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
        ON p.META_POST_ID = s.META_POST_ID
    LEFT JOIN facebook_ad_spend a
        ON a.META_POST_ID = s.META_POST_ID
    WHERE s.RN = 1
        AND p.CAMPAIGN_START_DATE IS NOT NULL
        AND p.CAMPAIGN_END_DATE IS NOT NULL
        AND p.CAMPAIGN_START_DATE >= DATE '1900-01-01'
        AND p.CAMPAIGN_END_DATE >= DATE '1900-01-01'
        AND p.CAMPAIGN_START_DATE < :END_DATE + 1
        AND p.CAMPAIGN_END_DATE >= :START_DATE
        AND (
            :INCLUDE_DAILY = 1
            OR NVL(p.CAMPAIGN_TYPE, '-') <> 'Daily Content'
        ) 

    UNION ALL

    SELECT
        'Instagram' AS PLATFORM,
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
        NVL(s.TOTAL_VIEWS, 0) AS IMPRESSIONS,
        s.REACH AS REACH,
        1 AS REACH_SUPPORTED,
        0 AS CLICKS,
        NVL(s.TOTAL_INTERACTIONS, 0) AS ENGAGEMENT,
        CAST(0 AS NUMBER) AS AD_SPEND
    FROM instagram_latest s
    JOIN UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
        ON p.IG_POST_ID = s.IG_POST_ID
    WHERE s.RN = 1
        AND p.CAMPAIGN_START_DATE IS NOT NULL
        AND p.CAMPAIGN_END_DATE IS NOT NULL
        AND p.CAMPAIGN_START_DATE >= DATE '1900-01-01'
        AND p.CAMPAIGN_END_DATE >= DATE '1900-01-01'
        AND p.CAMPAIGN_START_DATE < :END_DATE + 1
        AND p.CAMPAIGN_END_DATE >= :START_DATE
        AND (
            :INCLUDE_DAILY = 1
            OR NVL(p.CAMPAIGN_TYPE, '-') <> 'Daily Content'
        )
      

    UNION ALL

    SELECT
        'YouTube' AS PLATFORM,
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
        NVL(s.VIEWS, 0) AS IMPRESSIONS,
        CAST(NULL AS NUMBER) AS REACH,
        0 AS REACH_SUPPORTED,
        0 AS CLICKS,
        (
            NVL(s.LIKES, 0)
            + NVL(s.DISLIKES, 0)
            + NVL(s.COMMENTS, 0)
            + NVL(s.SHARES, 0)
            + NVL(s.SUBSCRIBERS_GAINED, 0)
            + NVL(s.SUBSCRIBERS_LOST, 0)
        ) AS ENGAGEMENT,
        CAST(0 AS NUMBER) AS AD_SPEND
    FROM youtube_latest s
    JOIN UNI_DIGITAL_CHANNEL_ETL.T_YT_POST p
        ON p.POST_UUID = s.POST_UUID
    WHERE s.RN = 1
        AND p.CAMPAIGN_START_DATE IS NOT NULL
        AND p.CAMPAIGN_END_DATE IS NOT NULL
        AND p.CAMPAIGN_START_DATE >= DATE '1900-01-01'
        AND p.CAMPAIGN_END_DATE >= DATE '1900-01-01'
        AND p.CAMPAIGN_START_DATE < :END_DATE + 1
        AND p.CAMPAIGN_END_DATE >= :START_DATE
        AND (
            :INCLUDE_DAILY = 1
            OR NVL(p.CAMPAIGN_TYPE, '-') <> 'Daily Content'
        )
),
filtered AS (
    SELECT
        PLATFORM,
        CAMPAIGN_NAME,
        RESPONSIBLE,
        CAMPAIGN_TYPE,
        BRAND,
        BUDGET_CODE,
        IMPRESSIONS,
        REACH,
        REACH_SUPPORTED,
        CLICKS,
        ENGAGEMENT,
        AD_SPEND
    FROM normalized
    WHERE 1 = 1
    {filter_clauses}
),
platform_totals AS (
    SELECT
        PLATFORM,
        COUNT(*) AS POST_COUNT,
        COUNT(DISTINCT CAMPAIGN_NAME) AS CAMPAIGN_COUNT,
        NVL(SUM(IMPRESSIONS), 0) AS IMPRESSIONS,
        SUM(REACH) AS REACH,
        MAX(REACH_SUPPORTED) AS REACH_SUPPORTED,
        NVL(SUM(CLICKS), 0) AS CLICKS,
        NVL(SUM(ENGAGEMENT), 0) AS ENGAGEMENT,
        NVL(SUM(AD_SPEND), 0) AS AD_SPEND
    FROM filtered
    GROUP BY PLATFORM
)
SELECT
    p.PLATFORM,
    p.POST_COUNT,
    p.CAMPAIGN_COUNT,
    p.IMPRESSIONS,
    p.REACH,
    p.REACH_SUPPORTED,
    p.CLICKS,
    p.ENGAGEMENT,
    p.AD_SPEND,
    (
        SELECT COUNT(DISTINCT CAMPAIGN_NAME)
        FROM filtered
        WHERE CAMPAIGN_NAME IS NOT NULL
    ) AS TOTAL_CAMPAIGNS
FROM platform_totals p
ORDER BY p.PLATFORM
"""


# The dashboard Ad Spend KPI is intentionally independent of campaign
# lifetime overlap and post matching. It represents every Ads Insights row
# whose delivery date falls inside the selected dashboard period.
PERIOD_AD_SPEND_SQL = """
SELECT NVL(SUM(SPEND), 0) AS AD_SPEND
FROM UNI_DIGITAL_CHANNEL_ETL.T_META_ADS_INSIGHTS
WHERE DATE_START >= :START_DATE
  AND DATE_START < :END_DATE + 1
"""


def add_list_filter(
    clauses: list[str],
    binds: dict,
    column: str,
    prefix: str,
    values: list[str],
):
    cleaned_values = list(
        dict.fromkeys(
            value.strip()
            for value in values
            if value and value.strip()
        )
    )

    if not cleaned_values:
        return

    placeholders = []

    for index, value in enumerate(cleaned_values):
        bind_name = f"{prefix}_{index}"

        placeholders.append(f":{bind_name}")
        binds[bind_name] = value

    clauses.append(
        f"{column} IN ({', '.join(placeholders)})"
    )

def get_dashboard_summary(start_date,
    end_date,
    include_daily_content,
    budget_codes,
    brands,
    campaigns,
    campaign_types,
    responsibles,
    platforms,
):
    binds = {
        "START_DATE": start_date,
        "END_DATE": end_date,
        "INCLUDE_DAILY": (
            1 if include_daily_content else 0
        ),
    }

    clauses = []

    add_list_filter(
        clauses,
        binds,
        "BUDGET_CODE",
        "BUDGET_CODE",
        budget_codes,
    )

    add_list_filter(
        clauses,
        binds,
        "BRAND",
        "BRAND",
        brands,
    )

    add_list_filter(
        clauses,
        binds,
        "CAMPAIGN_NAME",
        "CAMPAIGN",
        campaigns,
    )

    add_list_filter(
        clauses,
        binds,
        "CAMPAIGN_TYPE",
        "CAMPAIGN_TYPE",
        campaign_types,
    )

    add_list_filter(
        clauses,
        binds,
        "RESPONSIBLE",
        "RESPONSIBLE",
        responsibles,
    )

    add_list_filter(
        clauses,
        binds,
        "PLATFORM",
        "PLATFORM",
        platforms,
    )

    filter_sql = ""

    if clauses:
        filter_sql = "\nAND " + "\nAND ".join(clauses)

    sql = PLATFORM_SUMMARY_SQL.format(
        filter_clauses=filter_sql,
    )

    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, binds)

            columns = [
                column[0].lower()
                for column in cursor.description
            ]

            rows = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]

            cursor.execute(
                PERIOD_AD_SPEND_SQL,
                {
                    "START_DATE": start_date,
                    "END_DATE": end_date,
                },
            )
            period_ad_spend = cursor.fetchone()[0]

    platforms = {}

    for row in rows:
        platform = row["platform"]

        platforms[platform] = {
            "posts": int(row["post_count"] or 0),
            "campaigns": int(row["campaign_count"] or 0),
            "impressions": int(row["impressions"] or 0),
            "reach": (
                int(row["reach"])
                if row["reach_supported"] and row["reach"] is not None
                else None
            ),
            "reachSupported": bool(row["reach_supported"]),
            "clicks": int(row["clicks"] or 0),
            "engagement": int(row["engagement"] or 0),
            "adSpend": round(float(row["ad_spend"] or 0), 2),
        }

    supported_reach = [
        metric["reach"]
        for metric in platforms.values()
        if metric["reachSupported"]
        and metric["reach"] is not None
    ]

    facebook_metrics = platforms.get("Facebook")
    dashboard_ctr = (
        round(
            facebook_metrics["clicks"]
            / facebook_metrics["impressions"]
            * 100,
            4,
        )
        if facebook_metrics
        and facebook_metrics["impressions"] > 0
        else None
    )

    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "campaigns": (
            int(rows[0]["total_campaigns"])
            if rows
            else 0
        ),
        "impressions": sum(
            metric["impressions"]
            for metric in platforms.values()
        ),
        "engagement": sum(
            metric["engagement"]
            for metric in platforms.values()
        ),
        "adSpend": round(float(period_ad_spend or 0), 2),
        "ctr": dashboard_ctr,
        "reach": {
            "value": sum(supported_reach),
            "includedPlatforms": [
                platform
                for platform, metric in platforms.items()
                if metric["reachSupported"]
            ],
            "excludedPlatforms": [
                platform
                for platform, metric in platforms.items()
                if not metric["reachSupported"]
            ],
        },
        "platforms": platforms,
    }
