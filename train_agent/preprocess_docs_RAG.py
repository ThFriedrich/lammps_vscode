import json
import re
import os
import tiktoken
from typing import List, Dict, Any
from pathlib import Path
import glob

# -----------------------------
# Settings
# -----------------------------

INPUT_FILE = "src/doc_obj.ts"
EXAMPLES_DIR = "/home/thomas/Documents/Git/lammps/examples"
SYNTAX_FILE = "syntaxes/lmps.tmLanguage.json"
RST_DIR = "rst"  # Directory containing RST documentation files
OUTPUT_FILE = "train_agent/lammps_docs_chunks.json"
MAX_TOKENS = 1500  # approximate chunk cap

# Prefixes for general documentation (files starting with capital letters)
GENERAL_DOC_PREFIXES = {
    "Build": "Building LAMMPS",
    "Classes": "Python/C++ Classes and API",
    "Commands": "Command Categories and Structure", 
    "Developer": "Developer Documentation",
    "Errors": "Error Handling and Debugging",
    "Howto": "How-To Guides",
    "Install": "Installation",
    "Intro": "Introduction to LAMMPS",
    "Library": "Library Interface",
    "Modify": "Extending and Modifying LAMMPS",
    "Packages": "LAMMPS Packages",
    "Python": "Python Interface",
    "Run": "Running Simulations",
    "Speed": "Performance and Optimization",
    "Tools": "LAMMPS Tools",
    "Manual": "Manual Overview",
    "Cplusplus": "C++ Interface",
    "Fortran": "Fortran Interface",
}

# tokenizer (same as OpenAI GPT-4/Mistral approx)
enc = tiktoken.get_encoding("cl100k_base")


# -----------------------------
# Utilities
# -----------------------------

def count_tokens(text: str) -> int:
    return len(enc.encode(text))


def _split_long_paragraph(text: str, max_tokens: int) -> List[str]:
    """Split a single oversized paragraph by sentences, then by hard token cuts."""
    # Try splitting by sentences first
    sentences = re.split(r'(?<=[.!?])\s+', text)
    if len(sentences) <= 1:
        # No sentence boundaries — hard-split by tokens
        tokens = enc.encode(text)
        parts = []
        for i in range(0, len(tokens), max_tokens):
            parts.append(enc.decode(tokens[i:i + max_tokens]))
        return parts

    chunks = []
    current = ""
    for s in sentences:
        if count_tokens(current + " " + s) > max_tokens:
            if current.strip():
                chunks.append(current.strip())
            if count_tokens(s) > max_tokens:
                # Single sentence still too long — hard-split
                tokens = enc.encode(s)
                for i in range(0, len(tokens), max_tokens):
                    chunks.append(enc.decode(tokens[i:i + max_tokens]))
                current = ""
            else:
                current = s
        else:
            current = (current + " " + s).strip()
    if current.strip():
        chunks.append(current.strip())
    return chunks


def chunk_text(text: str, max_tokens: int) -> List[str]:
    """
    Split text into chunks to respect max token size.
    Uses paragraph-based splitting, with sentence-level fallback for oversized paragraphs.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for p in paragraphs:
        # If single paragraph exceeds limit, split it further
        if count_tokens(p) > max_tokens:
            if current.strip():
                chunks.append(current.strip())
                current = ""
            sub_chunks = _split_long_paragraph(p, max_tokens)
            chunks.extend(sub_chunks)
            continue

        if count_tokens(current + "\n\n" + p) > max_tokens:
            if current.strip():
                chunks.append(current.strip())
            current = p
        else:
            current += "\n\n" + p

    if current.strip():
        chunks.append(current.strip())

    return chunks


# -----------------------------
# Load and parse TS file
# -----------------------------

def extract_command_docs(ts_text: str) -> List[Dict[str, Any]]:
    """
    Extract the array literal assigned to command_docs in doc_obj.ts
    """

    # Find the array literal inside "export const command_docs = [ ... ];"
    # Use greedy match (*) to capture the entire array until the final ];
    match = re.search(
        r"export const command_docs\s*=\s*(\[[\s\S]*\]);",
        ts_text
    )
    if not match:
        raise ValueError("Could not find command_docs array in TS file.")

    array_text = match.group(1)

    # Remove trailing commas that break JSON
    array_text = re.sub(r",(\s*[}\]])", r"\1", array_text)

    # Fix JS trailing commas inside objects/arrays
    array_text = re.sub(r",(\s*[}\]])", r"\1", array_text)

    try:
        data = json.loads(array_text)
        return data
    except json.JSONDecodeError:
        try:
            import json5  # type: ignore
        except Exception:
            print("Error parsing JSON. Consider installing 'json5' (pip install json5) to parse JS-style literals.")
            raise

    def split_top_level_objects(s: str) -> List[str]:
        objs = []
        i = 0
        n = len(s)
        depth = 0
        in_str = False
        str_char = ""
        escape = False
        buf = []

        while i < n:
            ch = s[i]

            if in_str:
                buf.append(ch)
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == str_char:
                    in_str = False
                i += 1
                continue

            # not in string
            if ch == '"' or ch == "'" or ch == '`':
                in_str = True
                str_char = ch
                buf.append(ch)
                i += 1
                continue

            if ch == '{':
                depth += 1
                buf.append(ch)
                i += 1
                continue

            if ch == '}':
                depth -= 1
                buf.append(ch)
                i += 1
                if depth == 0:
                    # finished an object; strip surrounding whitespace
                    obj_text = ''.join(buf).strip()
                    if obj_text:
                        objs.append(obj_text)
                    buf = []
                continue

            if depth > 0:
                buf.append(ch)
            i += 1

        return objs

    # Remove the surrounding square brackets before splitting to simplify logic
    inner = array_text.strip()
    if inner.startswith('[') and inner.endswith(']'):
        inner = inner[1:-1]

    object_texts = split_top_level_objects(inner)

    parsed = []
    import json5 as _json5  # type: ignore
    for idx, ot in enumerate(object_texts):
        try:
            obj = _json5.loads(ot)
            parsed.append(obj)
        except Exception as e:
            print(f"Failed to parse object #{idx} with json5. Object preview:\n{ot}\n")
            print("json5 error:", e)
            raise

    return parsed


def build_text_from_entry(entry: Dict[str, Any]) -> str:
    """
    Convert a LAMMPS command entry into a flat text block for embeddings.
    """

    def safe(key):
        v = entry.get(key)
        if not v:
            return ""
        if isinstance(v, list):
            return "\n".join(str(x) for x in v)
        return str(v)

    parts = [
        f"COMMAND:\n{safe('command')}",
        f"\nCATEGORY:\n{safe('category')}",
        f"\nSECTION:\n{safe('section')}",
        f"\nSYNTAX:\n{safe('syntax')}",
        f"\nDESCRIPTION:\n{safe('description')}",
        f"\nPARAMETERS:\n{safe('parameters')}",
        f"\nEXAMPLES:\n{safe('examples')}",
        f"\nRELATED:\n{safe('related')}",
        f"\nCOMMAND NOTATION:\n{safe('command-notation')}",
    ]

    text = "\n".join(p for p in parts if p.strip())
    text = text.strip()

    # sanitize images and embedded base64/data URIs
    def sanitize(text: str) -> str:
        # remove markdown images: ![alt](url)
        text = re.sub(r"!\[[^\]]*\]\([^\)\n]*\)", "", text)

        # remove HTML <img ...> tags
        text = re.sub(r"<img\b[^>]*>", "", text, flags=re.IGNORECASE)

        # remove inline svg blocks <svg>...</svg>
        text = re.sub(r"<svg[\s\S]*?</svg>", "", text, flags=re.IGNORECASE)

        # remove data URI occurrences (data:image/..., possibly base64)
        text = re.sub(r"data:image/[^\s\)\'\"]+", "", text)

        # remove HTML <figure> or other image-containing tags conservatively
        text = re.sub(r"<figure[\s\S]*?</figure>", "", text, flags=re.IGNORECASE)

        return text

    return sanitize(text)


def process_example_scripts(examples_dir: str) -> List[Dict[str, Any]]:
    """
    Find and process all LAMMPS example scripts (in.*) in the examples directory.
    Returns a list of dictionaries with example script information.
    """
    if not os.path.exists(examples_dir):
        print(f"Warning: Examples directory {examples_dir} not found. Skipping examples.")
        return []
    
    example_files = []
    for root, dirs, files in os.walk(examples_dir):
        for file in files:
            if file.startswith("in."):
                example_files.append(os.path.join(root, file))
    
    print(f"Found {len(example_files)} example scripts")
    
    examples = []
    for filepath in example_files:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Extract relative path from examples directory
            rel_path = os.path.relpath(filepath, examples_dir)
            example_name = os.path.basename(filepath)
            category = os.path.dirname(rel_path).split(os.sep)[0]
            
            # Extract comment lines at the beginning as description
            description_lines = []
            for line in content.split('\n')[:10]:  # Check first 10 lines
                line = line.strip()
                if line.startswith('#'):
                    description_lines.append(line[1:].strip())
                elif line and not line.startswith('#'):
                    break
            
            description = ' '.join(description_lines) if description_lines else f"Example script from {category}"
            
            examples.append({
                'filepath': filepath,
                'rel_path': rel_path,
                'name': example_name,
                'category': category,
                'description': description,
                'content': content
            })
        except Exception as e:
            print(f"Warning: Could not read {filepath}: {e}")
            continue
    
    return examples


def build_text_from_example(example: Dict[str, Any]) -> str:
    """
    Convert a LAMMPS example script entry into a flat text block for embeddings.
    """
    parts = [
        f"LAMMPS EXAMPLE SCRIPT",
        f"\nNAME:\n{example['name']}",
        f"\nCATEGORY:\n{example['category']}",
        f"\nPATH:\n{example['rel_path']}",
        f"\nDESCRIPTION:\n{example['description']}",
        f"\nSCRIPT CONTENT:\n{example['content']}"
    ]
    
    text = "\n".join(p for p in parts if p.strip())
    return text.strip()


def extract_syntax_keywords(syntax_file: str) -> List[Dict[str, Any]]:
    """
    Extract syntax keywords, commands, styles, and functions from tmLanguage.json.
    Returns structured syntax information for embeddings.
    """
    if not os.path.exists(syntax_file):
        print(f"Warning: Syntax file {syntax_file} not found. Skipping syntax extraction.")
        return []
    
    with open(syntax_file, 'r', encoding='utf-8') as f:
        syntax_data = json.load(f)
    
    syntax_entries = []
    
    # Extract general commands
    patterns = syntax_data.get('repository', {}).get('keywords', {}).get('patterns', [])
    for pattern in patterns:
        if pattern.get('name') == 'keyword.command.general.lmps':
            match_text = pattern.get('match', '')
            # Extract commands from regex pattern
            commands = re.findall(r'\\b\(([^)]+)\)', match_text)
            if commands:
                command_list = commands[0].split('|')
                syntax_entries.append({
                    'type': 'general_commands',
                    'category': 'LAMMPS General Commands',
                    'keywords': command_list,
                    'description': 'General LAMMPS input script commands for simulation setup and control'
                })
    
    # Extract style-specific keywords (compute, pair_style, bond_style, etc.)
    style_types = {
        'compute': 'Compute Styles',
        'pair_style': 'Pair Styles',
        'bond_style': 'Bond Styles', 
        'angle_style': 'Angle Styles',
        'dihedral_style': 'Dihedral Styles',
        'improper_style': 'Improper Styles',
        'dump': 'Dump Styles',
        'fix': 'Fix Styles',
        'fix_modify': 'Fix Modify Options'
    }
    
    for pattern in patterns:
        if 'begin' in pattern:
            command_name = pattern.get('begin', '').replace('^\\\\s*', '').replace('\\\\s', '')
            if command_name in style_types:
                sub_patterns = pattern.get('patterns', [])
                for sub_pattern in sub_patterns:
                    match_text = sub_pattern.get('match', '')
                    styles = re.findall(r'\\b\(([^)]+)\)', match_text)
                    if styles:
                        style_list = styles[0].split('|')
                        syntax_entries.append({
                            'type': f'{command_name}_styles',
                            'category': f'LAMMPS {style_types[command_name]}',
                            'keywords': style_list,
                            'description': f'Available styles for the {command_name} command'
                        })
    
    # Extract functions
    function_patterns = syntax_data.get('repository', {}).get('functions', {}).get('patterns', [])
    for func_pattern in function_patterns:
        func_name = func_pattern.get('name', '')
        match_text = func_pattern.get('match', '')
        funcs = re.findall(r'\\b\(([^)]+)\)', match_text)
        if funcs:
            func_list = funcs[0].split('|')
            category = func_name.replace('support.function.', '').replace('_', ' ').replace('.lmps', '').title()
            syntax_entries.append({
                'type': 'functions',
                'category': f'LAMMPS {category}',
                'keywords': func_list,
                'description': f'Built-in LAMMPS {category.lower()} for use in variables and compute operations'
            })
    
    # Extract k-space solvers
    for pattern in patterns:
        if pattern.get('name') == 'keyword.k_space_solver.lmps':
            match_text = pattern.get('match', '')
            solvers = re.findall(r'\\b\(([^)]+)\)', match_text)
            if solvers:
                solver_list = solvers[0].split('|')
                syntax_entries.append({
                    'type': 'kspace_solvers',
                    'category': 'LAMMPS K-Space Solvers',
                    'keywords': solver_list,
                    'description': 'Long-range Coulombic solver styles for kspace_style command'
                })
    
    print(f"Extracted {len(syntax_entries)} syntax categories")
    return syntax_entries


def build_text_from_syntax(syntax_entry: Dict[str, Any]) -> str:
    """
    Convert syntax entry into a flat text block for embeddings.
    """
    keywords = syntax_entry.get('keywords', [])
    keyword_text = ', '.join(keywords)
    
    parts = [
        f"LAMMPS SYNTAX REFERENCE",
        f"\nCATEGORY:\n{syntax_entry['category']}",
        f"\nTYPE:\n{syntax_entry['type']}",
        f"\nDESCRIPTION:\n{syntax_entry['description']}",
        f"\nKEYWORDS:\n{keyword_text}",
        f"\nTOTAL COUNT:\n{len(keywords)} available options"
    ]
    
    text = "\n".join(p for p in parts if p.strip())
    return text.strip()


def process_general_rst_docs(rst_dir: str) -> List[Dict[str, Any]]:
    """
    Process general LAMMPS documentation RST files (non-command docs).
    These are files starting with capital letters like Howto_*, Developer_*, etc.
    """
    if not os.path.exists(rst_dir):
        print(f"Warning: RST directory {rst_dir} not found. Skipping general docs.")
        return []
    
    general_docs = []
    
    # Find all RST files starting with capital letters
    for filename in os.listdir(rst_dir):
        if not filename.endswith('.rst'):
            continue
        if not filename[0].isupper():
            continue
        
        filepath = os.path.join(rst_dir, filename)
        if not os.path.isfile(filepath):
            continue
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Determine category from filename prefix
            base_name = filename.replace('.rst', '')
            category = "General"
            for prefix, cat_name in GENERAL_DOC_PREFIXES.items():
                if base_name.startswith(prefix):
                    category = cat_name
                    break
            
            # Extract title from RST (first heading)
            title_match = re.search(r'^([^\n]+)\n[=]+\n', content, re.MULTILINE)
            title = title_match.group(1).strip() if title_match else base_name.replace('_', ' ')
            
            # Clean RST content for embedding
            clean_content = clean_rst_content(content)
            
            if len(clean_content.strip()) < 100:
                continue  # Skip very short files
            
            general_docs.append({
                'filename': filename,
                'title': title,
                'category': category,
                'content': clean_content
            })
        except Exception as e:
            print(f"Warning: Could not read {filepath}: {e}")
            continue
    
    print(f"Found {len(general_docs)} general documentation files")
    return general_docs


def clean_rst_content(content: str) -> str:
    """
    Clean RST content for embedding by removing markup and extracting text.
    """
    # Remove RST directives headers (keep content)
    content = re.sub(r'\.\. [a-z_]+::[^\n]*\n', '', content)
    
    # Remove reference targets
    content = re.sub(r'\.\. _[^:]+:', '', content)
    
    # Remove index directives
    content = re.sub(r'\.\. index::[^\n]*\n', '', content)
    
    # Convert RST links :doc:`text <target>` to just text
    content = re.sub(r':doc:`([^`<]+)(?:<[^>]+>)?`', r'\1', content)
    content = re.sub(r':ref:`([^`<]+)(?:<[^>]+>)?`', r'\1', content)
    
    # Remove image directives
    content = re.sub(r'\.\. image::[^\n]*\n(?:\s+:[^\n]+\n)*', '', content)
    content = re.sub(r'\.\. figure::[^\n]*\n(?:\s+:[^\n]+\n)*', '', content)
    
    # Remove toctree directives
    content = re.sub(r'\.\. toctree::[^\n]*\n(?:\s+:[^\n]+\n)*(?:\s+[^\n]+\n)*', '', content)
    
    # Remove table of contents
    content = re.sub(r'\.\. contents::[^\n]*\n(?:\s+:[^\n]+\n)*', '', content)
    
    # Convert code-block to plain text marker
    content = re.sub(r'\.\. code-block::\s*\w*\n', '\nCode:\n', content)
    content = re.sub(r'\.\. parsed-literal::\s*\n', '\nCode:\n', content)
    
    # Remove RST role markers
    content = re.sub(r':[a-z]+:`([^`]+)`', r'\1', content)
    
    # Remove heading underlines but keep text
    content = re.sub(r'\n[=\-~^"\']+\n', '\n', content)
    
    # Remove excessive whitespace
    content = re.sub(r'\n{3,}', '\n\n', content)
    content = re.sub(r' {2,}', ' ', content)
    
    return content.strip()


def build_text_from_general_doc(doc: Dict[str, Any]) -> str:
    """
    Convert a general documentation entry into a flat text block for embeddings.
    """
    parts = [
        f"LAMMPS DOCUMENTATION",
        f"\nTITLE:\n{doc['title']}",
        f"\nCATEGORY:\n{doc['category']}",
        f"\nFILE:\n{doc['filename']}",
        f"\nCONTENT:\n{doc['content']}"
    ]
    
    text = "\n".join(p for p in parts if p.strip())
    return text.strip()


def main():
    print("Reading TS file...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        ts = f.read()

    print("Extracting command_docs array...")
    docs = extract_command_docs(ts)
    print(f"Found {len(docs)} entries")

    print("\nProcessing example scripts...")
    examples = process_example_scripts(EXAMPLES_DIR)
    print(f"Found {len(examples)} example scripts")

    print("\nExtracting syntax keywords...")
    syntax_entries = extract_syntax_keywords(SYNTAX_FILE)
    print(f"Extracted {len(syntax_entries)} syntax categories")

    print("\nProcessing general documentation...")
    general_docs = process_general_rst_docs(RST_DIR)
    print(f"Found {len(general_docs)} general documentation files")

    print("\nBuilding chunks...")
    output = []
    chunk_id = 0

    # Process command documentation
    for entry in docs:
        full_text = build_text_from_entry(entry)
        chunks = chunk_text(full_text, MAX_TOKENS)

        for i, ch in enumerate(chunks):
            output.append({
                "id": f"{chunk_id}",
                "type": "command_doc",
                "command": entry.get("command"),
                "chunk_number": i,
                "text": ch
            })
            chunk_id += 1

    # Process example scripts
    for example in examples:
        full_text = build_text_from_example(example)
        chunks = chunk_text(full_text, MAX_TOKENS)

        for i, ch in enumerate(chunks):
            output.append({
                "id": f"{chunk_id}",
                "type": "example_script",
                "name": example['name'],
                "category": example['category'],
                "chunk_number": i,
                "text": ch
            })
            chunk_id += 1

    # Process syntax entries
    for syntax_entry in syntax_entries:
        full_text = build_text_from_syntax(syntax_entry)
        chunks = chunk_text(full_text, MAX_TOKENS)
        
        for i, ch in enumerate(chunks):
            output.append({
                "id": f"{chunk_id}",
                "type": "syntax_reference",
                "category": syntax_entry['category'],
                "chunk_number": i,
                "text": ch
            })
            chunk_id += 1

    # Process general documentation
    for doc in general_docs:
        full_text = build_text_from_general_doc(doc)
        chunks = chunk_text(full_text, MAX_TOKENS)
        
        for i, ch in enumerate(chunks):
            output.append({
                "id": f"{chunk_id}",
                "type": "general_doc",
                "title": doc['title'],
                "category": doc['category'],
                "filename": doc['filename'],
                "chunk_number": i,
                "text": ch
            })
            chunk_id += 1

    doc_count = sum(1 for x in output if x['type'] == 'command_doc')
    example_count = sum(1 for x in output if x['type'] == 'example_script')
    syntax_count = sum(1 for x in output if x['type'] == 'syntax_reference')
    general_count = sum(1 for x in output if x['type'] == 'general_doc')
    
    print(f"Created {len(output)} total chunks:")
    print(f"  - {doc_count} from command docs")
    print(f"  - {example_count} from examples")
    print(f"  - {syntax_count} from syntax")
    print(f"  - {general_count} from general docs")

    print(f"Writing output to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("Done.")


if __name__ == "__main__":
    main()
