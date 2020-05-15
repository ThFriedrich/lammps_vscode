"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mj = require('mathjax-node');
const lf = "  \n  ";
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
});
mj.start();
function scaleSVG(data, scale) {
    const svgelm = data.svgNode;
    // w0[2] and h0[2] are units, i.e., pt, ex, em, ...
    const w0 = svgelm.getAttribute('width').match(/([.\d]+)(\w*)/);
    const h0 = svgelm.getAttribute('height').match(/([.\d]+)(\w*)/);
    const w = scale * Number(w0[1]);
    const h = scale * Number(h0[1]);
    svgelm.setAttribute('width', w + w0[2]);
    svgelm.setAttribute('height', h + h0[2]);
}
function colorSVG(svg, color) {
    const ret = svg.replace('</title>', `</title><style> * { color: ${color} }</style>`);
    return ret;
}
function svgToDataUrl(xml) {
    const svg64 = Buffer.from(unescape(encodeURIComponent(xml)), 'binary').toString('base64');
    const b64Start = 'data:image/svg+xml;base64,';
    return b64Start + svg64;
}
function typeset(arg, scale) {
    return __awaiter(this, void 0, void 0, function* () {
        // const test_str:string = '\\begin{split}F_i^u & = \\sum_t^{N_t}\\alpha_t \\cdot \\exp\\left[-\\frac{\\left(d_{i,t}^u\\right)^2}{2l^2}\\right] \\\\ d_{i,t}^u & = \\left|\\left| V_i^u(\\eta) - V_t^u(\\eta) \\right|\\right| \\\\ V_i^u(\\eta) & = \\sum_{j \\neq i}\\frac{r^u_{ij}}{r_{ij}} \\cdot e^{-\\left(\\frac{r_{ij}}{\\eta} \\right)^2} \\cdot f_d\\left(r_{ij}\\right) \\\\ f_d\\left(r_{ij}\\right) & = \\frac{1}{2} \\left[\\cos\\left(\\frac{\\pi r_{ij}}{R_c}\\right) + 1 \\right]\\end{split}'
        const data = yield mj.typeset({
            math: arg,
            format: "TeX",
            svgNode: true
        });
        scaleSVG(data, scale);
        const xml = colorSVG(data.svgNode.outerHTML, "#133333");
        const md = svgToDataUrl(xml);
        return `![equation](${md})`;
    });
}
function mdBeautify(str) {
    return str
        .replace(RegExp('\\n(?=\\!\\[equation\\])', 'g'), lf); // Keep Line Breaks placed before Inline Equations 
    // .replace(RegExp('(?<=\\:)\\n+', 'g'), lf)               // Enforce Line Break after ":\n" (typically a List following)
    // .replace(RegExp('\\n\\n+', 'g'), lf)                    // Enforce Line Break after "\n\n..." (Section break)
    // .replace(RegExp('(?<!  )\\n(?!=  )','g')," ")           // Remove all other Line Breaks
}
exports.mdBeautify = mdBeautify;
function getMathMarkdown(txt) {
    return __awaiter(this, void 0, void 0, function* () {
        let strOut = "";
        // RegExp to match block equations and split text into blocks of Text or Equations
        const eqPat = RegExp('(\\\\\\[[\\r\\s\\S]*?\\\\\\])', 'g');
        const txtSplit = txt.split(eqPat);
        for (let ix = 0; ix < txtSplit.length; ix++) {
            if (txtSplit[ix].search(eqPat) != -1) {
                strOut += lf + (yield typeset(txtSplit[ix].replace(RegExp('\\\\(\\[|\\])', 'g'), ""), 1)) + lf;
            }
            else {
                // Check for Inline Math in standard Text Block
                // RegExp to match Inline Equations and Symbols
                const inlinePat = RegExp('(\\\\\\([\\r\\s\\S]*?\\\\\\))', 'g');
                const txtSubSplit = txtSplit[ix].split(inlinePat);
                for (let iz = 0; iz < txtSubSplit.length; iz++) {
                    if (txtSubSplit[iz].search(inlinePat) != -1) {
                        strOut += yield typeset(txtSubSplit[iz].replace(RegExp('\\\\(\\(|\\))', 'g'), ""), 0.72);
                    }
                    else {
                        strOut += txtSubSplit[iz];
                    }
                }
            }
        }
        return strOut;
    });
}
exports.getMathMarkdown = getMathMarkdown;
//# sourceMappingURL=math_render.js.map