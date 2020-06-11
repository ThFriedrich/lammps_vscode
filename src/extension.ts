import { doc_entry, fix_img_path, getCompletionList, getDocumentation, create_doc_page, getColor, doc_completion_item } from "./doc_fcns";
import { checkFilePaths } from './lmps_lint';
import { getMathMarkdown } from './math_render'
import * as vscode from 'vscode';

interface DocPanel extends vscode.WebviewPanel {
	command?: string
}

export async function activate(context: vscode.ExtensionContext) {

	let panel: DocPanel | undefined = undefined;
	let actCol: number = 2;
	const img_path_light = vscode.Uri.joinPath(vscode.Uri.parse(context.extensionPath),'imgs','logo_sq_l.gif')
	const img_path_dark = vscode.Uri.joinPath(vscode.Uri.parse(context.extensionPath),'imgs','logo_sq_d.gif')
	async function set_doc_panel_content(panel: DocPanel | undefined, md_content: vscode.MarkdownString) {
		const html: string = await vscode.commands.executeCommand('markdown.api.render', md_content.value) as string;
		panel!.webview.html = html;
	}

	// Register Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.show_docs', async () => {
			// Reset when the current panel is closed	

			panel?.onDidDispose(
				() => {
					panel = undefined;
				},
				null,
				context.subscriptions
			);

			panel?.onDidChangeViewState(
				e => {
					actCol = e.webviewPanel.viewColumn!
				},
				null,
				context.subscriptions
			);

			if (panel) {
				// If we already have a panel, show it in the target column
				panel.reveal(actCol);
			} else {
				// Otherwise, create a new panel
				panel = vscode.window.createWebviewPanel(
					'lmpsDoc',
					'Lammps Documentation', actCol!, { retainContextWhenHidden: false }
				);
				panel.iconPath = { light: img_path_light, dark: img_path_dark }
				context.subscriptions.push(panel)
			}
			const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
			const document: vscode.TextDocument = vscode.window.activeTextEditor!.document
			const position: vscode.Position = editor!.selection.active;
			const command: string = getRangeFromPosition(document, position)
			const md_content: vscode.MarkdownString | undefined = await create_doc_page(command, panel)
			if (md_content) {
				panel.command = command
				set_doc_panel_content(panel, md_content)
			}
			vscode.commands.executeCommand('setContext', 'commandOnCursor', false);

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

function getRangeFromPosition(document: vscode.TextDocument, position: vscode.Position): string {
	const range = document.getWordRangeAtPosition(position, RegExp('[\\w\\/]+(?:[\\t\\s]+[^\#\\s\\t]+)*'))
	return document.getText(range)
}


async function createHover(docs: doc_entry): Promise<vscode.Hover | undefined> {

	const hover_conf: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('lammps.Hover')
	if (hover_conf.Enabled) {
		const color: string = getColor()

		if (docs) {
			// Constructing the Markdown String to show in the Hover window
			const content = new vscode.MarkdownString("", true)
			if (docs?.short_description) {
				let short_desc: string = fix_img_path(docs.short_description, false, undefined)
				short_desc = await getMathMarkdown(short_desc, color)
				content.appendMarkdown(short_desc + ". [Read more... ](https://lammps.sandia.gov/doc/" + docs?.html_filename + ")\n")
				content.appendMarkdown("\n --- \n")
			}
			if (docs?.syntax) {
				content.appendMarkdown("### Syntax: \n")
				content.appendCodeblock(docs?.syntax, "lmps")
				content.appendMarkdown(await getMathMarkdown(docs?.parameters, color) + "\n\n")
			}
			if (docs?.examples && hover_conf.Examples) {
				content.appendMarkdown("### Examples: \n")
				content.appendMarkdown(docs?.examples)
			}
			if (docs?.description && hover_conf.Detail == 'Complete') {
				let full_desc: string = fix_img_path(docs.description, true, undefined)
				full_desc = await getMathMarkdown(full_desc, color)
				content.appendMarkdown("### Description: \n")
				content.appendMarkdown(full_desc + "\n")
			}
			if (docs?.restrictions && hover_conf.Restrictions) {
				content.appendMarkdown("### Restrictions: \n")
				content.appendMarkdown(docs?.restrictions)
			}
			return new vscode.Hover(content)
		}
	}
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	if (document) {
		let errors: vscode.Diagnostic[] = []
		for (let line_idx = 0; line_idx < document.lineCount; line_idx++) {
			// check lines with a set of functions, which append Diagnostic entries to the errors array
			errors = checkFilePaths(document, line_idx, errors)
		}
		collection.set(document.uri, errors)
	} else {
		collection.clear();
	}
}

// this method is called when your extension is deactivated
export function deactivate(context:vscode.ExtensionContext) {
}

