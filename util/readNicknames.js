const fs = require('fs');
module.exports = () => {
    let nicknames = [];
    try {
        nicknames = fs.readFileSync('nicknames.txt', 'utf8').toString().split('\n');
    } catch (error) {}
    return nicknames;
}
