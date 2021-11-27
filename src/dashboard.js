const vscode = acquireVsCodeApi();

window.onload = function () {

    var load_log_btn = document.getElementById('load_log_btn')
    var load_dump_btn = document.getElementById('load_dump_btn')
    var update_dump_btn = document.getElementById('update_dump_btn')
    var b_logs_plotted = false
    var b_dump_plotted = false
    var n_plots = 0


    document.getElementById("sys_tab").addEventListener('click', function (event) { openTab(event, 'sys') })
    document.getElementById("dump_tab").addEventListener('click', function (event) { openTab(event, 'dump') })
    document.getElementById("logs_tab").addEventListener('click', function (event) { openTab(event, 'logs') })
    document.getElementById("sys_tab").click();

    function resize_plots_sub() {
        if (b_logs_plotted) {
            Array.from(document.getElementsByClassName('panel')).forEach(plot_div => {
                var div_sz = plot_div.getBoundingClientRect()
                var update = {
                    width: div_sz.width,
                    height: div_sz.height
                };
                if (plot_div.offsetHeight > 0) {
                    Plotly.relayout(plot_div, update);
                }
            });
        }
        if (b_dump_plotted) {
            var dump_div = document.getElementById("dump_div");
            var div_sz = dump_div.getBoundingClientRect()
            var update = {
                width: div_sz.width,
                height: div_sz.height
            };
            if (dump_div.offsetHeight > 0) {
                Plotly.relayout(dump_div, update);
            }
        }
    }

    function resize_plots(e) {
        var fired = 0;
        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);

        function mousemove(e) {
            fired++;
            if (!(fired % 3) || fired == 1) {
                resize_plots_sub()
            }
        }

        function mouseup() {
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
            resize_plots_sub()
        }
    }

    function redraw_log_panel(ev_data, ev_meta) {
        var plot_div = document.getElementById('plot_div')
        while (plot_div.firstChild) {
            plot_div.removeChild(plot_div.firstChild);
        }
        n_plots = ev_data.length
        n_meta = Object.keys(ev_meta).length
        var table = document.createElement('table');
        table.setAttribute('style', 'margin:5px; width:100%; table-layout:fixed;');
        var thead = document.createElement('thead');
        var tbody = document.createElement('tbody');
        var row1 = document.createElement('tr');
        var row2 = document.createElement('tr');

        table.appendChild(thead);
        table.appendChild(tbody);
        plot_div.appendChild(table);

        for (let i = 0; i < n_meta; i++) {

            var th = document.createElement('th');
            var td = document.createElement('td');
            td.setAttribute('style', 'padding: 2px; overflow: auto;');
            th.innerHTML = Object.keys(ev_meta)[i];
            td.innerHTML = Object.values(ev_meta)[i];
            row1.appendChild(th);
            row2.appendChild(td);
        }
        thead.appendChild(row1);
        thead.appendChild(row2);

        for (i = 0; i < n_plots; i++) {
            var plot_div_button = document.createElement('button');
            plot_div_button.textContent = "Plot " + (1 + i).toString() + '  ( ' + ev_data[i][0].plot_type + ' )'
            plot_div_button.className = "accordion"
            plot_div_button.addEventListener("click", function () {
                /* Toggle between adding and removing the "active" class,
                to highlight the button that controls the panel */
                this.classList.toggle("active");

                /* Toggle between hiding and showing the active panel */
                var panel = this.nextElementSibling;
                if (panel.style.display === "block") {
                    panel.style.display = "none";
                } else {
                    panel.style.display = "block";
                    resize_plots()
                }
            });
            plot_div.appendChild(plot_div_button);

            var plot_div_child = document.createElement('div');
            plot_div_child.className = "panel"
            plot_div_child.style.resize = "vertical"
            plot_div_child.id = "plot_div_" + i.toString()
            plot_div_child.style.display = "none"
            plot_div.addEventListener("mousedown", resize_plots);
            plot_div.appendChild(plot_div_child);
            plot_log(plot_div_child.id, ev_data[i])
        }
        b_logs_plotted = true
    }

    var interval_set = false
    var log_interval = 500
    var sys_interval = 250

    window.addEventListener('message', event => {
        var ev_data = event.data.data
        var ev_meta = event.data.meta
        var ev_type = event.data.type

        if (ev_data) {
            switch (ev_type) {
                case 'plot_log':
                    redraw_log_panel(ev_data, ev_meta)
                    if (!interval_set) {
                        setInterval(() => {
                            vscode.postMessage({
                                command: 'update_log'
                            });
                        }, log_interval);
                        interval_set = true
                    }
                    break;
                case 'update_log':
                    var n_plots_update = ev_data?.length
                    if (n_plots_update && n_plots_update > n_plots) {
                        redraw_log_panel(ev_data, ev_meta)
                    } else {
                        for (i = 0; i < n_plots; i++) {
                            var div_id = "plot_div_" + i.toString()
                            update_log(div_id, ev_data[i])
                        }
                    }

                    break;
                case 'plot_dump':
                    dump_path_div.textContent = ev_meta.path;
                    plot_dump("dump_div", ev_data)
                    b_dump_plotted = true
                    if (!interval_set) {
                        setInterval(() => {
                            vscode.postMessage({
                                command: 'update_log'
                            });
                        }, log_interval);
                        interval_set = true
                    }
                    break;
                case 'cpu_stat':
                    document.getElementById('cpu_mem').value = ev_data['memory'];
                    for (let x = 0; x < ev_data['cpu'].length; x++) {
                        document.getElementById("cpu_util" + x).value = ev_data['cpu'][x]['cpu']
                    }
                    break;
                case 'gpu_stat':
                    for (let n = 0; n < ev_data['gpu_util'].length; n++) {
                        document.getElementById('gpu_mem' + n).value = ev_data['gpu_mem'][n];
                        document.getElementById('gpu_util' + n).value = ev_data['gpu_util'][n];
                    }

                    break;
                case 'gpu_info':
                    var sys_bars = document.getElementById('sys_bars');

                    for (let n = 0; n < ev_data['gpu'].length; n++) {
                        var header = document.createElement('h4')
                        header.appendChild(document.createTextNode(ev_data['gpu'][n]))
                        header.style.marginBottom = '6px';
                        sys_bars.appendChild(header)

                        var cuda_etc = document.createElement('p')
                        cuda_etc.appendChild(document.createTextNode(
                            'Driver: ' + ev_data['driver'] + Array(6).fill('\xa0').join('') + 'CUDA: ' + ev_data['cuda']))
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
                    }, sys_interval);

                    break;
                case 'cpu_info':
                    var sys_bars = document.getElementById('sys_bars');
                    var header = document.createElement('h4')
                    header.appendChild(document.createTextNode(ev_data['mod_cpu']))
                    sys_bars.appendChild(header)
                    var tbl = document.createElement("table");
                    var tblBody = document.createElement("tbody");

                    for (let x = 0; x < ev_data['n_cpu']; x++) {
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


                    setInterval(() => {
                        vscode.postMessage({
                            command: 'get_cpu_stat'
                        });
                    }, sys_interval);

                    break;
                default:
                    break;
            }
        }
    });

    window.addEventListener("resize", function () {
        if (b_logs_plotted) {
            Array.from(document.getElementsByClassName('panel')).forEach(plot_div => {
                var div_sz = plot_div.getBoundingClientRect()
                var update = {
                    width: div_sz.width,
                    height: div_sz.height
                };
                if (plot_div.offsetHeight > 0) {
                    Plotly.relayout(plot_div, update);
                }
            });
        }
        if (b_dump_plotted) {
            var dump_div = document.getElementById("dump_div");
            var div_sz = dump_div.getBoundingClientRect()
            var update = {
                width: div_sz.width,
                height: div_sz.height
            };
            Plotly.relayout(dump_div, update);
        };
    });

    vscode.postMessage({
        command: 'get_cpu_info'
    });
    vscode.postMessage({
        command: 'get_gpu_info'
    });

    load_log_btn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_log'
        });
    })

    load_dump_btn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_dump'
        });
    })

    update_dump_btn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'update_dump'
        });
    })
    var modbar_config = {
        displayModeBar: true,
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d", "toggleHover", "toggleSpikelines", "togglehover"],
        modeBarButtonsToAdd: ["hoverclosest", "hovercompare",
            {
                name: 'download',
                attr: 'download',
                title: 'Save as Image (png)',
                icon: Plotly.Icons.camera,
                click: function (gd) {
                    Plotly.Snapshot.toImage(gd, {format: 'png'}).once('success', function(url) {
                        vscode.postMessage('<img src="' + url + '"/>')
                      });
                }
            }
        ],
        scrollZoom: true,
    }

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');

    var bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-background');

    var fg2 = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-textBlockQuote-foreground');

    var hl_col = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-lineHighlightBackground');

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

        var layout = {
            width: document.getElementById('logs').clientWidth - 10,
            height: window.innerHeight - 40,
            paper_bgcolor: "rgba(255,255,255,0)",
            plot_bgcolor: "rgba(255,255,255,0)",
            legend: {
                x: 0,
                xanchor: 'left',
                y: 80,
                orientation: 'h'
            },
            margin: {
                l: 60,
                r: 50,
                b: 35,
                t: 15
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
            },
            modebar: {
                orientation: 'v',
                bgcolor: "rgba(255,255,255,0)",
                color: fg,
                activecolor: fg2
            }
        }
        return layout
    }

    function plot_log(plot_div, data) {
        var layout = get_layout()
        layout.height = 300;
        Plotly.newPlot(document.getElementById(plot_div), data, layout, modbar_config);

        // Overriding plotly modebar style to fix inactive button shifting
        var modebar_groups = document.getElementsByClassName("modebar-group");
        for (let i = 0; i < modebar_groups.length; i++) {
            modebar_groups[i].style.display = "grid";
        }
    }

    function update_log(plot_div, data) {
        var plotly_div = document.getElementById(plot_div)
        for (let d = 0; d < data.length; d++) {
            data[d].visible = plotly_div.data[d].visible;
        }
        Plotly.react(plotly_div, data, plotly_div.layout);
    }

    function plot_dump(plot_div, data) {

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
        Plotly.newPlot(document.getElementById(plot_div),
            [data[0]], layout, modbar_config);

        // Overriding plotly modebar style to fix inactive button shifting
        var modebar_groups = document.getElementsByClassName("modebar-group");
        for (let i = 0; i < modebar_groups.length; i++) {
            modebar_groups[i].style.display = "grid";
        }
        document.getElementById(plot_div).style.border = '1px solid'
        document.getElementById(plot_div).style.borderColor = hl_col
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
        resize_plots_sub()
    }
}
