import re
import numpy as np


def tr_section(section_rst: str, DOC) -> str:
    """Catches and translates rst markup into markdown

    Args:
        section_rst (str): rst text, typically a Section
        of the command documentation (e.g. Description or Restrictions, etc)
        DOC (CMD): Instance of the CMD class, essentially the
        Documentation object for one command

    Returns:
        str: Markdown compatible string
    """
    section_md = tr_inline_math(section_rst)
    section_md = tr_inline_doc(section_md)
    section_md = tr_inline_pdf(section_md)
    section_md = tr_table(section_md)
    section_md = tr_table_imgs(section_md)
    section_md = tr_references(section_md, DOC.references)
    section_md = tr_seperated_link(section_md, DOC.__rst_txt__)
    section_md = tr_inline_link(section_md)
    section_md = fix_tr_markup_bugs(section_md)

    return section_md


def tr_blocks(block: str) -> str:
    """Translates a number of rst-directives into Markdown compatible blocks

    Args:
        block (str): directive block to parse

    Returns:
        str: Markdown compatible string
    """
    sp = block.split("\n", 1)
    if len(sp) > 1:
        line1, rest = sp
    else:
        line1 = block
        rest = block
    if re.search("code-block\s*?::",line1.lower()):
        md = tr_code(line1, rest)
    elif re.search("math\s*?::",line1.lower()):
        md = tr_math(rest)
    elif re.search("parsed-literal\s*?::",line1.lower()):
        md = tr_code("", rest)
    elif re.search("note\s*?::",line1.lower()):
        md = tr_note(rest)
    elif re.search("warning\s*?::",line1.lower()):
        md = tr_warning(rest)
    elif re.search("seealso\s*?::",line1.lower()):
        md = tr_warning(rest)
    elif re.search("^.. (image|figure)\s*?::",line1.lower()):  # single image
        md = tr_image(line1)
    elif re.search("include\s*?::",line1.lower()):
        md = tr_include(line1)
    elif re.search("table_from_list\s*?::",line1.lower()):
        md = tr_table_from_list(line1, rest)
    elif re.search("list-table\s*?::",line1.lower()):
        md = tr_list_table(line1, rest)
    elif re.search("raw\s*?::",line1.lower()):
        md = ""
    elif re.search("only\s*?::\s*html",line1.lower()):
        md = tr_blocks(re.sub(r"^\n*|\s*$", "", rest).strip())+'\n'
    elif re.search("tabs\s*?::",line1.lower()):
        tabs = rest.split('.. tab::')
        md = '\n'
        for t in tabs:
            md += tr_tab(t)
    elif re.search("admonition\s*?::",line1.lower()):
        md = tr_admonition(line1, rest)
    elif re.search("(versionadded|versionchanged)\s*?::",line1.lower()):
        md = tr_version_tag(line1) + rest if rest != line1 else ""
    elif re.search("(deprecated)\s*?::",line1.lower()):
        md = tr_deprecated_tag(line1)
    elif line1.__contains__("::"):
        md = block
    else:
        md = tr_plain(block)
    return md

def tr_tab(tabs):
    tab_sec = tabs.split('\n\n',1)
    if len(tab_sec) > 1:
        body = tr_blocks(re.sub(r"^\n*|\s*$", "", tab_sec[1]))+'\n'
        return '**' + tab_sec[0].strip() + '** \n' + body
    else:
        return ''

def tr_admonition(line, rest):
    note_tag = line.split("::")[-1]
    body = re.sub('\s*:class:\s*note','',rest)
    note = tr_note(body, note_tag)
    return note

def tr_version_tag(line):
    v_tag = line.split()[-1]
    return '\n **New in version ' + v_tag + '** \n'

def tr_deprecated_tag(line):
    v_tag = line.split()[-1]
    return '\n **Deprecated in version ' + v_tag + '** \n'


def tr_inline_math(txt: str) -> str:
    inleq = re.findall(r"(\:math\:\`?)([\s\S\r]*?)(\`)", txt, 8)
    for eq in inleq:
        txt = txt.replace(
            "".join(eq), "\(" + eq[1].replace("\\AA", "\\mathring{\\textrm{A}}") + "\)"
        )
    return txt


def tr_references(section: str, references: dict) -> str:
    for r in references:
        b_tag = section.find(r["tag_rst"]) != -1
        b_fn = section.find(r["fn_rst"]) != -1 and section.find(r["fn_md"]) != -1
        if b_tag:
            section = section.replace(r["tag_rst"], r["tag_md"].replace("\n", " "))
            if b_fn:
                section = section.replace(r["fn_rst"], r["fn_md"])
            else:
                section = section + "\n" + r["fn_md"]
    return section


def tr_table(txt: str) -> str:
    tables = re.findall(
        r"((?:\n\n\+(?:\-+\+)+\n)([\s\S\r]*?)(?:\n\+(?:\-+\+)+\n)\n)", txt
    )
    for t in tables:
        md_tab = re.split(r"\n\+(?:\-+\+)+", t[1])
        cols = md_tab[0].count("|") - 1
        md_tab[0] = "\n" + md_tab[0]
        md_tab.insert(0, "\n" + "| " * cols + "|")  # avoids highlighting first row
        md_tab.insert(1, "\n" + "|---" * cols + "|")
        txt = txt.replace(t[0], "\n" + "".join(md_tab) + "\n\n")

    return txt


def tr_table_imgs(txt: str) -> str:
    img_tab = re.findall(
        r"\.\.\s\|\S+\|\s+image::[\s\S\r]*?(?=(?:\n{2,}\s{0,2}\S|\Z))", txt
    )

    for it in img_tab:
        label_img = re.findall(r"\.\.\s(\|\S+\|)\s+image::([\s\S\r]*?)\n", it)
        n_cols = len(label_img)
        md_tab = (
            " \n  " + "| " * n_cols + "|" + " \n  " + "|---" * n_cols + "|  \n  | "
        )  # avoids highlighting first row
        for li in label_img:
            md_tab += "![Image](" + li[1].strip() + ") | "
        md_tab += " \n"
        txt = txt.replace(it, md_tab)

    return txt


def tr_table_from_list(txt: str, tab: str) -> str:
    n_cols = int(re.search(r"(?!::columns:\s*)([0-9]+)", tab)[0])
    items = re.findall(r"(?<=\*\s)(.*)(?=\n)", tab)
    n_lines = int(np.ceil(len(items) / n_cols))
    md_tab = (
        "\n  " + "| " * n_cols + "|" + " \n  " + "|---" * n_cols + "|"
    )  # avoids highlighting first row
    for i_l in range(n_lines):
        md_tab += "\n  " + " | ".join(items[i_l * n_cols : ((i_l + 1) * n_cols)]) + "|"

    return md_tab + "\n  "


def tr_list_table(txt: str, tab: str) -> str:
    rows = re.findall(r"(?<=\*\s)([\s\S\r]*?)(?=\n\s*?\*)", tab)
    col = list()
    n_cols = 0
    for ir, r in enumerate(rows):
        c = re.split(r"\n\s*?\-\s*?", r)
        for it_x, it in enumerate(c):
            c[it_x] = re.sub(r"^\s*\-*\s*", "", it)
        col.append(c)
        n_cols = np.max((n_cols, len(c)))

    md_tab = (
        "\n  " + "| " * n_cols + "|" + " \n  " + "|---" * n_cols + "|"
    )  # avoids highlighting first row
    for i_r in range(len(rows)):
        md_tab += "\n  " + " | ".join(col[i_r][:]) + "|"

    return md_tab + "\n  "


def tr_inline_doc(txt: str) -> str:
    doc_lnk = re.findall(r"(\:doc\:\`?([\s\S\r]*?)\<([\s\S\r]*?)\>\`?)", txt, 8)
    for d in doc_lnk:
        txt = txt.replace(
            d[0],
            "["
            + d[1].replace("\n", "")
            + "](https://docs.lammps.org/"
            + d[2].replace("\n", "")
            + ".html)",
        )
    return txt


def tr_inline_link(txt: str) -> str:
    # `FFmpeg documentation <http://ffmpeg.org/ffmpeg.html>`_.
    # `https://openkim.org/browse/models/by-type <https://openkim.org/browse/models/by-type>`_
    lnk = re.findall(r"(\`(.*?)\s+\<(.*?)\>\`\_)", txt, 8)
    for d in lnk:
        txt = txt.replace(
            d[0], "[" + d[1].replace("\n", "") + "](" + d[2].replace("\n", "") + ")"
        )
    return txt


def tr_seperated_link(txt: str, rst_txt: str) -> str:
    # `PPM (aka NETPBM) format <ppm_format_>`_
    tags = re.findall(r"(\`(.*?)\<([\S\r]*?)\_\>\`\_)", txt, 8)

    # \n.. _ppm_format: https://en.wikipedia.org/wiki/Netpbm\n\n
    lnk = re.findall(r"(\n\.\. \_(.*?): *(.*)\n?)", rst_txt, 8)
    for l in lnk:
        for t in tags:
            if t[2] == l[1]:
                md_link = "[" + t[1] + "](" + l[2] + ")"
                txt = txt.replace(t[0], md_link)
                txt = txt.replace(l[0], "")
    return txt


def tr_inline_pdf(txt: str) -> str:
    # `this PDF guide <PDF/SMD_LAMMPS_userguide.pdf>`_
    doc_lnk = re.findall(r"(`([\s\S\r]*?)\<([\s\S\r]*?)(\.pdf)\>\`_)", txt, 8)
    for d in doc_lnk:
        txt = txt.replace(
            d[0],
            "["
            + d[1].replace("\n", "")
            + "](https://docs.lammps.org/"
            + d[2].replace("\n", "")
            + ".pdf)",
        )
    return txt


def tr_code(code_id: str, code_block: str) -> str:
    lang = re.findall(r"(?<=\:\:)\s*(\w*$)", code_id)
    if not lang:
        lang = [""]
    elif lang.__contains__("LAMMPS"):
        lang = ["lmps"]
    code_block_fmt = ""
    code_block_spl = code_block.strip("\n").splitlines()
    for l in code_block_spl:
        code_block_fmt += l.strip() + "\n"
    return "\n```" + lang[0] + "\n" + code_block_fmt + "```"


def tr_math(math_block: str) -> str:
    if math_block.__contains__("&") and not math_block.__contains__("begin{align"):
        return "\[\\begin{align*} " + math_block + " \\end{align*} \]"
    else:
        return "\[" + math_block + "\]"


def tr_note(note_block: str, title:str='') -> str:
    icon = ">   ### ![Note](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CgogPGc+CiAgPHRpdGxlPmJhY2tncm91bmQ8L3RpdGxlPgogIDxyZWN0IGZpbGw9Im5vbmUiIGlkPSJjYW52YXNfYmFja2dyb3VuZCIgaGVpZ2h0PSIyNiIgd2lkdGg9IjI2IiB5PSItMSIgeD0iLTEiLz4KIDwvZz4KIDxnPgogIDx0aXRsZT5MYXllciAxPC90aXRsZT4KICA8ZyBpZD0ic3ZnXzEiPgogICA8cGF0aCBmaWxsPSIjNTZhYWZmIiBpZD0ic3ZnXzIiIGQ9Im0xMi4wMDAwMDEsNC4xOTQ0MDVjNS40NjgxODQsMCA5LjkwMjg3Nyw0LjQzNDY5OCA5LjkwMjg3Nyw5LjkwMjg4YzAsNS40NjgxOCAtNC40MzQ2OTIsOS45MDI3MTYgLTkuOTAyODc3LDkuOTAyNzE2Yy01LjQ2ODM0MywwLjAwMDE2NCAtOS45MDI4OCwtNC40MzQ1MzYgLTkuOTAyODgsLTkuOTAyNzE2YzAsLTUuNDY4MTgyIDQuNDM0NTM2LC05LjkwMjg4IDkuOTAyODgsLTkuOTAyODhsMCwwem0yLjg5ODAxLDE1LjgzMDI2MWwtNS43OTYwMjEsMGwwLC0wLjk3NTYxNmwxLjA4OTA5MiwwbDAsLTUuOTU3MjAzbC0xLjA4OTA5MiwwbDAsLTAuNzc2MjQybDIuNzA5MTA5LDBjMC42ODQyMDcsMCAxLjM1NzQ1NSwtMC4wODIyMDIgMi4wMjI2NDQsLTAuMjQ5OTkxbDAsNi45ODM1OTNsMS4wNjQ0MjgsMGwwLDAuOTc1NDZsLTAuMDAwMTYsMHptLTIuNTA4MTE3LC0xMi40MzI5MTdjMC40NDg4ODUsMCAwLjgwMTg2OSwwLjEyOTc1IDEuMDU5MTEzLDAuMzg2MTg4YzAuMjU0NTAzLDAuMjU2Mjc1IDAuMzgzMTIzLDAuNjA3ODA4IDAuMzgzMTIzLDEuMDYwNzIyYzAsMC40NTkwNDEgLTAuMjE4ODgyLDAuODY3MzA5IC0wLjY1OTcwOCwxLjIyNTEyN2MtMC40NDM0MDYsMC4zNTc4MiAtMC45NTc1NjgsMC41MzgwMTcgLTEuNTQzNjE4LDAuNTM4MDE3Yy0wLjQ0MDUwNCwwIC0wLjc5MDU4NiwtMC4xMjMzMDIgLTEuMDU4Nzg5LC0wLjM3MDIzYy0wLjI2ODM2NCwtMC4yNDk5OSAtMC40MDI0NjUsLTAuNTczMTU0IC0wLjQwMjQ2NSwtMC45NzUxMzdjMCwtMC41MDY1ODggMC4yMTg4ODIsLTAuOTQzMzg0IDAuNjU0MjI3LC0xLjMxMzkzNmMwLjQzNTE4NiwtMC4zNjY4NDUgMC45NTc3MjksLTAuNTUwNzUyIDEuNTY4MTE3LC0wLjU1MDc1MmwwLDB6IiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgogIDwvZz4KIDwvZz4KPC9zdmc+) "
    return (
        "\n"
        + icon
        + " Note: " + title
        + "  \n   >"
        + tr_blocks(note_block.lstrip().replace("\n", "\n  >"))
        + "  \n   > "
        + "\n"
    )


def tr_seealso(seealso_block: str) -> str:
    icon = ">   ### ![seealso](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CgogPGc+CiAgPHRpdGxlPmJhY2tncm91bmQ8L3RpdGxlPgogIDxyZWN0IGZpbGw9Im5vbmUiIGlkPSJjYW52YXNfYmFja2dyb3VuZCIgaGVpZ2h0PSIyNiIgd2lkdGg9IjI2IiB5PSItMSIgeD0iLTEiLz4KIDwvZz4KIDxnPgogIDx0aXRsZT5MYXllciAxPC90aXRsZT4KICA8ZyBpZD0ic3ZnXzEiPgogICA8cGF0aCBmaWxsPSIjMDA1ZmJmIiBpZD0ic3ZnXzIiIGQ9Im0yLjkxMzU0LDE5LjUxNDQyNWwwLjA1NzcyMSwtMTAuMjI1OTkybC0xLjE1NDQyNywwbDAsMTMuMDExNTEzYzEuNTg2NDA3LC0wLjQwOTYzNiAzLjE3ODM5OSwtMC42NzAzMTMgNC43ODE1NjMsLTAuNjgxNDg0YzEuNDgwMjczLC0wLjAwOTMxMiAyLjk2MDU0NywwLjE5NzM2OSA0LjQ0NDU0NiwwLjcwMDEwNGMtMC45MjE2OCwtMC43NDY2NTUgLTEuOTQ5NDkzLC0xLjI5NTkzOCAtMy4wNDYxOTksLTEuNjUzNDM3Yy0xLjM4MTU4OSwtMC40NTA2IC0yLjg3NDg5NywtMC41OTk1NTggLTQuNDA1NDQ0LC0wLjQ2OTIyMWMtMC4zNDYzMjgsMC4wMjc5MzEgLTAuNjQ3OTY5LC0wLjIyOTAyMyAtMC42Nzc3NiwtMC41NzM0ODhjLTAuMDAzNzI0LC0wLjAzNzIzOSAtMC4wMDM3MjQsLTAuMDcyNjE3IDAsLTAuMTA3OTk0bDAsMHptMTYuOTQwMjkxLC0xMC43NjAzOGMtMC4wMDM3MjMsLTAuMDI5NzkxIC0wLjAwNzQ0OCwtMC4wNjE0NDUgLTAuMDA3NDQ4LC0wLjA5NDk2MWMwLC0wLjAzMTY1MiAwLjAwMTg2MiwtMC4wNjMzMDcgMC4wMDc0NDgsLTAuMDk0OTYxbDAsLTIuMDcwNTJjLTEuNDUyMzQ1LC0wLjEzNzc4NiAtMi45NDkzNzUsMC4wMjIzNDQgLTQuMjU2NDg2LDAuNTE3NjNjLTEuMjIxNDU4LDAuNDYzNjMzIC0yLjI3NTMzOSwxLjIyNTE4MyAtMi45NjA1NDcsMi4zMTYzMDNsMCwxMS43OTM3NzdjMS4wNjUwNTIsLTAuNzExMjc1IDIuMTU0MzEsLTEuMjk1OTM3IDMuMjczMzYsLTEuNjk0NDAxYzEuMjc1NDU2LC0wLjQ1NDMyMyAyLjU4NjI4OSwtMC42NzAzMTMgMy45NDM2NzMsLTAuNTYyMzE5bDAsLTEwLjExMDU0OGwwLDB6bTEuMjU2ODM2LC0wLjcyMjQ0OGwxLjcwMTg0OSwwYzAuMzQ2MzI5LDAgMC42Mjc0ODcsMC4yODExNiAwLjYyNzQ4NywwLjYyNzQ4N2wwLDE0LjQ2MDEzM2MwLDAuMzQ2MzI5IC0wLjI4MTE1OCwwLjYyNzQ4OSAtMC42Mjc0ODcsMC42Mjc0ODljLTAuMDcwNzU1LDAgLTAuMTM5NjQ4LC0wLjAxMTE3MyAtMC4yMDI5NTUsLTAuMDMzNTE2Yy0xLjc1MDI2MSwtMC41MDA4NzQgLTMuNDg5MzUxLC0wLjgzNDE2NyAtNS4yMTE2ODEsLTAuODQ1MzM5Yy0xLjY3OTUwNSwtMC4wMTExNzMgLTMuMzU3MTQ5LDAuMjg0ODgyIC01LjA0MjI0LDEuMDI3ODExYy0wLjEwNDI3MSwwLjA2ODg5MyAtMC4yMjkwMjQsMC4xMDYxMzMgLTAuMzU3NSwwLjEwNDI3MWMtMC4xMjY2MTUsMC4wMDE4NjIgLTAuMjUxMzY4LC0wLjAzNTM3OCAtMC4zNTc1LC0wLjEwNDI3MWMtMS42ODMyMywtMC43NDQ3OTEgLTMuMzYyNzM1LC0xLjAzODk4NCAtNS4wNDIyNDEsLTEuMDI3ODExYy0xLjcyMjMzMSwwLjAxMTE3MSAtMy40NTk1NTgsMC4zNDQ0NjUgLTUuMjExNjgxLDAuODQ1MzM5Yy0wLjA2MzMwNywwLjAyMjM0MyAtMC4xMzIyMDEsMC4wMzM1MTYgLTAuMjAyOTU2LDAuMDMzNTE2Yy0wLjM0MjYwNSwwLjAwMTg2IC0wLjYyMzc2NCwtMC4yNzkyOTkgLTAuNjIzNzY0LC0wLjYyNTYyOGwwLC0xNC40NjE5OTRjMCwtMC4zNDYzMjggMC4yODExNTksLTAuNjI3NDg3IDAuNjI3NDg3LC0wLjYyNzQ4N2wxLjc4OTM2MiwwbDAuMDExMTcyLC0yLjA5NjU4OWMwLjAwMTg2MiwtMC4zMDE2NDEgMC4yMTQxMjgsLTAuNTUxMTQ2IDAuNDk5MDExLC0wLjYxMDcyOWwwLDBjMS42NTE1NzUsLTAuMzQ0NDY2IDMuNjU4Nzg5LC0wLjI1ODgxNSA1LjQxODM2LDAuNDE1MjIyYzEuMjE1ODczLDAuNDY1NDk1IDIuMzIwMDI2LDEuMjA4NDI1IDMuMTI2MjY0LDIuMjgwOTI1YzAuODEzNjg1LC0wLjk5OTg4MyAxLjkwMTA4MSwtMS43MTg2MDcgMy4xMjQ0MDEsLTIuMTgyMjRjMS42NzIwNTksLTAuNjM0OTM1IDMuNjAxMDY5LC0wLjc4NzYxNyA1LjQxNjQ5OSwtMC41MjEzNTRjMC4zMTI4MTMsMC4wNDQ2ODcgMC41MzYyNDksMC4zMTQ2NzQgMC41MzYyNDksMC42MjAwMzlsMCwwbDAsMi4wOTQ3MjdsMC4wMDE4NjMsMHptLTcuODY1MDAzLDE0LjE5MjAwN2MxLjM4NzE3NCwtMC40MzU3MDEgMi43NzI0ODksLTAuNjE0NDU0IDQuMTU3OCwtMC42MDcwMDZjMS42MDMxNjUsMC4wMDkzMTIgMy4xOTUxNTYsMC4yNzE4NTEgNC43ODE1NjUsMC42ODE0ODZsMCwtMTMuMDA5NjUxbC0xLjA3NDM2NCwwbDAsMTAuMjgxODUxYzAsMC4zNDYzMjkgLTAuMjgxMTU4LDAuNjI3NDg3IC0wLjYyNzQ4NSwwLjYyNzQ4N2MtMC4wNTAyNzYsMCAtMC4wOTg2ODYsLTAuMDA1NTg1IC0wLjE0NTIzNSwtMC4wMTY3NThjLTEuMzc0MTQyLC0wLjIxNTk4OCAtMi43MDU0NTgsLTAuMDM3MjM5IC00LjAwNTExOSwwLjQyNjM5NGMtMS4wNDY0MzIsMC4zNzQyNTggLTIuMDc0MjQ0LDAuOTMyODUyIC0zLjA4NzE2MSwxLjYxNjE5OGwwLDB6bS0xLjg2Mzg0MSwtMS4yMjMzMmwwLC0xMS42OTEzNjhjLTAuNjU3Mjc5LC0xLjE2MDAxMyAtMS43MjA0NjksLTEuOTM2NDU5IC0yLjkyMTQ0NiwtMi4zOTYzNjhjLTEuMzYxMTA3LC0wLjUyMTM1NCAtMi44ODk3OTIsLTAuNjM4NjU5IC00LjIyMjk3LC0wLjQ0ODczN2wtMC4wNzA3NTUsMTIuNDM5ODg1YzEuNDU0MjA2LC0wLjA1MjEzNSAyLjg3Njc1OSwwLjEzMjIgNC4yMTU1MjEsMC41Njk3NjVjMS4wNjUwNTMsMC4zNDYzMjkgMi4wNzQyNDYsMC44NTQ2NDkgMi45OTk2NSwxLjUyNjgyM2wwLDB6Ii8+CiAgPC9nPgogPC9nPgo8L3N2Zz4=)"
    return (
        "\n"
        + icon
        + " See also:"
        + "  \n   >"
        + seealso_block.lstrip().replace("\n", "\n  >")
        + "  \n   > "
        + "\n"
    )


def tr_warning(warn_block: str) -> str:
    icon = ">   ### ![Warning](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CgogPGc+CiAgPHRpdGxlPmJhY2tncm91bmQ8L3RpdGxlPgogIDxyZWN0IGZpbGw9Im5vbmUiIGlkPSJjYW52YXNfYmFja2dyb3VuZCIgaGVpZ2h0PSIyNiIgd2lkdGg9IjI2IiB5PSItMSIgeD0iLTEiLz4KIDwvZz4KIDxnPgogIDx0aXRsZT5MYXllciAxPC90aXRsZT4KICA8ZyBpZD0ic3ZnXzEiPgogICA8cGF0aCBmaWxsPSIjZmY3ZjAwIiBpZD0ic3ZnXzIiIGQ9Im0xMi43NTkzODQsNS45NDYyNDFsMTAuNTI3NDkzLDE2LjUzNTgyYzAuMzE2ODA3LDAuNDk4MDI0IDAuNTkwMjQ0LDEuNTE3OTM5IDAsMS41MTc5MzlsLTIyLjU3MzQ5NiwwYy0wLjU5MDQzNywwIC0wLjMxNzM3NCwtMS4wMTk5MTUgMCwtMS41MTc5MzlsMTAuNTI3NDk0LC0xNi41MzU4MmMwLjMxNzE4NCwtMC40OTgwMjcgMS4yMDExMzQsLTAuNDk3NjQ5IDEuNTE4NTA5LDBsMCwwem0tMS42ODAwMzcsMTMuNjY3MTQ3bDEuODMzNDIyLDBsMCwxLjYyMTE0M2wtMS44MzM0MjIsMGwwLC0xLjYyMTE0M2wwLDB6bTEuODMyMjg1LC0xLjEyMjczOGwtMS44MzE5MDUsMGMtMC4xODI1NDcsLTIuMjI2MTYyIC0wLjU2NDY4NCwtMy42Mzg4MTYgLTAuNTY0Njg0LC01Ljg2MTc1N2MwLC0wLjgyMDEzNiAwLjY2NDY2NywtMS40ODQ5OTIgMS40ODQ4MDIsLTEuNDg0OTkyYzAuODIwMzI2LDAgMS40ODQ5OTEsMC42NjQ4NTYgMS40ODQ5OTEsMS40ODQ5OTJjMC4wMDAxODksMi4yMjE5OTMgLTAuMzg3MjQ5LDMuNjM3NDg3IC0wLjU3MzIwNCw1Ljg2MTc1N2wwLDB6IiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgogIDwvZz4KIDwvZz4KPC9zdmc+)"
    return (
        "\n"
        + icon
        + " Warning:"
        + "  \n   >"
        + warn_block.lstrip().replace("\n", "\n  >")
        + "  \n   > "
        + "\n"
    )


def tr_plain(plain_block: str) -> str:
    return re.sub(r"\n*\s*\.\..*?\:\:[\s\S]*?[$\n]", "", plain_block, 8)


def tr_image(txt: str) -> str:
    link = re.findall(r"(?<=\:\:)\s*(\S*$)", txt)
    return "\n ![Image](" + link[0] + ") \n"


def tr_include(txt: str) -> str:
    file = re.findall(r"(?<=\:\:)\s*(\S*$)", txt)[0]
    with open("rst/" + file, "r") as f:
        incl_txt = f.read()
    incl_txt = tr_blocks(incl_txt)
    return "\n " + incl_txt + "\n"


def rm_markup(txt: str) -> str:
    # Remove enclosing markup for bold, italic
    mrk = re.findall(r"\s([\*\_]+)(\S+?)([\*\_]+)\s", txt, 8)
    for m in mrk:
        txt = txt.replace("".join(m), m[1])

    # Remove escaped whitespaces
    txt = txt.replace("\ ", " ")

    return txt


def fix_tr_markup_bugs(txt: str) -> str:
    # Fixes particular patterns like '\n1. \n', e.g number at end of sentence, falsly initiating a numbered list
    mrk = re.findall(r"(\d\n\d\.\s)", txt, 8)
    for m in mrk:
        txt = txt.replace(m, m.replace("\n", " "))

    # Removes trailing Backslashes from marked up text like *gpu*\ -> *gpu*
    mrk = re.findall(r"(((?:\*\*?)(?:\S*?)(?:\*\*?))(?:\\))", txt, 8)
    for m in mrk:
        txt = txt.replace(m[0], m[1])

    # Underlining usin """"""  not supported in all md-flavours
    mrk = re.findall(r"(\n(.*?)\n\"{3,}\n)", txt, 8)
    for m in mrk:
        txt = txt.replace(m[0], "\n #### " + m[1] + "\n")

    # Remove leftover ====== markup from merged sections
    mrk = re.findall(r"(\n(.*?)\n\={3,}.*?\n)", txt, 8)
    for m in mrk:
        txt = txt.replace(m[0], "\n #### " + m[1] + "\n")

    return txt
