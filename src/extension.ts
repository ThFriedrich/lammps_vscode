// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as documentation from "./get_doc";
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

vscode.languages.registerHoverProvider("lmps", {
	provideHover(document, position) {
		const range = document.getWordRangeAtPosition(position)
		const word = document.getText(range)
		return createHover(word)
	}
})
  
function get_documentation(snippet: string){
	return documentation.get_doc(snippet);
}

function createHover(snippet: string) {
	const docs = get_documentation(snippet)
	const content = new vscode.MarkdownString(
		"# "+docs?.command+" \n\n" + 
		"--- " +" \n\n" +
		"## Syntax: \n " + docs?.syntax + " \n\n" + 
		"## Description: \n" + docs?.description + "\n\n" + 
		"## Examples:  \n" + docs?.examples, true)
	return new vscode.Hover(content)
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('extension.show_docs', () => {
		const panel = vscode.window.createWebviewPanel(
			'docs',
			'Lammps Documentation',
			vscode.ViewColumn.Two,
			{
			  localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src','html'))],
			}
		  );
		
		const PathOnDisk = path.join(context.extensionPath, 'html', 'Manual.html');
		panel.webview.html = fs.readFileSync(PathOnDisk).toString();
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
