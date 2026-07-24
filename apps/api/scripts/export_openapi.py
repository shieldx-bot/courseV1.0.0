"""Export FastAPI OpenAPI schema to JSON file.
Usage: python -m scripts.export_openapi [--output path/to/openapi.json]
"""
import json
import sys
from pathlib import Path


def main():
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from app.main import app

    schema = app.openapi()
    output = Path(sys.argv[sys.argv.index("--output") + 1]) if "--output" in sys.argv else Path(__file__).resolve().parent.parent.parent / "web" / "openapi.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(schema, indent=2))
    print(f"Exported OpenAPI schema ({len(schema.get('paths', {}))} paths) → {output}")


if __name__ == "__main__":
    main()
