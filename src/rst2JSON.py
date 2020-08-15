import json
import numpy as np
import os
import re
import rst2md
import rst2JSON_groups
from copy import copy


class CMD:
    '''Class representing the contents of a documentation page for LAMMPS Commands'''
    # Constructor

    def __init__(self, rst_path, ix_syntax=0):
        self.__rst_path__ = rst_path
        self.__rst_txt__ = ""
        self.__sections__ = []
        self.__ix_syntax__ = ix_syntax
        self.cmd_list = []
        self.valid = False
        self.syntax = ""
        self.n_syntax = 1
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
                self.related = "none"

    def __read_file2sections__(self):
        with open(self.__rst_path__, 'r') as f:
            self.__rst_txt__ = f.read()
            self.__sections__ = re.split(
                '(?:Syntax|Examples|Description|Restrictions|Related.*?commands|Default)\n+\"+\n+', self.__rst_txt__)

    def __validate__(self) -> bool:
        txt_block = re.sub(r"(`)|(\s+\<.*\>)|(\n\=+)",
                           "", self.__sections__[0])
        self.cmd_list = re.findall(
            r"(?<=\n\n)([\s\S]*?)(?=\s+command\n\n+)", txt_block)
        temp_list = copy(self.cmd_list)
        for ic, c in enumerate(temp_list):
            ref = re.search(r"(\:ref\:\`?\(?(.*?)\)?\s*\<(.*?)\>\`?)", c)
            if ref:
                self.cmd_list.remove(c)
                self.cmd_list.append(ref[2])
            lnk = re.search(r":doc:", c)
            if lnk:
                self.cmd_list.remove(c)

            # :doc:`dump vtk <dump_vtk>` command
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
            out = rst2md.rm_markup(out)
            out = rst2md.tr_inline_math(out)
            out = rst2md.fix_tr_markup_bugs(out)
            return out

        def get_multiple_syntaxes(syn_clean):
            syntaxes = []
            lines = syn_clean.splitlines()
            cmd_word = lines[0].split(" ")[0].strip()
            for l in lines:
                if l.strip().split(" ")[0].strip() == cmd_word:
                        syntaxes.append(l.strip())
            return syntaxes

        blocks = self.__section2blocks__(self.__sections__[1])
        syntax_clean = (rst2md.tr_plain(blocks[0])
                        .replace("*", "").strip())
        syntax_array = get_multiple_syntaxes(syntax_clean)
        self.syntax = syntax_array
        self.n_syntax = len(syntax_array)
        prms_block = tweak_prms_block(blocks[1:])
        self.parameters = rst2md.tr_inline_doc(prms_block)

    def __blocks2md_section__(self, blocks: str) -> str:
        out = str()
        for ib in range(0, len(blocks)):
            out += rst2md.tr_blocks(blocks[ib]) + "\n"
        return out

    def __section2blocks__(self, txt: str) -> str:
        blocks = re.split(
            r"(?:^|\n*)(\.\..*?\:\:[\s\S\r]*?)(?=(?:\n{2,}\s{0,2}\S|\Z))", txt)
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

        def clean_dscp_strings(dscps):
            """Function that takes the parameters and descriptions block of a command
               and outputs an array of argument-description pairs formatted for compatibility
               with other functions in this class. 

            Args:
                dscps (str): self.parameters

            Returns:
                [[str, str]]: array of argument-description pairs
            """
            temp_prms = []
            for dscp in dscps:
                level = (dscp.count('&#160;') // 3) + 1
                dscp_args = (dscp[0:dscp.find("=")]  # match everything before the '='
                             # remove markdown list marker
                             .replace('*', '')
                             # remove non-breaking whitespace characters
                             .replace('&#160;', '')
                             # include optional arguments by stripping the (optional)-Tag
                             .replace('(optional)', '')
                             .strip()                            # erase whitespaces
                             .split(','))                        # For commands of type x,y,z = blabla...

                dscp = (dscp[dscp.find("=")+1:]     # match everything after the '='
                        .replace('(optional)', '')
                        .strip()                            # erase whitespaces
                        .replace("0/1", "0 or 1"))          # make boolean and flag descriptions compatible with choice detection function

                for dscp_arg in dscp_args:
                    temp_prms.append([dscp_arg, dscp, level])

            return temp_prms

        def getChoices(arg: str, dscps: str) -> list:
            """Takes an argument(arg) as input and searches the argument descriptions(dscp) 
               for choice-selections and returns a list containg the type of argument and the 
               arguments choices if there are any. Argument types are:
                    1: argument is part of the command
                    2: argument is a variable
                    3: argument has choices

            Args:
                arg (str): [description]
                dscps (str): [description]

            Returns:
                list: [description]
            """
            choices: string = []
            a_type = 2
            arg_clean = re.sub(r"[\[\]\*\<\>]", "", arg)

            for dscp in dscps:
                # Is it the correct description for the given argument?
                # And: Is it a level 1 argument?
                if dscp[0].strip().split(" ")[0] == arg_clean and dscp[2] == 1:
                    dscp_fil = re.sub(r"(one|zero)\sor\smore(\sof)?\s*","", dscp[1])
                    b_choices = re.search(  # The description contains choices?
                        r".*\s(or)\s", dscp_fil) != None
                    if b_choices:     
                        choices = dscp_fil.split(' or ')
                        choices = [x.strip()  # Allow only single words and erase whitespaces
                                   # Filter out some funky cases
                                   for x in choices
                                   if not x.__contains__("=")
                                   and not x.__contains__(" ")]
                        a_type = 3
                        if len(choices)<=1: # Only one choice doesn't make sense...
                            a_type = 2
                            choices = []
                    else:
                        a_type = 2
            return a_type, choices

        def args_standard_commands(self, args, dscps):
            idx_cmd = 0
            com_words = self.cmd_list[idx_cmd].strip().split(' ')

            arg_ar = []
            for a in args:
                a_clean = re.sub(r"[\[\]\*\<\>]", "", a, 8)
                # Append Command-Keyword as plain string
                if com_words.__contains__(a):
                    arg_ar.append({"arg": a, "type": 1, "choices": []})
                else:  # No command word -> check for choices or Placeholders
                    # Must return list, to expand arg_ar for cases of x,y,z = ...
                    a_type, choices = getChoices(a, dscps)
                    arg_ar.append(
                        {"arg": a, "type": a_type, "choices": choices})
            return arg_ar

        def args_AtC_commands(self, args, dscps):
            arg_ar = []
            choices: string = []

            for a in args:
                a_clean = re.sub(r"[\[\]\*\<\>]", "", a, 8)
                if a.startswith(('<','[')) and a.endswith((']','>')):
                    if a.__contains__("|"):  # Takes care of AtC commands
                        choices = a_clean.split("|")
                        a_type = 3
                    else:
                        a_type, choices = getChoices(a, dscps)
                else:
                    a_type = 1
                    choices = []
                arg_ar.append(
                        {"arg": a, "type": a_type, "choices": choices})
            return arg_ar

        for s in self.syntax:
            args = re.split(r"(?<!AtC)\s", s.strip())
            args = [x for x in args if x != "..."]

            dscps = clean_dscp_strings(self.parameters.splitlines())

            b_AtC = self.syntax[0].__contains__('AtC')

            if b_AtC:
                arg_ar = args_AtC_commands(self, args, dscps)
            else:
                arg_ar = args_standard_commands(self, args, dscps)

            self.args.append(arg_ar)

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
                fn_md = re.sub(r"\*\*\(.*?\)\*\*",
                               "**(" + tag + ")**", fn_md) + " \n "
                self.references.append({"tag_rst": tag_rst,
                                        "fn_rst": fn_rst,
                                        "tag_md": tag_md,
                                        "fn_md": fn_md})


def dbg_print(Doc):
    # from time import sleep
    for ix, s in enumerate(Doc.syntax):
        print(s.strip())
        for x in Doc.args[ix]:
            print(x['arg'] + ' ' + str(x['type']))
            if len(x['choices']) > 0:
                print("\t" + " ".join(x['choices']))
        print('\n------------------\n')
        # sleep(2)


rst_path = "rst"
rst_files = [f for f in os.listdir(rst_path) if (
    f.endswith('.rst'))]
groups = rst2JSON_groups.init_group_dict()
cmd_count = 0
with open('./src/doc_obj.ts', 'w', encoding='utf-8') as f:
    f.write("export const command_docs = [\n")
    for rst in rst_files:
        Doc = CMD(os.path.join(rst_path, rst))
        if Doc.valid:
            # dbg_print(Doc)
            groups = rst2JSON_groups.cmds_by_group(Doc.cmd_list, groups)
            cmd_count += len(Doc.cmd_list)
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
            pass
            # print("failed: " + rst)
    f.write("];\n")
    print('\n' + str(cmd_count) + ' commands processed\n')
    groups = rst2JSON_groups.remove_duplicates_group_dict(groups)
    rst2JSON_groups.update_syntax('./syntaxes/lmps.tmLanguage.json', groups)
