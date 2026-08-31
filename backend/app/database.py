import os
import oracledb

pool = None


def start_pool():
    global pool

    dsn = (
        f"{os.environ['DB_HOST']}:"
        f"{os.environ['DB_PORT']}/"
        f"{os.environ['DB_SERVICE_NAME']}"
    )

    pool = oracledb.create_pool(
        user=os.environ["DB_USERNAME"],
        password=os.environ["DB_PASSWORD"],
        dsn=dsn,
        min=1,
        max=4,
        increment=1,
        stmtcachesize=50,
    )


def stop_pool():
    global pool

    if pool:
        pool.close(force=True)
        pool = None


def get_pool():
    if pool is None:
        raise RuntimeError("Oracle pool is unavailable")

    return pool