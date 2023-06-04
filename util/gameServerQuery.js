"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryGameServerRules = exports.queryGameServerPlayer = exports.queryGameServerInfo = void 0;
const promiseSocket_1 = require("./promiseSocket");
class GameServerQuery {
    constructor(_host, _port, attempts, timeout) {
        this._host = _host;
        this._port = _port;
        this._token = null;
        this._promiseSocket = new promiseSocket_1.PromiseSocket(attempts, timeout);
    };

    close() {
        this._promiseSocket.closeSocket();
    }

    async info(source = false) {
        let resultBuffer;
        let challengeTries = 0;
        let gotResponse = false;

        // 获取 Token
        try {
            resultBuffer = await this._promiseSocket.send(this._buildInfoPacket(), this._host, this._port);
        } catch (error) {
            this._promiseSocket.closeSocket();
            throw new Error(error);
        }

        // 检查是否响应 Token
        if (!this._isChallengeResponse(resultBuffer)) {
            this._promiseSocket.closeSocket();
            throw new Error('Info 未响应Token');
        }

        const token = resultBuffer.slice(5);
        this._token = token;
        // console.log('[调试]', 'Info Token:', token);

        // 获取 Info
        resultBuffer = null;
        do {
            try {
                resultBuffer = await this._promiseSocket.send(this._buildInfoPacket(token), this._host, this._port);
            } catch (error) {
                this._promiseSocket.closeSocket();
                throw new Error(error);
            }
            if (!this._isChallengeResponse(resultBuffer)) gotResponse = true;
            challengeTries++;
        } while (!gotResponse && challengeTries <= 5);

        this._promiseSocket.closeSocket();
        if (source) return resultBuffer; // 返回原数据
        const parsedBuffer = this._parseInfoBuffer(resultBuffer);
        return parsedBuffer;
    }

    async rules(source = false) {
        let resultBuffer;
        let challengeTries = 0;
        let gotResponse = false;
        let token = this._token;

        // 获取 Token
        if (!this._token) {
            try {
                resultBuffer = await this._promiseSocket.send(this._buildPacket(Buffer.from([0x56])), this._host, this._port);
                resultBuffer = await this._promiseSocket.send(this._buildPacket(Buffer.from([0x56])), this._host, this._port);
            } catch (error) {
                this._promiseSocket.closeSocket();
                throw new Error(error);
            }

            // 检查是否响应 Token
            if (!this._isChallengeResponse(resultBuffer)) {
                this._promiseSocket.closeSocket();
                throw new Error('Rules 未响应Token');
            }

            token = resultBuffer.slice(5);
        }

        // console.log('[调试]', 'Rules Token:', token);

        // 获取 Info
        resultBuffer = null;
        do {
            try {
                resultBuffer = await this._promiseSocket.send(this._buildPacket(Buffer.from([0x56]), token), this._host, this._port);
            } catch (error) {
                this._promiseSocket.closeSocket();
                throw new Error(error);
            }
            if (!this._isChallengeResponse(resultBuffer)) gotResponse = true;
            challengeTries++;
        } while (!gotResponse && challengeTries <= 5);

        this._promiseSocket.closeSocket();
        if (source) return resultBuffer; // 返回原数据
        const parsedBuffer = this._parseRulesBuffer(resultBuffer);
        return parsedBuffer;
    }

    async players(source = false) {
        let resultBuffer;
        let challengeTries = 0;
        let gotResponse = false;
        let token = this._token;

        // 获取 Token
        if (!this._token) {
            try {
                resultBuffer = await this._promiseSocket.send(this._buildPacket(Buffer.from([0x55])), this._host, this._port);
                resultBuffer = await this._promiseSocket.send(this._buildPacket(Buffer.from([0x55])), this._host, this._port);
            } catch (error) {
                this._promiseSocket.closeSocket();
                throw new Error(error);
            }

            // 检查是否响应 Token
            if (!this._isChallengeResponse(resultBuffer)) {
                this._promiseSocket.closeSocket();
                throw new Error('Players 未响应Token');
            }

            token = resultBuffer.slice(5);
        }

        // console.log('[调试]', 'Players Token:', token);

        // 获取 Players
        resultBuffer = null;
        do {
            try {
                resultBuffer = await this._promiseSocket.send(this._buildPacket(Buffer.from([0x55]), token), this._host, this._port);
            } catch (error) {
                this._promiseSocket.closeSocket();
                throw new Error(error);
            }
            if (!this._isChallengeResponse(resultBuffer)) gotResponse = true;
            challengeTries++;
        } while (!gotResponse && challengeTries <= 5);

        this._promiseSocket.closeSocket();
        if (source) return resultBuffer; // 返回原数据
        const parsedBuffer = this._parsePlayersBuffer(resultBuffer);
        return parsedBuffer;
    }

    _buildInfoPacket(challenge) {
        let packet = Buffer.concat([
            Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
            Buffer.from([0x54]),
            Buffer.from('Source Engine Query', 'ascii'),
            Buffer.from([0x00])
        ]);
        if (challenge) {
            packet = Buffer.concat([
                packet,
                challenge
            ]);
        }
        return packet;
    }

    _buildPacket(header, challenge) {
        let packet = Buffer.concat([
            Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
            header
        ]);
        if (challenge) {
            packet = Buffer.concat([
                packet,
                challenge
            ]);
        }
        else {
            packet = Buffer.concat([
                packet,
                Buffer.from([0xFF, 0xFF, 0xFF, 0xFF])
            ]);
        }
        return packet;
    }
    _isChallengeResponse(buffer) {
        return buffer.compare(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x41]), 0, 5, 0, 5) === 0;
    }
    _parseInfoBuffer(buffer) {
        const infoResponse = {};
        buffer = buffer.slice(5);
        [infoResponse.protocol, buffer] = this._readUInt8(buffer);
        [infoResponse.name, buffer] = this._readString(buffer);
        [infoResponse.map, buffer] = this._readString(buffer);
        [infoResponse.folder, buffer] = this._readString(buffer);
        [infoResponse.game, buffer] = this._readString(buffer);
        [infoResponse.appId, buffer] = this._readInt16LE(buffer);
        [infoResponse.players, buffer] = this._readUInt8(buffer);
        [infoResponse.maxPlayers, buffer] = this._readUInt8(buffer);
        [infoResponse.bots, buffer] = this._readUInt8(buffer);
        infoResponse.serverType = buffer.subarray(0, 1).toString('utf-8');
        buffer = buffer.slice(1);
        infoResponse.environment = buffer.subarray(0, 1).toString('utf-8');
        buffer = buffer.slice(1);
        [infoResponse.visibility, buffer] = this._readUInt8(buffer);
        [infoResponse.vac, buffer] = this._readUInt8(buffer);
        [infoResponse.version, buffer] = this._readString(buffer);
        // if the extra data flag (EDF) is present
        if (buffer.length > 1) {
            let edf;
            [edf, buffer] = this._readUInt8(buffer);
            if (edf & 0x80) {
                [infoResponse.port, buffer] = this._readInt16LE(buffer);
            }
            if (edf & 0x10) {
                buffer = buffer.slice(8);
            }
            if (edf & 0x40) {
                [infoResponse.spectatorPort, buffer] = this._readUInt8(buffer);
                [infoResponse.spectatorName, buffer] = this._readString(buffer);
            }
            if (edf & 0x20) {
                [infoResponse.keywords, buffer] = this._readString(buffer);
            }
            if (edf & 0x01) {
                infoResponse.gameId = buffer.readBigInt64LE();
                buffer = buffer.slice(8);
            }
        }
        return infoResponse;
    }
    _packageInfoBuffer(hex, player) {// 封装Info
        const len = hex.indexOf(Buffer.from([0x00, 0x73, 0x71, 0x75, 0x61, 0x64, 0x00, 0x53, 0x71, 0x75, 0x61, 0x64, 0x00])) + 15;
        let oldPlayer = 0;
        let buffer;
        [oldPlayer, buffer] = this._readUInt8(hex.slice(len));
        hex.writeUInt8(oldPlayer + player, len);
        return hex;
    }
    _parsePlayersBuffer(buffer) {// 解析Players
        const playerResponse = {};
        buffer = buffer.slice(5);
        [playerResponse.playerCount, buffer] = this._readUInt8(buffer);
        playerResponse.players = [];
        for (let i = 0; i < playerResponse.playerCount; i++) {
            let player;
            [player, buffer] = this._readPlayer(buffer);
            playerResponse.players.push(player);
        }
        return playerResponse;
    }
    _packagePlayersBuffer(obj) {// 封装Players
        let playerBuffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x44, '0x' + obj.playerCount.toString(16)]);
        for (let i = 0; i < obj.playerCount; i++) {
            if (!obj.players[i]) continue;
            const score = Buffer.allocUnsafe(4);
            score.writeInt32LE(obj.players[i].score, 0);
            const duration = Buffer.allocUnsafe(4);
            duration.writeFloatLE(obj.players[i].duration, 0);

            playerBuffer = Buffer.concat([
                playerBuffer,
                Buffer.from([0x00]),
                Buffer.from(obj.players[i].name),
                Buffer.from([0x00]),
                score,
                duration
            ]);
        }
        return playerBuffer;
    }
    _parseRulesBuffer(buffer) {// 解析Rules
        let ruleCount = 0;
        let rulesResponse = {};
        buffer = buffer.slice(5);
        [ruleCount, buffer] = this._readInt16LE(buffer);
        for (let i = 0; i < ruleCount; i++) {
            let rule;
            [rule, buffer] = this._readRule(buffer);
            rulesResponse = {
                ...rulesResponse,
                ...rule
            }
        }
        return rulesResponse;
    }
    _packageRulesBuffer(obj) {// 封装Rules
        let rulesBuffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x45, '0x' + Object.keys(obj).length.toString(16), 0x00]);
        for (const key in obj) {
            rulesBuffer = Buffer.concat(
                [
                    rulesBuffer,
                    Buffer.from(String(key)),
                    Buffer.from([0x00]),
                    Buffer.from(String(obj[key])),
                    Buffer.from([0x00])
                ]
            )
        }
        return rulesBuffer;
    }
    _readString(buffer) {
        const endOfName = buffer.indexOf(0x00);
        const stringBuffer = buffer.subarray(0, endOfName);
        const modifiedBuffer = buffer.slice(endOfName + 1);
        return [stringBuffer.toString('utf-8'), modifiedBuffer];
    }
    _readUInt8(buffer) {
        return [buffer.readUInt8(), buffer.slice(1)];
    }
    _readInt16LE(buffer) {
        return [buffer.readInt16LE(), buffer.slice(2)];
    }
    _readPlayer(buffer) {
        // console.log(buffer);
        let player = {};
        [player.index, buffer] = this._readUInt8(buffer);
        [player.name, buffer] = this._readString(buffer);
        player.score = buffer.readInt32LE();
        buffer = buffer.slice(4);
        player.duration = buffer.readFloatLE();
        buffer = buffer.slice(4);
        return [player, buffer];
    }
    _readRule(buffer) {
        let name, value;
        [name, buffer] = this._readString(buffer);
        [value, buffer] = this._readString(buffer);
        if (value.length <= 16 && Number(value) == value) value = Number(value);
        if (value === 'false') value = false;
        if (value === 'true') value = true;
        return [{ [name]: value }, buffer];
    }
}
module.exports = GameServerQuery;