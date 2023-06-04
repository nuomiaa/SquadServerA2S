const randomNumber = require('./randomNumber');
module.exports = (clients, server, type, rinfo, resultBuffer) => {
    const time = Math.round(new Date() / 1000);

    // 读取 Token
    let token = resultBuffer.slice(5, 9);
    if (resultBuffer.length === 29 && type === '54') token = resultBuffer.slice(25, 29);

    // 验证 Token
    if (
        !clients[rinfo.address] ||
        clients[rinfo.address].i > 20 ||
        time - clients[rinfo.address].time > 20 ||
        clients[rinfo.address].token.toString('hex') !== token.toString('hex')
    ) {
        clients[rinfo.address] = {
            i: 0,
            time: time,
            token: Buffer.from([randomNumber(1, 255), randomNumber(1, 255), randomNumber(1, 255), randomNumber(1, 255)])
        }

        // 发送 Token
        server.send(Buffer.concat([Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x41]), clients[rinfo.address].token]), rinfo.port, rinfo.address);
        return true;
    }

    // 增加请求次数
    clients[rinfo.address].i++;
    return false;
}
