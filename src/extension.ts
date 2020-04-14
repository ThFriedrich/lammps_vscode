// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as documentation from "./get_doc";
import * as vscode from 'vscode';

vscode.languages.registerHoverProvider("lmps", {
	provideHover(document, position) {
		const range = document.getWordRangeAtPosition(position, RegExp('[\\w\\/]+(?:[\\t\\s]+[^\#\\s\\t]+)*'))
		const words = document.getText(range)
		return createHover(words)
	}
});

vscode.languages.registerCompletionItemProvider("lmps", {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
		const auto_conf = vscode.workspace.getConfiguration('lammps.AutoComplete')
		return documentation.get_completion_list(auto_conf.CompletionString, auto_conf.Hint)
	}
});

function get_documentation(snippet: string) {

	const sub_com = snippet.split(RegExp('[\\t\\s]+'));
	var docs = documentation.get_doc(sub_com[0] + ' ' + sub_com[3])

	if (docs?.command) {
		return docs
	} else {
		// Captures all the AtC commands, like "fix_modify AtC output" and "fix_modify AtC control localized_lambda"
		docs = documentation.get_doc(sub_com[0] + ' AtC ' + sub_com[2] + ' ' + sub_com[3])
		if (docs?.command) {
			return docs
		} else {
			// Captures all the AtC commands, like "fix_modify AtC output"
			docs = documentation.get_doc(sub_com[0] + ' AtC ' + sub_com[2])
			if (docs?.command) {
				return docs
			} else {
				docs = documentation.get_doc(sub_com[0] + ' ' + sub_com[2])
				if (docs?.command) {
					return docs
				} else {
					docs = documentation.get_doc(sub_com[0] + ' ' + sub_com[1])
					if (docs?.command) {
						return docs
					} else {
						docs = documentation.get_doc(sub_com[0])
						if (docs?.command) {
							return docs
						}
						else { return undefined }
					}
				}
			}
		}
	}
}

function createHover(snippet: string) {

	const hover_conf = vscode.workspace.getConfiguration('lammps.Hover')
	const docs = get_documentation(snippet)

	if (docs?.command) {
		// Constructing the Markdown String to show in the Hover window
		const content = new vscode.MarkdownString()
		if (docs?.short_description) {
			content.appendText(docs?.short_description + "\n")
			content.appendMarkdown("\n --- \n")
		}
		if (docs?.syntax) {
			content.appendMarkdown("### Syntax: \n")
			content.appendCodeblock(docs?.syntax, "lmps")
			content.appendMarkdown(docs?.parameters + "\n\n")
		}
		if (docs?.examples && hover_conf.Examples) {
			content.appendMarkdown("### Examples: \n")
			content.appendCodeblock(docs?.examples, "lmps")
		}
		if (docs?.description && hover_conf.Detail == 'Complete') {
			content.appendMarkdown("### Description: \n")
			content.appendText(docs?.description + "\n")
		}
		if (docs?.restrictions && hover_conf.Restrictions) {
			content.appendMarkdown("### Restrictions: \n")
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

	});
	context.subscriptions.push(disposable);
}
// this method is called when your extension is deactivated
export function deactivate() { }
