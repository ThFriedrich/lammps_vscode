import { WebviewPanel, ExtensionContext, Uri, window, OpenDialogOptions } from 'vscode';
import { join, dirname } from 'path'
import { readFileSync } from 'fs';
import { get_css } from './doc_panel_fcns'

export interface PlotPanel extends WebviewPanel {
    log?: string
}
const re_log_data: RegExp = RegExp('^\\s*((-?[0-9]*(\\.[0-9]*)?([eE][-]?)?[0-9]+)\\s+)+(-?[0-9]*(\\.[0-9]*)?([eE][-]?)?[0-9]+)?', 'gm')

interface plot_data {
    x: number[] | string[],
    y: number[] | string[],
    mode?: string,
    name?: string,
    xaxis?: string,
    yaxis?: string,
    line?: {
        color?: string,
        shape?: string,
        width?: number,
        dash?: string
    }
}

interface ax_layout {
    [key: string]: any
}

export async function manage_plot_panel(context: ExtensionContext, panel: PlotPanel | undefined, actCol: number): Promise<PlotPanel | undefined> {

    const img_path_light = Uri.file(join(context.extensionPath, 'imgs', 'logo_sq_l.gif'))
    const img_path_dark = Uri.file(join(context.extensionPath, 'imgs', 'logo_sq_d.gif'))

    if (panel) {
        // If we already have a panel, show it in the target column
        panel.reveal(actCol);
    } else {
        // Otherwise, create a new panel
        panel = window.createWebviewPanel(
            'lmpsPlot',
            'Lammps Plots', actCol, { retainContextWhenHidden: false, enableScripts: true }
        );
        panel.iconPath = { light: img_path_light, dark: img_path_dark }
        panel.onDidChangeViewState(
            e => {
                actCol = e.webviewPanel.viewColumn!
            },
            null,
            context.subscriptions
        );
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'load_log':
                        if (panel) {
                            panel.log = undefined;
                            set_plot_panel_content(panel, context)
                        }
                        return;
                }
            },
            null,
            context.subscriptions
        );

        context.subscriptions.push(panel)
    }
    if (panel) {
        set_plot_panel_content(panel, context)
    }
    return panel
}


export async function set_plot_panel_content(panel: PlotPanel | undefined, context: ExtensionContext) {

    if (panel) {
        if (panel.log == undefined) {
            panel.log = await get_log_path() // Let user select a log file
        }
        if (panel.log) {
            let ax_layouts: ax_layout = {}
            let dat_log = read_log_data(panel.log)
            if (dat_log) {
                let dat: plot_data[] = []
                for (let iy = 0; iy < dat_log.length; iy++) {
                    let x_axis_lab: string = 'xaxis'
                    let x_axis_lab_short: string = 'x'
                    let y_axis_lab: string = 'yaxis'
                    let y_axis_lab_short: string = 'y'
                    if (iy > 0) {
                        x_axis_lab = 'xaxis' + (iy + 1).toString()
                        x_axis_lab_short = 'x' + (iy + 1).toString()
                        y_axis_lab = 'yaxis' + (iy + 1).toString()
                        y_axis_lab_short = 'y' + (iy + 1).toString()

                    }

                    for (let ix = 1; ix < dat_log[iy].data[0].length; ix++) {
                        dat.push({
                            x: dat_log[iy].data.map(data => data[0]),
                            y: dat_log[iy].data.map(data => data[ix]),
                            xaxis: x_axis_lab_short,
                            yaxis: y_axis_lab_short,
                            name: dat_log[iy].header[ix],
                            mode: 'line',
                            line: {
                                width: 2,
                            }
                        })
                        ax_layouts[x_axis_lab] = { domain: [0, 1], anchor: y_axis_lab_short }
                        ax_layouts[y_axis_lab] = { domain: [iy / dat_log.length, (iy + 1) / dat_log.length - 0.1] }
                    }
                }
                const script_lib: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'node_modules', 'plotly.js-dist-min', 'plotly.min.js')))
                const script: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'src', 'dashboard.js')))
                const css = get_css(panel, context)
                panel.webview.html = css + build_plot_html(script_lib, script)
                panel.webview.postMessage({ data: dat, layout: ax_layouts });
            }
        }
    }
}
function read_log_data(log_path: string) {
    if (log_path) {
        const log_file = readFileSync(log_path).toString()       // Read entire Log_file
        let data_block = re_log_data.exec(log_file)              // Find Data Blocks
        let log_ds: {                                            // Initialize Array of Datablocks
            header: string[],
            data: string[][]
        }[] = []

        while ((data_block = re_log_data.exec(log_file)) != null) {
            const header = data_block.input.slice(data_block.input.slice(0, data_block.index - 1).lastIndexOf('\n'), data_block.index).trim().split(RegExp('\\s+', 'g'))
            const dat_l = data_block.toString().split(RegExp("\\n+", "g"))
            const dat_n: string[][] = dat_l.map((value) => value.trim().split(RegExp('\\s+')))
            if (header.length == dat_n[0].length) {
                log_ds.push({ header: header, data: dat_n })
            }

        }
        return log_ds
    }
}


async function get_log_path(): Promise<string | undefined> {
    const options: OpenDialogOptions = {
        canSelectMany: false,
        title: 'Open Lammps Log File',
        canSelectFolders: false
    };
    const cwd = window.activeTextEditor?.document.uri
    if (cwd) {
        options.defaultUri = Uri.parse(dirname(cwd.toString()))
    }
    let log_path: string | undefined = undefined
    const fileUri = await window.showOpenDialog(options)
    if (fileUri && fileUri[0]) {
        log_path = fileUri[0].fsPath
    }
    return log_path
}

function build_plot_html(plotly_lib: Uri, script: Uri) {

    const html: string =
        `<!DOCTYPE html>
    <html lang="en">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <!-- Include Plotly.js -->
        <script src="${plotly_lib}"></script>   
    </head>

    <body>
        <button type="button" id="button1">Open Lammps Log File</button>
        <button type="button" id="button2">Open Lammps Dump File</button>
        <div id="plot_div">
        <!-- Plotly chart will be drawn inside this DIV -->
        </div>
        <script src="${script}"></script>
    </body>   

    </html>`;
    return html
}