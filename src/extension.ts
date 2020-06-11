import { doc_entry, getCompletionList, getDocumentation, doc_completion_item } from "./doc_fcns";
import { DocPanel, manage_doc_panel, set_doc_panel_content, create_doc_page } from './doc_panel_fcns';
import { createHover, getRangeFromPosition } from './hover_fcns';
import { updateDiagnostics } from './lmps_lint';
import * as vscode from 'vscode';


export async function activate(context: vscode.ExtensionContext) {

	// Initialize Panel and ViewColumn for Documentation WebView
	let panel: DocPanel | undefined = undefined;
	let actCol: number = 2;

	// Register Command to show Command documentation in WebView
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.show_docs', async () => {
			panel = await manage_doc_panel(context, panel, actCol)
		}));

	// Redraw active Webview Panel in new Color (for math)
	context.subscriptions.push(
		vscode.window.onDidChangeActiveColorTheme(async e => {
			if (panel && panel.command) {
				const md_content: vscode.MarkdownString | undefined = await create_doc_page(panel.command, panel)
				if (md_content) {
					set_doc_panel_content(panel, md_content)
				}
			}

		}))

	// Register Hover Provider
	context.subscriptions.push(
		vscode.languages.registerHoverProvider("lmps", {
			provideHover(document, position) {
				const command: string = getRangeFromPosition(document, position)
				const docs: doc_entry | undefined = getDocumentation(command)
				// Sets a context variable to control visibility of context menu item "Show documentation for Command"
				if (docs) {
					vscode.commands.executeCommand('setContext', 'commandOnCursor', true);
					return createHover(docs)
				} else {
					vscode.commands.executeCommand('setContext', 'commandOnCursor', false);
				}
			}
		}));


	// Register Completions Provider
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider("lmps",
			{
				async resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem> {
					const autoConf = vscode.workspace.getConfiguration('lammps.AutoComplete')
					const item_doc = await doc_completion_item(autoConf, item);
					if (item_doc) {
						return item_doc
					} else {
						return item
					}
				},
				provideCompletionItems(
					document: vscode.TextDocument,
					position: vscode.Position,
					token: vscode.CancellationToken,
					context: vscode.CompletionContext) {
					const autoConf = vscode.workspace.getConfiguration('lammps.AutoComplete')
					let compl_str: vscode.CompletionList = getCompletionList(autoConf)
					return compl_str
				}
			}));

	// Provide Diagnostics on Open, Save and Text-Changed-Event
	const collection = vscode.languages.createDiagnosticCollection('lmps');
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			if (doc.languageId == 'lmps') {
				updateDiagnostics(doc, collection);
			}
		}));

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(doc => {
			if (doc.languageId == 'lmps') {
				updateDiagnostics(doc, collection);
			}
		}));

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(editor => {
			const c_str: string = editor.contentChanges[0].text
			// Check only when a word was typed out comletely
			const b_trig: boolean = c_str.search(RegExp('[\\n\\s#]')) != -1
			if (b_trig) {
				updateDiagnostics(editor.document, collection);
			}
		}));
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
}

