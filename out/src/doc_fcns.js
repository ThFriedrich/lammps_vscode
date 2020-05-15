"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const lmp_doc_1 = require("./lmp_doc");
/** Returns the entire documentation entry for a given command.*/
function getCommand(find_command) {
    return lmp_doc_1.command_docs.find(e => e.command.includes(find_command));
}
exports.getCommand = getCommand;
/** Returns all commands that include a given substring or RegExp */
function searchCommands(searchString) {
    const return_array = [];
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
/** Function matches keywords(from the syntax) against parameter
 * descriptions and checks for patterns like 'style = fcc or bcc or ...' to
 * generate a list of options for that particular keyword.
*/
function getChoices(arg, prms) {
    function filterChoices(choice) {
        return !choice.includes('=');
    }
    // Allow only single words and erase whitespaces
    function trimChoices(choice) {
        return choice.trim().split(' ')[0];
    }
    let choices = [];
    let b_optional = false;
    if (arg.includes('|')) { //Takes care of AtC commands
        choices = arg.split('|');
    }
    else { // All other commands
        prms.forEach(p => {
            const b_choices = p.search(RegExp(`\\s*${arg}\\s?\\=.*(?<!,)\\s(or)\\s(?!(more))`)) != -1;
            b_optional = p.includes('optional');
            if (b_choices && !b_optional) {
                const prm_sub = p.slice(p.indexOf('=') + 1);
                choices = prm_sub.replace('0/1', '0 or 1').split(' or ');
                choices = choices.map(trimChoices);
                choices = choices.filter(filterChoices);
            }
        });
        if (choices.length == 0 && !b_optional) {
            choices.push(arg);
        }
    }
    return choices;
}
/** Generates Autocompletion SnippetString for CompletionList*/
function generateSnippetString(command_str, command_doc) {
    function argString(snip, choices) {
        snip.appendText(' ');
        switch (true) {
            case choices.length == 1:
                snip.appendPlaceholder(choices[0]);
                break;
            case choices.length > 1:
                snip.appendChoice(choices);
                break;
            default:
                break;
        }
        return snip;
    }
    const com_words = command_str.split(' ');
    const args = command_doc.syntax.split(RegExp('(?<!AtC)\\s')).filter(function (e) { if (e != '...') {
        return e;
    } });
    const prms = command_doc.parameters.split(RegExp('\\n?\\s\\*\\s'));
    let snip = new vscode_1.SnippetString(args[0]);
    for (let index = 1; index < args.length; index++) {
        const element = args[index].replace(RegExp('[\\[\\]\\*\\<\\>]', 'g'), '');
        if (com_words.includes(args[index])) { //Append Command-Keyword as plain string
            snip.appendText(' ' + args[index]);
        }
        else { // No command word -> check for choices or Placeholders
            const choices = getChoices(element, prms);
            snip = argString(snip, choices);
        }
    }
    return snip;
}
/** Generates CompletionList for all commands*/
function getCompletionList(autoConf) {
    const completion_List = new vscode_1.CompletionList();
    if (autoConf.Enabled) {
        for (let c of lmp_doc_1.command_docs.values()) {
            for (let c_ix of c.command.values()) {
                const compl_it = new vscode_1.CompletionItem(c_ix);
                compl_it.documentation = new vscode_1.MarkdownString();
                if (autoConf.Hint) {
                    compl_it.detail = c.syntax;
                }
                else {
                    compl_it.documentation.appendCodeblock(c.syntax, 'lmps');
                }
                compl_it.documentation.appendMarkdown("[Open documentation](https://lammps.sandia.gov/doc/" + c.html_filename + ")\n");
                compl_it.documentation.appendMarkdown(c.parameters);
                compl_it.documentation.appendMarkdown(" \n" + "--- " + " \n");
                compl_it.documentation.appendText(c.short_description);
                compl_it.insertText = generateSnippetString(c_ix, c);
                compl_it.kind = vscode_1.CompletionItemKind.Function;
                completion_List.items.push(compl_it);
            }
        }
    }
    return completion_List;
}
exports.getCompletionList = getCompletionList;
//# sourceMappingURL=doc_fcns.js.map