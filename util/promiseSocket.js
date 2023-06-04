"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromiseSocket = void 0;
const dgram_1 = require("dgram");
class PromiseSocket {
    constructor(_attempts, _timeout) {
        this._attempts = _attempts;
        this._timeout = _timeout;
        if (Array.isArray(this._timeout) &&
            this._attempts !== this._timeout.length) {
            throw new Error(`尝试次数 (${this._attempts}) 与超时数组的长度 (${this._timeout.length}) 不匹配`);
        }
        this._socket = (0, dgram_1.createSocket)('udp4');
    }
    async send(buffer, host, port) {
        return new Promise(async (resolve, reject) => {
            for (let i = 0; i < this._attempts; i++) {
                let timeout;
                if (Array.isArray(this._timeout)) {
                    timeout = this._timeout[i];
                }
                else {
                    timeout = this._timeout;
                }
                try {
                    const messageBuffer = await this._socketSend(buffer, host, port, timeout);
                    return resolve(messageBuffer);
                }
                catch (err) {
                    if (i === this._attempts - 1) {
                        return reject(err);
                    }
                }
            }
        });
    }
    closeSocket() {
        this._socket.close();
    }
    _socketSend(buffer, host, port, timeout) {
        // console.log('[发送]', buffer.length, buffer);
        return new Promise((resolve, reject) => {
            this._socket.send(buffer, port, host, (err) => {
                if (err) return reject(typeof err == 'string' ? new Error(err) : err);
                const messageListener = (buffer) => {
                    // console.log('[接收]', buffer.length, buffer);
                    this._socket.removeListener('message', messageListener);
                    this._socket.removeListener('error', errorListener);
                    clearTimeout(timeoutFnc);
                    return resolve(buffer);
                };
                const errorListener = (err) => {
                    clearTimeout(timeoutFnc);
                    return reject(err);
                };
                const timeoutFnc = setTimeout(() => {
                    this._socket.removeListener('message', messageListener);
                    this._socket.removeListener('error', errorListener);
                    return reject('查询超时');
                }, timeout);
                this._socket.on('message', messageListener);
                this._socket.on('error', errorListener);
            });
        });
    }
}
exports.PromiseSocket = PromiseSocket;
