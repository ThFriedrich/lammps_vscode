/* The MIT License (MIT)

Copyright (c) 2016 James Yu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. 

<<<Much of the code in this file was copied and adapted from https://github.com/James-Yu/LaTeX-Workshop>>>
*/

// Import MathJax components at the top level
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/AllPackages.js';

// Initialize MathJax components
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const texInput = new TeX({
    packages: { '[+]': ['ams', 'base', 'newcommand', 'configmacros', 'color', 'noerrors', 'noundefined', 'mathtools'] }
});
const svgOutput = new SVG({ fontCache: 'local' });
const htmlConverter = mathjax.document('', { InputJax: texInput, OutputJax: svgOutput });

console.log('MathJax initialized at module load');

const lf:string = "  \n  "

function scaleSVG(svgString: string, scale: number): string {
    // Parse width and height from SVG string
    const widthMatch = svgString.match(/width="([.\d]+)(\w*)"/);
    const heightMatch = svgString.match(/height="([.\d]+)(\w*)"/);
    
    if (widthMatch && heightMatch) {
        const w = scale * Number(widthMatch[1]);
        const h = scale * Number(heightMatch[1]);
        const wUnit = widthMatch[2] || 'ex';
        const hUnit = heightMatch[2] || 'ex';
        
        svgString = svgString.replace(/width="[.\d]+\w*"/, `width="${w}${wUnit}"`);
        svgString = svgString.replace(/height="[.\d]+\w*"/, `height="${h}${hUnit}"`);
    }
    
    return svgString;
}

function colorSVG(svg: string, color: string): string {
    // Insert style into the SVG properly
    // Look for the closing > of the opening <svg> tag and insert style after it
    const match = svg.match(/(<svg[^>]*>)/);
    if (match) {
        const svgOpenTag = match[1];
        const styleTag = `<style>* { fill: ${color}; }</style>`;
        return svg.replace(svgOpenTag, svgOpenTag + styleTag);
    }
    return svg;
}

function svgToDataUrl(xml: string): string {
    const svg64 = Buffer.from(unescape(encodeURIComponent(xml)), 'binary').toString('base64')
    const b64Start = 'data:image/svg+xml;base64,'
    return b64Start + svg64
}

async function typeset(arg: string, scale: number, color: string, isDisplay: boolean, b_md: boolean): Promise<string> {
    // Convert LaTeX to SVG using mathjax-full
    const convertOption = {
        display: isDisplay,
        em: 18,
        ex: 9,
        containerWidth: 80 * 18
    };
    const node = htmlConverter.convert(arg, convertOption);
    
    // Extract SVG string
    let svg = adaptor.innerHTML(node);
    
    if (b_md) {
        // For markdown (hover), encode as data URL for image embedding
        const scaledSvg = scaleSVG(svg, scale);
        const coloredSvg = colorSVG(scaledSvg, color);
        const dataUrl = svgToDataUrl(coloredSvg);
        
        // Use markdown image syntax without alt text to avoid showing "equation"
        if (isDisplay) {
            // Block math - center the image and set height in em (scale applies)
            return `<div style="text-align:center;"><img src=\"${dataUrl}\" style=\"height:${scale}em; display:block; margin:0.4em auto;\"/></div>`;
        } else {
            // Inline math - use an <img> with em-based height and a small negative vertical-align
            // to better match the text baseline. The value -0.15em is a good starting point.
            return `<img src=\"${dataUrl}\" style=\"height:${scale}em; vertical-align:-0.15em; display:inline-block;\"/>`;
        }
    } else {
        return svg;
    }
}


export async function getMathMarkdown(txt: string, color:string, b_md:boolean): Promise<string> {
    
    let strOut: string = ""
    // RegExp to match block equations and split text into blocks of Text or Equations
    const eqPat: RegExp = RegExp('(\\\\\\[[\\r\\s\\S]*?\\\\\\])', 'g')
    const txtSplit = txt.split(eqPat)

    for (let ix = 0; ix < txtSplit.length; ix++) {
        if (txtSplit[ix].search(eqPat) != -1) {
            // Display math (block equations) - isDisplay = true
            strOut += lf + await typeset(txtSplit[ix].replace(RegExp('\\\\(\\[|\\])', 'g'), ""), 1, color, true, b_md) + lf
        } else {
            // Check for Inline Math in standard Text Block
            // RegExp to match Inline Equations and Symbols
            const inlinePat: RegExp = RegExp('(\\\\\\([\\r\\s\\S]*?\\\\\\))', 'g')
            const txtSubSplit = txtSplit[ix].split(inlinePat)
            for (let iz = 0; iz < txtSubSplit.length; iz++) {
                if (txtSubSplit[iz].search(inlinePat) != -1) {
                    // Inline math - isDisplay = false
                    strOut += await typeset(txtSubSplit[iz].replace(RegExp('\\\\(\\(|\\))', 'g'), ""), 0.75, color, false, b_md)
                } else {
                    strOut += txtSubSplit[iz]
                }
            }
        }
    }
    return strOut
}