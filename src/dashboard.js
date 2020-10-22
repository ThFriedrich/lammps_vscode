window.onload = function() {
    var vscode = acquireVsCodeApi();

    var button1 = document.getElementById('button1')
    var button2 = document.getElementById('button2')

    var log_layout
    var dump_layout

    document.getElementById("default_tab").click();

    setInterval(() => {
        vscode.postMessage({
            command: 'get_sys_info'
        });
    }, 500);

    setInterval(() => {
        vscode.postMessage({
            command: 'update_log'
        });
    }, 3000);

    button1.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_log'
        });
    })

    button2.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_dump'
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

    window.addEventListener('message', event => {
        switch (event.data.type) {
            case 'plot_log':
                log_layout = get_layout(event.data.layout)
                plot_log("plot_div", event.data.data, log_layout)
                break;
            case 'plot_dump':
                dump_layout = get_layout()
                plot_log("dump_div", event.data.data, dump_layout)
                break;
            case 'update_log':
                update_plot("plot_div", event.data.data, log_layout)
                break;
            case 'sys_info':
                document.getElementById('memory').value = event.data.data['memory'];
                document.getElementById('cpu').value = event.data.data['cpu'];
                break;
            default:
                break;
        }
    });
}

function get_layout(grid_layout = undefined) {

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');
    var bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-background');
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
        }
    };
    if (grid_layout) {
        Object.keys(grid_layout).forEach((ax) => {
            Object.assign(grid_layout[ax], axis_layout)
        });

        return {...layout, ...grid_layout }
    } else {
        return layout
    }
}

function plot_log(plot_div, data, layout) {

    Plotly.newPlot(document.getElementById(plot_div), data, layout, { scrollZoom: true });

}

function update_plot(plot_div, data, layout) {
    Plotly.react(document.getElementById(plot_div), data, layout);
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