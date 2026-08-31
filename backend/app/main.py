from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import get_pool, start_pool, stop_pool
from app.routers.dashboard import router as dashboard_router
from app.routers.filters import router as filters_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_pool()
    yield
    stop_pool()


app = FastAPI(lifespan=lifespan)

app.include_router(dashboard_router)
app.include_router(filters_router)

@app.get("/health/db")
def database_health():
    with get_pool().acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM DUAL")
            value = cursor.fetchone()[0]

    return {"ok": value == 1}