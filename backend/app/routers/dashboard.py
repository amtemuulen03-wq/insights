from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.repositories.campaign_detail import get_campaign_detail
from app.repositories.dashboard import get_dashboard_summary
from app.repositories.past_campaigns import (
    get_past_campaign_scorecard,
    get_past_campaigns,
)
from app.repositories.rankings import get_campaign_rankings
from app.repositories.timeseries import get_dashboard_timeseries


router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
)


def _date_range(start: date | None, end: date | None):
    end_date = end or date.today()
    start_date = start or end_date - timedelta(days=30)

    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must not be after end date",
        )

    return start_date, end_date


@router.get("/summary")
def dashboard_summary(
    start: date | None = None,
    end: date | None = None,
    include_daily_content: bool = Query(
        default=False,
        alias="includeDailyContent",
    ),
    budget_codes: list[str] = Query(
        default=[],
        alias="budgetCode",
    ),
    brands: list[str] = Query(
        default=[],
        alias="brand",
    ),
    campaigns: list[str] = Query(
        default=[],
        alias="campaign",
    ),
    campaign_types: list[str] = Query(
        default=[],
        alias="campaignType",
    ),
    responsibles: list[str] = Query(
        default=[],
        alias="responsible",
    ),
    platforms: list[str] = Query(
        default=[],
        alias="platform",
    ),
):
    start_date, end_date = _date_range(start, end)

    return get_dashboard_summary(
        start_date=start_date,
        end_date=end_date,
        include_daily_content=include_daily_content,
        budget_codes=budget_codes,
        brands=brands,
        campaigns=campaigns,
        campaign_types=campaign_types,
        responsibles=responsibles,
        platforms=platforms,
    )


@router.get("/timeseries")
def dashboard_timeseries(
    start: date | None = None,
    end: date | None = None,
    include_daily_content: bool = Query(
        default=False,
        alias="includeDailyContent",
    ),
    budget_codes: list[str] = Query(
        default=[],
        alias="budgetCode",
    ),
    brands: list[str] = Query(
        default=[],
        alias="brand",
    ),
    campaigns: list[str] = Query(
        default=[],
        alias="campaign",
    ),
    campaign_types: list[str] = Query(
        default=[],
        alias="campaignType",
    ),
    responsibles: list[str] = Query(
        default=[],
        alias="responsible",
    ),
    platforms: list[str] = Query(
        default=[],
        alias="platform",
    ),
):
    start_date, end_date = _date_range(start, end)

    return get_dashboard_timeseries(
        start_date=start_date,
        end_date=end_date,
        include_daily_content=include_daily_content,
        budget_codes=budget_codes,
        brands=brands,
        campaigns=campaigns,
        campaign_types=campaign_types,
        responsibles=responsibles,
        platforms=platforms,
    )


@router.get("/rankings")
def dashboard_rankings(
    start: date | None = None,
    end: date | None = None,
    include_daily_content: bool = Query(
        default=False,
        alias="includeDailyContent",
    ),
    budget_codes: list[str] = Query(default=[], alias="budgetCode"),
    brands: list[str] = Query(default=[], alias="brand"),
    campaigns: list[str] = Query(default=[], alias="campaign"),
    campaign_types: list[str] = Query(default=[], alias="campaignType"),
    responsibles: list[str] = Query(default=[], alias="responsible"),
    platforms: list[str] = Query(default=[], alias="platform"),
):
    start_date, end_date = _date_range(start, end)

    return get_campaign_rankings(
        start_date=start_date,
        end_date=end_date,
        include_daily_content=include_daily_content,
        budget_codes=budget_codes,
        brands=brands,
        campaigns=campaigns,
        campaign_types=campaign_types,
        responsibles=responsibles,
        platforms=platforms,
    )


@router.get("/campaign-detail")
def campaign_detail(
    campaign: str = Query(min_length=1),
):
    result = get_campaign_detail(
        campaign_name=campaign,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Campaign was not found",
        )

    return result


@router.get("/past-campaigns")
def past_campaigns():
    return get_past_campaigns()


@router.get("/past-campaign-scorecard")
def past_campaign_scorecard(
    campaign: str = Query(min_length=1),
):
    result = get_past_campaign_scorecard(campaign)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Past Promotion campaign was not found",
        )

    return result
