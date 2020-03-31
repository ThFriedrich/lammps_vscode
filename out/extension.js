"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
Object.defineProperty(exports, "__esModule", { value: true });
const documentation = require("./get_doc");
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
vscode.languages.registerHoverProvider("lmps", {
    provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);
        return createHover(word);
    }
});
function get_documentation(snippet) {
    return documentation.get_doc(snippet);
}
function createHover(snippet) {
    const docs = get_documentation(snippet);
    const content = new vscode.MarkdownString("# " + (docs === null || docs === void 0 ? void 0 : docs.command) + " \n\n" +
        "--- " + " \n\n" +
        "## Syntax: \n " + (docs === null || docs === void 0 ? void 0 : docs.syntax) + " \n\n" +
        "## Description: \n" + (docs === null || docs === void 0 ? void 0 : docs.description) + "\n\n" +
        "## Examples:  \n" + (docs === null || docs === void 0 ? void 0 : docs.examples), true);
    return new vscode.Hover(content);
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.show_docs', () => {
        const panel = vscode.window.createWebviewPanel('docs', 'Lammps Documentation', vscode.ViewColumn.Two, {
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'html'))],
        });
        const PathOnDisk = path.join(context.extensionPath, 'html', 'Manual.html');
        panel.webview.html = fs.readFileSync(PathOnDisk).toString();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map