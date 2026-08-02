import argparse
import asyncio
import importlib
import logging
from pathlib import Path

from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


async def run_migration(name: str):
    db = get_db()
    path = Path(__file__).parent.parent.parent / "migrations" / f"{name}.py"
    if not path.exists():
        logger.error("Migration not found: %s", name)
        return

    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    if not hasattr(mod, "run"):
        logger.error("Migration %s has no run() function", name)
        return

    result = await mod.run(db)
    logger.info("Migration %s result: %s", name, result)


async def run_seed():
    import json
    from pathlib import Path

    db = get_db()
    seed_dir = Path(__file__).parent.parent.parent / "seed"
    for f in sorted(seed_dir.glob("*.json")):
        collection = f.stem
        count = await db[collection].count_documents({})
        if count > 0:
            logger.info("Seed skipped %s — already has %d documents", collection, count)
            continue
        with open(f) as fp:
            data = json.load(fp)
        await db[collection].insert_many(data)
        logger.info("Seeded %s with %d documents", collection, len(data))


def main():
    parser = argparse.ArgumentParser(description="Ascendly CLI")
    sub = parser.add_subparsers(dest="command")

    migrate = sub.add_parser("migrate", help="Run a migration")
    migrate.add_argument("name", help="Migration name (e.g. 001_seed_categories)")

    seed = sub.add_parser("seed", help="Seed database from JSON files")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if args.command == "migrate":
        asyncio.run(run_migration(args.name))
    elif args.command == "seed":
        asyncio.run(run_seed())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
