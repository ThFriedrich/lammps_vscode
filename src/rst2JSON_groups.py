import json


def init_group_dict():
    return {"compute": [],
            "pair_style": [],
            "bond_style": [],
            "angle_style": [],
            "dihedral_style": [],
            "improper_style": [],
            "dump": [],
            "fix": [],
            "fix_modify": [],
            "general": []
            }


def write_groups_to_json(group_dict):
    with open('./src/lmp_doc_groups.json', 'w', encoding='utf-8') as f:
        for group_key, group in group_dict.items():
            if 'style' in group_key:
                group_identifier = "keyword.style." + group_key + ".lmps"
            else:
                group_identifier = "keyword.command." + group_key + ".lmps"

            json.dump({'name': group_identifier,
                       'match': "\\b(" + regex_group_str(group) + ")(?=[\\t\\s])"},
                      f, ensure_ascii=False, indent=4)
            f.write(",\n")


def regex_group_str(group_list):
    comp_str = ""
    for it in group_list:
        if it:
            comp_str += "|"+it
    return comp_str[1:]


def remove_duplicates_group_dict(group_dict):
    for g in list(group_dict.keys()):
        g_temp = []
        for c in group_dict[g]:
            if c not in g_temp:
                g_temp.append(c)
        group_dict[g] = g_temp
    return group_dict


def cmds_by_group(cmd_list, group_dict):
    for cmd in cmd_list:
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
        else:
            group_dict['general'].append(' '.join(cmd.split()))
    return group_dict


def read_json(json_path):
    with open(json_path, 'r') as json_file:
        data = json.load(json_file)
    return data


def gen_group_obj(group_dict):
    groups = []
    for group_key, group in group_dict.items():
        if 'style' in group_key:
            group_identifier = "keyword.style." + group_key + ".lmps"
        else:
            group_identifier = "keyword.command." + group_key + ".lmps"

        groups.append({'name': group_identifier,
                       'match': "\\b(" + regex_group_str(group) + ")(?=[\\t\\s])"})
    return groups


def update_syntax(syntax_path, groups):
    groups_updated = []
    syn = read_json(syntax_path)
    jn = gen_group_obj(groups)
    jo = syn['repository']['keywords']['patterns']
    for ig, g_o in enumerate(jo):
        for g_n in jn:
            if g_n['name'] == g_o['name']:
                if jo[ig] != g_n:
                    jo[ig] = g_n
                    groups_updated.append(g_n['name'])

    syn['repository']['keywords']['patterns'] = jo

    with open(syntax_path, 'w', encoding='utf-8') as f:
        json.dump(syn, f, ensure_ascii=False, indent=4)

    print('Commands updated in groups: \n' + '\n'.join(groups_updated))
