const { Worker } = require('worker_threads');
const arguments = process.argv;
const oldServers = {};
const servers = {};
let mainInterval = null;
console.clear();
console.log('[主线程] 启动');


main();
async function main() {
    clearInterval(mainInterval);
    const servicesList = await require('./util/getServicesList')();

    for (const uid in servicesList) {
        const server = servicesList[uid];

        // 创建新线程
        if (!servers[server.uid]) {
            console.log(`[主线程] 创建：${server.nickname}`);

            const worker = new Worker('./core/thread.js', {
                workerData: server
            });

            worker.on('error', (error) => {
                console.log(`[主线程] 错误：${server.nickname}：`, error);
            });

            worker.on('exit', (code) => {
                worker.removeAllListeners('message');
                worker.removeAllListeners('error');
                worker.removeAllListeners('exit');
                if (code !== 0) console.log(`[主线程] 异常退出：${server.nickname}`);
            });

            servers[uid] = {
                ...server,
                worker
            }
        }
    }

    // 关闭不存在的服务器线程
    for (const uid in servers) {
        const server = servers[uid];
        if (!servicesList[uid]) {
            delete servers[uid];
            console.log(`[主线程] 销毁：${server.nickname}`);
            server.worker.postMessage({ code: -1 });
        }
    }

    mainInterval = setInterval(main, 1000 * 3);
}

process.on("SIGINT", async () => {
    console.log("\n\n\n");
    console.log(`[主线程] 检测到关闭信号，正在释放服务端口...`);

    clearInterval(mainInterval);

    // 释放端口
    for (const uid in servers) {
        const server = servers[uid];
        await server.worker.postMessage({ code: -1 });
    }

    setTimeout(() => {
        console.log(`[主线程] 退出...`);
    }, 200);
});
