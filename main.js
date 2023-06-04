const { Worker } = require('worker_threads');
const arguments = process.argv;
const servers = [];
console.clear();

(async () => {
    console.log('[主线程] 启动');
    let ip;
    if (arguments.length >= 3) {
        ip = arguments[2];
        console.log('[主线程] IP：' + ip);
    }

    let servicesList = await require('./util/getServicesList')(ip);

    for (const services of servicesList) {
        console.log(`[主线程] 创建：${services.nickname}`);
        const worker = new Worker('./core/thread.js', {
            workerData: services
        });
        worker.on('error', (error) => {
            console.log(`[主线程] 错误：${services.nickname}：`, error);
        });
        worker.on('exit', (code) => {
            worker.removeAllListeners('message');
            worker.removeAllListeners('error');
            worker.removeAllListeners('exit');
            if (code !== 0) console.log(`[主线程] 异常退出：${services.nickname}`);
        });
        servers.push({
            ...services,
            worker
        });
    }
})();

process.on("SIGINT", async () => {
    console.log("\n\n\n");
    console.log(`[主线程] 检测到关闭信号，正在释放服务端口...`);

    // 释放端口
    for (const server of servers) await server.worker.postMessage({ code: -1 });

    setTimeout(() => {
        console.log(`[主线程] 退出...`);
    }, 200);
});
