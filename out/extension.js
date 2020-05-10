"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
Object.defineProperty(exports, "__esModule", { value: true });
const doc_fcns = require("./doc_fcns");
const lint = require("./lmps_lint");
const vscode = require("vscode");
vscode.languages.registerHoverProvider("lmps", {
    provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, RegExp('[\\w\\/]+(?:[\\t\\s]+[^\#\\s\\t]+)*'));
        const words = document.getText(range);
        return createHover(words);
    }
});
vscode.languages.registerCompletionItemProvider("lmps", {
    provideCompletionItems(document, position, token, context) {
        const auto_conf = vscode.workspace.getConfiguration('lammps.AutoComplete');
        return doc_fcns.get_completion_list(auto_conf.CompletionString, auto_conf.Hint, auto_conf.Enabled);
    }
});
function get_documentation(snippet) {
    const sub_com = snippet.split(RegExp('[\\t\\s]+'));
    let docs = doc_fcns.getCommand(sub_com[0] + ' ' + sub_com[3]);
    if (docs === null || docs === void 0 ? void 0 : docs.command) {
        return docs;
    }
    else {
        // Captures all the AtC commands, like "fix_modify AtC output" and "fix_modify AtC control localized_lambda"
        docs = doc_fcns.getCommand(sub_com[0] + ' AtC ' + sub_com[2] + ' ' + sub_com[3]);
        if (docs === null || docs === void 0 ? void 0 : docs.command) {
            return docs;
        }
        else {
            // Captures all the AtC commands, like "fix_modify AtC output"
            docs = doc_fcns.getCommand(sub_com[0] + ' AtC ' + sub_com[2]);
            if (docs === null || docs === void 0 ? void 0 : docs.command) {
                return docs;
            }
            else {
                docs = doc_fcns.getCommand(sub_com[0] + ' ' + sub_com[2]);
                if (docs === null || docs === void 0 ? void 0 : docs.command) {
                    return docs;
                }
                else {
                    docs = doc_fcns.getCommand(sub_com[0] + ' ' + sub_com[1]);
                    if (docs === null || docs === void 0 ? void 0 : docs.command) {
                        return docs;
                    }
                    else {
                        docs = doc_fcns.getCommand(sub_com[0]);
                        if (docs === null || docs === void 0 ? void 0 : docs.command) {
                            return docs;
                        }
                        else {
                            return undefined;
                        }
                    }
                }
            }
        }
    }
}
function createHover(snippet) {
    const hover_conf = vscode.workspace.getConfiguration('lammps.Hover');
    if (hover_conf.Enabled) {
        const docs = get_documentation(snippet);
        if (docs === null || docs === void 0 ? void 0 : docs.command) {
            // Constructing the Markdown String to show in the Hover window
            const content = new vscode.MarkdownString();
            if (docs === null || docs === void 0 ? void 0 : docs.short_description) {
                content.appendMarkdown((docs === null || docs === void 0 ? void 0 : docs.short_description) + ". [Read more... ](https://lammps.sandia.gov/doc/" + (docs === null || docs === void 0 ? void 0 : docs.html_filename) + ")\n");
                content.appendMarkdown("\n --- \n");
            }
            if (docs === null || docs === void 0 ? void 0 : docs.syntax) {
                content.appendMarkdown("### Syntax: \n");
                content.appendCodeblock(docs === null || docs === void 0 ? void 0 : docs.syntax, "lmps");
                content.appendMarkdown((docs === null || docs === void 0 ? void 0 : docs.parameters) + "\n\n");
            }
            if ((docs === null || docs === void 0 ? void 0 : docs.examples) && hover_conf.Examples) {
                content.appendMarkdown("### Examples: \n");
                content.appendCodeblock(docs === null || docs === void 0 ? void 0 : docs.examples, "lmps");
            }
            if ((docs === null || docs === void 0 ? void 0 : docs.description) && hover_conf.Detail == 'Complete') {
                content.appendMarkdown("### Description: \n");
                content.appendText((docs === null || docs === void 0 ? void 0 : docs.description) + "\n");
            }
            if ((docs === null || docs === void 0 ? void 0 : docs.restrictions) && hover_conf.Restrictions) {
                content.appendMarkdown("### Restrictions: \n");
                content.appendText(docs === null || docs === void 0 ? void 0 : docs.restrictions);
            }
            return new vscode.Hover(content);
        }
    }
}
function updateDiagnostics(document, collection) {
    if (document) {
        let errors = [];
        for (let line_idx = 0; line_idx < document.lineCount; line_idx++) {
            // check lines with a set of functions, which append Diagnostic entries to the errors array
            errors = lint.check_file_paths(document, line_idx, errors);
            // errors = lint.check_write_paths(document, line_idx, errors)
        }
        collection.set(document.uri, errors);
    }
    else {
        collection.clear();
    }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    var _a;
    // Register Commands
    let disposable = vscode.commands.registerCommand('extension.show_docs', () => {
        const web_uri = vscode.Uri.parse("https://lammps.sandia.gov/doc/Manual.html");
        vscode.env.openExternal(web_uri);
    });
    context.subscriptions.push(disposable);
    // Provide Diagnostics on activation and Text-Changed-Event
    const collection = vscode.languages.createDiagnosticCollection('lmps');
    const editor = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document;
    if (editor) {
        updateDiagnostics(editor, collection);
    }
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(editor => {
        if (editor) {
            updateDiagnostics(editor.document, collection);
        }
    }));
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map