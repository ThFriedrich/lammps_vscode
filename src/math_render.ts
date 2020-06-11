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

const mj = require('mathjax-node')
const lf:string = "  \n  "

mj.config = ({
    MathJax: {
        jax: ['input/TeX', 'output/SVG'],
        extensions: ['tex2jax.js', 'MathZoom.js'],
        showMathMenu: false,
        showProcessingMessages: false,
        messageStyle: 'none',
        SVG: {
            useGlobalCache: false
        },
        TeX: {
            extensions: ['AMSmath.js', 'AMSsymbols.js', 'autoload-all.js', 'color.js', 'noUndefined.js']
        }
    }
})

mj.start()

function scaleSVG(data: any, scale: number) {
    const svgelm = data.svgNode
    // w0[2] and h0[2] are units, i.e., pt, ex, em, ...
    const w0 = svgelm.getAttribute('width').match(/([.\d]+)(\w*)/)
    const h0 = svgelm.getAttribute('height').match(/([.\d]+)(\w*)/)
    const w = scale * Number(w0[1])
    const h = scale * Number(h0[1])
    svgelm.setAttribute('width', w + w0[2])
    svgelm.setAttribute('height', h + h0[2])
}

function colorSVG(svg: string, color: string): string {
    const ret = svg.replace('</title>', `</title><style> * { color: ${color} }</style>`)
    return ret
}

function svgToDataUrl(xml: string): string {
    const svg64 = Buffer.from(unescape(encodeURIComponent(xml)), 'binary').toString('base64')
    const b64Start = 'data:image/svg+xml;base64,'
    return b64Start + svg64
}

async function typeset(arg: string, scale: number, color:string, format:string): Promise<string> {
    const data = await mj.typeset({
        math: arg,
        format: format,
        svgNode: true
    })
    scaleSVG(data, scale)
    const xml = colorSVG(data.svgNode.outerHTML, color)
    const md = svgToDataUrl(xml)
    return `![image](${md})`
}


export async function getMathMarkdown(txt: string, color:string): Promise<string> {
    
    let strOut: string = ""
    // RegExp to match block equations and split text into blocks of Text or Equations
    const eqPat: RegExp = RegExp('(\\\\\\[[\\r\\s\\S]*?\\\\\\])', 'g')
    const txtSplit = txt.split(eqPat)

    for (let ix = 0; ix < txtSplit.length; ix++) {
        if (txtSplit[ix].search(eqPat) != -1) {
            strOut += lf + await typeset(txtSplit[ix].replace(RegExp('\\\\(\\[|\\])', 'g'), ""), 1, color, "TeX") + lf
        } else {
            // Check for Inline Math in standard Text Block
            // RegExp to match Inline Equations and Symbols
            const inlinePat: RegExp = RegExp('(\\\\\\([\\r\\s\\S]*?\\\\\\))', 'g')
            const txtSubSplit = txtSplit[ix].split(inlinePat)
            for (let iz = 0; iz < txtSubSplit.length; iz++) {
                if (txtSubSplit[iz].search(inlinePat) != -1) {
                    strOut += await typeset(txtSubSplit[iz].replace(RegExp('\\\\(\\(|\\))', 'g'), ""), 0.75, color, "inline-TeX")
                } else {
                    strOut += txtSubSplit[iz]
                }
            }
        }
    }
    return strOut
}