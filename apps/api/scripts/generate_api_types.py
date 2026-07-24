"""Generate TypeScript types from FastAPI OpenAPI schema.
Usage: python scripts/generate_api_types.py [--watch]
"""
import json
import re
import sys
from pathlib import Path


API_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = API_DIR.parent / "web"
OPENAPI_PATH = WEB_DIR / "openapi.json"
OUTPUT_PATH = WEB_DIR / "types" / "api.ts"


TYPE_MAP = {
    "string": "string",
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
    "array": "unknown[]",
    "object": "Record<string, unknown>",
}


def _ts_type(ref_name: str) -> str:
    if ref_name.startswith("#/components/schemas/"):
        name = ref_name.split("/")[-1]
        name = re.sub(r"Body_.*", "never", name)
        return name
    return "unknown"


def _resolve_prop(schema: dict, schemas: dict) -> str:
    if "$ref" in schema:
        return _ts_type(schema["$ref"])

    if "anyOf" in schema:
        parts = [_resolve_prop(s, schemas) for s in schema["anyOf"]]
        return " | ".join(parts)

    if "allOf" in schema:
        parts = [_resolve_prop(s, schemas) for s in schema["allOf"]]
        return " & ".join(parts)

    t = schema.get("type", "unknown")
    if t == "array":
        items = schema.get("items", {})
        inner = _resolve_prop(items, schemas)
        return f"{inner}[]"
    if t == "string" and schema.get("enum"):
        return " | ".join(f'"{v}"' for v in schema["enum"])
    return TYPE_MAP.get(t, "unknown")


def _type_name(name: str) -> str:
    if name == "HTTPValidationError":
        return None
    if name.startswith("Body_"):
        return None
    return name


def _generate_interfaces(schemas: dict) -> str:
    lines = []
    lines.append("// ── Auto-generated from OpenAPI schema — do not edit manually ──")
    lines.append("// Regenerate with: python apps/api/scripts/generate_api_types.py")
    lines.append("")

    for name, schema_def in schemas.items():
        ts_name = _type_name(name)
        if ts_name is None:
            continue

        props = schema_def.get("properties", {})
        required = set(schema_def.get("required", []))
        if not props:
            lines.append(f"export interface {ts_name} {{}}")
            continue

        lines.append(f"export interface {ts_name} {{")
        for prop_name, prop_schema in props.items():
            ts = _resolve_prop(prop_schema, schemas)
            optional = prop_name not in required and prop_name != "_id"
            opt_str = "?" if optional else ""
            comment = prop_schema.get("description", "")
            if comment:
                lines.append(f"  /** {comment} */")
            lines.append(f"  {prop_name}{opt_str}: {ts};")
        lines.append("}")
        lines.append("")

    return "\n".join(lines)


def _extract_responses(path_item: dict, schemas: dict) -> list[tuple[str, str]]:
    results = []
    for method in ["get", "post", "put", "delete", "patch"]:
        op = path_item.get(method)
        if not op:
            continue
        status = "200" if "200" in op.get("responses", {}) else "default"
        resp = op["responses"].get(status, {})
        content = resp.get("content", {})
        media = content.get("application/json", {})
        schema = media.get("schema", {})
        ts = _resolve_prop(schema, schemas)
        results.append((method.upper(), ts))
    return results


def _generate_path_types(schema: dict) -> str:
    schemas = schema.get("components", {}).get("schemas", {})
    paths = schema.get("paths", {})
    lines = []
    lines.append("export interface ApiPaths {")

    for path, methods in sorted(paths.items()):
        ts_path = path.replace("{", "${")
        for method in ["get", "post", "put", "delete", "patch"]:
            op = methods.get(method)
            if not op:
                continue
            summary = op.get("summary", op.get("operationId", ""))
            tag = (op.get("tags") or ["default"])[0]
            m = method.upper()

            lines.append(f'  /** {tag}: {summary} */')
            lines.append(f'  "{m} {ts_path}": {{')

            params = op.get("parameters", [])
            if params:
                lines.append("    parameters: {")
                for p in params:
                    p_name = p["name"]
                    p_schema = p.get("schema", {})
                    p_type = _resolve_prop(p_schema, schemas)
                    p_required = p.get("required", False)
                    opt = "" if p_required else "?"
                    lines.append(f'      "{p_name}"{opt}: {p_type};')
                lines.append("    };")

            req_body = op.get("requestBody", {})
            req_content = req_body.get("content", {}).get("application/json", {})
            req_schema = req_content.get("schema", {})
            if req_schema:
                ts = _resolve_prop(req_schema, schemas)
                lines.append(f"    requestBody: {ts};")

            status = "200" if "200" in op.get("responses", {}) else "default"
            resp = op["responses"].get(status, {})
            resp_content = resp.get("content", {}).get("application/json", {})
            resp_schema = resp_content.get("schema", {})
            if resp_schema:
                ts = _resolve_prop(resp_schema, schemas)
                lines.append(f"    response: {ts};")

            lines.append("  };")
            lines.append("")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def _path_to_fn_name(method: str, path: str) -> str:
    name = path.replace("{", "").replace("}", "")
    name = re.sub(r"[^a-zA-Z0-9_/]", "_", name).strip("_")
    name = re.sub(r"[/-]+", "_", name)
    return f"{method}_{name}"


def generate() -> str:
    with open(OPENAPI_PATH) as f:
        schema = json.load(f)

    schemas = schema.get("components", {}).get("schemas", {})

    parts = [
        "// ⚠️ AUTO-GENERATED — do not edit manually",
        "// Regenerate: python apps/api/scripts/generate_api_types.py",
        "",
        _generate_interfaces(schemas),
        _generate_path_types(schema),
    ]
    return "\n".join(parts)


if __name__ == "__main__":
    output = generate()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(output)
    print(f"Generated {OUTPUT_PATH}")
