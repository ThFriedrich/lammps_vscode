---
title: 'Lammps_VSCODE: Interactive editor extension for LAMMPS molecular dynamics scripting'
tags:
  - Lammps
  - molecular dynamics
  - vscode
  - materials science
  - computational materials science
authors:
  - name: Thomas Friedrich
    orcid: 0000-0002-7584-2080
    email: thomas.friedrich@eah-jena.de
    affiliation: "1, 2" # (Multiple affiliations must be quoted)
affiliations:
 - name: Ernst-Abbe-University of Applied Sciences, Jena, Germany
   index: 1
   ror: 01rfnc002
 - name: INNOVENT e.V. Technologieentwicklung Jena, Jena, Germany
   index: 2
   ror: 016tmz810
date: 26 October 2024
bibliography: paper.bib

---

# Summary

Lammps_VSCODE is a extension-package for Microsofts popular code editor ["Visual Studio Code" (vscode)](https://code.visualstudio.com/) that supports materials scientiest working with the molecular dynamics software [LAMMPS](https://www.lammps.org). LAMMPS is an extensive, open-source molecular dynamics code with nearly 1000 high-level commands in its scripting environment. The code is constantly evolving with more than 250 contributors and regular release cycles. Using and understanding the these commands in LAMMPS-Input scipts can be challenging, especially for beginners. Lammps_VS
CODE provides an interface to LAMMPS and its extensive documentation and script syntax and implements functionalities such as syntax highlighting, tooltips, embedded offline documentation for all LAMMPS commands, autocomplete suggestions, some pre-run-checks and a simulation dashboard with interactive plotting of log-data and 3D-visualizations of atomic structure files. The extension is being updated automatically through a continuous integration pipeline on a monthly schedule to ensure ongoing compatability with the latest official LAMMPS release. Much of the syntax and functions is also used in derrivative packages such as LIGGGHTS [@Kloss2012], where __Lammps_VSCODE__ can also be used accordingly.

# Statement of need

LAMMPS stands for "Large-scale Atomic/Molecular Massively Parallel Simulator" and is a classical molecular dynamics code. The development began in the 1990s at Sandia National labs [@Plimpton1995] and continues to this day as an open source project with a large number of contributors and an even larger number of users [@Thompson2022].The scripting language used for setting up LAMMPS simulations has 1387 documented commands in the release branch of the GitHub repository at the time of writing and several [parsing rules](https://docs.lammps.org/Commands_parse.html), which add a layer of complexity. The actual scripts are usually not particularly extensive and consist of [four main parts](https://docs.lammps.org/Commands_structure.html):
 1. Initializations
 2. System definitions
 3. Simulation settings
 4. Simulation execution
However, in principle scripts can have arbitrary complexity and several features and conventions may not be obvious to new users. For example compute commands or fixes with given ID may be referenced by a their ID with prefixes, such as 'c_ID' and 'v_ID' respectively, without declaring these variables explicitly. Variables of different types may be defined explicitly and referenced in the script. Expressions can also be evaluated directly without declaring variables, such as ```$((xlo/xhi)/2+sqrt(v_area))```. In this example ``` $(...)``` indicates a direct evaluation, ```xlo```, ```xhi``` and ```v_area``` reference variables, ```sqrt()``` calls one of many functions known to Lammps and mathematical operators are used and work as expected. Many more such rules may be found in the [documentation](https://docs.lammps.org/variable.html). The examples show that the Lammps scripting environment can indeed be seen as an own language and syntax highlighting significantly helps navigating it. The commands implemented in Lammps may be easily used but often not intuitively understood. Quick access to the extensive documentation is therefore essential for productivity and learning. A direct interface for running and evaluationg simulations within a familiar development environment supports this further. The advantages __Lammps_VSCODE__ provides are appreciated by thousands of users and incluided in several online tutorials [@Fahim2022; @Mihok2022]

# Figures

Figure sizes can be customized by adding an optional second parameter:

![Caption for example figure.](figure.png){ width=20% }

# Acknowledgements

I want to acknowledge contributions from Arnaud Allera and Felix-Justin Friedrich who actively worked on the code, and the many GitHub-users who contributed enhancement-ideas and bug-reports. I am particularly grateful for the anonymous donations to [Ecologi](https://ecologi.com/) through the [Treeware license](https://treeware.earth/) of __Lammps_VSCODE__.

# References
