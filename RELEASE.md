# Release Notes v.1.3.0

In this update some major changes were introduced and features added. Please [report issues](https://github.com/ThFriedrich/lammps_vscode/issues/new/choose) if you encounter any problems so they can be fixed. Much of the content of this extension is generated in an automated fashion from the official [Lammps documentation](https://lammps.sandia.gov/doc/Manual.html). It is hardly possible to check the behaviour of autocomplete and hover features for each individual command, what makes bug reports all the more important and valueable. Also, please share your ideas for enhancements or new features. 

If you have to or want to revert to a previous release, please download the corresponding vsix-package from [GitHub](https://github.com/ThFriedrich/lammps_vscode/releases) and [install it](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix) from the command line with the following command:
```bash
code --install-extension lammps-1.2.4.vsix 
```

---

### This Release introduces the following new features and improvements:

## Auto Completion
Completion suggestions now behave much like snippets. Editable arguments are accessed by tabbing (<kbd>Tab</kbd>) through them. Variables can be edited like text. Arguments that allow specific choices should show a dropdown list with options to choose from. Words that are part of the command description are automatically inserted.

## Hover Feature
* Rendering Equations is now supported using MathJax
* Fixed many styling issues

## Offline embedded documentation
* right click on command allows to show documentation in new vscode-panel

## Linting functions
* Set of functions that points out problems before runtime
* So far only checking for files and paths on read- and write commands
* To be extended in the future

## Automatic Updates
* The build of this extension is fully automated to synchronise it's contents with the Official Lammps documentation on a monthly schedule

