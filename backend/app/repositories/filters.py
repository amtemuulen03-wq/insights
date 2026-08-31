from datetime import date, datetime

from app.database import get_pool


FILTER_SQL = """
SELECT
    CAMPAIGN_NAME,
    RESPONSIBLE,
    CAMPAIGN_TYPE,
    CASE LOWER(PAGE_NAME)
        WHEN 'unitelofficial' THEN 'Unitel'
        WHEN 'looktvmnofficial' THEN 'LookTV'
        WHEN 'univisionmn' THEN 'Univision'
        WHEN 'univision mongolia' THEN 'Univision'
        ELSE PAGE_NAME
    END AS BRAND,
    BUDGET_CODE,
    MIN(CAMPAIGN_START_DATE) AS CAMPAIGN_START_DATE,
    MAX(CAMPAIGN_END_DATE) AS CAMPAIGN_END_DATE,
    'Facebook' AS PLATFORM
FROM UNI_DIGITAL_CHANNEL_ETL.T_FB_POST
WHERE CAMPAIGN_NAME IS NOT NULL
GROUP BY
    CAMPAIGN_NAME,
    RESPONSIBLE,
    CAMPAIGN_TYPE,
    PAGE_NAME,
    BUDGET_CODE

UNION

SELECT
    CAMPAIGN_NAME,
    RESPONSIBLE,
    CAMPAIGN_TYPE,
    CASE LOWER(USERNAME)
        WHEN 'unitelofficial' THEN 'Unitel'
        WHEN 'looktvmnofficial' THEN 'LookTV'
        WHEN 'looktvmn' THEN 'LookTV'
        WHEN 'univisionmn' THEN 'Univision'
        WHEN 'univision mongolia' THEN 'Univision'
        ELSE USERNAME
    END AS BRAND,
    BUDGET_CODE,
    MIN(CAMPAIGN_START_DATE),
    MAX(CAMPAIGN_END_DATE),
    'Instagram'
FROM UNI_DIGITAL_CHANNEL_ETL.T_IG_POST
WHERE CAMPAIGN_NAME IS NOT NULL
GROUP BY
    CAMPAIGN_NAME,
    RESPONSIBLE,
    CAMPAIGN_TYPE,
    USERNAME,
    BUDGET_CODE

UNION

SELECT
    CAMPAIGN_NAME,
    RESPONSIBLE,
    CAMPAIGN_TYPE,
    CASE LOWER(PAGE_NAME)
        WHEN 'unitelofficial' THEN 'Unitel'
        WHEN 'looktvmnofficial' THEN 'LookTV'
        WHEN 'univisionmn' THEN 'Univision'
        ELSE PAGE_NAME
    END AS BRAND,
    BUDGET_CODE,
    MIN(CAMPAIGN_START_DATE),
    MAX(CAMPAIGN_END_DATE),
    'YouTube'
FROM UNI_DIGITAL_CHANNEL_ETL.T_YT_POST
WHERE CAMPAIGN_NAME IS NOT NULL
GROUP BY
    CAMPAIGN_NAME,
    RESPONSIBLE,
    CAMPAIGN_TYPE,
    PAGE_NAME,
    BUDGET_CODE

ORDER BY CAMPAIGN_NAME
"""


def serialize_date(value):
    if value is None:
        return None

    if isinstance(value, (date, datetime)):
        if value.year < 1900:
            return None

        return value.date().isoformat() if isinstance(
            value, datetime
        ) else value.isoformat()

    return None


def get_filter_rows():
    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(FILTER_SQL)

            rows = cursor.fetchall()

    return [
        {
            "campaignName": row[0],
            "responsible": row[1],
            "campaignType": row[2],
            "brand": row[3],
            "budgetCode": row[4],
            "campaignStartDate": serialize_date(row[5]),
            "campaignEndDate": serialize_date(row[6]),
            "platform": row[7],
        }
        for row in rows
    ]