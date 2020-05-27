"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletionList = exports.getArgIndex = exports.searchCommands = exports.getCommand = exports.fix_img_path = void 0;
const vscode_1 = require("vscode");
const math_render_1 = require("./math_render");
const lmp_doc_1 = require("./lmp_doc");
const theme_1 = require("./theme");
function fix_img_path(txt, b_img) {
    if (b_img) {
    }
    else {
    }
    return txt;
}
exports.fix_img_path = fix_img_path;
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
/** Generates Autocompletion SnippetString for CompletionList*/
function generateSnippetString(command_doc) {
    let snip = new vscode_1.SnippetString(command_doc.args[0].arg);
    for (let index = 1; index < command_doc.args.length; index++) {
        snip.appendText(" ");
        switch (command_doc.args[index].type) {
            case 1:
                snip.appendText(command_doc.args[index].arg);
                break;
            case 2:
                snip.appendPlaceholder(command_doc.args[index].arg);
                break;
            case 3:
                snip.appendChoice(command_doc.args[index].choices);
                break;
            default:
                break;
        }
    }
    return snip;
}
/** Generates CompletionList for all commands*/
function getCompletionList(autoConf) {
    return __awaiter(this, void 0, void 0, function* () {
        function mediumBlock(c, compl_it_doc) {
            compl_it_doc = docLink(c.html_filename, compl_it_doc);
            compl_it_doc.appendCodeblock(c.syntax, 'lmps');
            compl_it_doc.appendMarkdown(c.parameters);
            return compl_it_doc;
        }
        function docLink(html_link, compl_it_doc) {
            return compl_it_doc.appendMarkdown("[Open documentation](https://lammps.sandia.gov/doc/" + html_link + ")\n");
        }
        const color = theme_1.getColor();
        const completion_List = new vscode_1.CompletionList();
        if (autoConf.Setting != "None") {
            for (let c of lmp_doc_1.command_docs.values()) {
                for (let c_ix of c.command.values()) {
                    const compl_it = new vscode_1.CompletionItem(c_ix);
                    compl_it.documentation = new vscode_1.MarkdownString("", true);
                    switch (autoConf.Setting) {
                        case "Minimal":
                            compl_it.detail = c.syntax;
                            compl_it.documentation = docLink(c.html_filename, compl_it.documentation);
                            break;
                        case "Medium":
                            compl_it.documentation = mediumBlock(c, compl_it.documentation);
                            break;
                        case "Extensive":
                            compl_it.documentation = mediumBlock(c, compl_it.documentation);
                            compl_it.documentation.appendMarkdown(" \n" + "--- " + " \n");
                            compl_it.documentation.appendMarkdown(yield math_render_1.getMathMarkdown(c.short_description, color));
                            break;
                        default:
                            break;
                    }
                    compl_it.insertText = generateSnippetString(c);
                    compl_it.kind = vscode_1.CompletionItemKind.Function;
                    completion_List.items.push(compl_it);
                }
            }
        }
        return completion_List;
    });
}
exports.getCompletionList = getCompletionList;
//# sourceMappingURL=doc_fcns.js.map