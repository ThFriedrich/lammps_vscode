import { WorkspaceConfiguration, CompletionItem, CompletionList, MarkdownString, SnippetString, CompletionItemKind } from 'vscode';
import { command_docs } from "./lmp_doc";

export type commandDoc = {
    command: string[];
    html_filename: string;
    short_description: string;
    description: string;
    syntax: string;
    parameters: string;
    examples: string;
    restrictions: string;
}

/** Returns the entire documentation entry for a given command.*/
export function getCommand(find_command: string):commandDoc|undefined {
    return command_docs.find(e => e.command.includes(find_command));
}

/** Returns all commands that include a given substring or RegExp */
export function searchCommands(searchString: string | RegExp):string[] {
    const return_array: string[] = []
    command_docs.forEach(element => {
        element.command.forEach(com => {
            if (!(com.search(searchString) == -1)) {
                return_array?.push(com)
            }
        })
    })
    return return_array
}

/** Searches the Syntax of a given command for a particular argument or RegExp
 * and returns the position index of that argument according to the syntax. 
 * Example:    
 * Suppose you want to locate the 'file' argument in the 'bond_write' command
 * with syntax ´bond_write btype N inner outer file keyword itype jtype´  
 * getArgDoc('bond_write',RegExp('\\b(file)\\b')) would return 5  
 * */
export function getArgIndex(command: string, argument: RegExp | string):number {
    const com = getCommand(command)
    let idx: number = -1
    if (com) {
        const args = com.syntax.split(RegExp('\\s'))
        for (let index = 0; index < args.length; index++) {
            const find_idx = args[index].search(argument)
            if (find_idx != -1) {
                idx = index
                break
            }
        }
    }
    return idx
}

/** Function matches keywords(from the syntax) against parameter 
 * descriptions and checks for patterns like 'style = fcc or bcc or ...' to
 * generate a list of options for that particular keyword. 
*/
function getChoices(arg: string, prms: string[]):string[] {

    function filterChoices(choice: string):boolean {
        return !choice.includes('=')
    }

    // Allow only single words and erase whitespaces
    function trimChoices(choice: string):string {
        return choice.trim().split(' ')[0]
    }

    let choices: string[] = []
    let b_optional: boolean = false
    if (arg.includes('|')) { //Takes care of AtC commands
        choices = arg.split('|')
    } else { // All other commands
        prms.forEach(p => {
            const b_choices = p.search(RegExp(`\\s*${arg}\\s?\\=.*(?<!,)\\s(or)\\s(?!(more))`)) != -1
            b_optional = p.includes('optional')
            if (b_choices && !b_optional) {
                const prm_sub = p.slice(p.indexOf('=') + 1)
                choices = prm_sub.replace('0/1', '0 or 1').split(' or ')
                choices = choices.map(trimChoices)
                choices = choices.filter(filterChoices)
            }
        }
        )
        if (choices.length == 0 && !b_optional) {
            choices.push(arg)
        }
    }
    return choices
}

/** Generates Autocompletion SnippetString for CompletionList*/
function generateSnippetString(command_str: string, command_doc: commandDoc):SnippetString {

    function argString(snip: SnippetString, choices: string[]):SnippetString {
        snip.appendText(' ')
        switch (true) {
            case choices.length == 1:
                snip.appendPlaceholder(choices[0])
                break;
            case choices.length > 1:
                snip.appendChoice(choices)
                break;
            default:
                break;
        }
        return snip
    }

    const com_words: string[] = command_str.split(' ')
    const args: string[] = command_doc.syntax.split(RegExp('(?<!AtC)\\s')).filter(function (e) { if (e != '...') { return e } })
    const prms: string[] = command_doc.parameters.split(RegExp('\\n?\\s\\*\\s'))
    let snip = new SnippetString(args[0]);

    for (let index = 1; index < args.length; index++) {
        const element = args[index].replace(RegExp('[\\[\\]\\*\\<\\>]', 'g'), '');
        if (com_words.includes(args[index])) { //Append Command-Keyword as plain string
            snip.appendText(' ' + args[index])
        } else { // No command word -> check for choices or Placeholders
            const choices = getChoices(element, prms)
            snip = argString(snip, choices)
        }
    }
    return snip
}

/** Generates CompletionList for all commands*/
export function getCompletionList(autoConf: WorkspaceConfiguration):CompletionList {

    const completion_List = new CompletionList();

    if (autoConf.Enabled) {
        for (let c of command_docs.values()) {
            for (let c_ix of c.command.values()) {
                const compl_it = new CompletionItem(c_ix);
                compl_it.documentation = new MarkdownString();

                if (autoConf.Hint) {
                    compl_it.detail = c.syntax
                } else {
                    compl_it.documentation.appendCodeblock(c.syntax, 'lmps')
                }
                compl_it.documentation.appendMarkdown("[Open documentation](https://lammps.sandia.gov/doc/" + c.html_filename + ")\n")
                compl_it.documentation.appendMarkdown(c.parameters)
                compl_it.documentation.appendMarkdown(" \n" + "--- " + " \n")
                compl_it.documentation.appendText(c.short_description)
                compl_it.insertText = generateSnippetString(c_ix, c)
                compl_it.kind = CompletionItemKind.Function

                completion_List.items.push(compl_it)
            }
        }
    }
    return completion_List
}