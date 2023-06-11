console.clear();
const fs = require('fs');
const dgram = require("dgram");
const args = process.argv.slice(2);
const server = dgram.createSocket("udp4");
const chinaIP = require('./util/chinaIP');
const getToken = require('./util/getToken');
const formatDate = require('./util/formatDate');
const randomNumber = require('./util/randomNumber');
const readNicknames = require('./util/readNicknames');
const gameServerQuery = require('./util/gameServerQuery');

let info = {};
const params = {};
const clients = {};
const blacklist = {};
const serverInfo = {};
const playerList = [];
const nicknames = readNicknames();
const libqqwry = require('lib-qqwry');
const qqwry = libqqwry(true, './qqwry.dat');
let filePath = '/home/container/a2s.json';
// const filePath = 'D:/NodeJS/SquadServerA2S_Test/a2s.json';

args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (value && value.trim() !== '') params[key.toLocaleUpperCase()] = value;
});

const ip = params['LOCALIP'] || '127.0.0.1';
const port = params['QUERYPORT'] || 50001;
let state = Boolean(params['VP']) || false;
// if (params['DIR']) filePath = params['DIR'] + '/a2s.json';

let A2SConfig = {
    block: false,
    auto: false,
    player: 0,
    queue: 0
}

// 更新配置文件
updateConfig();

// 更新服务器信息
async function updateServerInfo() {
    try {
        let conn = new gameServerQuery(ip, port, 3, 15000);
        let tempInfo = await conn.info(true);
        conn = new gameServerQuery(ip, port, 3, 5000);
        let tempRules = await conn.rules(true);
        conn = new gameServerQuery(ip, port, 3, 5000);
        let tempPlayers = await conn.players(true);

        // 解析 Rules 数据
        const rules = conn._parseRulesBuffer(tempRules);
        const maxPlayers = rules.NUMPUBCONN;
        const maxQueue = rules.PublicQueueLimit_i;
        const currentPlayers = rules.PlayerCount_i > maxPlayers ? maxPlayers : rules.PlayerCount_i;
        const currentQueue = rules.PublicQueue_i;

        // 启用虚拟玩家人数
        if (state) {
            // 自动模式
            if (A2SConfig.auto) {
                A2SConfig.queue = 0;
                if (currentPlayers === 0) A2SConfig.player = 1;
                else if (currentPlayers < 4) A2SConfig.player = 4;
                else if (currentPlayers < 8) A2SConfig.player = 6;
                else if (currentPlayers < 11) A2SConfig.player = 8;
                else if (currentPlayers < 21) A2SConfig.player = 10;
                else if (currentPlayers < 31) A2SConfig.player = 12;
                else if (currentPlayers < 41) A2SConfig.player = 15;
                else if (currentPlayers < 51) A2SConfig.player = 18;
                else if (currentPlayers < 61) A2SConfig.player = 20;
                else if (currentPlayers > 95) A2SConfig.player = 0;
                else if (currentPlayers > 90) A2SConfig.player = 3;
                else if (currentPlayers > 80) A2SConfig.player = 8;
                else if (currentPlayers > 70) A2SConfig.player = 15;
                else if (currentPlayers > 60) A2SConfig.player = 18;
            }

            // 验证屏蔽海外
            if (A2SConfig.player > 0) shieldOverseas = true;
            else shieldOverseas = false

            // 防止数据超出最大限制
            if (A2SConfig.player + currentPlayers > maxPlayers) A2SConfig.player = maxPlayers - currentPlayers;
            if (A2SConfig.queue + currentQueue > maxQueue) A2SConfig.queue = maxQueue - currentQueue;
            if (currentPlayers < maxPlayers - 2) A2SConfig.queue = 0;

            // 修改数据
            if (A2SConfig.player > 0 || A2SConfig.queue > 0) {
                // 解析 Player 数据
                const players = conn._parsePlayersBuffer(tempPlayers);

                // 修改 Rules 数据
                rules.PlayerCount_i = A2SConfig.player + currentPlayers;
                rules.PublicQueue_i = A2SConfig.queue + currentQueue;

                // 修改 Player 数据
                players.playerCount += A2SConfig.player + A2SConfig.queue;
                if (playerList.length === 0 || playerList.length !== A2SConfig.player) {
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
                tempInfo = conn._packageInfoBuffer(tempInfo, A2SConfig.player + A2SConfig.queue);
                tempRules = conn._packageRulesBuffer(rules);
                tempPlayers = conn._packagePlayersBuffer(players);
            }
            console.log(`[${formatDate()}] 更新A2S信息1 | ${currentPlayers + A2SConfig.player}(+${A2SConfig.player})/${maxPlayers} | ${rules.OWNINGNAME.substring(0, 30)}`);
        } else {
            console.log(`[${formatDate()}] 更新A2S信息2 | ${currentPlayers + A2SConfig.player}(+${A2SConfig.player})/${maxPlayers} | ${rules.OWNINGNAME.substring(0, 30)}`);
        }

        serverInfo.info = tempInfo;
        serverInfo.player = tempPlayers;
        serverInfo.rules = tempRules;
    } catch (error) {
        console.log(`[${formatDate()}] 更新A2S信息失败`);
        console.log(error);
    }
}

function updateConfig() {
    // 判断配置文件是否存在，不存在则创建配置文件
    if (!fs.existsSync(filePath)) {
        try {
            fs.writeFileSync(filePath, JSON.stringify({
                block: false,
                auto: false,
                player: 0,
                queue: 0
            }));
        } catch (err) {
            console.error(`[${formatDate()}] 无法写入配置文件:`, err);
            // process.exit(1);
        }
    }
    
    try {
        A2SConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`[${formatDate()}] 无法读取配置文件:`, err);
        // process.exit(1);
    }
}

// 响应请求
server.on("message", async (res, rinfo) => {
    if (res.length < 9) return;// 忽略长度 < 9 的请求

    // 屏蔽海外
    if (A2SConfig.block) {
        if (blacklist[rinfo.address]) return;
        const ipInfo = qqwry.searchIP(rinfo.address);
        if (!chinaIP(ipInfo.Country)) {
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
server.on("listening", async () => {
    const address = server.address();
    console.log(`[${formatDate()}] 请求 ${ip}:${port}`);
    console.log(`[${formatDate()}] 监听 ${address.address}:${address.port}`);
    console.log(`[${formatDate()}] 状态 ${state}`);

    // 更新服务器信息
    await updateServerInfo();

    // 创建自动更新服务器信息
    setInterval(updateServerInfo, 1000);

    // 自动更新配置文件
    setInterval(updateConfig, 1000);
});

// 错误处理
process.on('unhandledRejection', (error) => console.error('未处理的拒绝', error));
process.on('uncaughtException', (error) => console.error('未捕获的异常', error));

// 创建服务端口
server.bind(Number(port) + 30000);
