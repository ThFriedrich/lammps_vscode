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
    b1 = contains(str(link.contents[0]), "command")
    b2 = str.endswith(link.get('href'),'.html')
    return b1 and b2   

def contains(string, word):
    return (' ' + word + ' ') in (' ' + string + ' ')

def fix_sub_urls(url):
    return ''.join(url.split('#')[:1])

def scrape_docs(html_path):
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
                        url_c = fix_sub_urls(html_path + '/' + link.get('href'))
                        if url_c not in com_dumped:     # Check duplicate
                            com_dumped.append(url_c)
                            txt_c = BeautifulSoup(open(url_c), "html.parser")
                            # Check all sections in the command documentation page
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
                                    c = ' '.join(link.contents[0].split()[:-1])
                                    print(c)
                                    json.dump({ 'command': c, 
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

html_path = './html'
scrape_docs(html_path)


