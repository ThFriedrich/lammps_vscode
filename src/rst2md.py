import re


def tr_section(section_rst: str, references: dict) -> str:
    section_md = tr_inline_math(section_rst)
    section_md = tr_inline_doc(section_md)
    section_md = tr_inline_pdf(section_md)
    section_md = tr_table(section_md)
    section_md = tr_references(section_md, references)
    section_md = fix_tr_markup_bugs(section_md)

    return section_md


def tr_inline_math(txt: str) -> str:
    inleq = re.findall(r"(\:math\:\`?)([\s\S\r]*?)(\`)", txt, 8)
    for eq in inleq:
        txt = txt.replace("".join(eq), "\("+eq[1]+"\)")
    return txt


def tr_references(section: str, references: dict) -> str:
    for r in references:
        b_tag = section.find(r['tag_rst']) != -1
        b_fn = section.find(r['fn_rst']) != -1 \
            and section.find(r['fn_md']) != -1
        if b_tag:
            section = section.replace(
                r['tag_rst'], r['tag_md'].replace("\n", " "))
            if b_fn:
                section = section.replace(r['fn_rst'], r['fn_md'])
            else:
                section = section + "\n" + r['fn_md']
    return section


def tr_table(txt: str) -> str:
    tables = re.findall(
        r"((?:\n\n\+(?:\-+\+)+\n)([\s\S\r]*?)(?:\n\+(?:\-+\+)+\n)\n)", txt)
    for t in tables:
        md_tab = re.split(r"\n\+(?:\-+\+)+", t[1])
        cols = md_tab[0].count("|") - 1
        md_tab[0] = "\n  " + md_tab[0]
        md_tab.insert(0, "\n  "+"| "*cols+"|")  # avoids highlighting first row
        md_tab.insert(1, "\n  "+"|---"*cols+"|")
        txt = txt.replace(t[0], "\n" + "".join(md_tab) + "\n\n")

    return txt


def tr_inline_doc(txt: str) -> str:
    doc_lnk = re.findall(
        r"(\:doc\:\`?([\s\S\r]*?)\<([\s\S\r]*?)\>\`?)", txt, 8)
    for d in doc_lnk:
        txt = txt.replace(
            d[0], "[" + d[1].replace("\n", "") + "](https://lammps.sandia.gov/doc/" + d[2].replace("\n", "") + ".html)")
    return txt

def tr_inline_pdf(txt: str) -> str:
    # `this PDF guide <PDF/SMD_LAMMPS_userguide.pdf>`_
    doc_lnk = re.findall(
        r"(`([\s\S\r]*?)\<([\s\S\r]*?)(\.pdf)\>\`_)", txt, 8)
    for d in doc_lnk:
        txt = txt.replace(
            d[0], "[" + d[1].replace("\n", "") + "](https://lammps.sandia.gov/doc/" + d[2].replace("\n", "") + ".pdf)")
    return txt


def rm_markup(txt: str) -> str:
    mrk = re.findall(r"\s([\*\_]+)(\S+?)([\*\_]+)\s", txt, 8)
    for m in mrk:
        txt = txt.replace("".join(m), m[1])

    return txt


def fix_tr_markup_bugs(txt: str) -> str:
    # Fixes particular patterns like '\n1. \n', e.g number at end of sentence, falsly initiating a numbered list
    mrk = re.findall(r"(\n\s*?)([0-9]\.\s)", txt, 8)
    for m in mrk:
        txt = txt.replace("".join(m), " " + m[1])

    # Removes trailing Backslashes from marked up text like *gpu*\ -> *gpu* 
    mrk = re.findall(r"(((?:\*\*?)(?:\S*?)(?:\*\*?))(?:\\))", txt, 8)
    for m in mrk:
        txt = txt.replace(m[0],m[1])

    return txt


def tr_code(code_id: str, code_block: str) -> str:
    lang = re.findall(r"(?<=\:\:)\s*(\w*$)", code_id)
    if not lang:
        lang = [""]
    elif lang.__contains__("LAMMPS"):
        lang = ["lmps"]
    code_block_fmt = ""
    code_block_spl = code_block.lstrip("\n").splitlines()
    for l in code_block_spl:
        code_block_fmt += l.strip() + '\n'
    return "\n```"+lang[0]+"\n" + code_block_fmt + "\n```\n"


def tr_math(math_block: str) -> str:
    if math_block.__contains__("&") and not math_block.__contains__("begin{align"):
        return "\[\\begin{align*} " + math_block + " \\end{align*} \]"
    else:
        return "\[" + math_block + "\]"


def tr_note(note_block: str) -> str:
    return "\n  > **_Note:_**" + "  \n  " + note_block.lstrip().replace("\n", "\n  >")


def tr_plain(plain_block: str) -> str:
    return re.sub(r"\n*\s*\.\..*?\:\:[\s\S]*?[$\n]", "", plain_block, 8)


def tr_image(txt: str) -> str:
    link = re.findall(r"(?<=\:\:)\s*(\S*$)", txt)
    return "\n ![Image]("+link[0]+") \n"


def tr_blocks(block: str) -> str:
    sp = block.split("\n", 1)
    if len(sp) > 1:
        line1, rest = sp
    else:
        line1 = sp
        rest = sp
    if line1.__contains__("code-block::"):
        md = tr_code(line1, rest)
    elif line1.__contains__("math::"):
        md = tr_math(rest)
    elif line1.__contains__("parsed-literal::"):
        md = tr_code("", rest)
    elif line1.__contains__("note::"):
        md = tr_note(rest)
    elif line1.__contains__("image::"):
        md = tr_image(line1)
    else:
        md = tr_plain(block)
    return md
