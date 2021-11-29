import { TextDocument, Position, Hover, WorkspaceConfiguration, workspace, MarkdownString, ExtensionContext, Uri } from 'vscode'
import { doc_entry, getColor, fix_img_path } from './doc_fcns'
import { getMathMarkdown } from './render_fcns'

export function getRangeFromPosition(document: TextDocument, position: Position): string {
    const range = document.getWordRangeAtPosition(position, RegExp('[\\w\\/]+(?:[\\t\\s]+[^\#\\s\\t]+)*'))
    return document.getText(range)
}

export async function createHover(docs: doc_entry, context:ExtensionContext): Promise<Hover | undefined> {

    const hover_conf: WorkspaceConfiguration = workspace.getConfiguration('lammps.Hover')
    if (hover_conf.Enabled) {
        const color: string = getColor()

        if (docs) {
            // Constructing the Markdown String to show in the Hover window
            const content = new MarkdownString("", true)
            if (docs.short_description) {
                const show_doc_uri = Uri.parse(`command:extension.show_docs`);
                let short_desc: string = fix_img_path(docs.short_description, false, undefined, context)
                short_desc = await getMathMarkdown(short_desc, color, true)
                content.appendMarkdown(short_desc + `. [Read more... ]( ${show_doc_uri} ) \n`)
                content.appendMarkdown("\n --- \n")
            }
            if (docs.syntax) {
                content.appendMarkdown("### Syntax: \n")
                content.appendCodeblock(docs.syntax.join('\n'), "lmps")
                content.appendMarkdown(await getMathMarkdown(docs.parameters, color, true) + "\n\n")
            }
            if (docs.examples && hover_conf.Examples) {
                let exmpl: string = fix_img_path(docs.examples, true, undefined, context)
                exmpl = await getMathMarkdown(exmpl, color, true)
                content.appendMarkdown("### Examples: \n")
                content.appendMarkdown(exmpl + '\n')
            }
            if (docs.description && hover_conf.Detail == 'Complete') {
                let full_desc: string = fix_img_path(docs.description, true, undefined, context)
                full_desc = await getMathMarkdown(full_desc, color, true)
                content.appendMarkdown("### Description: \n")
                content.appendMarkdown(full_desc + "\n")
            }
            if (docs.restrictions && hover_conf.Restrictions) {
                content.appendMarkdown("### Restrictions: \n")
                content.appendMarkdown(docs.restrictions)
            }
            content.isTrusted = true;
            return new Hover(content)
        }
    }
}
