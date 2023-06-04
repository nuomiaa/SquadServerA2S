const axios = require("axios");
module.exports = async (gid, uid) => {
    if (!gid || !uid) return {};
    try {
        const ret = (await axios.get(`http://squad.tzyjs.cn/api/instance?uuid=${uid}&remote_uuid=${gid}&apikey=30309a9551954c34abbd19569818ab70`)).data;
        if (ret.status !== 200) return {};
        return ret.data;
    } catch (error) {

    }
    return;
}
