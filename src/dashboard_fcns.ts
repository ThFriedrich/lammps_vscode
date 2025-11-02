import { WebviewPanel, ExtensionContext, Uri, window, OpenDialogOptions, workspace, SaveDialogOptions } from 'vscode';
import { join } from 'path'
import { readFileSync, statSync, writeFileSync, promises as fsPromises } from 'fs';
import { get_css } from './doc_panel_fcns'
import { get_cpu_info, get_cpu_stat, get_gpu_info, get_gpu_stat } from './os_util_fcns'

export interface PlotPanel extends WebviewPanel {
    log?: string
    last_read?: number
    log_file_size?: number
    dump?: string
    dump_last_read?: number
    dump_file_size?: number
}

interface plot_data {
    plot_type?: string,
    x: number[] | string[],
    y: number[] | string[],
    mode?: string,
    visible?: boolean | string,
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

interface dump_data {
    x: number[] | string[],
    y: number[] | string[],
    z: number[] | string[],
    mode: string,
    visible: boolean | string,
    name?: string,
    marker: {
        color?: any
        size?: number,
        line?: {
            color?: any,
            width?: number
        },
        opacity?: number
    },
    type: string
}

interface Meta {
    [key: string]: string
}

interface plot_data_ds {
    meta: Meta,
    data: plot_data[][]

}

interface dump_data_ds {
    meta: Meta,
    data: dump_data[]

}

const colors =
    ['#1f77b4', // muted blue
        '#ff7f0e',  // safety orange
        '#2ca02c',  // cooked asparagus green
        '#d62728',  // brick red
        '#9467bd',  // muted purple
        '#8c564b',  // chestnut brown
        '#e377c2',  // raspberry yogurt pink
        '#7f7f7f',  // middle gray
        '#bcbd22',  // curry yellow-green
        '#17becf']  // blue-teal


enum file_type {
    log,
    dump,
}

//Regular Expression to find tabulated blocks of numerical data for log data and atomic dump files
const re_log_data: RegExp = RegExp('^\\s*((-?[0-9]*(\\.[0-9]*)?([eE][-]?)?[0-9]+)\\s+)+(-?[0-9]*(\\.[0-9]*)?([eE][-]?)?[0-9]+)?', 'gm')
const re_dump_data: RegExp = RegExp('ITEM: ATOMS[\\s\\S\\n]*?(?=ITEM:|$)', 'g')
const re_dump_bounds: RegExp = RegExp('ITEM: BOX BOUNDS[\\s\\S\\n]*?(?=ITEM:|$)', 'g')
const re_comments: RegExp = RegExp('^\\s*#.*$\\n?', 'gm')

const patterns_config = [
    {
        "name": "lmp_version",
        "value": null,
        "regex": RegExp("^\\s*LAMMPS[\\s]+\\((.+)\\)")
    },
    {
        "name": "dimension",
        "value": null,
        "regex": RegExp("^\\s*dimension[\\s]+(\\d+)")
    },
    {
        "name": "boundaries",
        "value": null,
        "regex": RegExp("^\\s*boundary[\\s]+(.+)")
    },
    {
        "name": "pair_style",
        "value": null,
        "regex": RegExp("^\\s*pair_style[\\s]+(.+)")
    },
    {
        "name": "omp_per_mpi",
        "value": null,
        "regex": RegExp("using (\\d)+ OpenMP thread\\(s\\) per MPI task")
    },
    {
        "name": "min_style",
        "value": null,
        "regex": RegExp("min_style[\\s\\t]+([\\w\\d]+)")
    }
]

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
            'Lammps Dashboard', actCol, { retainContextWhenHidden: true, enableScripts: true, localResourceRoots: [Uri.file(context.extensionPath)] }
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
                if (panel) {
                    switch (message.command) {
                        case 'load_log':
                            panel.log = undefined;
                            set_plot_panel_content(panel, context, file_type.log)
                            break;
                        case 'update_log':
                            get_update(panel, 'log');
                            break;
                        case 'load_dump':
                            panel.dump = undefined;
                            set_plot_panel_content(panel, context, file_type.dump)
                            break;
                        case 'update_dump':
                            get_update(panel, 'dump');
                            break;
                        case 'get_gpu_info':
                            get_gpu_info().then((s: any) => {
                                panel?.webview.postMessage({ type: 'gpu_info', data: s })
                            });
                            break;
                        case 'get_cpu_info':
                            get_cpu_info().then((s: any) => {
                                panel?.webview.postMessage({ type: 'cpu_info', data: s })
                            });
                            break;
                        case 'get_gpu_stat':
                            get_gpu_stat().then((s: any) => {
                                panel?.webview.postMessage({ type: 'gpu_stat', data: s })
                            });
                            break;
                        case 'get_cpu_stat':
                            get_cpu_stat().then((s: any) => {
                                panel?.webview.postMessage({ type: 'cpu_stat', data: s })
                            });
                            break;
                        default:
                            if (message.startsWith('<img src=')) {
                                const img_data = message.match(RegExp('<img src="data:image\\/(\\w+);base64,(.*)"'));
                                const buf = Buffer.from(img_data[2], 'base64');
                                get_save_img_path('Save Image as...').then((img_path: string | undefined) => {
                                    if (img_path) {
                                        if (!img_path.endsWith('.png')) {
                                            img_path += '.png'
                                        }
                                        writeFileSync(img_path, buf);
                                    }
                                });
                            }
                            break;
                    }

                }
                return;
            },
            null,
            context.subscriptions
        );

        context.subscriptions.push(panel)
    }
    draw_panel(panel, context)
    return panel
}

function get_update(panel: PlotPanel | undefined, updateType?: 'log' | 'dump') {
    // Use Promise.all to check both files in parallel
    const promises: Promise<void>[] = [];
    
    if (panel?.log && (!updateType || updateType === 'log')) {
        const logPromise = fsPromises.stat(panel.log).then(stats => {
            const last_write = stats.mtime.getTime();
            const current_size = stats.size;
            
            // Check if file has shrunk (overwritten/restarted)
            if (panel.log_file_size && current_size < panel.log_file_size) {
                // File was overwritten - reload everything from scratch
                const log_data: plot_data_ds | undefined = get_log_data(panel.log!)
                if (log_data) {
                    panel.webview.postMessage({ type: 'plot_log', data: log_data.data, meta: log_data.meta });
                    panel.last_read = Date.now();
                    panel.log_file_size = current_size;
                }
            }
            // Check if file has been modified
            else if (!panel.last_read || last_write > panel.last_read) {
                const log_data: plot_data_ds | undefined = get_log_data(panel.log!)
                if (log_data) {
                    panel.webview.postMessage({ type: 'update_log', data: log_data.data, meta: log_data.meta });
                    panel.last_read = Date.now();
                    panel.log_file_size = current_size;
                }
            }
        }).catch(err => {
            console.error('[LAMMPS Dashboard] Error reading log file:', err);
        });
        promises.push(logPromise);
    }
    
    if (panel?.dump && (!updateType || updateType === 'dump')) {
        const dumpPromise = fsPromises.stat(panel.dump).then(stats => {
            const last_write = stats.mtime.getTime();
            const current_size = stats.size;
            
            // Check if file has shrunk (overwritten/restarted)
            if (panel.dump_file_size && current_size < panel.dump_file_size) {
                // File was overwritten - reload everything from scratch
                const dump_data: dump_data_ds | undefined = get_dump_data(panel.dump!, 0)
                if (dump_data) {
                    panel.webview.postMessage({ type: 'plot_dump', data: dump_data.data, meta: dump_data.meta });
                    panel.dump_last_read = Date.now();
                    panel.dump_file_size = current_size;
                }
            }
            // Check if file has been modified and grown (new data appended)
            else if (!panel.dump_last_read || last_write > panel.dump_last_read) {
                const is_initial_load = !panel.dump_file_size;
                const dump_data: dump_data_ds | undefined = get_dump_data(panel.dump!, panel.dump_file_size || 0)
                
                if (dump_data) {
                    // Send with appropriate message type based on whether this is initial load or update
                    const messageType = is_initial_load ? 'plot_dump' : 'update_dump';
                    panel.webview.postMessage({ type: messageType, data: dump_data.data, meta: dump_data.meta });
                    panel.dump_last_read = Date.now();
                    panel.dump_file_size = current_size;
                }
            }
        }).catch(err => {
            console.error('[LAMMPS Dashboard] Error reading dump file:', err);
        });
        promises.push(dumpPromise);
    }
    
    return Promise.all(promises);
}
export function draw_panel(panel: PlotPanel, context: ExtensionContext) {
    const node_lib_path: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'node_modules')))
    const script_lib: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'node_modules', 'plotly.js-dist-min', 'plotly.min.js')))
    const script: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'dist', 'dashboard.js')))
    const css = get_css(panel, context)
    panel.webview.html = css + build_plot_html(panel, node_lib_path, script_lib, script)
    if (panel.log) {
        set_plot_panel_content(panel, context, file_type.log)
    }
    if (panel.dump) {
        set_plot_panel_content(panel, context, file_type.dump)
    }
}

function get_log_data(path: string): plot_data_ds | undefined {
    const log = read_log(path)
    if (log) {
        const plot_ser: plot_data[][] = []
        for (let iy = 0; iy < log.data.length; iy++) {
            const ser: plot_data[] = []
            for (let ix = 1; ix < log.data[iy].data[0].length; ix++) {
                ser.push({
                    plot_type: log.data[iy].type,
                    visible: true,
                    x: log.data[iy].data.map(data => data[0]),
                    y: log.data[iy].data.map(data => data[ix]),
                    name: log.data[iy].header[ix],
                    mode: 'line',
                    line: {
                        width: 2,
                    }
                })
            }
            plot_ser.push(ser)
        }
        return { 'data': plot_ser, 'meta': log.meta }
    }
}

interface log_block {
    index: number,
    match: string
}

function locate_blocks(log: string) {
    const work_kw = [
        RegExp("\\brun\\b[\\s\\S]*?(\\bDangerous\\sbuilds\\b|$)", 'g'),
        RegExp("\\bminimize\\b[\\s\\S]*?(\\bDangerous\\sbuilds\\b|$)", 'g'),
        RegExp("\\bneb\\b[\\s\\S]*?(\\bDangerous\\sbuilds\\b|$)", 'g')]
    const blocks: log_block[] = []

    work_kw.forEach(kw => {
        let match
        while ((match = kw.exec(log)) != null) {
            blocks.push({ 'index': match.index, 'match': match[0] })
        }
    });
    return blocks
}

function locate_meta(log: string, log_path: string) {
    const meta: Meta = {}
    const log_lines = log.split('\n')
    for (let p = 0; p < patterns_config.length; p++) {
        for (let i = 0; i < log_lines.length; i++) {
            const match = patterns_config[p].regex.exec(log_lines[i])
            if (match) {
                meta[patterns_config[p].name] = match[1]
                break
            }
        }
    }
    meta['path'] = log_path
    return meta
}


function read_log(log_path: string) {
    if (log_path) {
        const log_file = readFileSync(log_path).toString().replace(re_comments, '').replace(/\r\n/g, '\n');  // Read entire Log_file
        const meta = locate_meta(log_file, log_path)
        const blocks = locate_blocks(log_file)
        const log_ds: {
            type: string,                                                              // Initialize Array of Datablocks
            header: string[],
            data: string[][]
        }[] = []

        if (blocks) {
            blocks.sort((a, b) => a.index - b.index)
            blocks.forEach(block => {
                let data_block                                                              // Find Data Blocks
                while ((data_block = re_log_data.exec(block.match)) != null) {
                    const header = data_block.input.slice(data_block.input.slice(0, data_block.index - 1).lastIndexOf('\n'), data_block.index).trim().split(RegExp('\\s+', 'g'))
                    const dat_l = data_block.toString().split(RegExp("\\n+", "g"))
                    const dat_n: string[][] = dat_l.map((value) => value.trim().split(RegExp('\\s+')))
                    if (header.length == dat_n[0].length) {
                        const dl = []
                        for (let nd = 0; nd < dat_n.length; nd++) {
                            if (header.length == dat_n[nd].length) {
                                dl.push(dat_n[nd])
                            }
                        }
                        log_ds.push({ type: block.match.split("\n")[0], header: header, data: dl })
                    }
                }
            });
        }
        return { 'data': log_ds, 'meta': meta }
    }
}

function get_dump_data(path: string, start_byte: number = 0): dump_data_ds | undefined {
    const dmp_ds: dump_data_ds = { 'data': [], 'meta': { 'path': path } }
    const dmp = read_dump(path, start_byte)
    if (dmp) {
        for (let iy = 0; iy < dmp.length; iy++) {
            const ty: number[] = dmp[iy].data.map(data => data[1])
            const col: string[] = ty.map(c => colors[c])
            dmp_ds.data.push({
                x: dmp[iy].data.map(data => data[2] * dmp[iy].scale_xyz[0]),
                y: dmp[iy].data.map(data => data[3] * dmp[iy].scale_xyz[1]),
                z: dmp[iy].data.map(data => data[4] * dmp[iy].scale_xyz[2]),
                mode: 'markers',
                visible: true,
                marker: {
                    color: col,
                    size: 10,
                    line: {
                        color: 'black',
                        width: 0.25
                    },
                    opacity: 0.8
                },
                type: 'scatter3d'
            })
        }
        return dmp_ds
    }
}

function read_dump(dump_path: string, start_byte: number = 0) {
    if (dump_path) {
        const full_file = readFileSync(dump_path).toString();
        
        let dump_file: string;
        if (start_byte > 0) {
            // Find the next "ITEM: TIMESTEP" after start_byte to ensure we start at a complete frame
            const file_from_start = full_file.slice(start_byte);
            const timestep_match = file_from_start.match(/ITEM: TIMESTEP/);
            if (timestep_match && timestep_match.index !== undefined) {
                // Start from the beginning of this timestep
                dump_file = file_from_start.slice(timestep_match.index).replace(re_comments, '').replace(/\r\n/g, '\n');
            } else {
                // No new timesteps found
                return [];
            }
        } else {
            // Read from beginning
            dump_file = full_file.replace(re_comments, '').replace(/\r\n/g, '\n');
        }
        
        let data_block
        let bounds
        const dump_ds: {
            header: string[],
            data: number[][],
            scale_xyz: number[]
        }[] = []
        let scale_xyz
        let idx
        
        while ((bounds = re_dump_bounds.exec(dump_file)) != null) {
            idx = 0
            scale_xyz = [1.0, 1.0, 1.0]
            for (const line of bounds[0].trim().split(RegExp('\\n+'))) {
                const vals = line.split(RegExp('\\s+'))
                if (vals.length == 2) {
                    scale_xyz[idx] = parseFloat(vals[1]) - parseFloat(vals[0])
                    idx++
                }
            }

            if ((data_block = re_dump_data.exec(dump_file)) != null) {
                const idx_head = data_block[0].indexOf('\n')
                let header = data_block[0].slice(0, idx_head).trim().split(RegExp('\\s+'))
                header = header.filter(e => e !== 'ITEM:' && e !== 'ATOMS')
                const dat_l = data_block[0].slice(idx_head + 1).toString().trim().split(RegExp("\\n+", "g"))
                const dat_n: number[][] = dat_l.map((value) =>
                    value.trim().split(/\s+/).map((substring) => parseFloat(substring))
                ); 
                if (header.length == dat_n[0].length) {
                    dump_ds.push({ header: header, data: dat_n, scale_xyz: scale_xyz })
                }
            }
        }
        return dump_ds
    }
}

export async function set_plot_panel_content(panel: PlotPanel | undefined, context: ExtensionContext, f_type: file_type) {
    if (panel) {
        switch (f_type) {
            case file_type.log:
                if (panel.log == undefined) {
                    panel.log = await get_log_path('Open Lammps Log File') // Let user select a log file
                }
                if (panel.log) {
                    const log_data: plot_data_ds | undefined = get_log_data(panel.log)
                    if (log_data) {
                        panel.webview.postMessage({ type: 'plot_log', data: log_data.data, meta: log_data.meta })
                        panel.last_read = Date.now()
                        // Initialize file size tracking
                        const stats = await fsPromises.stat(panel.log);
                        panel.log_file_size = stats.size;
                    }
                }
                break;
            case file_type.dump:
                if (panel.dump == undefined) {
                    panel.dump = await get_log_path('Open Lammps Dump File') // Let user select a dump file
                }
                if (panel.dump) {
                    const dump_data: dump_data_ds | undefined = get_dump_data(panel.dump)
                    if (dump_data) {
                        panel.webview.postMessage({ type: 'plot_dump', data: dump_data.data, meta: dump_data.meta });
                        panel.dump_last_read = Date.now()
                        // Initialize file size tracking
                        const stats = await fsPromises.stat(panel.dump);
                        panel.dump_file_size = stats.size;
                    }
                }
                break;
            default:
                break;
        }
    }
}


async function get_log_path(title: string): Promise<string | undefined> {
    const cwd = workspace.workspaceFolders
    const options: OpenDialogOptions = {
        canSelectMany: false,
        title: title,
        canSelectFolders: false,
        canSelectFiles: true,
        defaultUri: cwd ? cwd[0].uri : undefined,
    };
    let log_path: string | undefined = undefined
    const fileUri = await window.showOpenDialog(options)
    if (fileUri && fileUri[0]) {
        log_path = fileUri[0].fsPath
    }
    return log_path
}

async function get_save_img_path(title: string): Promise<string | undefined> {
    const cwd = workspace.workspaceFolders
    const options: SaveDialogOptions = {
        title: title,
        filters: { 'Images (.png)': ['png'] },
        defaultUri: cwd ? cwd[0].uri : undefined
    };

    let img_path: string | undefined = undefined
    const fileUri = await window.showSaveDialog(options)
    if (fileUri) {
        img_path = fileUri.fsPath
    }
    return img_path
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 64; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function build_plot_html(panel: PlotPanel, node_lib_path: Uri, plotly_lib: Uri, script: Uri) {
    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();
    const html: string =
        `<!DOCTYPE html>
    <html lang="en">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
        img-src ${panel.webview.cspSource} data: blob:;
        script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval';
        style-src ${panel.webview.cspSource} 'strict-dynamic' 'unsafe-inline';
        "/>

        <script nonce="${nonce}" src="${script}"></script>
        <script nonce="${nonce}" src="${plotly_lib}"></script>   
    </head>

    <body>

        <!-- Tab links -->
        <div class="tab">
          <button class="tablinks" id="sys_tab">System Information</button>
          <button class="tablinks" id="dump_tab">Dumps</button>
          <button class="tablinks" id="logs_tab">Logs</button>
        </div>
        
        <!-- Tab content -->
        <div id="sys" class="tabcontent">
          <div id="sys_bars">
          </div>
        </div>
        
        <div id="dump" class="tabcontent">
          <div>
            <button type="button" id="load_dump_btn">📂 Open Lammps Dump File</button>
            <label style="margin-left: 20px;">
              <input type="checkbox" id="live_update_toggle" checked>
              Live Updates
            </label>
            <div id="dump_path_div"></div><br>
            <div id="dump_div" class="dump_div" align="center">
            <!-- Plotly chart will be drawn inside this DIV -->
            </div>
          </div>
        </div>
        
        <div id="logs" class="tabcontent">
            <button type="button" id="load_log_btn">📂 Open Lammps Log File</button>
            <label style="margin-left: 20px;">
              <input type="checkbox" id="live_update_toggle_logs" checked>
              Live Updates
            </label>
            <div id="plot_div" class="log_div">
            <!-- Plotly chart will be drawn inside this DIV -->
            </div>
        </div>
    </body>   
    </html>`;
    return html
}