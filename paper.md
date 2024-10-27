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

__Lammps_VSCODE__ is a editor-extension vor [vscode](https://code.visualstudio.com/) that supports materials scientiest working with the molecular dynamics software [__LAMMPS__](https://www.lammps.org). LAMMPS is an extensive, open-source molecular dynamics code with nearly 1000 high-level commands in its scripting environment. The code is constantly evolving with more than 250 contributors and regular release cycles. Using and understanding the these commands in LAMMPS-Input scipts can be challenging, especially for beginners. Lammps_VSCODE provides an editor extension for Microsofts popular code editor "Visual Studio Code" (vscode) that provides an interface to LAMMPS and its extensive documentation and script syntax. The extension provides syntax highlighting, tooltips, embedded offline documentation for all LAMMPS commands, autocomplete suggestions, a limited number of pre-run-checks and a simulation dashboard with interactive plotting of log-data and 3D-visualizations of atomic structure files. The extension is being updated automatically through a continuous integration pipeline on a mothly schedule to ensure ongoing compatability with the latest official LAMMPS release.

# Statement of need

scientific publications [@Thompson2022; @Plimpton1995; @Kloss2012] Online Tutorials [@Fahim2022; @Mihok2022]


# Figures

Figure sizes can be customized by adding an optional second parameter:

![Caption for example figure.](figure.png){ width=20% }

# Acknowledgements

I want to acknowledge contributions from Arnaud Allera and Felix-Justin Friedrich who actively worked on the code, and the many GitHub-users who contributed enhancement-ideas and bug-reports. I am particularly grateful for the anonymous donations to [Ecologi](https://ecologi.com/) through the [Treeware license](https://treeware.earth/) of __Lammps_VSCODE__.

# References
