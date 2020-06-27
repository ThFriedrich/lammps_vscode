import { TextDocument, Position, Hover, WorkspaceConfiguration, workspace, MarkdownString } from 'vscode'
import { doc_entry, getColor, fix_img_path } from './doc_fcns'
import { getMathMarkdown } from './math_render'

export function getRangeFromPosition(document: TextDocument, position: Position): string {
    const range = document.getWordRangeAtPosition(position, RegExp('[\\w\\/]+(?:[\\t\\s]+[^\#\\s\\t]+)*'))
    return document.getText(range)
}

export async function createHover(docs: doc_entry): Promise<Hover | undefined> {

    const hover_conf: WorkspaceConfiguration = workspace.getConfiguration('lammps.Hover')
    if (hover_conf.Enabled) {
        const color: string = getColor()

        if (docs) {
            // Constructing the Markdown String to show in the Hover window
            const content = new MarkdownString("", true)
            if (docs?.short_description) {
                let short_desc: string = fix_img_path(docs.short_description, false, undefined)
                short_desc = await getMathMarkdown(short_desc, color)
                content.appendMarkdown(short_desc + ". [Read more... ](https://lammps.sandia.gov/doc/" + docs?.html_filename + ")\n")
                content.appendMarkdown("\n --- \n")
            }
            if (docs?.syntax) {
                content.appendMarkdown("### Syntax: \n")
                content.appendCodeblock(docs?.syntax.join('\n'), "lmps")
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
            return new Hover(content)
        }
    }
}
