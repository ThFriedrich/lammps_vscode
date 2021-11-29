# Release Notes v.1.5.0

In this update some minor changes were introduced and features added. The most significant adition in this update is the **Lammps Simulation Dashboard** (Still in the testing phase). Please [report issues](https://github.com/ThFriedrich/lammps_vscode/issues/new/choose) if you encounter any problems so they can be fixed. Much of the content of this extension is generated in an automated fashion from the official [Lammps documentation](https://docs.lammps.org/Manual.html). It is hardly possible to check the behaviour of autocomplete and hover features and the generation and formatting of the embedded documentation pages for each individual command, what makes bug reports all the more important and valueable. Also, please share your ideas for enhancements or new features. 

---

This package is [Treeware](https://treeware.earth). If you find this extension useful, then we ask that you [🌱 **buy the world a tree**](https://plant.treeware.earth/thfriedrich/lammps_vscode) to thank us for our work.

---

## This Release introduces the following new features and improvements:

 - ### Added **Lammps dashboard** (beta) as discussed in [Issue #19](https://github.com/ThFriedrich/lammps_vscode/issues/19)
   - Plotting of log file data
   - Plotting of atomic dump data
   - System Information display for Memory usage, CPU load and GPU load (Nvidia GPUs only)
   - Added Editor command 'Open Lammps Simulation Dashboard'
   - Added button to open dashboard in editor window
 - ### Synchronisation of lammps_vscode with Lammps documentation
   - Changed documentation source in official lammps repo from 'master' to 'release'

 - ### Grammar
   - Keywords updated 
  
 - ### Offline embedded documentation
   - minor layout improvements 
 - ### Added dependencies
   - cpu-stats
   - markdown-it
   - node-nvidia-smi
   - node-os-utils
   - plotly.js-dist-min
   - acorn
---

If you have to or want to revert to a previous release, please download the corresponding vsix-package from [GitHub](https://github.com/ThFriedrich/lammps_vscode/releases) and [install it](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix) through the GUI (Extensions menu -> click the 3 dots -> Install from VSIX...) or from the command line with the following command:
```bash
code --install-extension lammps-1.2.4.vsix 
```

---

