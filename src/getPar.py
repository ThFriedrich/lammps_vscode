import json
import os
from bs4 import BeautifulSoup


def modify_string(string):
    subs = '\n'.join(string.split('\n')[2:])
    return subs.rstrip()

def split_syntax(string):
    syn_sp = string.split('\n')
    syn = syn_sp[2]
    syn_prms = list(filter(None, syn_sp[3:]))
    syn_prms = '\n * '.join(syn_prms)
    if syn_prms:
        syn_prms = ' * ' + syn_prms.rstrip()
    return syn, syn_prms

def split_description(string):
    des_sp = string.split('.')
    return des_sp[0].replace('\n',' ')

def check_link(link):
    '''
    Check if a link leads to a command
    '''
    b1 = contains(str(link.contents[0]), "command")
    b2 = str.endswith(link.get('href'),'.html')
    return b1 and b2   

def contains(string, word):
    '''
    Simple check for a substring in  a string
    '''
    return (' ' + word + ' ') in (' ' + string + ' ')

def find_commands(section):
    cmd_list = list()
    headers = section.find_all("h1")
    for ix in headers:
        ix_c = ix.contents
        for txt in ix_c:
            if str(type(txt)) == "<class 'bs4.element.NavigableString'>":
                word_array = txt.split()
                if word_array[-1] == "command" and len(word_array)>1:
                    cmd_list.append(' '.join(word_array[:-1])) 
                    print(' '.join(word_array[:-1]))
    return cmd_list, not cmd_list

def cmds_by_group(cmd_list, group_dict):
    for cmd in cmd_list:
        if len(cmd.split())>1:
            group = cmd.split()[0]
            if group == 'compute':
                group_dict['compute'].append(''.join(cmd.split()[-1]))
            elif group == 'pair_style':
                group_dict['pair_style'].append(''.join(cmd.split()[-1]))
            elif group == 'bond_style':
                group_dict['bond_style'].append(''.join(cmd.split()[-1]))
            elif group == 'angle_style':
                group_dict['angle_style'].append(''.join(cmd.split()[-1]))
            elif group == 'dihedral_style':
                group_dict['dihedral_style'].append(''.join(cmd.split()[-1]))
            elif group == 'improper_style':
                group_dict['improper_style'].append(''.join(cmd.split()[-1]))
            elif group == 'dump':
                group_dict['dump'].append(''.join(cmd.split()[-1]))
            elif group == 'fix':
                group_dict['fix'].append(''.join(cmd.split()[-1]))
            elif group == 'fix_modify':
                group_dict['fix_modify'].append(''.join(cmd.split()[-1]))
    return group_dict

def regex_group_str(group_list):
    comp_str = ""
    for it in group_list:
        if it:
            comp_str += "|"+it
    return comp_str[1:]

def write_groups_to_json(group_dict):
    with open('./src/lmp_doc_groups.json', 'w', encoding='utf-8') as f:
        for group_key, group in group_dict.items():
            if  'style' in group_key:
                group_identifier = "keyword.style." + group_key + ".lmps"
            else:
                group_identifier = "keyword.command." + group_key + ".lmps"

            json.dump({ 'name': group_identifier, 
                        'match': "\\b(" + regex_group_str(group) + ")(?=[\\t\\s])"}, 
                        f, ensure_ascii=False, indent=4)
            f.write(",\n")

def scrape_docs(html_path):
    group_dict = {"compute": [],
                  "pair_style": [],  
                  "bond_style": [],  
                  "angle_style": [],  
                  "dihedral_style": [],  
                  "improper_style": [],  
                  "dump": [],  
                  "fix": [],  
                  "fix_modify": []  
                  } 
    com_dumped = list() # List to check for duplicate links
    html_files = os.listdir(html_path)
    with open('./src/lmp_doc.ts', 'w', encoding='utf-8') as f:
        f.write("export const command_docs = [\n")
        for fx in html_files:
            url = html_path+'/'+fx
            if str.endswith(url,'.html'):
                txt = BeautifulSoup(open(url), "html.parser")   
                # Find all links on the all-commands-page and check if it directs to a command
                for link in txt.findAll('a'):
                    if check_link(link):
                        url_c = html_path + '/' + link.get('href')
                        if url_c not in com_dumped:     # Check duplicate
                            com_dumped.append(url_c)
                            txt_c = BeautifulSoup(open(url_c), "html.parser")
                            # Check all sections in the command documentation page
                            cmd_list, bool_cmd = find_commands(txt_c)
                            if not bool_cmd:
                                for sec in txt_c.findAll("div", {"class": "section"}):
                                    if sec.attrs['id'] == 'syntax':
                                        syntax, parameters = split_syntax(sec.text)
                                    elif sec.attrs['id'] == 'examples':
                                        examples = modify_string(sec.text)
                                    elif sec.attrs['id'] == 'description':
                                        description = modify_string(sec.text)
                                        short_description = split_description(description)
                                    elif sec.attrs['id'] == 'restrictions':
                                        restrictions = modify_string(sec.text)
                                group_dict = cmds_by_group(cmd_list, group_dict)
                                json.dump({ 'command': cmd_list, 
                                            'html_filename': url_c.split('/')[-1],
                                            'short_description': short_description, 
                                            'description': description, 
                                            'syntax': syntax, 
                                            'parameters': parameters, 
                                            'examples': examples, 
                                            'restrictions': restrictions}, 
                                            f, ensure_ascii=False, indent=4)
                                f.write(",\n")
        f.write("];\n")
    write_groups_to_json(group_dict)

html_path = './html'
scrape_docs(html_path)


