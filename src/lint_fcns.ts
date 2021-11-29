import { Diagnostic, DiagnosticSeverity, TextDocument, Range, DiagnosticCollection, workspace } from 'vscode'
import { dirname, join, isAbsolute } from 'path'
import { searchCommands, getArgIndex } from "./doc_fcns";
import { existsSync } from 'fs'

//////////////////////////////////////
// document checks/Linter functions //
//////////////////////////////////////


export function updateDiagnostics(document: TextDocument, collection: DiagnosticCollection): void {
	if (document) {
		let errors: Diagnostic[] = []
		for (let line_idx = 0; line_idx < document.lineCount; line_idx++) {
			// check lines with a set of functions, which append Diagnostic entries to the errors array
			errors = checkFilePaths(document, line_idx, errors)
		}
		collection.set(document.uri, errors)
	} else {
		collection.clear();
	}
}

/**
* This function checks wheter a file given as input for 
* a read-command actually exists.
*/
export function checkFilePaths(document: TextDocument, line_index: number, errors: Diagnostic[]):Diagnostic[] {

    const line_str = document.lineAt(line_index).text
    let error: Diagnostic|undefined
    const read_commands = searchCommands(RegExp('(?<=^|\\s|_)(read)(?=$|\\s|_)'))
    let com_struct = getCommandArgs(line_str, read_commands)

    // Check for read and write commands
    if (com_struct.command) {
        const fileArg_idx = getArgIndex(com_struct.command, RegExp('\\b(file|filename)\\b'))
        error = checkPath(document, line_str, line_index, com_struct, fileArg_idx, 'file')
    } else {
        const write_commands = searchCommands(RegExp('(?<=^|\\s|_)(write)(?=$|\\s|_)'))
        com_struct = getCommandArgs(line_str, write_commands)
        if (com_struct.command) {
            const fileArg_idx = getArgIndex(com_struct.command, RegExp('\\b(file|filename)\\b'))
            error = checkPath(document, line_str, line_index, com_struct, fileArg_idx, 'dir')
        }
    }
    if (error) {
        errors.push(error);
    }
    return errors
}

//////////////////////////////////////
// Bunch of little helper functions //
// that all operate in the TextDoc- //
// ument context.                   //
//////////////////////////////////////

/**
* Type definition for command-arguments 
* structure
*/
type commandStruct = {
    command: string,
    args: string[]
}

/**
* This function takes a line of the textfiles and checks 
* if one of the given commands is contained in the line.
* If the command is found a commandStruct object is returned, 
* containing the command name and an array of arguments
*/
function getCommandArgs(line: string, command: string[]):commandStruct {
    //Remove comments from the line
    if (line.includes('#')) {
        line = line.substr(0, line.indexOf('#'))
    }
    //Split line into array of strings without whitespaces, filter empty elemets
    let line_arr = line.split(RegExp('\\s+')).filter(function (e) { return e })

    // Initialize empty commandStruct variable
    const com_struct = <commandStruct>{}

    // Check the words for each provided command
    command.forEach(c => {
        const c_str: string | undefined = line_arr.find(e => e == c)
        if (c_str) {
            for (let index = 0; index < line_arr.length; index++) {
                if (index == 0) {
                    com_struct.command = c_str
                    com_struct.args = []
                } else {
                    com_struct.args.push(line_arr[index])
                }
            }
        }
    })
    return com_struct
}

/**
* Returns the range of a given string 
* within a given line of the document.
* Similar to getWordRangeAtPosition 
* from vscode api
*/
function getRange(line_str: string, line_idx: number, argument: string):Range {
    const arg_pos: number = line_str.indexOf(argument)
    return new Range(line_idx, arg_pos, line_idx, arg_pos + argument.length)
}

/**
* Returns the absolute path of the 
* directory a given TextDocument is in
*/
function getDocDir(document: TextDocument):string {
    let cwd = document.uri.fsPath;
    if (cwd) {
        cwd = dirname(cwd);
    }
    return cwd
}

/**
* Returns the absolute path of the 
* current working directory
*/
function getCWD(document: TextDocument): string | undefined {
    return workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
}

/**
* Returns a boolean, indicating wether 
* a given file exists. Path can be absolute or 
* relative to the location of the TextDocument
*/
function fileExists(document: TextDocument, file_path: string):boolean {
    if (!isAbsolute(file_path)) {
        const docDir = getCWD(document);
        if (docDir) {
            file_path = join(docDir, file_path)
        } else {
            file_path = join(getDocDir(document), file_path)
        }
    }
    if (existsSync(file_path)) {
        return true
    } else {
        return false
    }
}

/**
* Returns a boolean, indicating wether 
* a given directory exists. Path can be absolute or 
* relative to the location of the TextDocument
*/
function dirExists(document: TextDocument, file_path: string):boolean {
    if (!isAbsolute(file_path)) {
        const docDir = getCWD(document);
        if (docDir) {
            file_path = join(docDir, file_path)
        } else {
            file_path = join(getDocDir(document), file_path)
        }
    }
    if (existsSync(dirname(file_path))) {
        return true
    } else {
        return false
    }
}

/**
* Checks for the existence of a given file or directory
* and returns a Diagnostic entry if it doesn't exist
*/
function checkPath(document: TextDocument, line_str:string, line_index: number, com_struct: commandStruct, fileArg_idx: number, checkType: 'dir' | 'file'):Diagnostic|undefined {

    // Initialize Diagnostic Variables
    let rng:Range|undefined = undefined
    let msg:string|undefined = undefined

    if (com_struct.args.length >= fileArg_idx) { // path specified/argument provided?
        const file_path: string = com_struct.args[fileArg_idx - 1].replace(/['"]+/g, '')
        
        switch (checkType) { // Check wether directory/file exists
            case 'dir':
                if (!dirExists(document, file_path)) { // Directory doesn't exist
                    rng = getRange(line_str, line_index, file_path)
                    msg = `The directory ${dirname(file_path)} does not exist`
                }
                break;
            case 'file':
                if (!fileExists(document, file_path)) { // File doesn't exist
                    rng = getRange(line_str, line_index, file_path)
                    msg = `The file ${file_path} does not exist`
                }
                break;
            default:
                break;
        }

    } else { // no path given!
        rng = getRange(line_str, line_index, com_struct.command)
        msg = `The command ${com_struct.command} requires an argument at position ${fileArg_idx} speciying the file to read from or write to`
    }

    if (msg && rng) { // Error detected, otherwise returns undefined
        return {
            message: msg,
            range: rng,
            severity: DiagnosticSeverity.Error
        }
    }
}