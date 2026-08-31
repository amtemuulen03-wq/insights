import json
from collections import Counter
from datetime import date, datetime

from app.database import get_pool


SPECIFIED_BENCHMARKS = [
    ("Unitel", "Meta", "Link_click", "TOFU", "cpp", "CPP", 0.00111),
    ("Unitel", "Meta", "Awareness", "TOFU", "cpp", "CPP", 0.00016),
    ("Unitel", "Meta", "Engagement", "TOFU", "cpp", "CPP", 0.00063),
    ("Univision", "Meta", "Link_click", "TOFU", "cpp", "CPP", 0.00064),
    ("Univision", "Meta", "Awareness", "TOFU", "cpp", "CPP", 0.00013),
    ("Univision", "Meta", "Engagement", "TOFU", "cpp", "CPP", 0.00068),
    ("LookTV", "Meta", "Link_click", "TOFU", "cpp", "CPP", 0.00039),
    ("LookTV", "Meta", "Awareness", "TOFU", "cpp", "CPP", 0.00014),
    ("LookTV", "Meta", "Engagement", "TOFU", "cpp", "CPP", 0.00054),
    ("Unitel", "Facebook", None, "TOFU", "organicImpressionPercent", "Organic Imp%", 12),
    ("Univision", "Facebook", None, "TOFU", "organicImpressionPercent", "Organic Imp%", 18),
    ("LookTV", "Facebook", None, "TOFU", "organicImpressionPercent", "Organic Imp%", 12),
    ("Unitel", "Facebook", None, "TOFU", "averageViews", "AVG Views", 141679),
    ("Unitel", "Instagram", None, "TOFU", "averageViews", "AVG Views", 141534),
    ("Unitel", "YouTube", None, "TOFU", "averageViews", "AVG Views", 6300),
    ("Univision", "Facebook", None, "TOFU", "averageViews", "AVG Views", 91933),
    ("Univision", "Instagram", None, "TOFU", "averageViews", "AVG Views", 97175),
    ("Univision", "YouTube", None, "TOFU", "averageViews", "AVG Views", 7500),
    ("LookTV", "Facebook", None, "TOFU", "averageViews", "AVG Views", 114492),
    ("LookTV", "Instagram", None, "TOFU", "averageViews", "AVG Views", 121532),
    ("LookTV", "YouTube", None, "TOFU", "averageViews", "AVG Views", 3900),
    ("Unitel", "Facebook", None, "TOFU", "averageReach", "AVG Reach", 195386),
    ("Unitel", "Instagram", None, "TOFU", "averageReach", "AVG Reach", 79747),
    ("Univision", "Facebook", None, "TOFU", "averageReach", "AVG Reach", 117907),
    ("Univision", "Instagram", None, "TOFU", "averageReach", "AVG Reach", 53653),
    ("LookTV", "Facebook", None, "TOFU", "averageReach", "AVG Reach", 120336),
    ("LookTV", "Instagram", None, "TOFU", "averageReach", "AVG Reach", 62387),
    ("Unitel", "Facebook", None, "MOFU", "ctr", "CTR", 0.32),
    ("Univision", "Facebook", None, "MOFU", "ctr", "CTR", 0.28),
    ("LookTV", "Facebook", None, "MOFU", "ctr", "CTR", 0.28),
    ("Unitel", "Facebook", None, "MOFU", "engagementRate", "Eng Rate %", 1.43),
    ("Unitel", "Instagram", None, "MOFU", "engagementRate", "Eng Rate %", 1.23),
    ("Unitel", "YouTube", None, "MOFU", "engagementRate", "Eng Rate %", 2.27),
    ("Univision", "Facebook", None, "MOFU", "engagementRate", "Eng Rate %", 0.97),
    ("Univision", "Instagram", None, "MOFU", "engagementRate", "Eng Rate %", 1.84),
    ("Univision", "YouTube", None, "MOFU", "engagementRate", "Eng Rate %", 1.86),
    ("LookTV", "Facebook", None, "MOFU", "engagementRate", "Eng Rate %", 1.76),
    ("LookTV", "Instagram", None, "MOFU", "engagementRate", "Eng Rate %", 2.42),
    ("LookTV", "YouTube", None, "MOFU", "engagementRate", "Eng Rate %", 1.88),
    ("Unitel", "Facebook", None, "MOFU", "averageEngagement", "AVG Engagement", 2250),
    ("Unitel", "Instagram", None, "MOFU", "averageEngagement", "AVG Engagement", 483),
    ("Unitel", "YouTube", None, "MOFU", "averageEngagement", "AVG Engagement", 145),
    ("Univision", "Facebook", None, "MOFU", "averageEngagement", "AVG Engagement", 1092),
    ("Univision", "Instagram", None, "MOFU", "averageEngagement", "AVG Engagement", 514),
    ("Univision", "YouTube", None, "MOFU", "averageEngagement", "AVG Engagement", 170),
    ("LookTV", "Facebook", None, "MOFU", "averageEngagement", "AVG Engagement", 1248),
    ("LookTV", "Instagram", None, "MOFU", "averageEngagement", "AVG Engagement", 1164),
    ("LookTV", "YouTube", None, "MOFU", "averageEngagement", "AVG Engagement", 97),
]


PAST_CAMPAIGNS_SQL = """
WITH campaign_rows AS (
    SELECT CAMPAIGN_NAME, CAMPAIGN_START_DATE, CAMPAIGN_END_DATE
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST
    WHERE CAMPAIGN_NAME IS NOT NULL
      AND UPPER(TRIM(NVL(CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
      AND CAMPAIGN_START_DATE >= DATE '1900-01-01'
      AND CAMPAIGN_END_DATE >= DATE '1900-01-01'

    UNION ALL

    SELECT CAMPAIGN_NAME, CAMPAIGN_START_DATE, CAMPAIGN_END_DATE
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST
    WHERE CAMPAIGN_NAME IS NOT NULL
      AND UPPER(TRIM(NVL(CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
      AND CAMPAIGN_START_DATE >= DATE '1900-01-01'
      AND CAMPAIGN_END_DATE >= DATE '1900-01-01'
)
SELECT CAMPAIGN_NAME,
       MIN(CAMPAIGN_START_DATE) AS START_DATE,
       MAX(CAMPAIGN_END_DATE) AS END_DATE
FROM campaign_rows
GROUP BY CAMPAIGN_NAME
HAVING MAX(CAMPAIGN_END_DATE) < TRUNC(SYSDATE)
ORDER BY END_DATE DESC, CAMPAIGN_NAME
"""


PAST_CAMPAIGN_SCORECARD_SQL = """
WITH
campaign_rows AS (
    SELECT CAMPAIGN_NAME, CAMPAIGN_START_DATE, CAMPAIGN_END_DATE
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST
    WHERE CAMPAIGN_NAME = :CAMPAIGN_NAME
      AND UPPER(TRIM(NVL(CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
      AND CAMPAIGN_START_DATE >= DATE '1900-01-01'
      AND CAMPAIGN_END_DATE >= DATE '1900-01-01'

    UNION ALL

    SELECT CAMPAIGN_NAME, CAMPAIGN_START_DATE, CAMPAIGN_END_DATE
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST
    WHERE CAMPAIGN_NAME = :CAMPAIGN_NAME
      AND UPPER(TRIM(NVL(CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
      AND CAMPAIGN_START_DATE >= DATE '1900-01-01'
      AND CAMPAIGN_END_DATE >= DATE '1900-01-01'
),
past_campaign AS (
    SELECT CAMPAIGN_NAME,
           MIN(CAMPAIGN_START_DATE) AS START_DATE,
           MAX(CAMPAIGN_END_DATE) AS END_DATE
    FROM campaign_rows
    GROUP BY CAMPAIGN_NAME
    HAVING MAX(CAMPAIGN_END_DATE) < TRUNC(SYSDATE)
),
facebook_posts_ranked AS (
    SELECT p.CAMPAIGN_NAME,
           CASE LOWER(p.PAGE_NAME)
               WHEN 'unitelofficial' THEN 'Unitel'
               WHEN 'looktvmnofficial' THEN 'LookTV'
               WHEN 'looktvmn' THEN 'LookTV'
               WHEN 'univisionmn' THEN 'Univision'
               WHEN 'univision mongolia' THEN 'Univision'
               ELSE p.PAGE_NAME
           END AS BRAND,
           p.META_POST_ID AS POST_ID,
           p.META_POST_ID AS AD_POST_ID,
           p.POST_TYPE,
           ROW_NUMBER() OVER (
               PARTITION BY p.CAMPAIGN_NAME, p.META_POST_ID
               ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST, p.ROWID DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST p
    JOIN past_campaign c ON c.CAMPAIGN_NAME = p.CAMPAIGN_NAME
    WHERE p.META_POST_ID IS NOT NULL
      AND UPPER(TRIM(NVL(p.CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
),
facebook_posts AS (
    SELECT CAMPAIGN_NAME, BRAND, POST_ID, AD_POST_ID, POST_TYPE
    FROM facebook_posts_ranked
    WHERE RN = 1
),
instagram_posts_ranked AS (
    SELECT p.CAMPAIGN_NAME,
           CASE LOWER(p.USERNAME)
               WHEN 'unitelofficial' THEN 'Unitel'
               WHEN 'looktvmnofficial' THEN 'LookTV'
               WHEN 'looktvmn' THEN 'LookTV'
               WHEN 'univisionmn' THEN 'Univision'
               WHEN 'univision mongolia' THEN 'Univision'
               ELSE p.USERNAME
           END AS BRAND,
           p.IG_POST_ID AS POST_ID,
           p.OWNER_ID || '_' || p.IG_POST_ID AS AD_POST_ID,
           p.MEDIA_TYPE,
           p.MEDIA_CATEGORY,
           ROW_NUMBER() OVER (
               PARTITION BY p.CAMPAIGN_NAME, p.IG_POST_ID
               ORDER BY p.CAMPAIGN_END_DATE DESC NULLS LAST, p.ROWID DESC
           ) AS RN
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST p
    JOIN past_campaign c ON c.CAMPAIGN_NAME = p.CAMPAIGN_NAME
    WHERE p.IG_POST_ID IS NOT NULL
      AND UPPER(TRIM(NVL(p.CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
),
instagram_posts AS (
    SELECT CAMPAIGN_NAME, BRAND, POST_ID, AD_POST_ID, MEDIA_TYPE, MEDIA_CATEGORY
    FROM instagram_posts_ranked
    WHERE RN = 1
),
facebook_latest AS (
    SELECT p.CAMPAIGN_NAME,
           p.BRAND,
           p.POST_ID,
           p.AD_POST_ID,
           NVL(s.TOTAL_IMPRESSIONS, 0) AS IMPRESSIONS,
           s.REACH,
           NVL(s.CLICKS, 0) AS CLICKS,
           NVL(s.CLICKS, 0)
             + NVL(s.TOTAL_REACTIONS, 0)
             + NVL(s.COMMENTS_COUNT, 0)
             + NVL(s.SHARES_COUNT, 0) AS ENGAGEMENT,
           s.VIDEO_IMPRESSIONS AS VIDEO_VIEWS,
           CASE
               WHEN INSTR(UPPER(NVL(p.POST_TYPE, '-')), 'VIDEO') > 0
                 OR INSTR(UPPER(NVL(p.POST_TYPE, '-')), 'REEL') > 0
                 OR NVL(s.VIDEO_IMPRESSIONS, 0) > 0
               THEN 1 ELSE 0
           END AS IS_VIDEO,
           CAST(NULL AS NUMBER) AS ORGANIC_IMPRESSIONS,
           ROW_NUMBER() OVER (
               PARTITION BY p.CAMPAIGN_NAME, p.POST_ID
               ORDER BY s.SNAPSHOT_DATE DESC, s.ROWID DESC
           ) AS RN
    FROM facebook_posts p
    JOIN UNI_DIGITAL_CHANNEL_ETL.T_FB_POST_METRICS_SNAPSHOT s
      ON s.META_POST_ID = p.POST_ID
),
instagram_latest AS (
    SELECT p.CAMPAIGN_NAME,
           p.BRAND,
           p.POST_ID,
           p.AD_POST_ID,
           NVL(s.TOTAL_VIEWS, 0) AS IMPRESSIONS,
           s.REACH,
           NVL(s.TOTAL_INTERACTIONS, 0) AS ENGAGEMENT,
           CASE
               WHEN UPPER(NVL(p.MEDIA_CATEGORY, '-')) = 'VIDEO_REEL'
                 OR UPPER(NVL(p.MEDIA_TYPE, '-')) IN ('VIDEO', 'REEL', 'REELS')
               THEN NVL(s.TOTAL_VIEWS, 0) ELSE 0
           END AS VIDEO_VIEWS,
           CASE
               WHEN UPPER(NVL(p.MEDIA_CATEGORY, '-')) = 'VIDEO_REEL'
                 OR UPPER(NVL(p.MEDIA_TYPE, '-')) IN ('VIDEO', 'REEL', 'REELS')
               THEN 1 ELSE 0
           END AS IS_VIDEO,
           ROW_NUMBER() OVER (
               PARTITION BY p.CAMPAIGN_NAME, p.POST_ID
               ORDER BY s.SNAPSHOT_DATE DESC, s.ROWID DESC
           ) AS RN
    FROM instagram_posts p
    JOIN UNI_DIGITAL_CHANNEL_ETL.T_IG_POST_METRICS_SNAPSHOT s
      ON s.IG_POST_ID = p.POST_ID
),
ad_spend AS (
    SELECT PAGE_ID || '_' || POST_ID AS AD_POST_ID,
           SUM(NVL(SPEND, 0)) AS SPEND
    FROM UNI_DIGITAL_CHANNEL_ETL.T_META_ADS_INSIGHTS
    GROUP BY PAGE_ID || '_' || POST_ID
),
normalized AS (
    SELECT f.CAMPAIGN_NAME,
           f.BRAND,
           'Facebook' AS PLATFORM,
           f.POST_ID,
           f.IMPRESSIONS,
           f.REACH,
           f.CLICKS,
           f.IMPRESSIONS AS CLICK_IMPRESSIONS,
           f.ENGAGEMENT,
           NVL(f.VIDEO_VIEWS, 0) AS VIDEO_VIEWS,
           f.IS_VIDEO,
           f.ORGANIC_IMPRESSIONS,
           CASE WHEN f.ORGANIC_IMPRESSIONS IS NULL THEN 0 ELSE 1 END AS ORGANIC_SUPPORTED,
           NVL(a.SPEND, 0) AS SPEND
    FROM facebook_latest f
    LEFT JOIN ad_spend a ON a.AD_POST_ID = f.AD_POST_ID
    WHERE f.RN = 1

    UNION ALL

    SELECT i.CAMPAIGN_NAME,
           i.BRAND,
           'Instagram',
           i.POST_ID,
           i.IMPRESSIONS,
           i.REACH,
           CAST(NULL AS NUMBER),
           CAST(NULL AS NUMBER),
           i.ENGAGEMENT,
           NVL(i.VIDEO_VIEWS, 0),
           i.IS_VIDEO,
           CAST(NULL AS NUMBER),
           0,
           NVL(a.SPEND, 0)
    FROM instagram_latest i
    LEFT JOIN ad_spend a ON a.AD_POST_ID = i.AD_POST_ID
    WHERE i.RN = 1
),
platform_metrics AS (
    SELECT BRAND,
           PLATFORM,
           COUNT(*) AS POST_COUNT,
           NVL(SUM(SPEND), 0) AS SPEND,
           NVL(SUM(IMPRESSIONS), 0) AS IMPRESSIONS,
           NVL(SUM(REACH), 0) AS REACH,
           NVL(SUM(VIDEO_VIEWS), 0) AS VIDEO_VIEWS,
           SUM(IS_VIDEO) AS VIDEO_POST_COUNT,
           NVL(SUM(CLICKS), 0) AS CLICKS,
           NVL(SUM(ENGAGEMENT), 0) AS ENGAGEMENT,
           AVG(CASE WHEN IS_VIDEO = 1 THEN VIDEO_VIEWS END) AS AVG_VIEWS,
           AVG(REACH) AS AVG_REACH,
           CASE WHEN SUM(NVL(CLICK_IMPRESSIONS, 0)) > 0
                THEN SUM(NVL(CLICKS, 0))
                     / SUM(NVL(CLICK_IMPRESSIONS, 0)) * 100
           END AS CTR,
           CASE WHEN SUM(IMPRESSIONS) > 0
                THEN SUM(ENGAGEMENT) / SUM(IMPRESSIONS) * 100
           END AS ENGAGEMENT_RATE,
           AVG(ENGAGEMENT) AS AVG_ENGAGEMENT,
           CASE WHEN SUM(ORGANIC_SUPPORTED) > 0 AND SUM(IMPRESSIONS) > 0
                THEN SUM(NVL(ORGANIC_IMPRESSIONS, 0))
                     / SUM(IMPRESSIONS) * 100
           END AS ORGANIC_IMPRESSION_PERCENT
    FROM normalized
    GROUP BY BRAND, PLATFORM
)
SELECT m.BRAND,
       m.PLATFORM,
       m.POST_COUNT,
       m.SPEND,
       m.IMPRESSIONS,
       m.REACH,
       m.VIDEO_VIEWS,
       m.VIDEO_POST_COUNT,
       m.CLICKS,
       m.ENGAGEMENT,
       m.AVG_VIEWS,
       m.AVG_REACH,
       m.CTR,
       m.ENGAGEMENT_RATE,
       m.AVG_ENGAGEMENT,
       m.ORGANIC_IMPRESSION_PERCENT,
       c.START_DATE,
       c.END_DATE
FROM platform_metrics m
CROSS JOIN past_campaign c
ORDER BY m.BRAND, m.PLATFORM
"""


PAST_CAMPAIGN_OBJECTIVE_SQL = """
WITH post_map AS (
    SELECT DISTINCT META_POST_ID AS AD_POST_ID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST
    WHERE CAMPAIGN_NAME = :CAMPAIGN_NAME
      AND META_POST_ID IS NOT NULL
      AND UPPER(TRIM(NVL(CAMPAIGN_TYPE, '-'))) = 'PROMOTION'

    UNION

    SELECT DISTINCT OWNER_ID || '_' || IG_POST_ID AS AD_POST_ID
    FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST
    WHERE CAMPAIGN_NAME = :CAMPAIGN_NAME
      AND IG_POST_ID IS NOT NULL
      AND UPPER(TRIM(NVL(CAMPAIGN_TYPE, '-'))) = 'PROMOTION'
)
SELECT a.RAW_PAYLOAD
FROM UNI_DIGITAL_CHANNEL_ETL.T_META_ADS_INSIGHTS a
JOIN post_map p
  ON p.AD_POST_ID = a.PAGE_ID || '_' || a.POST_ID
WHERE a.RAW_PAYLOAD IS NOT NULL
"""


def _iso_date(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def _date_value(value):
    return value.date() if isinstance(value, datetime) else value


def _number(value, digits=2):
    return round(float(value), digits) if value is not None else None


def _lob_text(value):
    if value is None:
        return None
    if hasattr(value, "read"):
        value = value.read()
    return str(value)


def _objective_candidates(value):
    candidates = []
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in {"objective", "optimization_goal"}:
                candidates.append(str(child))
            candidates.extend(_objective_candidates(child))
    elif isinstance(value, list):
        for child in value:
            candidates.extend(_objective_candidates(child))
    return candidates


def _normalize_objective(value):
    normalized = str(value).upper()
    if ("LINK" in normalized and "CLICK" in normalized) or "TRAFFIC" in normalized:
        return "Link_click"
    if "AWARENESS" in normalized or normalized in {"REACH", "OUTCOME_AWARENESS"}:
        return "Awareness"
    if "ENGAGEMENT" in normalized or "POST_ENGAGEMENT" in normalized:
        return "Engagement"
    return None


def _infer_objective(raw_payloads):
    objectives = []
    for payload in raw_payloads:
        if not payload:
            continue
        try:
            parsed = json.loads(payload)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        for candidate in _objective_candidates(parsed):
            normalized = _normalize_objective(candidate)
            if normalized:
                objectives.append(normalized)
    return Counter(objectives).most_common(1)[0][0] if objectives else None


def _benchmark_dict(row):
    brand, platform, objective, funnel, key, metric, benchmark = row
    return {
        "brand": brand,
        "mediaType": "DIGITAL",
        "channel": "Social",
        "platform": platform,
        "objective": objective,
        "funnel": funnel,
        "metricKey": key,
        "metric": metric,
        "benchmark": benchmark,
        "benchmarkYear": 2025,
    }


def get_past_campaigns():
    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(PAST_CAMPAIGNS_SQL)
            rows = cursor.fetchall()

    return {
        "items": [
            {
                "campaignName": str(row[0]),
                "startDate": _iso_date(row[1]),
                "endDate": _iso_date(row[2]),
            }
            for row in rows
        ]
    }


def get_past_campaign_scorecard(campaign_name: str):
    binds = {"CAMPAIGN_NAME": campaign_name}
    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(PAST_CAMPAIGN_SCORECARD_SQL, binds)
            rows = cursor.fetchall()
            cursor.execute(PAST_CAMPAIGN_OBJECTIVE_SQL, binds)
            raw_payloads = [_lob_text(row[0]) for row in cursor]

    if not rows:
        return None

    actuals = [
        {
            "brand": str(row[0]),
            "platform": str(row[1]),
            "posts": int(row[2] or 0),
            "spend": _number(row[3]) or 0,
            "impressions": int(row[4] or 0),
            "reach": int(row[5] or 0),
            "videoViews": int(row[6] or 0),
            "videoPosts": int(row[7] or 0),
            "clicks": int(row[8] or 0),
            "engagement": int(row[9] or 0),
            "averageViews": _number(row[10]),
            "averageReach": _number(row[11]),
            "ctr": _number(row[12], 4),
            "engagementRate": _number(row[13], 4),
            "averageEngagement": _number(row[14]),
            "organicImpressionPercent": _number(row[15], 4),
        }
        for row in rows
    ]

    brands = sorted({item["brand"] for item in actuals})
    platforms = sorted({item["platform"] for item in actuals})
    start_date = _date_value(rows[0][16])
    end_date = _date_value(rows[0][17])
    total_posts = sum(item["posts"] for item in actuals)
    total_impressions = sum(item["impressions"] for item in actuals)
    total_reach = sum(item["reach"] for item in actuals)
    total_video_views = sum(item["videoViews"] for item in actuals)
    total_video_posts = sum(item["videoPosts"] for item in actuals)
    total_clicks = sum(item["clicks"] for item in actuals)
    click_impressions = sum(
        item["impressions"]
        for item in actuals
        if item["platform"] == "Facebook"
    )
    total_engagement = sum(item["engagement"] for item in actuals)
    total_spend = sum(item["spend"] for item in actuals)

    average_impressions = (
        total_impressions / total_posts if total_posts > 0 else None
    )
    campaign_cpp = (
        round(total_spend / average_impressions, 8)
        if average_impressions and average_impressions > 0 else None
    )
    cpp_by_brand = {brand: campaign_cpp for brand in brands}

    relevant_benchmarks = [
        _benchmark_dict(benchmark)
        for benchmark in SPECIFIED_BENCHMARKS
        if benchmark[0] in brands
        and (benchmark[1] == "Meta" or benchmark[1] in platforms)
    ]

    return {
        "metadata": {
            "campaignName": campaign_name,
            "campaignType": "Promotion",
            "brands": brands,
            "platforms": platforms,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "lifespanDays": (end_date - start_date).days + 1,
            "benchmarkYear": 2025,
            "inferredObjective": _infer_objective(raw_payloads),
        },
        "totals": {
            "posts": total_posts,
            "spend": round(total_spend, 2),
            "impressions": total_impressions,
            "reach": total_reach,
            "videoViews": total_video_views,
            "videoPosts": total_video_posts,
            "clicks": total_clicks,
            "engagement": total_engagement,
            "averageViews": (
                round(total_video_views / total_video_posts, 2)
                if total_video_posts > 0 else None
            ),
            "averageReach": (
                round(total_reach / total_posts, 2)
                if total_posts > 0 else None
            ),
            "ctr": (
                round(total_clicks / click_impressions * 100, 4)
                if click_impressions > 0 else None
            ),
        },
        "cppByBrand": cpp_by_brand,
        "actuals": actuals,
        "specifiedBenchmarks": relevant_benchmarks,
    }
