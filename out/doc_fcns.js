"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lmp_doc_1 = require("./lmp_doc");
const vscode_1 = require("vscode");
/** Returns the entire documentation entry for a given command.*/
function getCommand(find_command) {
    return lmp_doc_1.command_docs.find(e => e.command.includes(find_command));
}
exports.getCommand = getCommand;
/** Returns all commands that include a given substring or RegExp */
function searchCommands(searchString) {
    let return_array = [];
    lmp_doc_1.command_docs.forEach(element => {
        element.command.forEach(com => {
            if (!(com.search(searchString) == -1)) {
                return_array === null || return_array === void 0 ? void 0 : return_array.push(com);
            }
        });
    });
    return return_array;
}
exports.searchCommands = searchCommands;
/** Searches the Syntax of a given command for a particular argument or RegExp
 * and returns the position index of that argument according to the syntax.
 * Example:
 * Suppose you want to locate the 'file' argument in the 'bond_write' command
 * with syntax ´bond_write btype N inner outer file keyword itype jtype´
 * getArgDoc('bond_write',RegExp('\\b(file)\\b')) would return 5
 * */
function getArgIndex(command, argument) {
    const com = getCommand(command);
    let idx = -1;
    if (com) {
        const args = com.syntax.split(RegExp('\\s'));
        for (let index = 0; index < args.length; index++) {
            const find_idx = args[index].search(argument);
            if (find_idx != -1) {
                idx = index;
                break;
            }
        }
    }
    return idx;
}
exports.getArgIndex = getArgIndex;
function get_completion_list(CompletionString, detail, enabled) {
    const completion_List = new vscode_1.CompletionList();
    if (enabled) {
        for (let c of lmp_doc_1.command_docs.values()) {
            for (let c_ix of c.command.values()) {
                var compl_it = new vscode_1.CompletionItem(c_ix);
                compl_it.documentation = new vscode_1.MarkdownString();
                if (detail) {
                    compl_it.detail = c.syntax;
                }
                else {
                    compl_it.documentation.appendCodeblock(c.syntax, 'lmps');
                }
                compl_it.documentation.appendMarkdown("[Open documentation](https://lammps.sandia.gov/doc/" + c.html_filename + ")\n");
                compl_it.documentation.appendMarkdown(c.parameters);
                compl_it.documentation.appendMarkdown(" \n" + "--- " + " \n");
                compl_it.documentation.appendText(c.short_description);
                if (CompletionString == 'Syntax') {
                    compl_it.insertText = c.syntax;
                }
                completion_List.items.push(compl_it);
            }
        }
    }
    return completion_List;
}
exports.get_completion_list = get_completion_list;
//# sourceMappingURL=doc_fcns.js.map