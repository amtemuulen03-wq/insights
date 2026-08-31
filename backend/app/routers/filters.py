from fastapi import APIRouter

from app.repositories.filters import get_filter_rows


router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
)


@router.get("/filters")
def dashboard_filters():
    rows = get_filter_rows()

    return {
        "rows": rows,
        "count": len(rows),
    }