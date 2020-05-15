/* The MIT License (MIT)

Copyright (c) 2016 James Yu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. 

<<<Much of the code in this file was copied and adapted from https://github.com/James-Yu/LaTeX-Workshop>>>
*/

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import stripJsonComments from 'strip-json-comments'


const themeColorMap: { [theme: string]: 'light' | 'dark' } = {
    'Abyss': 'dark',
    'Default Dark+': 'dark',
    'Default Light+': 'light',
    'Visual Studio Dark': 'dark',
    'Visual Studio Light': 'light',
    'Default High Contrast': 'dark',
    'Kimbie Dark': 'dark',
    'Monokai Dimmed': 'dark',
    'Monokai': 'dark',
    'Quiet Light': 'light',
    'Red': 'dark',
    'vs-seti': 'dark',
    'Solarized Dark': 'dark',
    'Solarized Light': 'light',
    'Tomorrow Night Blue': 'dark',
    'One Dark Pro': 'dark',
    'One Dark Pro Vivid': 'dark',
    'One Dark Pro Bold': 'dark',
    'Material Theme': 'dark',
    'Material Theme High Contrast': 'dark',
    'Material Theme Darker': 'dark',
    'Material Theme Darker High Contrast': 'dark',
    'Material Theme Palenight': 'dark',
    'Material Theme Palenight High Contrast': 'dark',
    'Material Theme Ocean': 'dark',
    'Material Theme Ocean High Contrast': 'dark',
    'Material Theme Lighter': 'light',
    'Material Theme Lighter High Contrast': 'light',
    'Atom One Dark': 'dark',
    'Dracula': 'dark',
    'Dracula Soft': 'dark'
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : null
}

function getCurrentThemeLightness(): 'light' | 'dark' {
    const colorTheme = vscode.workspace.getConfiguration('workbench').get('colorTheme') as string
    for (const extension of vscode.extensions.all) {
        if (extension.packageJSON === undefined || extension.packageJSON.contributes === undefined || extension.packageJSON.contributes.themes === undefined) {
            continue
        }
        const candidateThemes = extension.packageJSON.contributes.themes.filter((themePkg: any) => themePkg.label === colorTheme || themePkg.id === colorTheme)
        if (candidateThemes.length === 0) {
            continue
        }
        try {
            const themePath = path.resolve(extension.extensionPath, candidateThemes[0].path)
            let theme = JSON.parse(stripJsonComments(fs.readFileSync(themePath, 'utf8')))
            while (theme.include) {
                const includedTheme = JSON.parse(stripJsonComments(fs.readFileSync(path.resolve(path.dirname(themePath), theme.include), 'utf8')))
                theme.include = undefined
                theme = { ...theme, ...includedTheme }
            }
            const bgColor = hexToRgb(theme.colors['editor.background'])
            if (bgColor) {
                // http://stackoverflow.com/a/3943023/112731
                const r = bgColor.r <= 0.03928 ? bgColor.r / 12.92 : Math.pow((bgColor.r + 0.055) / 1.055, 2.4)
                const g = bgColor.r <= 0.03928 ? bgColor.g / 12.92 : Math.pow((bgColor.g + 0.055) / 1.055, 2.4)
                const b = bgColor.r <= 0.03928 ? bgColor.b / 12.92 : Math.pow((bgColor.b + 0.055) / 1.055, 2.4)
                const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
                if (L > 0.179) {
                    return 'light'
                } else {
                    return 'dark'
                }
            } else if (theme.type && theme.type === 'dark') {
                return 'dark'
            }
        } catch (e) {

        }
        const uiTheme = candidateThemes[0].uiTheme
        if (!uiTheme || uiTheme === 'vs') {
            return 'light'
        } else {
            return 'dark'
        }
    }
    if (themeColorMap[colorTheme] === 'dark') {
        return 'dark'
    }
    return 'light'
}
export function getColor(): string {
    const lightness = getCurrentThemeLightness()
    if (lightness === 'light') {
        return '#000000'
    } else {
        return '#ffffff'
    }
}
