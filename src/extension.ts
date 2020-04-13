// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as documentation from "./get_doc";
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

vscode.languages.registerHoverProvider("lmps", {
	provideHover(document, position) {
		const range = document.getWordRangeAtPosition(position, RegExp('\\w+( ?(\\w+)(\\/\\w+)*)?'))
		const word = document.getText(range)
		return createHover(word)
	}
});

vscode.languages.registerCompletionItemProvider("lmps", {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
		return documentation.get_completion_list()
	}
});

function get_documentation(snippet: string){
	return documentation.get_doc(snippet);
}

function createHover(snippet: string) {
	var docs = get_documentation(snippet)
	// If command is not found, see if the first string is a command. 
	// This is necessary, because the range selector returns multiple words. This can be a command like:
	// "fix evaporate" or a keyword-value combination like "variable x" 
	if (!docs?.command) {
		const sub_com = snippet.split(" "); 
		docs = get_documentation(sub_com[0])
	}
	if (docs?.command) {
		// Constructing the Markdown String to show in the Hover window
		const content = new vscode.MarkdownString()
		content.appendMarkdown("# "+docs?.command+" \n" + "--- " +" \n")

		if (docs?.syntax) {
			content.appendMarkdown("## Syntax: \n")
			content.appendCodeblock(docs?.syntax,"lmps")
			content.appendMarkdown(docs?.parameters + "\n\n")
		}
		if (docs?.examples) {
			content.appendMarkdown("## Examples: \n")
			content.appendCodeblock(docs?.examples,"lmps")
		}
		if (docs?.description) {
			content.appendMarkdown("## Description: \n")
			content.appendText(docs?.description + "\n")
		}
		if (docs?.restrictions) {
			content.appendMarkdown("## Restrictions: \n")
			content.appendText(docs?.restrictions)
		}
		
		return new vscode.Hover(content)
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('extension.show_docs', () => {
		
		const web_uri = vscode.Uri.parse("https://lammps.sandia.gov/doc/Manual.html")
		vscode.env.openExternal(web_uri)

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

// this method is called when your extension is deactivated
export function deactivate() {}
