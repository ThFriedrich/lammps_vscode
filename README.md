# lammps_vscode README

This extension for Visual Studio Code provides language support for LAMMPS (Molecular dynamics Software) Scripts.

## Features

### Syntax/Keyword Highlighting 
![Syntax Highlighting](imgs/lammps-lng-anim.gif)

- Syntax Highlighting for Keywords, Variables and Data Types
- Keyword list up to date with the Lammps documentation as of Juli 2020
- Keyword Highlighting for LIGGGHTS(R)-PUBLIC scripts supported
- Folding possible between Markers #[ and #]
- Recognizes .lmp, .lmps and .lammps file extensions and files beginning with "in."
---
### Embedded Offline Documentation 
![Embedded Offline Documentation](imgs/doc_panel.gif)

- Right click on a command allows to open a documentation page inside vscode

---
### Autocompletion
![Autocompletion](imgs/autocomplete.gif)

- Completion suggestions with corresponding informations are displayed
- Functionality can be turned off
- Different information-display options possible 
---
### Hover information
![Hover](imgs/hover.gif)

- Information about Lammps commands are displayed when hovering over them
- Appearance of the hover panel is customisable
---
### Linting (in progress)
![Lint](imgs/lint.gif)

- Set of functions that points out problems before runtime
- So far only checking for files and paths on read- and write commands
- To be extended in the future
---
Please report [issues](https://github.com/ThFriedrich/lammps_vscode/issues) and feel free to [contribute](https://github.com/ThFriedrich/lammps_vscode).

