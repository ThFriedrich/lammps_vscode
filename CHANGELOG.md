# Change Log

All notable changes to the "lammps_vscode" extension will be documented in this file.

## Initial release 20.10.2019
- Synatx highlighting for keywords, Variables, Comments, Strings and numeric data types
- Folding of sections possible between #[ and #] marks
- Keyword list up to date with Lammps documentation
- Recognizes .lmp, .lmps and .lammps file extensions

## Version 1.1.0 28.01.2020
 - Keyword support for LIGGGHTS(R)-PUBLIC scripts added as suggested in [Issue #1](https://github.com/ThFriedrich/lammps_vscode/issues/1)
 - Fixed wrong name for multiple-character variable pattern

## Version 1.2.0 15.04.2020
 - Keyword group `fix_modify` added
 - Simplified/fixed regex for keyword capturing
 - Implemented Hover feature 
 - Implemented Autocompletion feature
 - Added Command "Open Lammps Documentation" and documentation links
 - Added configurations in Settings
 - Refer to [Issue #2](https://github.com/ThFriedrich/lammps_vscode/issues/2) for details

## Version 1.2.2 17.04.2020
 - Grammar 
    - support for arithmetic functions, immediate variables and operators
    - recognition of line continuation
    - strings escape paramters
    - several bug fixes
 - Snippets functionality with few examples added as shown in [Issue #9](https://github.com/ThFriedrich/lammps_vscode/issues/9)

## Version 1.2.3 18.04.2020
 - Updated keyword list
 - All commands sharing one documentation page captured by hover and autocomplete
 - Added options to disable hover and autocomplete
 - Added double quaotes to auto-closing-surrounding-pairs

 ## Version 1.2.4 19.04.2020
  - Bugfixes
  - Add Logo to package
