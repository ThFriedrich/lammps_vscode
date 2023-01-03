# Lammps language extension for vscode README


[![vsm-version](https://img.shields.io/visual-studio-marketplace/v/thfriedrich.lammps?style=flat&label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=thfriedrich.lammps)
[![vsm-installs](https://img.shields.io/visual-studio-marketplace/i/thfriedrich.lammps?style=flat&label=installs&logo=visual-studio-code&color=brightgreen)](https://marketplace.visualstudio.com/items?itemName=thfriedrich.lammps)
[![SYNC](https://github.com/ThFriedrich/lammps_vscode/actions/workflows/sync.yml/badge.svg)](https://github.com/ThFriedrich/lammps_vscode/actions/workflows/sync.yml)
![GitHub](https://custom-icon-badges.herokuapp.com/github/license/thfriedrich/lammps_vscode?color=brightgreen&logo=repo)
![Updated](https://custom-icon-badges.herokuapp.com/github/release-date/thfriedrich/lammps_vscode?label=last%20update%20&logo=history&logoColor=white)
[![Plant Tree](https://custom-icon-badges.herokuapp.com/badge/dynamic/json?color=brightgreen&label=Plant%20Tree&query=%24.total&url=https%3A%2F%2Fpublic.offset.earth%2Fusers%2Ftreeware%2Ftrees&&logo=treeware&logoColor=brightgreen)](https://plant.treeware.earth/thfriedrich/lammps_vscode)
[![Gitter](https://img.shields.io/gitter/room/thfriedrich/lammps_vscode?logo=gitter)](https://gitter.im/lammps_vscode/community)

This extension for Visual Studio Code provides language support for LAMMPS (Molecular dynamics Software) Scripts.
This package is being synchronised with the Lammps documentation through a continuous integration pipeline on a monthly schedule to keep the keyword lists and embedded command documentations up to date.

## Features

### Syntax/Keyword Highlighting 
![Syntax Highlighting](imgs/lammps-lng-anim.gif)

- Syntax Highlighting for Keywords, Variables and Data Types
- Folding possible between Markers #[ and #]
- Recognizes .lmp, .lmps and .lammps file extensions and files beginning with "in."

### Embedded Offline Documentation 

![Embedded Offline Documentation](imgs/doc_panel.gif)

- Right click on a command allows to open a documentation page inside vscode

### Autocompletion

![Autocompletion](imgs/autocomplete.gif)

- Completion suggestions with corresponding informations are displayed
- Functionality can be turned off
- Different information-display options possible 

### Hover information

![Hover](imgs/hover.gif)

- Information about Lammps commands are displayed when hovering over them
- Appearance of the hover panel is customisable

### Task Provider

![Tasks](imgs/run_task.gif)

- Different preconfigured run tasks can be executed
- Path to Lammps executable must be set in the extensions settings 
- Tasks of `"type": "lmps"` can also be configured manually in a tasks.json file

### Linting (in progress)

![Lint](imgs/lint.gif)

- Set of functions that points out problems before runtime
- So far implemented: 
  - checking for files and paths on read- and write commands
  - checking for unbalanced/non-closed brackets
  - checking for exceeding maximum # of group definitions
- To be extended in the future


### Simulation Dashboard (beta feature)

![Dashboard](imgs/dashboard.gif)

 - Shows system information like CPU,GPU(Nvidia only) and memory usage
 - interactive 3D Visualisation of atomic dumps
 - interactive plots of lammps log file data
 - automatically updating plots for easy live observation of simulation status
  
--- 


## Treeware License            
This package is [Treeware](https://treeware.earth). If you find this extension useful, then we ask that you [🌱 **buy the world a tree**](https://plant.treeware.earth/thfriedrich/lammps_vscode) to thank us for our work. By contributing to the Treeware forest you’ll be creating employment for local families and restoring wildlife habitats.
