import json
import numpy as np
import os
import re
import rst2md
import rst2JSON_groups


class CMD:
    '''Class representing the contents of a documentation page for LAMMPS Commands'''
    # Constructor

    def __init__(self, rst_path):
        self.__rst_path__ = rst_path
        self.__rst_txt__ = ""
        self.__sections__ = []
        self.cmd_list = []
        self.valid = False
        self.syntax = ""
        self.parameters = ""
        self.args = []
        self.examples = ""
        self.html_filename = ""
        self.short_description = ""
        self.description = ""
        self.restrictions = ""
        self.related = ""
        self.references = []
        self.__build__()

    # Private Functions

    def __build__(self):
        self.__read_file2sections__()
        self.__validate__()
        if self.valid:
            self.__get_refs__()
            self.__get_syntax_prms__()
            self.__get_args__()
            self.__get_html_link__()
            self.examples = self.__section2md__(self.__sections__[2])
            self.description = self.__section2md__(self.__sections__[3])
            self.__get_short_description__()
            self.restrictions = self.__section2md__(self.__sections__[4])
            if len(self.__sections__) > 5:
                self.related = self.__section2md__(self.__sections__[5])
            else:
                related = "none"

    def __read_file2sections__(self):
        with open(self.__rst_path__, 'r') as f:
            self.__rst_txt__ = f.read()
            self.__sections__ = re.split(
                '(?:Syntax|Examples|Description|Restrictions|Related.*?commands)\n+\"+\n+', self.__rst_txt__)

    def __validate__(self) -> bool:
        txt_block = re.sub(r"(:doc:`)|(`)|(\s+\<.*\>)|(\n\=+)",
                           "", self.__sections__[0])
        self.cmd_list = re.findall(r"(?<=\n)(.*)(?=\s+command)", txt_block)
        b_commands = len(self.cmd_list) > 0
        b_complete = len(self.__sections__) >= 5
        self.valid = b_commands and b_complete

    def __get_html_link__(self):
        rst_path = os.path.basename(self.__rst_path__)
        self.html_filename = rst_path.replace(".rst", ".html")

    def __get_short_description__(self):
        self.short_description = (re.split(r'\.\s+?', self.description, 1)[0])

    def __get_syntax_prms__(self):

        def tweak_prms_block(blocks: str) -> str:
            out = ""
            for b in blocks:
                if b.__contains__("parsed-literal::"):
                    lines = rst2md.tr_plain(b).splitlines()
                    lines = list(filter(None, lines))
                    n_ws = np.zeros(len(lines), int)
                    for ix, l in enumerate(lines):
                        n_ws[ix] = len(l) - len(l.lstrip())
                    ws_min = np.min(n_ws)
                    for ix, l in enumerate(lines):
                        l_str = l[:ws_min].replace(
                            " ", '&#160;') + l[ws_min:] + "   \n"
                        if n_ws[ix] == ws_min:
                            out += "  * " + l_str
                        else:
                            out += "    " + l_str
                else:
                    out += b + "   \n"
            return rst2md.remove_markup(out)

        blocks = self.__section2blocks__(self.__sections__[1])
        self.syntax = rst2md.tr_plain(blocks[0]).strip().replace("*", "")
        prms_block = tweak_prms_block(blocks[1:])
        self.parameters = rst2md.tr_inline_doc(prms_block)

    def __blocks2md_section__(self, blocks: str) -> str:
        out = str()
        for ib in range(0, len(blocks)):
            out += rst2md.tr_blocks(blocks[ib]) + "\n"
        return out

    def __section2blocks__(self, txt: str) -> str:
        blocks = re.split(r"(?:^|\n*)(\.\..*?\:\:[\s\S\r]*?)(?=(?:\n{2,}\s{0,2}\S|\Z))", txt)
        for ib, b in enumerate(blocks):
            if b == "":
                blocks.remove(b)
            else:
                blocks[ib] = re.sub(r"^\n*|\s*$", "", b)
        return blocks

    def __section2md__(self, section_rst: str) -> str:
        blocks = self.__section2blocks__(section_rst)
        section_md = self.__blocks2md_section__(blocks)
        return rst2md.tr_section(section_md, self.references)

    def __get_args__(self):

        def getChoices(arg: str, prms: str) -> list:

            choices: string = []
            a_type = 1
            b_optional: bool = False
            arg_clean = re.sub(r"[\[\]\*\<\>]", "", arg, 8)
            if arg.__contains__("|"):  # Takes care of AtC commands
                choices = arg_clean.split("|")
                a_type = 3
            else:  # All other commands
                for p in prms:
                    b_choices = re.findall(
                        r"\s*"+arg_clean+"\s?\=.*(?<!,)\s(or)\s(?!(more))", p)
                    b_optional = p.__contains__("optional")
                    if b_choices and not b_optional:
                        prm_sub = p[p.find("=")+1:]
                        choices = prm_sub.replace(
                            '0/1', '0 or 1').split(' or ')
                        choices = [x.strip().split(' ')[0]  # Allow only single words and erase whitespaces
                                   for x in choices
                                   if not x.__contains__("=") and not x.__contains__(" ")]
                        a_type = 3
                if len(choices) == 0 and not b_optional:
                    choices.append(arg)
                    a_type = 2
            return a_type, choices

        arg_ar = []
        com_words = self.cmd_list[0].split(' ')
        args = re.split(r"(?<!AtC)\s", self.syntax.splitlines()[0])
        args = [x for x in args if x != "..."]
        prms = re.sub(r"\*", "", self.parameters).splitlines()

        for a in args:
            a_clean = re.sub(r"'[\[\]\*\<\>]", "", a, 8)
            # Append Command-Keyword as plain string
            if com_words.__contains__(a):
                arg_ar.append({"arg": a, "type": 1, "choices": [a]})
            else:  # No command word -> check for choices or Placeholders
                a_type, choices = getChoices(a, prms)
                arg_ar.append({"arg": a, "type": a_type, "choices": choices})
        self.args = arg_ar

    def __get_refs__(self):
        refs = re.findall(
            r"(\:ref\:\`?\(?(.*?)\)?\s*\<(.*?)\>\`?)", self.__rst_txt__)
        for r in refs:
            tag = r[2]
            tag_rst = r[0]
            tag_md = "**"+tag+"**"
            fn = re.search(
                rf"\.\.\s*\_{tag}\:\n+([\s\S\r]*?)(?:\n\n+?|\s*?$|[\s\n]*?\.\.)", self.__rst_txt__)
            if fn:
                fn_rst = fn[0]
                fn_md = fn[1]
                fn_md = re.sub(r"\*\*\(.*?\)\*\*", "**(" + tag + ")**", fn_md) + " \n "
                self.references.append({"tag_rst": tag_rst,
                                        "fn_rst": fn_rst,
                                        "tag_md": tag_md,
                                        "fn_md": fn_md})


rst_path = "rst"
rst_files = [f for f in os.listdir(rst_path) if (f.endswith('.rst'))]
groups = rst2JSON_groups.init_group_dict()
with open('./src/lmp_doc.ts', 'w', encoding='utf-8') as f:
    f.write("export const command_docs = [\n")
    for rst in rst_files:
        Doc = CMD(os.path.join(rst_path, rst))
        groups = rst2JSON_groups.cmds_by_group(Doc.cmd_list, groups)
        if Doc.valid:
            json.dump({'command': Doc.cmd_list,
                       'syntax': Doc.syntax,
                       'args': Doc.args,
                       'parameters': Doc.parameters,
                       'examples': Doc.examples,
                       'html_filename': Doc.html_filename,
                       'short_description': Doc.short_description,
                       'description': Doc.description,
                       'restrictions': Doc.restrictions,
                       'related': Doc.related},
                      f, ensure_ascii=False, indent=4)
            f.write(",\n")
            print("passed: " + rst)
        else:
            print("failed: " + rst)
    f.write("];\n")
    rst2JSON_groups.write_groups_to_json(groups)
