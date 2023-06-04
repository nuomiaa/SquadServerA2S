const dgram = require("dgram");
const server = dgram.createSocket("udp4");
const chinaIP = require('../util/chinaIP');
const getToken = require('../util/getToken');
const formatDate = require('../util/formatDate');
const getServices = require('../util/getServices');
const randomNumber = require('../util/randomNumber');
const readNicknames = require('../util/readNicknames');
const gameServerQuery = require('../util/gameServerQuery');
const { parentPort, workerData } = require('worker_threads');

let info = {};
let config = {};
let shieldOverseas = false;
const clients = {};
const tempList = {};
const blacklist = {};
const serverInfo = {};
const playerList = [];
const nicknames = readNicknames();
const libqqwry = require('lib-qqwry');
const qqwry = libqqwry(true, './qqwry.dat');

// 更新服务器信息
async function updateServerInfo() {
    if (!info || info.status !== 3 || !info.info || !info.info.maxPlayers || info.info.maxPlayers == -1) return;
    const virtualPlayer = config.squadConfig.virtualPlayer;
    try {
        let conn = new gameServerQuery(workerData.ip, workerData.queryPort, 3, 15000);
        let tempInfo = await conn.info(true);
        conn = new gameServerQuery(workerData.ip, workerData.queryPort, 3, 5000);
        let tempRules = await conn.rules(true);
        conn = new gameServerQuery(workerData.ip, workerData.queryPort, 3, 5000);
        let tempPlayers = await conn.players(true);

        // 启用虚拟玩家人数
        if (virtualPlayer.is) {
            // 解析 Rules 数据
            const rules = conn._parseRulesBuffer(tempRules);
            const maxPlayers = rules.NUMPUBCONN;
            const maxQueue = rules.PublicQueueLimit_i;
            const currentPlayers = rules.PlayerCount_i > maxPlayers ? maxPlayers : rules.PlayerCount_i;
            const currentQueue = rules.PublicQueue_i;

            // 自动模式
            if (virtualPlayer.auto) {
                virtualPlayer.queue = 0;
                if (currentPlayers === 0) virtualPlayer.player = 1;
                else if (currentPlayers < 4) virtualPlayer.player = 4;
                else if (currentPlayers < 8) virtualPlayer.player = 6;
                else if (currentPlayers < 11) virtualPlayer.player = 8;
                else if (currentPlayers < 21) virtualPlayer.player = 10;
                else if (currentPlayers < 31) virtualPlayer.player = 12;
                else if (currentPlayers < 41) virtualPlayer.player = 15;
                else if (currentPlayers < 51) virtualPlayer.player = 18;
                else if (currentPlayers < 61) virtualPlayer.player = 20;
                else if (currentPlayers > 95) virtualPlayer.player = 0;
                else if (currentPlayers > 90) virtualPlayer.player = 3;
                else if (currentPlayers > 80) virtualPlayer.player = 8;
                else if (currentPlayers > 70) virtualPlayer.player = 15;
                else if (currentPlayers > 60) virtualPlayer.player = 18;
            }

            // 验证屏蔽海外
            if (virtualPlayer.player > 0) shieldOverseas = true;
            else shieldOverseas = false

            // 防止数据超出最大限制
            if (virtualPlayer.player + currentPlayers > maxPlayers) virtualPlayer.player = maxPlayers - currentPlayers;
            if (virtualPlayer.queue + currentQueue > maxQueue) virtualPlayer.queue = maxQueue - currentQueue;
            if (currentPlayers < maxPlayers - 2) virtualPlayer.queue = 0;

            // 修改数据
            if (virtualPlayer.player > 0 || virtualPlayer.queue > 0) {
                // 解析 Player 数据
                const players = conn._parsePlayersBuffer(tempPlayers);

                // 修改 Rules 数据
                rules.PlayerCount_i = virtualPlayer.player + currentPlayers;
                rules.PublicQueue_i = virtualPlayer.queue + currentQueue;

                // 修改 Player 数据
                players.playerCount += virtualPlayer.player + virtualPlayer.queue;
                if (playerList.length === 0 || playerList.length !== virtualPlayer.player) {
                    for (let i = 0; i < players.playerCount; i++) {
                        playerList.push({
                            index: 0,
                            name: nicknames[randomNumber(0, nicknames.length - 1)],
                            score: randomNumber(-30, 200),
                            duration: Number((Math.random() * randomNumber(10, 10000)).toPrecision(14))
                        });
                    }
                } else {
                    for (let i = 0; i < playerList.length; i++) {
                        playerList[i].duration++;
                    }
                }
                players.players = players.players.concat(playerList);
                players.players.sort((a, b) => { return b.duration - a.duration });

                // 封装数据
                tempInfo = conn._packageInfoBuffer(tempInfo, virtualPlayer.player + virtualPlayer.queue);
                tempRules = conn._packageRulesBuffer(rules);
                tempPlayers = conn._packagePlayersBuffer(players);
            }
            console.log(`[${formatDate()}] 更新A2S信息1 | ${currentPlayers + virtualPlayer.player}(+${virtualPlayer.player})/${maxPlayers} | ${rules.OWNINGNAME.substring(0, 30)}`);
        } else {
            console.log(`[${formatDate()}] 更新A2S信息2 | ${info.info.currentPlayersShow}/${info.info.maxPlayers} | ${info.info.name.substring(0, 30)}`);
        }

        serverInfo.info = tempInfo;
        serverInfo.player = tempPlayers;
        serverInfo.rules = tempRules;
    } catch (error) {
        console.log(`[${formatDate()}] 更新A2S信息失败 | ${workerData.nickname}`);
        // console.log(error);
    }
}

// 响应请求
server.on("message", async (res, rinfo) => {
    if (res.length < 9) return;// 忽略长度 < 9 的请求

    // 屏蔽海外
    if (shieldOverseas) {
        if (blacklist[rinfo.address]) return;
        const ipInfo = qqwry.searchIP(rinfo.address);
        if (rinfo.address === '119.188.247.29' || !chinaIP(ipInfo.Country)) {
            blacklist[rinfo.address] = 1;
            return;
        }
    }

    const type = res[4].toString(16);// 读取请求类型

    try {
        // A2S_INFO
        if (type === '54') {
            if (getToken(clients, server, type, rinfo, res)) return;
            server.send(serverInfo.info, rinfo.port, rinfo.address);
        }

        // A2S_PLAYER
        else if (type === '55') {
            if (getToken(clients, server, type, rinfo, res)) return;
            server.send(serverInfo.player, rinfo.port, rinfo.address);
        }

        // A2S_RULES
        else if (type === '56') {
            if (getToken(clients, server, type, rinfo, res)) return;
            server.send(serverInfo.rules, rinfo.port, rinfo.address);
        }
    } catch (error) {

    }
});

// 监听
server.on("connect", async (...q) => {
    console.log(...q);
});

// 监听
server.on("listening", async () => {
    const address = server.address();
    console.log(`[${formatDate()}] 监听 ${address.address}:${address.port} | ${workerData.nickname}`);

    // 获取配置
    info = await getServices(workerData.gid, workerData.uid);
    if (info) config = info.config;

    // 更新服务器信息
    await updateServerInfo();

    // 创建自动更新服务器信息
    setInterval(updateServerInfo, 1000);

    // 创建自动获取配置
    setInterval(async () => {
        info = await getServices(workerData.gid, workerData.uid);
        if (info) config = info.config;
    }, 1000 * 5);
});

// 主线程消息
parentPort.on('message', (data) => {
    // 主线程要求退出
    if (data.code === -1) {
        console.log(`[${formatDate()}] 释放端口 | ${workerData.nickname}`);
        process.exit();
    }
});

// 创建服务端口
if (workerData.queryPort > 0) server.bind(workerData.queryPort);
