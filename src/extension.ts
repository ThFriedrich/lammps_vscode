// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

vscode.languages.registerHoverProvider("lmps", {
	provideHover(document, position) {
		const range = document.getWordRangeAtPosition(position)
		const word = document.getText(range)
		return createHover(word)
	}
})

function get_documentation(snippet){
	return {
		"syntax":"```dump ID group-ID style N file args```",
		"examples": "- dump myDump all atom 100 dump.atom  \n- dump myDump all atom/ mpiio 100  \n- dump.atom.mpiio  \n- dump myDump all atom / gz 100 dump.atom.gz  \n- dump 2 subgroup atom 50 dump.run.bin  \n- dump 2 subgroup atom 50 dump.run.mpiio.bin  \n- dump 4a all custom 100 dump.myforce.* id type x y vx fx  \n- dump 4b flow custom 100 dump.%.myforce id type c_myF[3] v_ke  \n- dump 4b flow custom 100 dump.%.myforce id type c_myF[\*] v_ke\n- dump 2 inner cfg 10 dump.snap.*.cfg mass type xs ys zs vx vy vz\n- dump snap all cfg 100 dump.config.*.cfg mass type xs ys zs id type c_Stress[2]\n- dump 1 all xtc 1000 file.xtc\n",
			}
}

function createHover(snippet) {
	const example =
		typeof snippet.example == 'undefined' ? '' : snippet.example
	const description =
		typeof snippet.description == 'undefined' ? '' : snippet.description
	const docs = get_documentation(snippet)
	const content = new vscode.MarkdownString("**Syntax** :  \n" + docs.syntax + "\n\n**Examples** :  \n" + docs.examples, true)
	return new vscode.Hover(content)
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.msg', () => {
		// Display a message box to the user
		vscode.window.showInformationMessage('Lammps Syntax Highlighting enabled.');
	});
	
	context.subscriptions.push(disposable);
}
// this method is called when your extension is deactivated
export function deactivate() {}
