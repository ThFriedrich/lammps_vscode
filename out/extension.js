"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const doc_fcns_1 = require("./doc_fcns");
const lmps_lint_1 = require("./lmps_lint");
const math_render_1 = require("./math_render");
const theme_1 = require("./theme");
const vscode = __importStar(require("vscode"));
function activate(context) {
    // Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('extension.show_docs', () => {
        const web_uri = vscode.Uri.parse("https://lammps.sandia.gov/doc/Manual.html");
        vscode.env.openExternal(web_uri);
    }));
    // Register Hover Provider
    context.subscriptions.push(vscode.languages.registerHoverProvider("lmps", {
        provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position, RegExp('[\\w\\/]+(?:[\\t\\s]+[^\#\\s\\t]+)*'));
            const words = document.getText(range);
            return createHover(words);
        }
    }));
    // Register Completions Provider
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider("lmps", {
        provideCompletionItems(document, position, token, context) {
            return __awaiter(this, void 0, void 0, function* () {
                const autoConf = vscode.workspace.getConfiguration('lammps.AutoComplete');
                let compl_str = yield doc_fcns_1.getCompletionList(autoConf);
                return compl_str;
            });
        }
    }));
    // Provide Diagnostics on Open, Save and Text-Changed-Event
    const collection = vscode.languages.createDiagnosticCollection('lmps');
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId == 'lmps') {
            updateDiagnostics(doc, collection);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.languageId == 'lmps') {
            updateDiagnostics(doc, collection);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(editor => {
        const c_str = editor.contentChanges[0].text;
        // Check only when a word was typed out comletely
        const b_trig = c_str.search(RegExp('[\\n\\s#]')) != -1;
        if (b_trig) {
            updateDiagnostics(editor.document, collection);
        }
    }));
}
exports.activate = activate;
function getDocumentation(snippet) {
    const sub_com = snippet.split(RegExp('[\\t\\s]+'));
    // Captures commands with 2 Arguments between 2 Keywords
    let docs = doc_fcns_1.getCommand(sub_com[0] + ' ' + sub_com[3]);
    if (docs) {
        return docs;
    }
    else {
        // Captures AtC commands with 3 Keywords like "fix_modify AtC control localized_lambda"
        docs = doc_fcns_1.getCommand(sub_com[0] + ' AtC ' + sub_com[2] + ' ' + sub_com[3]);
        if (docs) {
            return docs;
        }
        else {
            // Captures AtC commands with 2 Keywords like like "fix_modify AtC output"
            docs = doc_fcns_1.getCommand(sub_com[0] + ' AtC ' + sub_com[2]);
            if (docs) {
                return docs;
            }
            else {
                // Captures commands with 1 Arguments between 2 Keywords
                docs = doc_fcns_1.getCommand(sub_com[0] + ' ' + sub_com[2]);
                if (docs) {
                    return docs;
                }
                else {
                    // Captures commands with 2 Arguments
                    docs = doc_fcns_1.getCommand(sub_com[0] + ' ' + sub_com[1]);
                    if (docs) {
                        return docs;
                    }
                    else {
                        // Captures commands with 1 Argument
                        docs = doc_fcns_1.getCommand(sub_com[0]);
                        if (docs) {
                            return docs;
                        }
                        else {
                            return undefined;
                        }
                    }
                }
            }
        }
    }
}
function createHover(snippet) {
    return __awaiter(this, void 0, void 0, function* () {
        const hover_conf = vscode.workspace.getConfiguration('lammps.Hover');
        if (hover_conf.Enabled) {
            const color = theme_1.getColor();
            const docs = getDocumentation(snippet);
            if (docs) {
                // Constructing the Markdown String to show in the Hover window
                const content = new vscode.MarkdownString("", true);
                if (docs === null || docs === void 0 ? void 0 : docs.short_description) {
                    content.appendMarkdown((yield math_render_1.getMathMarkdown(docs.short_description, color)) + ". [Read more... ](https://lammps.sandia.gov/doc/" + (docs === null || docs === void 0 ? void 0 : docs.html_filename) + ")\n");
                    content.appendMarkdown("\n --- \n");
                }
                if (docs === null || docs === void 0 ? void 0 : docs.syntax) {
                    content.appendMarkdown("### Syntax: \n");
                    content.appendCodeblock(docs === null || docs === void 0 ? void 0 : docs.syntax, "lmps");
                    content.appendMarkdown((yield math_render_1.getMathMarkdown(docs === null || docs === void 0 ? void 0 : docs.parameters, color)) + "\n\n");
                }
                if ((docs === null || docs === void 0 ? void 0 : docs.examples) && hover_conf.Examples) {
                    content.appendMarkdown("### Examples: \n");
                    content.appendCodeblock(docs === null || docs === void 0 ? void 0 : docs.examples, "lmps");
                }
                if ((docs === null || docs === void 0 ? void 0 : docs.description) && hover_conf.Detail == 'Complete') {
                    content.appendMarkdown("### Description: \n");
                    content.appendMarkdown(math_render_1.mdBeautify(yield math_render_1.getMathMarkdown(docs.description, color)) + "\n");
                }
                if ((docs === null || docs === void 0 ? void 0 : docs.restrictions) && hover_conf.Restrictions) {
                    content.appendMarkdown("### Restrictions: \n");
                    content.appendMarkdown(math_render_1.mdBeautify(docs === null || docs === void 0 ? void 0 : docs.restrictions));
                }
                return new vscode.Hover(content);
            }
        }
    });
}
function updateDiagnostics(document, collection) {
    if (document) {
        let errors = [];
        for (let line_idx = 0; line_idx < document.lineCount; line_idx++) {
            // check lines with a set of functions, which append Diagnostic entries to the errors array
            errors = lmps_lint_1.checFilePaths(document, line_idx, errors);
        }
        collection.set(document.uri, errors);
    }
    else {
        collection.clear();
    }
}
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map