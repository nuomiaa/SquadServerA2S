const fs = require("fs");
const axios = require("axios");
let first = true;
module.exports = async (ip) => {
    let servers = {};
    try {
        const ret = (await axios.get('http://squad.tzyjs.cn/api/service/remote_services?apikey=30309a9551954c34abbd19569818ab70')).data;
        if (ret.status !== 200) return;

        // 获取白名单IP列表
        const list = fs.readFileSync('./list.txt', 'utf-8').toString();

        if (first) {
            console.log('[ 白名单 ]\n' + list);
            first = false
        }
        
        for (const daemon of ret.data) {
            if (ip && daemon.ip !== ip) continue; // 过滤命令行指定IP
            if (list && list.indexOf(daemon.ip) === -1) continue; // 过滤白名单主机
            if (daemon.remarks.indexOf('SQUAD #') === -1) continue; // 过滤非 SQUAD 主机

            for (const server of daemon.instances) {
                if (server.config.type !== 'steam/squad') continue; // 过滤非 SQUAD 实例
                if (!server.config.squadConfig?.virtualPlayer) continue; // 过滤旧版本守护进程
                servers[server.instanceUuid] = {
                    ip: daemon.ip,
                    gid: daemon.uuid,
                    uid: server.instanceUuid,
                    nickname: server.config.nickname,
                    queryPort: server.config.squadConfig.queryPort,
                    is: server.config.squadConfig.virtualPlayer.is,
                    auto: server.config.squadConfig.virtualPlayer.auto,
                    player: server.config.squadConfig.virtualPlayer.player,
                    queue: server.config.squadConfig.virtualPlayer.queue
                }
            }
        }

        fs.writeFileSync('./servers.json', JSON.stringify(servers));
    } catch (error) {
        console.log('[获取服务器列表] 错误', error);
        try {
            servers = JSON.parse(fs.readFileSync('./servers.json').toString(), true);
        } catch (error) { }
    }
    return servers;
}
