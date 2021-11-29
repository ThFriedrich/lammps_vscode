const smi = require('node-nvidia-smi');
const osu = require('node-os-utils');
const cpuStats = require('cpu-stats')

export function get_gpu_info(): Promise<{ n_gpus: number, cuda: string, driver: string, gpu: string[] }> {
    return new Promise((resolve, reject) => {
        smi(function (err: any, data: any) {
            // handle errors
            if (err) {
                reject(err);
            } else {
                const n_gpus: number = Number(data.nvidia_smi_log.attached_gpus)
                const cuda: string = data.nvidia_smi_log.cuda_version
                const driver: string = data.nvidia_smi_log.driver_version
                let gpu: string[] = []
                let gpus = data.nvidia_smi_log.gpu
                if (n_gpus <= 1) {
                    gpus = Array(data.nvidia_smi_log.gpu)
                }
                gpus.forEach((gpu_i: { product_name: string; }) => {
                    gpu.push(gpu_i.product_name)
                });
                resolve({ n_gpus: n_gpus, cuda: cuda, driver: driver, gpu: gpu })
            }
        }
        )
    })
}

export function get_gpu_stat(): Promise<{ gpu_util: number[], gpu_mem: number[] }> {
    return new Promise((resolve, reject) => {
        smi(function (err: any, data: any) {
            // handle errors
            if (err) {
                reject(err);
            } else {
                const n_gpus: number = Number(data.nvidia_smi_log.attached_gpus)
                let util: number[] = []
                let mem: number[] = []
                let gpus = data.nvidia_smi_log.gpu
                if (n_gpus == 1) {
                    gpus = Array(data.nvidia_smi_log.gpu)
                }
                gpus.forEach((gpu_i: { fb_memory_usage: any; utilization: { gpu_util: string | any[]; }; }) => {
                    const mem_vals = gpu_i.fb_memory_usage
                    const mem_prct = Number(mem_vals['used'].slice(0, -4)) / Number(mem_vals['total'].slice(0, -4)) * 100
                    mem.push(mem_prct)
                    util.push(Number(gpu_i.utilization.gpu_util.slice(0, -2)))
                });
                resolve({ gpu_util: util, gpu_mem: mem })
            }
        }
        )
    })
}

export async function get_cpu_info(): Promise<{ n_cpu: number, mod_cpu: string, tot_mem: number } | void> {

    const n_cpu: number = osu.cpu.count()
    const mod_cpu: string = osu.cpu.model()
    const tot_mem: number = osu.mem.totalMem()/(1024**3) // convert to GB

    return { n_cpu: n_cpu, mod_cpu: mod_cpu, tot_mem: tot_mem };

}

export async function get_cpu_stat(): Promise<{}> {

    const p_mem: Promise<number> = osu.mem.info().then((info: any): number => {
        return 100 - info.freeMemPercentage
    })

    const p_cpu = new Promise((resolve, reject) => {
        cpuStats(1000, function (err: any, data: any) {
            if (err) {
                reject(err);
            } else {
                resolve(data)
            }
        })
    })

    const mem_prct = await p_mem;
    const cpu_prct = await p_cpu;
    return { memory: mem_prct, cpu: cpu_prct };
}