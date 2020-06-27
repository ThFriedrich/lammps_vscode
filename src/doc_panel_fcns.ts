import { WebviewPanel, ExtensionContext, Uri, window, TextDocument, TextEditor, MarkdownString, Position, commands } from 'vscode';
import { doc_entry, getColor, fix_img_path, getDocumentation } from './doc_fcns'
import { getMathMarkdown } from './math_render'
import { getRangeFromPosition } from './hover_fcns';

export interface DocPanel extends WebviewPanel {
    command?: string
}

export async function manage_doc_panel(context: ExtensionContext, panel: DocPanel | undefined, actCol: number):Promise<DocPanel|undefined> {

    const img_path_light = Uri.joinPath(Uri.parse(context.extensionPath), 'imgs', 'logo_sq_l.gif')
    const img_path_dark = Uri.joinPath(Uri.parse(context.extensionPath), 'imgs', 'logo_sq_d.gif')

    if (panel) {
        // If we already have a panel, show it in the target column
        panel.reveal(actCol);
    } else {
        // Otherwise, create a new panel
        panel = window.createWebviewPanel(
            'lmpsDoc',
            'Lammps Documentation', actCol!, { retainContextWhenHidden: true }
        );
        panel.iconPath = { light: img_path_light, dark: img_path_dark }
        panel.onDidChangeViewState(
            e => {
                actCol = e.webviewPanel.viewColumn!
            },
            null,
            context.subscriptions
        );
        context.subscriptions.push(panel)
    }

    const editor: TextEditor | undefined = window.activeTextEditor;
    const document: TextDocument = window.activeTextEditor!.document
    const position: Position = editor!.selection.active;
    const command: string = getRangeFromPosition(document, position)
    const md_content: MarkdownString | undefined = await create_doc_page(command, panel)

    if (md_content && panel) {
        panel.command = command
        set_doc_panel_content(panel, md_content)
    }
    commands.executeCommand('setContext', 'commandOnCursor', false);
    return panel
}

export async function set_doc_panel_content(panel: DocPanel | undefined, md_content: MarkdownString) {
    const html: string = await commands.executeCommand('markdown.api.render', md_content.value) as string;
    panel!.webview.html = html;
}

export async function create_doc_page(snippet: string, panel: WebviewPanel | undefined): Promise<MarkdownString | undefined> {

    const color: string = getColor()
    const docs: doc_entry | undefined = getDocumentation(snippet)
    if (docs) {
        // Constructing the Markdown String to show in the Hover window
        const content = new MarkdownString("", true)
        if (docs?.command) {
            content.appendMarkdown(`## ${docs?.command[0]} \n`)
            content.appendMarkdown("\n --- \n")
            if (docs.command.length > 1) {
                for (let cx = 1; cx < docs.command.length; cx++) {
                    const c = docs.command[cx];
                    content.appendMarkdown(`### ${c} \n`)
                }
                content.appendMarkdown("\n --- \n")
            }
        }
        if (docs?.syntax) {
            content.appendMarkdown("## Syntax: \n")
            content.appendCodeblock(docs?.syntax.join('\n'), "lmps")
            content.appendMarkdown(await getMathMarkdown(docs?.parameters, color) + "\n\n")
        }
        if (docs?.examples) {
            content.appendMarkdown("## Examples: \n")
            content.appendMarkdown(docs?.examples)
        }
        if (docs?.description) {
            let full_desc: string = fix_img_path(docs.description, true, panel)
            full_desc = await getMathMarkdown(full_desc, color)
            content.appendMarkdown("## Description: \n")
            content.appendMarkdown(full_desc + "\n")
        }
        if (docs?.restrictions) {
            content.appendMarkdown("## Restrictions: \n")
            content.appendMarkdown(docs?.restrictions)
        }
        // if (docs?.related) {
        //     content.appendMarkdown("### Related commands: \n")
        //     content.appendMarkdown(docs?.related)
        // }
        return content
    } else {
        return undefined
    }
}
