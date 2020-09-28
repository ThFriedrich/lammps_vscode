import { readFileSync, readFile } from 'fs'
import path from 'path';
import { ExtensionContext } from 'vscode'
import * as vsctm from 'vscode-textmate'
const plist = require('plist');
const oniguruma = require('vscode-oniguruma')

/**
 * Read a json file and convert to plist as a promise
 */
function readJSON2plist(path: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		readFile(path, (error, data) => {
			if (error) {
				reject(error)
			} else {
				const js_g = data.toString()
				const pl_g = plist.build(JSON.parse(js_g))
				resolve(pl_g)
			}
		}
		);
	})
}

export async function get_markdown_it(context: ExtensionContext) {
	try {

		const wasm = readFileSync(path.join(context.extensionPath, 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm')).buffer;
		oniguruma.loadWASM(wasm);
		const registry = new vsctm.Registry({
			onigLib: Promise.resolve({
				createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
				createOnigString: (str) => new oniguruma.OnigString(str)
			}),
			loadGrammar: () => {
				return readJSON2plist(path.join(context.extensionPath, 'syntaxes', 'lmps.tmLanguage.json'))
					.then(data => {
						return vsctm.parseRawGrammar(data)
					}).catch(null)
			}
		});

		const grammar = await registry.loadGrammar('source.lmps')

		const md = require('markdown-it')(
			{
				html: true,
				linkify: true,
				typographer: true,
				langPrefix: '',
				highlight: function (str: string, lang: string) {
					if (grammar && lang && lang == 'lmps') {
						return tokenize_lmps(str, grammar)
					}
				}
			});
		return md
	} catch (error) {
		const md = require('markdown-it')(
			{
				html: true,
				linkify: true,
				typographer: true,
				langPrefix: '',
			});
		return md
	}
}

let scopeStack: string[];

function tokenize_lmps(text: string, grammar: vsctm.IGrammar) {

	const lines = text.split(RegExp('\n'))

	let html = '<pre class="editor editor-colors">';
	for (let i = 0; i < lines.length; i++) {
		scopeStack = [];
		html += '<div class="line">';
		const line = lines[i];
		// TODO: Provide previous state
		const lineTokens = grammar.tokenizeLine(line, null)
		html += lineToken2html(lineTokens, line)
	}
	return html + '</pre>'
}

function lineToken2html(tokens: vsctm.ITokenizeLineResult, line: string) {
	let html = ''
	for (let l = 0, len1 = tokens.tokens.length; l < len1; l++) {
		let ref1 = tokens.tokens[l]
		let scopes = ref1.scopes;
		let value = line.substring(ref1.startIndex, ref1.endIndex)
		if (!value) {
			value = ' ';
		}
		html = updateScopeStack(scopeStack, scopes, html);
		html += "<span>" + (escapeString(value)) + "</span>";
	}
	html += '</div>';
	return html;
}

function updateScopeStack(scopeStack: string[], desiredScopes: string[], html: string) {
	let excessScopes, i, j, k, l, ref, ref1, ref2;
	excessScopes = scopeStack.length - desiredScopes.length;
	if (excessScopes > 0) {
		while (excessScopes--) {
			html = popScope(scopeStack, html);
		}
	}
	for (i = k = ref = scopeStack.length; ref <= 0 ? k <= 0 : k >= 0; i = ref <= 0 ? ++k : --k) {
		if (JSON.stringify(scopeStack.slice(0, i)) === JSON.stringify(desiredScopes.slice(0, i))) {
			break;
		}
		html = popScope(scopeStack, html);
	}
	for (j = l = ref1 = i, ref2 = desiredScopes.length; ref1 <= ref2 ? l < ref2 : l > ref2; j = ref1 <= ref2 ? ++l : --l) {
		html = pushScope(scopeStack, desiredScopes[j], html);
	}
	return html;
};

function pushScope(scopeStack: string[], scope: string, html: string) {
	let className;
	scopeStack.push(scope);
	if (scope) {
		className = scope.replace(/\.+/g, " ");
		return html += "<span class=\"" + className + "\">";
	} else {
		return html += "<span>";
	}
};

function popScope(scopeStack: string[], html: string) {
	scopeStack.pop();
	return html += '</span>';
};

function escapeString(str: string) {
	return str.replace(/[&"'<> ]/g, function (match) {
		switch (match) {
			case '&':
				return '&amp;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case ' ':
				return '&nbsp;';
			default:
				return match;
		}
	});
};


// Substantial parts of this code were copied and/or adapted from the highlights package:
// https://github.com/atom/highlights
// under an MIT License:

/*
Copyright (c) 2014 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */