"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
Object.defineProperty(exports, "__esModule", { value: true });
const documentation = require("./get_doc");
const vscode = require("vscode");
vscode.languages.registerHoverProvider("lmps", {
    provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, RegExp('\\w+( ?(\\w+)(\\/\\w+)*)?'));
        const word = document.getText(range);
        return createHover(word);
    }
});
vscode.languages.registerCompletionItemProvider("lmps", {
    provideCompletionItems(document, position, token, context) {
        return documentation.get_completion_list();
    }
});
function get_documentation(snippet) {
    return documentation.get_doc(snippet);
}
function createHover(snippet) {
    var docs = get_documentation(snippet);
    // If command is not found, see if the first string is a command. 
    // This is necessary, because the range selector returns multiple words. This can be a command like:
    // "fix evaporate" or a keyword-value combination like "variable x" 
    if (!(docs === null || docs === void 0 ? void 0 : docs.command)) {
        const sub_com = snippet.split(" ");
        docs = get_documentation(sub_com[0]);
    }
    if (docs === null || docs === void 0 ? void 0 : docs.command) {
        // Constructing the Markdown String to show in the Hover window
        const content = new vscode.MarkdownString();
        content.appendMarkdown("# " + (docs === null || docs === void 0 ? void 0 : docs.command) + " \n" + "--- " + " \n");
        if (docs === null || docs === void 0 ? void 0 : docs.syntax) {
            content.appendMarkdown("## Syntax: \n");
            content.appendCodeblock(docs === null || docs === void 0 ? void 0 : docs.syntax, "lmps");
            content.appendMarkdown((docs === null || docs === void 0 ? void 0 : docs.parameters) + "\n\n");
        }
        if (docs === null || docs === void 0 ? void 0 : docs.examples) {
            content.appendMarkdown("## Examples: \n");
            content.appendCodeblock(docs === null || docs === void 0 ? void 0 : docs.examples, "lmps");
        }
        if (docs === null || docs === void 0 ? void 0 : docs.description) {
            content.appendMarkdown("## Description: \n");
            content.appendText((docs === null || docs === void 0 ? void 0 : docs.description) + "\n");
        }
        if (docs === null || docs === void 0 ? void 0 : docs.restrictions) {
            content.appendMarkdown("## Restrictions: \n");
            content.appendText(docs === null || docs === void 0 ? void 0 : docs.restrictions);
        }
        return new vscode.Hover(content);
    }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.show_docs', () => {
        const web_uri = vscode.Uri.parse("https://lammps.sandia.gov/doc/Manual.html");
        vscode.env.openExternal(web_uri);
        // const doc_uri = vscode.Uri.parse(path.join(context.extensionPath, 'src','html','Manual.html'))
        // 	const panel = vscode.window.createWebviewPanel(
        // 		'docs',
        // 		'Lammps Documentation',
        // 		vscode.ViewColumn.Two,
        // 		{
        // 		  localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src','html'))],
        // 		}
        // 	  );
        // 	const PathOnDisk = path.join(context.extensionPath, 'html', 'Manual.html');
        // 	panel.webview.html = fs.readFileSync(PathOnDisk).toString();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map