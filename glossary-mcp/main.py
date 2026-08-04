import os
import logging
import csv
from typing import List, Dict, Optional, Any
from fastmcp import FastMCP
from fastapi import FastAPI
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app_name = "glossarymcp"

mcp = FastMCP(app_name)

# Glossary name mappings
GLOSSARY_MAPPING = {
    "Glossar.csv": "General Glossar",
    "EE_Glossar.csv": "E/E-Glossar",
    "E^3_Glossar.csv": "E³ Glossar",
    "Zoll_Steuern_Glossar.csv": "Zoll und Steuern Glossar",
}

# Reverse mapping for lookup by friendly name
REVERSE_GLOSSARY_MAPPING = {v: k for k, v in GLOSSARY_MAPPING.items()}


def normalize_text(text: str) -> str:
    """
    Normalize text to handle E³/E^3 variations.
    Converts E^3 to E³ for consistent matching.
    """
    return text.replace("E^3", "E³").replace("e^3", "e³")


def resolve_glossary_name(name: str) -> Optional[str]:
    """
    Resolve glossary name to handle E³/E^3 variations.
    Returns the canonical glossary name or None if not found.
    """
    # Direct match
    if name in REVERSE_GLOSSARY_MAPPING:
        return name

    # Handle E³/E^3 variations
    name_normalized = name.replace("E^3", "E³").replace("e^3", "E³").replace("e³", "E³")

    # Try normalized version
    if name_normalized in REVERSE_GLOSSARY_MAPPING:
        return name_normalized

    # Case-insensitive search
    name_lower = name.lower()
    for glossary_name in REVERSE_GLOSSARY_MAPPING.keys():
        if glossary_name.lower() == name_lower:
            return glossary_name

    return None

# Cache for loaded glossaries
glossary_cache: Dict[str, List[Dict[str, Any]]] = {}


def load_glossary(filename: str) -> List[Dict[str, Any]]:
    """Load a glossary CSV file and return normalized data."""
    if filename in glossary_cache:
        return glossary_cache[filename]

    data_dir = "data"
    file_path = os.path.join(data_dir, filename)

    if not os.path.exists(file_path):
        logger.error(f"Glossary file not found: {file_path}")
        return []

    entries = []
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            # Remove BOM if present
            content = file.read()
            if content.startswith("\ufeff"):
                content = content[1:]

            # Parse CSV
            reader = csv.DictReader(content.splitlines())
            glossary_name = GLOSSARY_MAPPING.get(filename, filename)

            for row in reader:
                # Normalize column names and add metadata
                entry = {
                    "starting_letter": row.get("Anfangsbuchstabe", "").strip(),
                    "term": row.get("Title", "").strip(),
                    "definition": row.get("Begriff", "").strip(),
                    "note": row.get("Hinweis", "").strip(),
                    "link": row.get("Link", "").strip(),
                    "glossary_name": glossary_name,
                }
                entries.append(entry)

        glossary_cache[filename] = entries
        logger.info(f"Loaded {len(entries)} entries from {filename}")
    except Exception as e:
        logger.error(f"Error loading glossary {filename}: {str(e)}")
        return []

    return entries


def load_all_glossaries() -> List[Dict[str, Any]]:
    """Load all glossaries and return combined data."""
    all_entries = []
    for filename in GLOSSARY_MAPPING.keys():
        entries = load_glossary(filename)
        all_entries.extend(entries)
    return all_entries


def search_entries(
    entries: List[Dict[str, Any]],
    term: Optional[str] = None,
    letter: Optional[str] = None,
    definition_text: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Search entries by term, letter, or definition text."""
    results = entries

    if term:
        # Normalize both search term and entry terms to handle E^3/E³ variations
        term_normalized = normalize_text(term).lower()
        results = [e for e in results if term_normalized in normalize_text(e["term"]).lower()]

    if letter:
        letter_upper = letter.upper()
        results = [e for e in results if e["starting_letter"].upper() == letter_upper]

    if definition_text:
        # Also normalize definition text search for consistency
        text_normalized = normalize_text(definition_text).lower()
        results = [e for e in results if text_normalized in normalize_text(e["definition"]).lower()]

    return results


@mcp.tool()
async def list_glossaries():
    """
    Lists all available glossaries with their friendly names and basic statistics.
    Returns the glossary name, file reference, and number of terms in each glossary.
    """
    glossaries = []

    for filename, friendly_name in GLOSSARY_MAPPING.items():
        entries = load_glossary(filename)
        glossaries.append(
            {
                "name": friendly_name,
                "term_count": len(entries),
            }
        )

    return {"glossaries": glossaries, "total_glossaries": len(glossaries)}


@mcp.tool()
async def search_term(term: str, glossary_name: Optional[str] = None):
    """
    Search for a specific term across all glossaries or within a specific glossary.
    Performs case-insensitive fuzzy matching on term names.

    Args:
        term: The term/abbreviation to search for (e.g., "ACC", "ABS")
        glossary_name: Optional. Specific glossary to search in (e.g., "E/E-Glossar", "E³ Glossar", "E^3 Glossar")
    """
    if glossary_name:
        # Resolve glossary name (handles E³/E^3 variations)
        resolved_name = resolve_glossary_name(glossary_name)
        if not resolved_name:
            return {
                "error": f"Glossary '{glossary_name}' not found. Available glossaries: {list(REVERSE_GLOSSARY_MAPPING.keys())}"
            }
        filename = REVERSE_GLOSSARY_MAPPING[resolved_name]
        entries = load_glossary(filename)
    else:
        # Search across all glossaries
        entries = load_all_glossaries()

    results = search_entries(entries, term=term)

    return {
        "query": {"term": term, "glossary": glossary_name or "all"},
        "results": results,
        "count": len(results),
    }


@mcp.tool()
async def search_by_letter(letter: str, glossary_name: Optional[str] = None):
    """
    Get all terms starting with a specific letter from all glossaries or a specific glossary.

    Args:
        letter: The starting letter (e.g., "A", "B", "E")
        glossary_name: Optional. Specific glossary to search in (e.g., "E/E-Glossar", "E³ Glossar", "E^3 Glossar")
    """
    if len(letter) != 1:
        return {"error": "Letter must be a single character"}

    if glossary_name:
        # Resolve glossary name (handles E³/E^3 variations)
        resolved_name = resolve_glossary_name(glossary_name)
        if not resolved_name:
            return {
                "error": f"Glossary '{glossary_name}' not found. Available glossaries: {list(REVERSE_GLOSSARY_MAPPING.keys())}"
            }
        filename = REVERSE_GLOSSARY_MAPPING[resolved_name]
        entries = load_glossary(filename)
    else:
        entries = load_all_glossaries()

    results = search_entries(entries, letter=letter)

    return {
        "query": {"letter": letter.upper(), "glossary": glossary_name or "all"},
        "results": results,
        "count": len(results),
    }


@mcp.tool()
async def search_definition(text: str, glossary_name: Optional[str] = None):
    """
    Full-text search in term definitions/meanings across all glossaries or a specific glossary.
    Useful for finding terms by their description or related concepts.

    Args:
        text: Text to search for in definitions (e.g., "Steuergerät", "Control")
        glossary_name: Optional. Specific glossary to search in (e.g., "E/E-Glossar", "E³ Glossar", "E^3 Glossar")
    """
    if glossary_name:
        # Resolve glossary name (handles E³/E^3 variations)
        resolved_name = resolve_glossary_name(glossary_name)
        if not resolved_name:
            return {
                "error": f"Glossary '{glossary_name}' not found. Available glossaries: {list(REVERSE_GLOSSARY_MAPPING.keys())}"
            }
        filename = REVERSE_GLOSSARY_MAPPING[resolved_name]
        entries = load_glossary(filename)
    else:
        entries = load_all_glossaries()

    results = search_entries(entries, definition_text=text)

    return {
        "query": {"text": text, "glossary": glossary_name or "all"},
        "results": results,
        "count": len(results),
    }


@mcp.tool()
async def batch_lookup(terms: List[str], glossary_name: Optional[str] = None):
    """
    Look up multiple terms at once across all glossaries or within a specific glossary.
    Returns results organized by term.

    Args:
        terms: List of terms to look up (e.g., ["ACC", "ABS", "ESP"])
        glossary_name: Optional. Specific glossary to search in (e.g., "E/E-Glossar", "E³ Glossar", "E^3 Glossar")
    """
    if glossary_name:
        # Resolve glossary name (handles E³/E^3 variations)
        resolved_name = resolve_glossary_name(glossary_name)
        if not resolved_name:
            return {
                "error": f"Glossary '{glossary_name}' not found. Available glossaries: {list(REVERSE_GLOSSARY_MAPPING.keys())}"
            }
        filename = REVERSE_GLOSSARY_MAPPING[resolved_name]
        entries = load_glossary(filename)
    else:
        entries = load_all_glossaries()

    batch_results = {}
    total_found = 0

    for term in terms:
        results = search_entries(entries, term=term)
        batch_results[term] = {
            "results": results,
            "count": len(results),
        }
        total_found += len(results)

    return {
        "query": {"terms": terms, "glossary": glossary_name or "all"},
        "batch_results": batch_results,
        "total_terms_searched": len(terms),
        "total_results_found": total_found,
    }


@mcp.tool()
async def get_all_terms(glossary_name: str):
    """
    Get all terms from a specific glossary.

    Args:
        glossary_name: Name of the glossary (e.g., "E/E-Glossar", "E³ Glossar", "E^3 Glossar", "General Glossar", "Zoll und Steuern Glossar")
    """
    # Resolve glossary name (handles E³/E^3 variations)
    resolved_name = resolve_glossary_name(glossary_name)
    if not resolved_name:
        return {
            "error": f"Glossary '{glossary_name}' not found. Available glossaries: {list(REVERSE_GLOSSARY_MAPPING.keys())}"
        }

    filename = REVERSE_GLOSSARY_MAPPING[resolved_name]
    entries = load_glossary(filename)

    return {
        "glossary": resolved_name,
        "terms": entries,
        "count": len(entries),
    }


@mcp.tool()
async def get_statistics():
    """
    Get statistics about all glossaries including term counts, letter distribution, and overall metrics.
    """
    stats = {
        "glossaries": {},
        "total_terms": 0,
        "letter_distribution": {},
    }

    for filename, friendly_name in GLOSSARY_MAPPING.items():
        entries = load_glossary(filename)
        term_count = len(entries)

        # Count terms by starting letter
        letter_counts = {}
        for entry in entries:
            letter = entry["starting_letter"].upper()
            letter_counts[letter] = letter_counts.get(letter, 0) + 1

        stats["glossaries"][friendly_name] = {
            "term_count": term_count,
            "letter_distribution": letter_counts,
        }

        stats["total_terms"] += term_count

        # Add to overall letter distribution
        for letter, count in letter_counts.items():
            stats["letter_distribution"][letter] = (
                stats["letter_distribution"].get(letter, 0) + count
            )

    return stats


if __name__ == "__main__":
    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "8002"))

    # Pre-load all glossaries into cache
    logger.info("Loading glossaries into cache...")
    load_all_glossaries()
    logger.info("Glossary cache initialized")

    # Build official HTTP ASGI app (handles /mcp) with proper lifespan
    mcp_app = mcp.http_app()

    wrapper = FastAPI(lifespan=mcp_app.lifespan)

    # Mount MCP app at root (it serves /mcp internally)
    wrapper.mount("/", mcp_app)

    @wrapper.get("/health")
    async def health():
        return {"status": "ok"}

    uvicorn.run(wrapper, host=host, port=port)