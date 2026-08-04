# Porsche Glossary MCP Server (Carrera Online)

**Helping AI Agents Understand Porsche "Fachchinesisch"**

This MCP server provides AI assistants with access to **local copies of the official Porsche Glossar from Carrera Online**, enabling them to understand and explain Porsche-specific technical jargon ("Fachchinesisch") across multiple domains.

**Note:** This server uses local CSV files downloaded from Carrera Online. It does NOT connect directly to SharePoint - the glossary data must be manually updated when new terms are added to the official Carrera Online Glossar.

## Overview

At Porsche, we use highly specialized terminology, abbreviations, and domain-specific language that can be challenging even for experienced colleagues. This Glossary MCP server bridges that gap by giving AI assistants like Claude instant access to the official Porsche Glossar definitions, helping them:

- **Translate "Fachchinesisch"** - Decode complex Porsche-specific abbreviations and technical terms
- **Provide Context** - Explain terminology within the correct domain (E/E systems, customs, architecture, etc.)
- **Enable Communication** - Help teams understand technical discussions across departments
- **Support Documentation** - Ensure consistent use of Porsche terminology in documents and code

The server supports fuzzy search, batch lookups, and provides domain context for each term across four comprehensive glossaries from Carrera Online.

## Available Glossaries

- **General Glossar** - General automotive and technical terms
- **E/E-Glossar** - Electrical/Electronic systems abbreviations and definitions
- **E³ Glossar** - End-to-End Electronic Architecture terminology (also accepts "E^3 Glossar")
- **Zoll und Steuern Glossar** - Customs and tax-related terms

**Note:** The E³ Glossar can be referenced using either "E³ Glossar" or "E^3 Glossar" - both forms are recognized.

## Getting Started

The Glossary MCP server requires no authentication - it reads glossary data from local CSV files. Simply configure proxy settings if needed:

1. Copy `.env.example` to `.env` (optional - only needed for proxy configuration)
2. Configure settings if needed:
   - Set proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`) if behind a corporate firewall
   - Set `MCP_PORT` to configure the server port (default is 8002)

### Option 1: Docker

Run the Glossary MCP server using Docker:

```
# From the glossary-mcp directory
docker-compose up -d

# Or from the parent mcporsche directory to run all MCP servers
cd ..
docker-compose up -d glossary-mcp
```

The server will be available at:
```
http://localhost:8002/mcp/
```

To stop the server:
```bash
docker-compose down
```

### Option 2: Local Installation

Start the server:
```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

Configure your MCP Client to use the server URL:
```
http://localhost:<MCP_PORT>/mcp/
```
i.e.
```
http://localhost:8002/mcp/
```

## Features

### Search Capabilities
- **Term Search**: Find specific terms across all or specific glossaries with fuzzy/case-insensitive matching
  - **E^3/E³ Normalization**: Searches automatically normalize "E^3" to "E³", so searching for "E^3" will match terms containing "E³"
- **Letter Browse**: Get all terms starting with a specific letter
- **Definition Search**: Full-text search within term definitions and meanings
- **Batch Lookup**: Search for multiple terms simultaneously

### Browse & Discovery
- **List Glossaries**: View all available glossaries with term counts
- **Get All Terms**: Retrieve complete term lists from specific glossaries
- **Statistics**: View detailed statistics including term counts and letter distributions

### Data Format
All results include:
- `term` - The abbreviation or term
- `definition` - Complete definition/meaning
- `starting_letter` - First letter for alphabetical organization
- `note` - Additional notes or context (if available)
- `link` - Reference links (if available)
- `glossary_name` - Source glossary for domain context

## Available Tools

### 1. `list_glossaries()`
Lists all available glossaries with statistics.

**Returns:**
```json
{
  "glossaries": [
    {
      "name": "E/E-Glossar",
      "term_count": 434
    },
    ...
  ],
  "total_glossaries": 4
}
```

### 2. `search_term(term: str, glossary_name?: str)`
Search for a specific term with fuzzy matching.

**Parameters:**
- `term` - The term to search for (e.g., "ACC", "ABS")
- `glossary_name` - Optional. Specific glossary to search in

**Example:**
```python
search_term("ACC")  # Search across all glossaries
search_term("ACC", "E/E-Glossar")  # Search only in E/E glossary
```

**Returns:**
```json
{
  "query": {
    "term": "ACC",
    "glossary": "all"
  },
  "results": [
    {
      "term": "ACC",
      "definition": "Adaptive Cruise Control...",
      "starting_letter": "A",
      "glossary_name": "E/E-Glossar",
      ...
    }
  ],
  "count": 1
}
```

### 3. `search_by_letter(letter: str, glossary_name?: str)`
Get all terms starting with a specific letter.

**Parameters:**
- `letter` - Single letter (e.g., "A", "B", "E")
- `glossary_name` - Optional. Specific glossary to search in

**Example:**
```python
search_by_letter("A")  # All A terms across all glossaries
search_by_letter("E", "E³ Glossar")  # Only E terms from E³ glossary
```

### 4. `search_definition(text: str, glossary_name?: str)`
Full-text search in definitions and meanings.

**Parameters:**
- `text` - Text to search for in definitions
- `glossary_name` - Optional. Specific glossary to search in

**Example:**
```python
search_definition("Steuergerät")  # Find all terms related to control units
```

### 5. `batch_lookup(terms: List[str], glossary_name?: str)`
Look up multiple terms simultaneously.

**Parameters:**
- `terms` - List of terms to search for
- `glossary_name` - Optional. Specific glossary to search in

**Example:**
```python
batch_lookup(["ACC", "ABS", "ESP"])
```

**Returns:**
```json
{
  "query": {
    "terms": ["ACC", "ABS", "ESP"],
    "glossary": "all"
  },
  "batch_results": {
    "ACC": {
      "results": [...],
      "count": 1
    },
    "ABS": {
      "results": [...],
      "count": 1
    },
    ...
  },
  "total_terms_searched": 3,
  "total_results_found": 3
}
```

### 6. `get_all_terms(glossary_name: str)`
Retrieve all terms from a specific glossary.

**Parameters:**
- `glossary_name` - Name of the glossary (e.g., "E/E-Glossar")

**Example:**
```python
get_all_terms("E³ Glossar")
```

### 7. `get_statistics()`
Get detailed statistics about all glossaries.

**Returns:**
```json
{
  "glossaries": {
    "E/E-Glossar": {
      "term_count": 434,
      "letter_distribution": {
        "A": 30,
        "B": 19,
        ...
      }
    },
    ...
  },
  "total_terms": 500,
  "letter_distribution": {
    "A": 50,
    "B": 30,
    ...
  }
}
```

## Environment Variables

Create a `.env` file with the following variables (all optional):

```
# Proxy settings (only if needed)
HTTP_PROXY=http://http-proxy.porsche.org:3128
HTTPS_PROXY=http://http-proxy.porsche.org:3133

# Server port (default: 8002)
MCP_PORT=8002
```

**Note:** The proxy settings are only required if you're behind a corporate firewall. If no proxy environment variables are set, the server will connect directly.

## Data Files

Glossary CSV files are stored in the `data/` directory:
- `Glossar.csv` - General Glossar
- `EE_Glossar.csv` - E/E-Glossar (434 terms)
- `E^3_Glossar.csv` - E³ Glossar (28 terms)
- `Zoll_Steuern_Glossar.csv` - Zoll und Steuern Glossar

### CSV Format
All glossaries follow this structure:
```csv
"Anfangsbuchstabe","Title","Begriff","Hinweis","Link"
"A","ACC","Adaptive Cruise Control...","",""
```

### Data Source

The glossary data in the `/data` directory originates from the official Porsche Glossar:
- **Source**: [Porsche Glossar on SharePoint](https://porsche.sharepoint.com/sites/CarreraOnline_PAG_Info-Welt/SitePages/Glossar.aspx)
- **Current Version**: 17.12.2025
- **Updates**: The CSV files need to be downloaded manually from the SharePoint source if newly added words are required

## Use Cases

### Understanding "Fachchinesisch" in Conversations
When AI assistants like Claude encounter Porsche-specific terminology in conversations, they can:
- Instantly look up abbreviations and technical terms from Carrera Online
- Explain what "SGV", "E³", "CBBaC", and hundreds of other terms mean
- Provide domain-specific context (is this an E/E term or a customs term?)
- Help bridge communication gaps between departments

**Example**:
> User: "We need to implement SGV for the new E³ architecture"
>
> AI: *looks up SGV and E³ in glossary* "I see you're working with Steuergerätevariante (SGV) for the End-to-End Electronic Architecture (E³). Let me help you with that implementation..."

### Documentation and Code Quality
- **Auto-explain abbreviations** in code comments and documentation
- **Validate terminology** consistency across teams
- **Generate glossary sections** for technical specifications
- **Onboard new team members** by explaining Porsche-specific terms they encounter

## Performance

- **Caching**: All glossaries are loaded into memory at startup for fast access
- **Search**: Case-insensitive fuzzy matching optimized for quick lookups
- **Batch Operations**: Efficient parallel lookup of multiple terms

## License

Internal use only - Porsche AG

## Support

For issues or questions, please contact the development team.