import { command_docs } from "./lmp_doc";
import { CompletionItem, CompletionList, MarkdownString } from 'vscode';

/** Returns the entire documentation entry for a given command.*/
export function getCommand(find_command: string) {
    return command_docs.find(e => e.command.includes(find_command));
}

/** Returns all commands that include a given substring or RegExp */
export function searchCommands(searchString: string | RegExp) {
    let return_array: string[] = []
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
export function getArgIndex(command: string, argument: RegExp | string) {
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

export function get_completion_list(CompletionString: string, detail: boolean, enabled: boolean) {

    const completion_List = new CompletionList();

    if (enabled) {

        for (let c of command_docs.values()) {
            for (let c_ix of c.command.values()) {
                var compl_it = new CompletionItem(c_ix);
                compl_it.documentation = new MarkdownString();
                if (detail) {
                    compl_it.detail = c.syntax
                }
                else {
                    compl_it.documentation.appendCodeblock(c.syntax, 'lmps')
                }
                compl_it.documentation.appendMarkdown("[Open documentation](https://lammps.sandia.gov/doc/" + c.html_filename + ")\n")
                compl_it.documentation.appendMarkdown(c.parameters)
                compl_it.documentation.appendMarkdown(" \n" + "--- " + " \n")
                compl_it.documentation.appendText(c.short_description)

                if (CompletionString == 'Syntax') {
                    compl_it.insertText = c.syntax
                }
                completion_List.items.push(compl_it)
            }
        }
    }
    return completion_List
}