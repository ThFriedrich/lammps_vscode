import { doc_entry, getCompletionList, getDocumentation, doc_completion_item } from "./doc_fcns";
import { DocPanel, manage_doc_panel, set_doc_panel_content, create_doc_page } from './doc_panel_fcns';
import { PlotPanel, manage_plot_panel, draw_panel } from './dashboard_fcns';
import { createHover, getRangeFromPosition } from './hover_fcns';
import { updateDiagnostics } from './lint_fcns';
import { get_tasks, resolve_task } from './task_fcns'
import * as vscode from 'vscode';
import { get_markdown_it } from './highlight_fcns';
import { join } from 'path';
import { readFileSync } from 'fs'

export async function activate(context: vscode.ExtensionContext) {

	check_versions(context)
	const md = await get_markdown_it(context)

	// Initialize Panel and ViewColumn for Documentation WebView
	let panel: DocPanel | undefined = undefined;
	const actCol: number = 2;
	let commandUnderCursor: string | undefined = undefined;

	// Initialize Panel and ViewColumn for Dashboard WebView
	let plot_panel: PlotPanel | undefined = undefined;
	const plot_actCol: number = 2;

	// Register Command to show Command documentation in WebView
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.show_docs', async () => {
			panel = await manage_doc_panel(context, panel, actCol, commandUnderCursor, md)
			// Reset when the panel is closed	
			panel?.onDidDispose(() => {
				panel = undefined;
			},
				null,
				context.subscriptions
			);
		}));

	// Register Command to show Plots in WebView
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.show_dash', async () => {
			plot_panel = await manage_plot_panel(context, plot_panel, plot_actCol)
			plot_panel?.onDidDispose(() => {
				plot_panel = undefined;
			},
				null,
				context.subscriptions
			);
		}));

	// Redraw active Webview Panels in new Color
	context.subscriptions.push(
		vscode.window.onDidChangeActiveColorTheme(async () => {
			if (panel && panel.command) {
				const md_content: vscode.MarkdownString | undefined = await create_doc_page(panel.command, panel, context)
				if (md_content) {
					set_doc_panel_content(panel, md_content, context, md)
				}
			}
			if (plot_panel) {
				draw_panel(plot_panel, context)
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
					commandUnderCursor = command;
					return createHover(docs, context)
				} else {
					vscode.commands.executeCommand('setContext', 'commandOnCursor', false);
				}
			}
		}));


	// Register Completions Provider
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider("lmps",
			{
				async resolveCompletionItem(item: vscode.CompletionItem): Promise<vscode.CompletionItem> {
					const autoConf = vscode.workspace.getConfiguration('lammps.AutoComplete')
					const item_doc = await doc_completion_item(autoConf, item);
					if (item_doc) {
						commandUnderCursor = String(item_doc.label);
						return item_doc
					} else {
						commandUnderCursor = String(item.label);
						return item
					}
				},
				provideCompletionItems(
					document: vscode.TextDocument,
					position: vscode.Position,
					token: vscode.CancellationToken) {
					if (token.isCancellationRequested) {
						return Promise.resolve(new vscode.CompletionList([])); // Return an empty completion list
					}
					const linePrefix = document.lineAt(position).text.substring(0, position.character);
					// provide completion suggestion only at the beginning of the line
					if (linePrefix.search(RegExp('^\\s*[\\S]+\\s')) >= 0) {
						return undefined;
					} else {
						const autoConf = vscode.workspace.getConfiguration('lammps.AutoComplete')
						const compl_str: vscode.CompletionList = getCompletionList(autoConf)
						return compl_str
					}
				}
			}));

	// Provide Diagnostics on Open, Save and Text-Changed-Event
	const collection = vscode.languages.createDiagnosticCollection('lmps');
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			if (doc.languageId == 'lmps') {
				updateDiagnostics(doc, collection);
			}
		}),
		vscode.workspace.onDidSaveTextDocument(doc => {
			if (doc.languageId == 'lmps') {
				updateDiagnostics(doc, collection);
			}
		}),
		vscode.workspace.onDidChangeTextDocument(editor => {
			const c_str: string = editor.contentChanges[0]?.text
			// Check only when a word was typed out comletely
			const b_trig: boolean = c_str?.search(RegExp('[\\n\\s#]')) != -1
			if (b_trig && editor.document.languageId == 'lmps') {
				updateDiagnostics(editor.document, collection);
			}
		}));

	// Provide Tasks to run Lammps-script in vscode
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider('lmps', {
			provideTasks() {
				return get_tasks()
			},
			resolveTask(tsk: vscode.Task): vscode.Task | undefined {
				return resolve_task(tsk)
			}
		}));

	// Provide Symbols to display Headers in the Outline Tab
	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider("lmps", {
			provideDocumentSymbols(document: vscode.TextDocument, cancellationToken: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
				return new Promise((resolve) => {
					const symbols = [];
					for (let i = 0; i < document.lineCount; i++) {
						if (cancellationToken.isCancellationRequested) {
							resolve(symbols);
						}
						const line = document.lineAt(i);
						const m = line.text.match(RegExp("^\\s*#\\s*\\[\\s*(.*)"));
						if (m && m.length > 1) {
							symbols.push({
								name: m[1],
								kind: vscode.SymbolKind.Module,
								containerName: 'Section',
								location: new vscode.Location(document.uri, line.range)
							});
						}
					}
					resolve(symbols);
				});
			}
		}));
}

// Function to display update notification
function check_versions(context: vscode.ExtensionContext) {
	const meta = JSON.parse(readFileSync(join(context.extensionPath, 'package.json'), 'utf8'));
	const v: string = meta.version
	const v_stored: string | undefined = context.globalState.get('lmps_version')
	if (!v_stored || v != v_stored) {
		context.globalState.update('lmps_version', v)
		const buttons = ['🧐 Show Release Notes', '🌱 Buy the world a tree'];
		const message = `Lammps Language extension was updated to version ${v}. \n 
							Please keep an eye out for bugs and issues and report them! 🧐🐛 \n
							This software supports the [Treeware project](https://treeware.earth).`
		vscode.window.showInformationMessage(message, buttons[0], buttons[1]).then(click => {
			if (click == buttons[0]) {
				vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(context.extensionUri, 'RELEASE.md'), "Release Notes")
			}
			if (click == buttons[1]) {
				vscode.env.openExternal(vscode.Uri.parse("https://plant.treeware.earth/thfriedrich/lammps_vscode"))
			}
		})
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
}

