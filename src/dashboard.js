const vscode = acquireVsCodeApi();

window.onload = function() {

    var button1 = document.getElementById('button1')
    var button2 = document.getElementById('button2')
    var button3 = document.getElementById('button3')

    document.getElementById("default_tab").click();

    window.addEventListener('message', event => {
        switch (event.data.type) {
            case 'plot_log':
                plot_log("plot_div", event.data.data, event.data.layout)
                break;
            case 'update_log':
                update_log("plot_div", event.data.data, event.data.layout)
                break;
            case 'plot_dump':
                plot_dump("dump_div", event.data.data)
                break;
            case 'cpu_stat':
                var cpu_info = event.data.data;
                document.getElementById('cpu_mem').value = cpu_info['memory'];
                for (let x = 0; x < cpu_info['cpu'].length; x++) {
                    document.getElementById("cpu_util" + x).value = cpu_info['cpu'][x]['cpu']
                }
                break;
            case 'gpu_stat':
                for (let n = 0; n < event.data.data['gpu_util'].length; n++) {
                    document.getElementById('gpu_mem' + n).value = event.data.data['gpu_mem'][n];
                    document.getElementById('gpu_util' + n).value = event.data.data['gpu_util'][n];
                }

                break;
            case 'gpu_info':
                var gpu_info = event.data.data;
                var sys_bars = document.getElementById('sys_bars');

                for (let n = 0; n < gpu_info['gpu'].length; n++) {
                    var header = document.createElement('h4')
                    header.appendChild(document.createTextNode(gpu_info['gpu'][n]))
                    header.style.marginBottom = '6px';
                    sys_bars.appendChild(header)

                    var cuda_etc = document.createElement('p')
                    cuda_etc.appendChild(document.createTextNode(
                        'Driver: ' + gpu_info['driver'] + Array(6).fill('\xa0').join('') + 'CUDA: ' + gpu_info['cuda']))
                    cuda_etc.style.marginTop = 0;
                    sys_bars.appendChild(cuda_etc)

                    var tbl = document.createElement("table");
                    var tblBody = document.createElement("tbody");

                    var util_row = gen_info_row("gpu_util" + n, "GPU load:")
                    tblBody.appendChild(util_row)
                    var mem_row = gen_info_row("gpu_mem" + n, "Memory usage:")
                    tblBody.appendChild(mem_row)

                    tbl.appendChild(tblBody);
                    sys_bars.appendChild(tbl)

                }

                setInterval(() => {
                    vscode.postMessage({
                        command: 'get_gpu_stat'
                    });
                }, 500);

                break;
            case 'cpu_info':
                var cpu_info = event.data.data;
                if (cpu_info) {
                    var sys_bars = document.getElementById('sys_bars');
                    var header = document.createElement('h4')
                    header.appendChild(document.createTextNode(cpu_info['mod_cpu']))
                    sys_bars.appendChild(header)
                    var tbl = document.createElement("table");
                    var tblBody = document.createElement("tbody");

                    for (let x = 0; x < cpu_info['n_cpu']; x++) {
                        var util_row = gen_info_row("cpu_util" + x, "CPU" + x + " load:")
                        tblBody.appendChild(util_row)
                    }

                    tbl.appendChild(tblBody)
                    sys_bars.appendChild(tbl)

                    var headerM = document.createElement('h4')
                    headerM.appendChild(document.createTextNode('Memory'))
                    sys_bars.appendChild(headerM)

                    var tblM = document.createElement("table");
                    var tblBodyM = document.createElement("tbody");

                    var mem_row = gen_info_row("cpu_mem", "Memory usage:")
                    tblBodyM.appendChild(mem_row)
                    tblM.appendChild(tblBodyM);

                    sys_bars.appendChild(tblM)
                }

                setInterval(() => {
                    vscode.postMessage({
                        command: 'get_cpu_stat'
                    });
                }, 500);

                break;
            default:
                break;
        }
    });

    vscode.postMessage({
        command: 'get_cpu_info'
    });
    vscode.postMessage({
        command: 'get_gpu_info'
    });

    button1.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_log'
        });
        setInterval(() => {
            vscode.postMessage({
                command: 'update_log'
            });
        }, 3000);
    })

    button2.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_dump'
        });
    })

    button3.addEventListener('click', () => {
        vscode.postMessage({
            command: 'update_dump'
        });
    })

    window.onresize = function() {
        var update = {
            width: document.getElementById('logs').clientWidth - 10,
            height: window.innerHeight,
        };
        Plotly.relayout(document.getElementById("plot_div"), update);
        Plotly.relayout(document.getElementById("dump_div"), update);
    }
}

function gen_info_row(bar_id, label_str) {
    var util_row = document.createElement("tr");
    var util_label_cell = document.createElement("td");
    util_label_cell.appendChild(document.createTextNode(label_str))
    var util_bar_cell = document.createElement("td");
    var util_bar = document.createElement("progress")
    util_bar.id = bar_id
    util_bar.value = "0"
    util_bar.min = "0"
    util_bar.max = "100"
    util_bar.style = "width:100%; padding: 2px 4px;"
    util_bar_cell.appendChild(util_bar)
    util_row.appendChild(util_label_cell)
    util_row.appendChild(util_bar_cell)
    return util_row
}

function get_layout() {

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');

    var layout = {
        width: document.getElementById('logs').clientWidth - 10,
        height: window.innerHeight,
        paper_bgcolor: "rgba(255,255,255,0)",
        plot_bgcolor: "rgba(255,255,255,0)",
        legend: {
            x: 0,
            xanchor: 'left',
            y: 1,
            orientation: 'h'
        },
        margin: {
            l: 60,
            r: 25,
            b: 35,
            t: 50
        },
        font: {
            size: 14,
            color: fg
        },
        scene: {
            camera: {
                projection: {
                    type: "orthographic"
                }
            }
        }
    }
    return layout
}

function get_axis_layout() {

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');
    var fg2 = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-textBlockQuote-foreground');

    var axis_layout = {
        showgrid: true,
        showline: true,
        zeroline: false,
        mirror: 'ticks',
        gridcolor: fg2,
        linecolor: fg,
        gridwidth: 1,
        linewidth: 2,
        tickcolor: fg,
        tickangle: 'auto',
        tickfont: {
            size: 14,
            color: fg
        }
    };
    return axis_layout
}

function append_log_layout(layout, grid_layout) {
    // Log Data -> multiple 2D plots
    var axis_layout = get_axis_layout()

    Object.keys(grid_layout).forEach((ax) => {
        Object.assign(grid_layout[ax], axis_layout)
    });

    return {...layout, ...grid_layout }
}


function plot_log(plot_div, data, grid_layout) {
    var layout = get_layout()
    layout = append_log_layout(layout, grid_layout)
    Plotly.newPlot(document.getElementById(plot_div), data, layout, { scrollZoom: true, responsive: true });

}

function plot_dump(plot_div, data) {

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');

    var layout = get_layout()

    var sliderSteps = [];
    var bools = []
    for (let i = 0; i < data.length; i++) {
        for (let ix = 0; ix < data.length; ix++) {
            if (ix == i) {
                bools[ix] = true
            } else { bools[ix] = false }
        }

        sliderSteps.push({
            label: String(i),
            method: 'update',
            args: [{
                'x': [data[i].x],
                'y': [data[i].y],
                'z': [data[i].z],
                'marker': [data[i].marker]
            }]
        })
    }

    layout['sliders'] = [{
            pad: { t: 30 },
            currentvalue: {
                xanchor: 'right',
                prefix: 'Timestep: ',
                font: {
                    color: fg,
                    size: 14
                }
            },
            steps: sliderSteps
        }]
        // Create the plot:
    Plotly.newPlot(document.getElementById(plot_div), {
        data: [data[0]],
        layout: layout
    }, { scrollZoom: true, responsive: true });
}

function update_log(plot_div, data, grid_layout) {
    var div = document.getElementById(plot_div);
    var layout = get_layout()
    layout = append_log_layout(layout, grid_layout)
    for (let d = 0; d < div.data.length; d++) {
        data[d].visible = div.data[d].visible;
    }
    Plotly.react(div, data, layout);
}

function openTab(evt, cont_type) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(cont_type).style.display = "block";
    evt.currentTarget.className += " active";
}