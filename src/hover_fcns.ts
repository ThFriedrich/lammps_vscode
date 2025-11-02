import { TextDocument, Position, Hover, WorkspaceConfiguration, workspace, MarkdownString, ExtensionContext, Uri } from 'vscode'
import { doc_entry, getColor, fix_img_path } from './doc_fcns'
import { getMathMarkdown } from './render_fcns'

export function getRangeFromPosition(document: TextDocument, position: Position): string {
    // eslint-disable-next-line no-useless-escape
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
            content.supportHtml = true;
            content.isTrusted = true;
            
            // Build the complete content string first
            let fullContent = "";
            
            if (docs.short_description) {
                const show_doc_uri = Uri.parse(`command:extension.show_docs`);
                let short_desc: string = fix_img_path(docs.short_description, false, undefined, context)
                short_desc = await getMathMarkdown(short_desc, color, true)
                fullContent += short_desc + `. [Read more... ]( ${show_doc_uri} ) \n\n --- \n`;
            }
            if (docs.syntax) {
                fullContent += "### Syntax: \n";
                fullContent += "```lmps\n" + docs.syntax.join('\n') + "\n```\n";
                let params = await getMathMarkdown(docs.parameters, color, true)
                fullContent += params + "\n\n";
            }
            if (docs.examples && hover_conf.Examples) {
                let exmpl: string = fix_img_path(docs.examples, true, undefined, context)
                exmpl = await getMathMarkdown(exmpl, color, true)
                fullContent += "### Examples: \n" + exmpl + '\n';
            }
            if (docs.description && hover_conf.Detail == 'Complete') {
                let full_desc: string = fix_img_path(docs.description, true, undefined, context)
                full_desc = await getMathMarkdown(full_desc, color, true)
                fullContent += "### Description: \n" + full_desc + "\n";
            }
            if (docs.restrictions && hover_conf.Restrictions) {
                fullContent += "### Restrictions: \n" + docs.restrictions;
            }
            
            // Now apply SVG filtering to the entire combined content
            const MAX_TOTAL_LENGTH = 100000; // 100KB total size limit
            
            if (fullContent.length > MAX_TOTAL_LENGTH) {
                // String is too large - need to remove largest SVGs until it fits
                const imgPattern = /<img\s+src="(data:image\/svg\+xml[^"]*)"[^>]*>/g;
                
                // Collect all SVG images with their sizes
                const svgImages: Array<{match: string, dataUrl: string, size: number, isDisplay: boolean}> = [];
                let match;
                
                while ((match = imgPattern.exec(fullContent)) !== null) {
                    svgImages.push({
                        match: match[0],
                        dataUrl: match[1],
                        size: match[1].length,
                        isDisplay: match[0].includes('display:block')
                    });
                }
                
                // Sort by size (largest first)
                svgImages.sort((a, b) => b.size - a.size);
                
                // Replace largest SVGs with placeholders until total size is acceptable
                for (const svg of svgImages) {
                    if (fullContent.length <= MAX_TOTAL_LENGTH) {
                        break; // Size is now acceptable
                    }
                    
                    const placeholder = svg.isDisplay 
                        ? '\n\n*[Equation too complex for hover preview]*\n\n'
                        : '*[Equation too complex]*';
                    
                    fullContent = fullContent.replace(svg.match, placeholder);
                }
            }
            
            // Add the filtered content to the MarkdownString
            content.appendMarkdown(fullContent);
            
            return new Hover(content)
        }
    }
}
