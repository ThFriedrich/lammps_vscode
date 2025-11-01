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

// Lazy-load MathJax v3 to avoid loading at extension startup
let mjInitialized = false;
let tex2svg: any = null;

function initMathJax() {
    if (!mjInitialized) {
        try {
            const { mathjax } = require('mathjax-full/js/mathjax.js');
            const { TeX } = require('mathjax-full/js/input/tex.js');
            const { SVG } = require('mathjax-full/js/output/svg.js');
            const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
            const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
            const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

            // Create an HTML adaptor and register it
            const adaptor = liteAdaptor();
            RegisterHTMLHandler(adaptor);

            // Create input and output processors
            const tex = new TeX({
                packages: AllPackages,
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']]
            });
            const svg = new SVG({ fontCache: 'none' });

            // Create a conversion function
            const html = mathjax.document('', { InputJax: tex, OutputJax: svg });
            
            tex2svg = (math: string, display: boolean = false) => {
                const node = html.convert(math, { display });
                return adaptor.innerHTML(node);
            };

            mjInitialized = true;
            console.log('MathJax v3 initialized successfully');
        } catch (error) {
            console.error('Failed to load MathJax:', error);
            throw error;
        }
    }
    return tex2svg;
}

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
    const converter = initMathJax();
    const svg = converter(arg, isDisplay);
    
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