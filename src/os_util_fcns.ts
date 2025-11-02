import { NvidiaSMI } from '@quik-fe/node-nvidia-smi';
const osu = require('node-os-utils');
const cpuStats = require('cpu-stats')

export async function get_gpu_info(): Promise<{ n_gpus: number, cuda: string, driver: string, gpu: string[] }> {
    try {
        const exists = await NvidiaSMI.exist();
        if (!exists) {
            throw new Error('nvidia-smi not found');
        }

        const driverVersion = await NvidiaSMI.Utils.getDriverVersion();
        const cudaVersion = await NvidiaSMI.Utils.getCudaVersion();
        const n_gpus = await NvidiaSMI.Utils.getAttachedGPUs();
        
        const gpu: string[] = [];
        
        // Get detailed GPU data
        const rawData = await NvidiaSMI.get_details();
        
        // Parse GPU names from raw data
        if (rawData && rawData.nvidia_smi_log && rawData.nvidia_smi_log.gpu) {
            const gpus = Array.isArray(rawData.nvidia_smi_log.gpu) 
                ? rawData.nvidia_smi_log.gpu 
                : [rawData.nvidia_smi_log.gpu];
            
            gpus.forEach((gpu_i: any) => {
                if (gpu_i && gpu_i.product_name) {
                    gpu.push(gpu_i.product_name);
                }
            });
        }
        
        return { 
            n_gpus: n_gpus, 
            cuda: cudaVersion?.toString() || 'N/A', 
            driver: driverVersion?.toString() || 'N/A', 
            gpu: gpu 
        };
    } catch (err) {
        throw err;
    }
}

export async function get_gpu_stat(): Promise<{ gpu_util: number[], gpu_mem: number[] }> {
    try {
        const n_gpus = await NvidiaSMI.Utils.getAttachedGPUs();
        const util: number[] = [];
        const mem: number[] = [];
        
        // Get detailed GPU data
        const rawData = await NvidiaSMI.get_details();
        
        if (rawData && rawData.nvidia_smi_log && rawData.nvidia_smi_log.gpu) {
            const gpus = Array.isArray(rawData.nvidia_smi_log.gpu) 
                ? rawData.nvidia_smi_log.gpu 
                : [rawData.nvidia_smi_log.gpu];
            
            gpus.forEach((gpu_i: any) => {
                if (gpu_i) {
                    // Get utilization
                    if (gpu_i.utilization && gpu_i.utilization.gpu_util) {
                        const utilStr = gpu_i.utilization.gpu_util.toString();
                        const utilNum = parseFloat(utilStr.replace(/[^0-9.]/g, ''));
                        util.push(utilNum);
                    }
                    
                    // Get memory usage
                    if (gpu_i.fb_memory_usage) {
                        const used = parseFloat(gpu_i.fb_memory_usage.used.toString().replace(/[^0-9.]/g, ''));
                        const total = parseFloat(gpu_i.fb_memory_usage.total.toString().replace(/[^0-9.]/g, ''));
                        const mem_prct = (used / total) * 100;
                        mem.push(mem_prct);
                    }
                }
            });
        }
        
        return { gpu_util: util, gpu_mem: mem };
    } catch (err) {
        throw err;
    }
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