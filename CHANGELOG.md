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

## Version 1.3.0-beta 02.07.2020
 - Auto Completion
    - Completion suggestions now behave much like snippets. Editable arguments are accessed by tabbing (<kbd>Tab</kbd>) through them. Variables can be edited like text. Arguments that allow specific choices should show a dropdown list with options to choose from. Words that are part of the command description are automatically inserted.
 - Hover Feature
    - Rendering Equations is now supported using MathJax
    - Fixed many styling issues
 - Offline embedded documentation
    - right click on command allows to show documentation in new vscode-panel
 - Linting functions
    - Set of functions that points out problems before runtime
    - So far only checking for files and paths on read- and write commands
    - To be extended in the future
 - Grammar
    - Keywords updated 

## Version 1.3.0 08.08.2020
 - CI for Synchronisation with the Lammps documentation, Github publishing and automatic Marketplace publishing 
 - All patch releases from now on are automated synchronisation releases unless further changes are specified

## Version 1.3.2 14.08.2020
 - Scheduled synchronisation of lammps_vscode with Lammps documentation

## Version 1.4.0 03.09.2020
 - Synchronisation of lammps_vscode with Lammps documentation
 - Task Provider 
   - Lammps can now be run as a task from within vscode
   - Settings added for: 
      - __binary__: path to the Lammps executable
      - __mpi_tasks__: # of MPI tasks to run for parallel execution
      - __gpu_nodes__: # of GPU Nodes to use with the *gpu* package
   - Task type *"lmps"* provided to set up tasks manually in a *tasks.json* file 
 - Hover Feature
   - Documentation links in hover boxes now open the embedded documentation pages inside vscode instead of pointing to the weblink
   - Package now bundles all images with versions in width=256px, used by the Hover only
 - Auto Completion
   - Documentation links in autocomplete-info boxes now open the embedded documentation pages inside vscode instead of pointing to the weblink
   - Autocomplete suggestions are now only triggered at the beginning of lines
 - Grammar
   - Keywords updated 
   - Updates to Grammar rules to avoid some false positives 
 - Offline embedded documentation
   - Improved layout of "Note" and "Warning" sections
   - fix missing rst-file includes 
   - fixed several formatting issues
   - added Syntax highlighting support through vscode-textmate and markdown-it.
   - added standard light/dark css-files to control syntax highlighting in the webview. (because Token-Colors are not exposed through vscode API yet)
 - Dependencies added:
   - markdown-it
   - plist
   - request
   - vscode-oniguruma
   - vscode-textmate
  
## Version 1.4.1 14.09.2020
 - Offline embedded documentation
   - Styling improvements for rendering of tables, generic text and *Note* blocks
   - Math rendering changed to html for webview, now allowing to use theme colors for equations in the documentation panel

## Version 1.4.11 16.07.2021
 - Linting
   - Added checks for unbalanced parenthesis
   - Added function to check for maximum number of group definitions

## Version 1.5.0 29.11.2021
 - Added **Lammps dashboard** (beta) as discussed in [Issue #19](https://github.com/ThFriedrich/lammps_vscode/issues/19)
   - Plotting of log file data
   - Plotting of atomic dump data
   - System Information display for Memory usage, CPU load and GPU load (Nvidia GPUs only)
   - Added Editor command 'Open Lammps Simulation Dashboard'
   - Added button to open dashboard in editor window
 - Added dependencies:
   - cpu-stats
   - markdown-it
   - node-nvidia-smi
   - node-os-utils
   - plotly.js-dist-min
   - acorn
 - Changed documentation source in official lammps repo from 'master' to 'release'

## Version 1.5.12 14.02.2023
 - Removed Github-Action to create Releases and archive them on GitHub. To rollback or install specific version the VSCODE UI should be used
 
## Version 1.6.0 18.07.2023
 - Update doc_obj generation scripts
   - Changed the way to split the rst into sections to improve stability
   - Added checks for minimal entries found (e.g. Syntax, Description, Examples)
   - Updated for new rst-directives (tabs, admonition, deprecated, only html, figure, versionadded)
   - several smaller bugfixes and formatting improvements
 - Added Outline as discussed in [Issue #52](https://github.com/ThFriedrich/lammps_vscode/issues/52)
 - Fixed linting issues [#51](https://github.com/ThFriedrich/lammps_vscode/issues/51), [#49](https://github.com/ThFriedrich/lammps_vscode/issues/49), [#39](https://github.com/ThFriedrich/lammps_vscode/issues/39)
 - several updated dependencies

 ## Version 1.7.0 18.09.2023
 - Improvements in Dashboard dump-view layout
   - Add scaling accounting for the bounding box size
   - Improve automatic resizing of dump-div 
 - Task provider
   - Add a dryrun Task [#11](https://github.com/ThFriedrich/lammps_vscode/issues/11), using the ['-skiprun' flag](https://docs.lammps.org/latest/Run_options.html#skiprun)
   - Add "args" to allow customisation of tasks [#41](https://github.com/ThFriedrich/lammps_vscode/issues/41)
   - Simplify task provider implementation

 ## Version 1.8.0 02.01.2024
 - Update of the documentation links [#56](https://github.com/ThFriedrich/lammps_vscode/pull/56)
 - Dashboard
   - Fixes of Dashboard view in Windows
   - Fix EOL-character issues when reading multiline dump- and log-files
 - Task provider
   - Rework of the 'resolve_task' funtion for better reliability
   - Include OMP-threads option
 - Packaging
   - Removed dev-dependency glob-types
   - Fixed Task provider definition
   - Add Logo for Lammps-input-script files in tree view, etc.

 ## Version 1.8.8 22.10.2024
 - Packaging
   - Various dependency updates as a consequence of moving to node 22
 - Linting
   - Disabled linting for log-files [#57](https://github.com/ThFriedrich/lammps_vscode/issues/57)

  ## Version 1.9.0 02.11.2025
  - Task provider
    - Implementation updated to support VSCode Task API changes
  - Dashboard
    - Performance improvements for dump viewer and logging
    - Added support for scaled coordinates (xs, ys, zs) in dump files
    - Added error handling for missing coordinate columns in dump files. Fixes [#63](https://github.com/ThFriedrich/lammps_vscode/issues/63) and [#62](https://github.com/ThFriedrich/lammps_vscode/issues/62)
    - Introduced live update toggles for log and dump data in the dashboard.
    - Implemented throttling for plot resizing on window resize events to improve performance.
    - Updated the logic for handling log and dump file updates, including file size tracking and handling file overwrites.
    - Refactored the get_update function to support both log and dump updates with improved error handling.
    - Added functionality to append new frames to existing dump plots dynamically.
    - Cleaned up event listeners and ensured they are attached only once to improve efficiency.
  - Documentation Panel
    - Enhanced HTML head generation: added dynamic font size and family retrieval from VS Code settings for improved styling in the document panel.
  - Packaging
    - Switch from MathJax-Node to MathJax-Full for rendering equations
    - Removed "request" dependency
    - Fix rendering of some equations in hover and documentation panel
    - Switched to '@quik-fe/node-nvidia-smi' for better compatibility with newer Node versions
    - Fixed all vulnerability issues reported by npm audit
  - Linting
    - Implemented unpacking of variables to avoid false positives in linting. Fixes [#58](https://github.com/ThFriedrich/lammps_vscode/issues/58) and [#68](https://github.com/ThFriedrich/lammps_vscode/issues/68)
   
