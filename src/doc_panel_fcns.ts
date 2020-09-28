import { WebviewPanel, ExtensionContext, Uri, window, TextDocument, TextEditor, MarkdownString, Position, commands } from 'vscode';
import { doc_entry, getColor, fix_img_path, getDocumentation } from './doc_fcns'
import { getMathMarkdown } from './render_fcns'
import { getRangeFromPosition } from './hover_fcns';
import { join } from 'path'
import { PlotPanel } from './dashboard_fcns';

export interface DocPanel extends WebviewPanel {
    command?: string
}

export async function manage_doc_panel(context: ExtensionContext, panel: DocPanel | undefined, actCol: number, commandUnderCursor: string | undefined, md: { render: (arg0: string) => any; }): Promise<DocPanel | undefined> {

    const img_path_light = Uri.file(join(context.extensionPath, 'imgs', 'logo_sq_l.gif'))
    const img_path_dark = Uri.file(join(context.extensionPath, 'imgs', 'logo_sq_d.gif'))

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

    if (!commandUnderCursor) {
        const editor: TextEditor | undefined = window.activeTextEditor;
        const document: TextDocument = window.activeTextEditor!.document
        const position: Position = editor!.selection.active;
        commandUnderCursor = getRangeFromPosition(document, position)
    }

    const md_content: MarkdownString | undefined = await create_doc_page(commandUnderCursor, panel, context)
    if (md_content && panel) {
        panel.command = commandUnderCursor
        set_doc_panel_content(panel, md_content, context, md)
    }

    commands.executeCommand('setContext', 'commandOnCursor', false);
    return panel
}

function fix_base64_image_html(txt: string): string {
    const imgs = txt.match(RegExp("(\\!\\[\\S*?\\]\\()(.*?)(\\))", "g"))
    if (imgs) {
        imgs.forEach(img => {
            const tag = img.replace(RegExp("\\!\\[\\S*?\\]\\("), "<img src=\"").slice(0, -1) + "\"/>"
            txt = txt.replace(img, tag)
        })
    }
    return txt
}


export function set_doc_panel_content(panel: DocPanel | undefined, md_content: MarkdownString, context: ExtensionContext, md: { render: (arg0: string) => any; }) {

    if (panel) {

        const incl_str: string = get_css(panel,context)

        let html = md.render(md_content.value)
        html = fix_base64_image_html(html)
        panel.webview.html = incl_str + html
    }
}

export function get_css(panel: DocPanel | PlotPanel, context: ExtensionContext) {
    const css_lmps: Uri[] = [
        Uri.file(join(context.extensionPath, 'css', 'lmps_light.css')),
        Uri.file(join(context.extensionPath, 'css', 'lmps_dark.css')),
        Uri.file(join(context.extensionPath, 'css', 'lmps_dark.css'))]

    const style: Uri = css_lmps[window.activeColorTheme.kind - 1]
    const style_panel_uri = panel.webview.asWebviewUri(style)
    const incl_str: string = `<link rel="stylesheet" type="text/css" href="${style_panel_uri}">`
    return incl_str
}
export async function create_doc_page(snippet: string, panel: WebviewPanel | undefined, context: ExtensionContext): Promise<MarkdownString | undefined> {

    const color: string = getColor()
    const docs: doc_entry | undefined = getDocumentation(snippet)
    if (docs) {
        // Constructing the Markdown String to show in the Hover window
        const content = new MarkdownString("", true)
        if (docs.command) {
            content.appendMarkdown(`## ${docs.command[0]} \n`)
            content.appendMarkdown("\n --- \n")
            if (docs.command.length > 1) {
                for (let cx = 1; cx < docs.command.length; cx++) {
                    const c = docs.command[cx];
                    content.appendMarkdown(`### ${c} \n`)
                }
                content.appendMarkdown("\n --- \n")
            }
        }
        if (docs.syntax) {
            content.appendMarkdown("### Syntax: \n")
            content.appendCodeblock(docs.syntax.join('\n'), "lmps")
            content.appendMarkdown(await getMathMarkdown(docs.parameters, color, false) + "\n\n")
        }
        if (docs.examples) {
            let exmpl: string = fix_img_path(docs.examples, true, panel, context)
            exmpl = await getMathMarkdown(exmpl, color, false)
            content.appendMarkdown("### Examples: \n")
            content.appendMarkdown(exmpl + '\n')
        }
        if (docs.description) {
            let full_desc: string = fix_img_path(docs.description, true, panel, context)
            full_desc = await getMathMarkdown(full_desc, color, false)
            content.appendMarkdown("### Description: \n")
            content.appendMarkdown(full_desc + "\n")
        }
        if (docs.restrictions) {
            content.appendMarkdown("### Restrictions: \n")
            content.appendMarkdown(docs.restrictions)
        }
        // TODO: 
        // Related commands section has references in it. Needs fixing.
        // if (docs.related) {
        //     content.appendMarkdown("### Related commands: \n")
        //     content.appendMarkdown(docs.related)
        // }
        return content
    } else {
        return undefined
    }
}
