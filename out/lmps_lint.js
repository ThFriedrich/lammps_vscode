"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFilePaths = void 0;
const vscode_1 = require("vscode");
const path_1 = require("path");
const doc_fcns_1 = require("./doc_fcns");
const fs_1 = require("fs");
//////////////////////////////////////
// document checks/Linter functions //
//////////////////////////////////////
/**
* This function checks wheter a file given as input for
* a read-command actually exists.
*/
function checkFilePaths(document, line_index, errors) {
    const line_str = document.lineAt(line_index).text;
    let error;
    const read_commands = doc_fcns_1.searchCommands(RegExp('(?<=^|\\s|_)(read)(?=$|\\s|_)'));
    let com_struct = getCommandArgs(line_str, read_commands);
    // Check for read and write commands
    if (com_struct.command) {
        const fileArg_idx = doc_fcns_1.getArgIndex(com_struct.command, RegExp('\\b(file|filename)\\b'));
        error = checkPath(document, line_str, line_index, com_struct, fileArg_idx, 'file');
    }
    else {
        const write_commands = doc_fcns_1.searchCommands(RegExp('(?<=^|\\s|_)(write)(?=$|\\s|_)'));
        com_struct = getCommandArgs(line_str, write_commands);
        if (com_struct.command) {
            const fileArg_idx = doc_fcns_1.getArgIndex(com_struct.command, RegExp('\\b(file|filename)\\b'));
            error = checkPath(document, line_str, line_index, com_struct, fileArg_idx, 'dir');
        }
    }
    if (error) {
        errors.push(error);
    }
    return errors;
}
exports.checkFilePaths = checkFilePaths;
/**
* This function takes a line of the textfiles and checks
* if one of the given commands is contained in the line.
* If the command is found a commandStruct object is returned,
* containing the command name and an array of arguments
*/
function getCommandArgs(line, command) {
    //Remove comments from the line
    if (line.includes('#')) {
        line = line.substr(0, line.indexOf('#'));
    }
    //Split line into array of strings without whitespaces, filter empty elemets
    let line_arr = line.split(RegExp('\\s+')).filter(function (e) { return e; });
    // Initialize empty commandStruct variable
    const com_struct = {};
    // Check the words for each provided command
    command.forEach(c => {
        const c_str = line_arr.find(e => e == c);
        if (c_str) {
            for (let index = 0; index < line_arr.length; index++) {
                if (index == 0) {
                    com_struct.command = c_str;
                    com_struct.args = [];
                }
                else {
                    com_struct.args.push(line_arr[index]);
                }
            }
        }
    });
    return com_struct;
}
/**
* Returns the range of a given string
* within a given line of the document.
* Similar to getWordRangeAtPosition
* from vscode api
*/
function getRange(line_str, line_idx, argument) {
    const arg_pos = line_str.search(argument);
    return new vscode_1.Range(line_idx, arg_pos, line_idx, arg_pos + argument.length);
}
/**
* Returns the absolute path of the
* directory a given TextDocument is in
*/
function getDocDir(document) {
    let cwd = document.uri.fsPath;
    if (cwd) {
        cwd = path_1.dirname(cwd);
    }
    return cwd;
}
/**
* Returns a boolean, indicating wether
* a given file exists. Path can be absolute or
* relative to the location of the TextDocument
*/
function fileExists(document, file_path) {
    if (!path_1.isAbsolute(file_path)) {
        const docDir = getDocDir(document);
        file_path = path_1.join(docDir, file_path);
    }
    if (fs_1.existsSync(file_path)) {
        return true;
    }
    else {
        return false;
    }
}
/**
* Returns a boolean, indicating wether
* a given directory exists. Path can be absolute or
* relative to the location of the TextDocument
*/
function dirExists(document, file_path) {
    if (!path_1.isAbsolute(file_path)) {
        const docDir = getDocDir(document);
        file_path = path_1.join(docDir, file_path);
    }
    if (fs_1.existsSync(path_1.dirname(file_path))) {
        return true;
    }
    else {
        return false;
    }
}
/**
* Checks for the existence of a given file or directory
* and returns a Diagnostic entry if it doesn't exist
*/
function checkPath(document, line_str, line_index, com_struct, fileArg_idx, checkType) {
    // Initialize Diagnostic Variables
    let rng = undefined;
    let msg = undefined;
    if (com_struct.args.length >= fileArg_idx) { // path specified/argument provided?
        const file_path = com_struct.args[fileArg_idx - 1];
        switch (checkType) { // Check wether directory/file exists
            case 'dir':
                if (!dirExists(document, file_path)) { // Directory doesn't exist
                    rng = getRange(line_str, line_index, file_path);
                    msg = `The directory ${path_1.dirname(file_path)} does not exist`;
                }
                break;
            case 'file':
                if (!fileExists(document, file_path)) { // File doesn't exist
                    rng = getRange(line_str, line_index, file_path);
                    msg = `The file ${file_path} does not exist`;
                }
                break;
            default:
                break;
        }
    }
    else { // no path given!
        rng = getRange(line_str, line_index, com_struct.command);
        msg = `The command ${com_struct.command} requires an argument at position ${fileArg_idx} speciying the file to read from or write to`;
    }
    if (msg && rng) { // Error detected, otherwise returns undefined
        return {
            message: msg,
            range: rng,
            severity: vscode_1.DiagnosticSeverity.Error
        };
    }
}
//# sourceMappingURL=lmps_lint.js.map