"""Database backing store for the 500k cohort — the sandbox's data warehouse.

The deterministic generator (api/sandbox.py) remains the source of truth:
`python -m api.sandbox export` materializes it into cohort_500k.csv, which
loads into either engine:

  python -m api.cohortdb build    →  SQLite  data/synthetic/cohort_500k.db
  python -m api.cohortdb loadpg   →  PostgreSQL `cohort` table (COPY, ~30s)

At request time the store picks PostgreSQL when a server with a loaded
`cohort` table answers at TABAQA_COHORT_DSN (default a local
postgresql://localhost:5432/tabaqa), else the SQLite file, else reports
unavailable and the sandbox falls back to the on-demand generator — so
teammates' machines and slim serverless deploys keep working untouched.
Every sandbox response stamps which engine served it (`backing`).
"""
from __future__ import annotations

import csv
import os
import sqlite3
import sys
import time
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
CSV_PATH = APP_DIR / "data" / "synthetic" / "cohort_500k.csv"
DB_PATH = APP_DIR / "data" / "synthetic" / "cohort_500k.db"

# 5433: the demo Mac's Homebrew postgresql@17 — 5432 is held by a pre-existing
# system PostgreSQL 18 (/Library/PostgreSQL/18, password-authed) we leave alone.
PG_DSN = os.environ.get("TABAQA_COHORT_DSN", "postgresql://localhost:5433/tabaqa")
_FORCE = os.environ.get("TABAQA_COHORT_ENGINE")  # "postgres" | "sqlite" | "generated"

# Everything not listed here is stored numeric (INTEGER when integral).
_TEXT_COLS = {"national_id", "name_ar", "name_en", "region", "sector",
              "employer", "employer_category", "credit_grade",
              "marital_status", "internal_rating", "risk_segment_ar",
              "model_version"}

# The list-view slice of the 58 columns — full rows come from record().
BROWSE_COLS = ["national_id", "name_ar", "name_en", "age", "region", "sector",
               "employer", "monthly_salary_sar", "credit_grade", "dbr",
               "bureau_score_sim", "pd_12m", "internal_rating", "ifrs9_stage",
               "risk_segment_ar"]

_SORT_KEYS = {"salary": "monthly_salary_sar", "pd": "pd_12m", "dbr": "dbr",
              "score": "bureau_score_sim", "el": "expected_loss_sar"}


_PG_OK: bool | None = None  # probed once per process — restart after starting/loading PG


def _pg_ok() -> bool:
    """True when a PostgreSQL server answers at PG_DSN *and* holds cohort rows."""
    global _PG_OK
    if _PG_OK is None:
        try:
            import psycopg
            with psycopg.connect(PG_DSN, connect_timeout=2) as conn:
                _PG_OK = conn.execute("SELECT 1 FROM cohort LIMIT 1").fetchone() is not None
        except Exception:
            _PG_OK = False
    return _PG_OK


def backing() -> str | None:
    """Which engine serves this process: 'postgresql' > 'sqlite' > None (generator)."""
    if _FORCE == "generated":
        return None
    if _FORCE == "sqlite":
        return "sqlite" if DB_PATH.exists() else None
    if _FORCE == "postgres":
        return "postgresql" if _pg_ok() else None
    if _pg_ok():
        return "postgresql"
    return "sqlite" if DB_PATH.exists() else None


def available() -> bool:
    return backing() is not None


def _connect() -> sqlite3.Connection:
    """A fresh read-only connection per request — safe under FastAPI's threadpool."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _pg_connect():
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(PG_DSN, row_factory=dict_row)


def _num(s: str):
    if s == "":
        return None
    try:
        return int(s)
    except ValueError:
        return float(s)


def build(csv_path: Path = CSV_PATH, db_path: Path = DB_PATH) -> None:
    """Load the exported cohort CSV into an indexed SQLite database."""
    if not csv_path.exists():
        raise SystemExit(f"missing {csv_path} — run `python -m api.sandbox export` first")
    t0 = time.time()
    tmp = db_path.with_suffix(".db.tmp")
    tmp.unlink(missing_ok=True)
    conn = sqlite3.connect(tmp)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        defs = ", ".join(
            f'"{c}" INTEGER PRIMARY KEY' if c == "idx"
            else f'"{c}" TEXT' if c in _TEXT_COLS else f'"{c}" NUMERIC'
            for c in header)
        conn.execute(f"CREATE TABLE cohort ({defs})")
        text_idx = {i for i, c in enumerate(header) if c in _TEXT_COLS}
        insert = f"INSERT INTO cohort VALUES ({','.join('?' * len(header))})"
        batch: list[list] = []
        n = 0
        for row in reader:
            batch.append([v if i in text_idx else _num(v) for i, v in enumerate(row)])
            if len(batch) >= 20_000:
                conn.executemany(insert, batch)
                n += len(batch)
                batch.clear()
                if n % 100_000 == 0:
                    print(f"  {n:,} rows…")
        if batch:
            conn.executemany(insert, batch)
            n += len(batch)
    conn.execute("CREATE UNIQUE INDEX ix_nin ON cohort(national_id)")
    for col in ("region", "sector", "credit_grade", "ifrs9_stage"):
        conn.execute(f"CREATE INDEX ix_{col} ON cohort({col})")
    conn.execute("ANALYZE")
    conn.commit()
    conn.close()
    tmp.replace(db_path)
    size_mb = db_path.stat().st_size / 1e6
    print(f"loaded {n:,} rows × {len(header)} cols → {db_path} "
          f"({size_mb:.0f} MB, {time.time() - t0:.0f}s)")


def _filters(region, sector, grade, stage, delinquent, min_salary, max_salary,
             sort, desc, ph: str) -> tuple[str, str, list]:
    """(where_sql, order_sql, params) — shared by both engines; ph = placeholder."""
    where, params = [], []
    for clause, value in [("region = ", region), ("sector = ", sector),
                          ("credit_grade = ", grade), ("ifrs9_stage = ", stage),
                          ("serious_delinquency = ", delinquent),
                          ("monthly_salary_sar >= ", min_salary),
                          ("monthly_salary_sar <= ", max_salary)]:
        if value is not None:
            where.append(clause + ph)
            params.append(value)
    sql_where = f" WHERE {' AND '.join(where)}" if where else ""
    order = f' ORDER BY "{_SORT_KEYS[sort]}" {"DESC" if desc else "ASC"}' if sort in _SORT_KEYS else ""
    return sql_where, order, params


def browse(offset: int, limit: int, *, region: str | None = None,
           sector: str | None = None, grade: str | None = None,
           stage: int | None = None, delinquent: int | None = None,
           min_salary: float | None = None, max_salary: float | None = None,
           sort: str | None = None, desc: bool = False) -> tuple[int, list[dict]]:
    """(matching_total, page) over the cohort table with real WHERE clauses."""
    pg = backing() == "postgresql"
    sql_where, order, params = _filters(region, sector, grade, stage, delinquent,
                                        min_salary, max_salary, sort, desc,
                                        "%s" if pg else "?")
    cols = ", ".join(f'"{c}"' for c in BROWSE_COLS)
    count_sql = f"SELECT COUNT(*) FROM cohort{sql_where}"
    page_sql = (f"SELECT {cols} FROM cohort{sql_where}{order} "
                f"LIMIT {'%s' if pg else '?'} OFFSET {'%s' if pg else '?'}")
    if pg:
        with _pg_connect() as conn:
            total = conn.execute(count_sql, params).fetchone()["count"]
            rows = conn.execute(page_sql, params + [limit, offset]).fetchall()
            return total, [_plain(r) for r in rows]
    conn = _connect()
    try:
        total = conn.execute(count_sql, params).fetchone()[0]
        rows = conn.execute(page_sql, params + [limit, offset]).fetchall()
        return total, [dict(r) for r in rows]
    finally:
        conn.close()


def _plain(row: dict) -> dict:
    """psycopg returns Decimal for numeric columns — flatten to int/float for JSON."""
    from decimal import Decimal
    return {k: (int(v) if v == v.to_integral_value() else float(v))
            if isinstance(v, Decimal) else v for k, v in row.items()}


def record(nin: str) -> dict | None:
    """The full analytical row for one national ID, or None if not in the store."""
    if backing() == "postgresql":
        with _pg_connect() as conn:
            row = conn.execute("SELECT * FROM cohort WHERE national_id = %s", (nin,)).fetchone()
            return _plain(row) if row else None
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM cohort WHERE national_id = ?", (nin,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


_STATS: dict | None = None


def _scalar(v):
    """Numeric SQL results as JSON-friendly int/float (psycopg hands back Decimal)."""
    from decimal import Decimal
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def stats() -> dict:
    """Portfolio-level aggregates over all 500k rows — computed once, then cached."""
    global _STATS
    if _STATS is not None:
        return _STATS
    if backing() == "postgresql":
        import psycopg
        conn = psycopg.connect(PG_DSN)  # default tuple rows, same shape as sqlite
    else:
        conn = _connect()
    try:
        one = lambda sql: conn.execute(sql).fetchone()  # noqa: E731
        pop = one("SELECT COUNT(*) FROM cohort")[0]
        sal = one("SELECT AVG(monthly_salary_sar), MIN(monthly_salary_sar), "
                  "MAX(monthly_salary_sar) FROM cohort")
        median = one(f"SELECT monthly_salary_sar FROM cohort ORDER BY "
                     f"monthly_salary_sar LIMIT 1 OFFSET {pop // 2}")[0]
        risk = one("SELECT AVG(dbr), AVG(pd_12m), SUM(expected_loss_sar), AVG(el_bps), "
                   "AVG(thin_file), AVG(serious_delinquency), AVG(within_sama_ceiling), "
                   "SUM(total_outstanding_sar), SUM(max_financing_48m_sar) FROM cohort")
        group = lambda col: {str(r[0]): r[1] for r in conn.execute(  # noqa: E731
            f"SELECT {col}, COUNT(*) FROM cohort GROUP BY {col} ORDER BY {col}")}
        regions = [{"region": r[0], "count": r[1], "avg_salary_sar": round(r[2])}
                   for r in conn.execute(
                       "SELECT region, COUNT(*), AVG(monthly_salary_sar) FROM cohort "
                       "GROUP BY region ORDER BY COUNT(*) DESC")]
        sal, median = [_scalar(v) for v in sal], _scalar(median)
        risk = [_scalar(v) for v in risk]
        _STATS = {
            "population": pop,
            "salary_sar": {"avg": round(sal[0]), "median": median,
                           "min": sal[1], "max": sal[2]},
            "portfolio": {
                "avg_dbr": round(risk[0], 4), "avg_pd_12m": round(risk[1], 4),
                "expected_loss_sar": round(risk[2]), "avg_el_bps": round(risk[3]),
                "thin_file_share": round(risk[4], 4),
                "serious_delinquency_share": round(risk[5], 4),
                "within_sama_ceiling_share": round(risk[6], 4),
                "total_outstanding_sar": round(risk[7]),
                "max_financing_capacity_48m_sar": round(risk[8]),
            },
            "by_credit_grade": group("credit_grade"),
            "by_ifrs9_stage": group("ifrs9_stage"),
            "by_internal_rating": group("internal_rating"),
            "by_region": regions,
        }
        return _STATS
    finally:
        conn.close()


def load_pg(csv_path: Path = CSV_PATH, dsn: str = PG_DSN) -> None:
    """Bulk-load the cohort CSV into PostgreSQL via COPY, then index + ANALYZE."""
    import psycopg
    if not csv_path.exists():
        raise SystemExit(f"missing {csv_path} — run `python -m api.sandbox export` first")
    t0 = time.time()
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        header = next(csv.reader(f))
    defs = ",\n  ".join(
        f'"{c}" integer PRIMARY KEY' if c == "idx"
        else f'"{c}" text' if c in _TEXT_COLS else f'"{c}" numeric'
        for c in header)
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute("DROP TABLE IF EXISTS cohort")
        conn.execute(f"CREATE TABLE cohort (\n  {defs}\n)")
        with conn.cursor() as cur, csv_path.open("rb") as f:
            with cur.copy("COPY cohort FROM STDIN WITH (FORMAT csv, HEADER true)") as copy:
                while chunk := f.read(1 << 20):
                    copy.write(chunk)
        conn.execute('CREATE UNIQUE INDEX ix_pg_nin ON cohort(national_id)')
        for col in ("region", "sector", "credit_grade", "ifrs9_stage"):
            conn.execute(f"CREATE INDEX ix_pg_{col} ON cohort({col})")
        conn.execute("ANALYZE cohort")
        n = conn.execute("SELECT COUNT(*) FROM cohort").fetchone()[0]
        size = conn.execute("SELECT pg_size_pretty(pg_total_relation_size('cohort'))").fetchone()[0]
    print(f"loaded {n:,} rows × {len(header)} cols → PostgreSQL table cohort "
          f"({size}, {time.time() - t0:.0f}s) at {dsn}")


if __name__ == "__main__":
    if "build" in sys.argv[1:]:
        build()
    if "loadpg" in sys.argv[1:]:
        load_pg()
    if "stats" in sys.argv[1:]:
        import json
        print(json.dumps(stats(), ensure_ascii=False, indent=2))
    if len(sys.argv) == 1:
        print(f"backing: {backing() or 'none — generator fallback'} (pg dsn: {PG_DSN})\n"
              f"load: `python -m api.cohortdb build` (sqlite) · "
              f"`python -m api.cohortdb loadpg` (postgresql)")
