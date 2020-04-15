"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lmp_doc_1 = require("./lmp_doc");
const vscode_1 = require("vscode");
function get_doc(find_command) {
    return lmp_doc_1.command_docs.find(e => e.command === find_command);
}
exports.get_doc = get_doc;
function get_completion_list(CompletionString, detail) {
    const completion_List = new vscode_1.CompletionList();
    for (let c of lmp_doc_1.command_docs.values()) {
        var compl_it = new vscode_1.CompletionItem(c.command);
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
    return completion_List;
}
exports.get_completion_list = get_completion_list;
//# sourceMappingURL=get_doc.js.map