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
            "fix_modify": []
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


def cmds_by_group(cmd_list, group_dict):
    for cmd in cmd_list:
        if len(cmd.split()) > 1:
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
