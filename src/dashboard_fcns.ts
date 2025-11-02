import { WebviewPanel, ExtensionContext, Uri, window, OpenDialogOptions, workspace, SaveDialogOptions, tasks, Task, ShellExecution, TaskScope } from 'vscode';
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
    script_file?: string
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
    data: plot_data[][],
    performance?: {
        labels: string[],
        values: number[],
        avg_times: number[],
        total_time?: number
    }[]
}

interface dump_data_ds {
    meta: Meta,
    data: dump_data[]

}

const colors =
    [   '#0daba1',  // teal
        '#ff7f0e',  // safety orange
        '#1f77b4',  // muted blue
        '#d62728',  // brick red
        '#9467bd',  // muted purple
        '#8c564b',  // chestnut brown
        '#e377c2',  // raspberry yogurt pink
        '#7f7f7f',  // middle gray
        '#bcbd22',  // curry yellow-green
        '#2ca02c',  // cooked asparagus green
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

    // Capture the active file when opening the dashboard
    const activeFile = window.activeTextEditor?.document.fileName;

    if (panel) {
        // If we already have a panel, show it in the target column
        panel.reveal(actCol);
        // Update the script file if there's a new active file
        if (activeFile) {
            panel.script_file = activeFile;
            // Send the updated file to the webview
            panel.webview.postMessage({ type: 'active_file', data: activeFile });
        }
    } else {
        // Otherwise, create a new panel
        panel = window.createWebviewPanel(
            'lmpsPlot',
            'Lammps Dashboard', actCol, { retainContextWhenHidden: true, enableScripts: true, localResourceRoots: [Uri.file(context.extensionPath)] }
        );
        panel.iconPath = { light: img_path_light, dark: img_path_dark }
        // Store the script file in the panel
        if (activeFile) {
            panel.script_file = activeFile;
        }
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
                        case 'get_active_file':
                            // Return the stored script file or fallback to current active editor
                            const activeFile = panel.script_file || window.activeTextEditor?.document.fileName || '';
                            panel?.webview.postMessage({ type: 'active_file', data: activeFile });
                            break;
                        case 'run_task':
                            run_lammps_task(message.config).then((result: any) => {
                                panel?.webview.postMessage({ type: 'task_result', data: result });
                            }).catch((error: any) => {
                                panel?.webview.postMessage({ type: 'task_error', data: error.message });
                            });
                            break;
                        case 'save_task_config':
                            save_task_config(message.config).then(() => {
                                panel?.webview.postMessage({ type: 'task_saved', data: 'Task configuration saved successfully' });
                            }).catch((error: any) => {
                                panel?.webview.postMessage({ type: 'task_error', data: error.message });
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
                    panel.webview.postMessage({ type: 'plot_log', data: log_data.data, meta: log_data.meta, performance: log_data.performance });
                    panel.last_read = Date.now();
                    panel.log_file_size = current_size;
                }
            }
            // Check if file has been modified
            else if (!panel.last_read || last_write > panel.last_read) {
                const log_data: plot_data_ds | undefined = get_log_data(panel.log!)
                if (log_data) {
                    panel.webview.postMessage({ type: 'update_log', data: log_data.data, meta: log_data.meta, performance: log_data.performance });
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
    
    // Send the initial script file to the webview if available
    if (panel.script_file) {
        panel.webview.postMessage({ type: 'active_file', data: panel.script_file });
    }
    
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
        return { 'data': plot_ser, 'meta': log.meta, 'performance': log.performance }
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

function extract_performance(log: string): { labels: string[], values: number[], avg_times: number[], total_time?: number } | undefined {
    // Match both standard and accelerated package performance breakdowns
    const perf_section_regex = RegExp('(MPI task timing breakdown:|Section \\|.*%total)[\\s\\S]*?(?=\\n\\n|Loop time|$)', 'g');
    const perf_match = perf_section_regex.exec(log);
    
    if (!perf_match) {
        return undefined;
    }
    
    const perf_text = perf_match[0];
    const lines = perf_text.split('\n');
    
    const labels: string[] = [];
    const values: number[] = [];
    const avg_times: number[] = [];
    let total_time: number | undefined = undefined;
    
    // Try to extract Loop time (total wall time)
    const loop_time_match = log.match(/Loop time of ([\d.]+) on/);
    if (loop_time_match) {
        total_time = parseFloat(loop_time_match[1]);
    }
    
    // Parse each line for section name, avg time, and %total
    for (const line of lines) {
        // Skip header lines and separators
        if (line.includes('Section |') || line.includes('---') || line.includes('timing breakdown')) {
            continue;
        }
        
        // Match lines with timing data: "Section | min | avg | max | varavg | percentage"
        // Format: Section | min time | avg time | max time | %varavg | %total
        const timing_match = line.match(/^([A-Za-z]+)\s*\|\s*[\d.]+\s*\|\s*([\d.]+)\s*\|.*\|\s*([\d.]+)\s*$/);
        if (timing_match) {
            const section = timing_match[1].trim();
            const avg_time = parseFloat(timing_match[2]);
            const percentage = parseFloat(timing_match[3]);
            
            if (section && !isNaN(avg_time) && !isNaN(percentage) && percentage > 0) {
                labels.push(section);
                avg_times.push(avg_time);
                values.push(percentage);
            }
        }
    }
    
    if (labels.length > 0 && values.length > 0) {
        return { labels, values, avg_times, total_time };
    }
    
    return undefined;
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
        const performance_data: { labels: string[], values: number[], avg_times: number[], total_time?: number }[] = []

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
                // Extract performance data for this block
                const block_performance = extract_performance(block.match)
                if (block_performance) {
                    performance_data.push(block_performance)
                }
            });
        }
        return { 'data': log_ds, 'meta': meta, 'performance': performance_data.length > 0 ? performance_data : undefined }
    }
}

function get_dump_data(path: string, start_byte: number = 0): dump_data_ds | undefined {
    const dmp_ds: dump_data_ds = { 'data': [], 'meta': { 'path': path } }
    const dmp = read_dump(path, start_byte)
    if (dmp) {
        for (let iy = 0; iy < dmp.length; iy++) {
            // Find column indices from header labels
            const idx_type = dmp[iy].header.indexOf('type');
            
            // Try to find x, y, z coordinates (prefer scaled coordinates if available)
            let idx_x = dmp[iy].header.indexOf('xs');
            let idx_y = dmp[iy].header.indexOf('ys');
            let idx_z = dmp[iy].header.indexOf('zs');
            let is_scaled = (idx_x !== -1 && idx_y !== -1 && idx_z !== -1);
            
            // Fall back to unwrapped coordinates if scaled not found
            if (idx_x === -1) idx_x = dmp[iy].header.indexOf('x');
            if (idx_y === -1) idx_y = dmp[iy].header.indexOf('y');
            if (idx_z === -1) idx_z = dmp[iy].header.indexOf('z');
            
            // Try wrapped coordinates as last resort
            if (idx_x === -1) idx_x = dmp[iy].header.indexOf('xu');
            if (idx_y === -1) idx_y = dmp[iy].header.indexOf('yu');
            if (idx_z === -1) idx_z = dmp[iy].header.indexOf('zu');
            
            // Validate that required columns exist
            if (idx_type === -1 || idx_x === -1 || idx_y === -1 || idx_z === -1) {
                console.error(`Missing required columns in dump file. Header: ${dmp[iy].header.join(', ')}`);
                continue;
            }
            
            const ty: number[] = dmp[iy].data.map(data => data[idx_type])
            const col: string[] = ty.map(c => colors[c])
            
            // Only apply box scaling if coordinates are scaled (xs, ys, zs)
            // For unwrapped/wrapped coordinates (x, y, z or xu, yu, zu), don't scale
            const scale_x = is_scaled ? dmp[iy].scale_xyz[0] : 1.0;
            const scale_y = is_scaled ? dmp[iy].scale_xyz[1] : 1.0;
            const scale_z = is_scaled ? dmp[iy].scale_xyz[2] : 1.0;
            
            dmp_ds.data.push({
                x: dmp[iy].data.map(data => data[idx_x] * scale_x),
                y: dmp[iy].data.map(data => data[idx_y] * scale_y),
                z: dmp[iy].data.map(data => data[idx_z] * scale_z),
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
                        panel.webview.postMessage({ type: 'plot_log', data: log_data.data, meta: log_data.meta, performance: log_data.performance })
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
          <button class="tablinks" id="run_tab">Run Task</button>
          <button class="tablinks" id="dump_tab">Dumps</button>
          <button class="tablinks" id="logs_tab">Logs</button>
        </div>
        
        <!-- Tab content -->
        <div id="sys" class="tabcontent">
          <div id="sys_bars">
          </div>
        </div>

        <div id="run" class="tabcontent">
          <div id="run_task">
            <h2>LAMMPS Task Configuration</h2>
            <form id="task_form">
              <table style="width: 100%; max-width: 800px;">
                <tr>
                  <td><label for="task_label" title="Display name for the task in VS Code's task list">Task Label:</label></td>
                  <td><input type="text" id="task_label" value="LAMMPS Run" style="width: 100%;" title="Display name for the task in VS Code's task list"></td>
                </tr>
                <tr>
                  <td><label for="task_script" title="Path to the LAMMPS input script to execute. Defaults to the active editor file.">Script File:</label></td>
                  <td>
                    <input type="text" id="task_script" placeholder="Active editor or specify path" style="width: 100%;" title="Path to the LAMMPS input script to execute. Defaults to the active editor file.">
                  </td>
                </tr>
                <tr>
                  <td><label for="task_binary" title="Path to the LAMMPS executable (e.g., lmp, lmp_mpi, lmp_intel_cpu_intelmpi, /usr/local/bin/lmp)">Binary:</label></td>
                  <td><input type="text" id="task_binary" value="lmp" style="width: 100%;" title="Path to the LAMMPS executable (e.g., lmp, lmp_mpi, lmp_intel_cpu_intelmpi, /usr/local/bin/lmp)"></td>
                </tr>
                <tr>
                  <td><label for="task_mpiexec" title="Path to the MPI launcher executable (e.g., mpiexec, mpirun, srun). Used when MPI Tasks > 0.">MPI Exec Path:</label></td>
                  <td><input type="text" id="task_mpiexec" value="mpiexec" style="width: 100%;" title="Path to the MPI launcher executable (e.g., mpiexec, mpirun, srun). Used when MPI Tasks > 0."></td>
                </tr>
                <tr>
                  <td><label for="task_mpi_tasks" title="Number of MPI processes to use for parallel execution. Set to 0 for single-task (serial) execution.">MPI Tasks:</label></td>
                  <td><input type="number" id="task_mpi_tasks" value="4" min="0" max="9999" style="width: 100px;" title="Number of MPI processes to use for parallel execution. Set to 0 for single-task (serial) execution."></td>
                </tr>
                <tr>
                  <td><label for="task_gpu_nodes" title="Number of GPU nodes to use with -sf gpu -pk gpu flags. Set to 0 to disable GPU acceleration.">GPU Nodes:</label></td>
                  <td><input type="number" id="task_gpu_nodes" value="0" min="0" max="99" style="width: 100px;" title="Number of GPU nodes to use with -sf gpu -pk gpu flags. Set to 0 to disable GPU acceleration."></td>
                </tr>
                <tr>
                  <td><label for="task_omp_threads" title="Number of OpenMP threads per MPI task. Set to 0 to use system default. Sets OMP_NUM_THREADS environment variable.">OMP Threads:</label></td>
                  <td><input type="number" id="task_omp_threads" value="0" min="0" max="999" style="width: 100px;" title="Number of OpenMP threads per MPI task. Set to 0 to use system default. Sets OMP_NUM_THREADS environment variable."></td>
                </tr>
                <tr>
                  <td><label for="task_args" title="Additional command-line arguments to pass to LAMMPS (e.g., -log none, -screen none, -var temp 300, -skiprun)">Additional Args:</label></td>
                  <td><input type="text" id="task_args" placeholder="-log none" style="width: 100%;" title="Additional command-line arguments to pass to LAMMPS (e.g., -log none, -screen none, -var temp 300, -skiprun)"></td>
                </tr>
                <tr>
                  <td><label for="task_group" title="Task group classification in VS Code. Build tasks can be run with Ctrl+Shift+B.">Task Group:</label></td>
                  <td>
                    <select id="task_group" style="width: 150px;" title="Task group classification in VS Code. Build tasks can be run with Ctrl+Shift+B.">
                      <option value="build" selected>Build</option>
                      <option value="test">Test</option>
                      <option value="none">None</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label for="task_default" title="Mark this as the default task for its group. Default tasks can be executed with keyboard shortcuts (e.g., Ctrl+Shift+B for build group).">Default Task:</label></td>
                  <td><input type="checkbox" id="task_default" checked title="Mark this as the default task for its group. Default tasks can be executed with keyboard shortcuts (e.g., Ctrl+Shift+B for build group)."></td>
                </tr>
              </table>
              <br>
              <button type="button" id="run_task_btn" style="padding: 10px 20px; font-size: 16px;" title="Execute the LAMMPS task immediately with the current configuration">▶ Run Task</button>
              <button type="button" id="save_task_btn" style="padding: 10px 20px; font-size: 16px; margin-left: 10px;" title="Save this configuration to .vscode/tasks.json for reuse">💾 Save Task Config</button>
            </form>
            <div id="task_output" style="margin-top: 20px; padding: 10px; border: 1px solid; max-height: 300px; overflow-y: auto; font-family: monospace; white-space: pre-wrap;"></div>
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

async function run_lammps_task(config: any): Promise<any> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    
    // Build the command based on the configuration
    let command = '';
    const binary = config.binary || 'lmp';
    const script = config.script || window.activeTextEditor?.document.fileName || '';
    
    if (!script) {
        throw new Error('No script file specified and no active editor');
    }

    // Build command based on MPI and GPU settings
    const mpi_tasks = parseInt(config.mpi_tasks) || 0;
    const gpu_nodes = parseInt(config.gpu_nodes) || 0;
    const omp_threads = parseInt(config.omp_threads) || 0;
    const args = config.args || '';

    if (mpi_tasks > 0) {
        const mpiexec = config.mpiexec_path || 'mpiexec';
        command = `${mpiexec} -np ${mpi_tasks}`;
        if (omp_threads > 0) {
            command += ` -x OMP_NUM_THREADS=${omp_threads}`;
        }
        command += ` ${binary}`;
    } else {
        if (omp_threads > 0) {
            command = `OMP_NUM_THREADS=${omp_threads} ${binary}`;
        } else {
            command = binary;
        }
    }

    if (gpu_nodes > 0) {
        command += ` -sf gpu -pk gpu ${gpu_nodes}`;
    }

    command += ` -in ${script}`;
    
    if (args) {
        command += ` ${args}`;
    }

    // Create and execute the task
    const taskDefinition = {
        type: 'lmps',
        label: config.label || 'LAMMPS Run',
    };

    const execution = new ShellExecution(command);
    const task = new Task(
        taskDefinition,
        workspaceFolder,
        config.label || 'LAMMPS Run',
        'lmps',
        execution,
        []
    );

    // Execute the task
    await tasks.executeTask(task);

    return {
        success: true,
        command: command,
        message: 'Task started successfully'
    };
}

async function save_task_config(config: any): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    const tasksJsonPath = join(workspaceFolder.uri.fsPath, '.vscode', 'tasks.json');

    // Build the task configuration object
    const taskConfig = {
        type: 'lmps',
        label: config.label || 'LAMMPS Custom Task',
        binary: config.binary || 'lmp',
        mpiexec_path: config.mpiexec_path || 'mpiexec',
        mpi_tasks: parseInt(config.mpi_tasks) || 0,
        gpu_nodes: parseInt(config.gpu_nodes) || 0,
        omp_threads: parseInt(config.omp_threads) || 0,
        args: config.args || '',
        problemMatcher: [],
        group: {
            kind: config.group || 'build',
            isDefault: config.isDefault !== false
        }
    };

    // Read existing tasks.json or create new structure
    let tasksJson: any;
    try {
        const tasksContent = readFileSync(tasksJsonPath, 'utf8');
        tasksJson = JSON.parse(tasksContent);
    } catch (e) {
        // File doesn't exist or is invalid, create new structure
        tasksJson = {
            version: '2.0.0',
            tasks: []
        };
    }

    // Add or update the task
    if (!tasksJson.tasks) {
        tasksJson.tasks = [];
    }

    // Check if task with same label exists
    const existingTaskIndex = tasksJson.tasks.findIndex((t: any) => t.label === taskConfig.label);
    if (existingTaskIndex >= 0) {
        tasksJson.tasks[existingTaskIndex] = taskConfig;
    } else {
        tasksJson.tasks.push(taskConfig);
    }

    // Ensure .vscode directory exists
    const vscodePath = join(workspaceFolder.uri.fsPath, '.vscode');
    try {
        await fsPromises.mkdir(vscodePath, { recursive: true });
    } catch (e) {
        // Directory already exists
    }

    // Write the file
    writeFileSync(tasksJsonPath, JSON.stringify(tasksJson, null, 2));
}