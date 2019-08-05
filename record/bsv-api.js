const bsv = require('bsv');
const fetch = require('node-fetch');

module.exports.getUtxos = function getUtxos(address) {
    return fetch(`https://api.bitindex.network/api/v3/${process.env.APINET}/addr/${address}/utxo`)
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then((data) => {
            return data;
        });
}

module.exports.sendTxn = function send(txn) {
    console.log(`Broadcasting: ${txn.hash}`);
    return fetch(`https://api.bitindex.network/api/v3/${process.env.APINET}/tx/send`, {
        method: 'post',
        body: JSON.stringify({rawtx: txn.toString()}),
        headers: {
            'Content-Type': 'application/json',
            'api_key': '5S6NL4ZeikgBqFCsJrv3bhexqDB1mNwz4GmnAK2hjzRviozF8Dx2sKjfT73vaFcuNn'
         }
    })
        .then(async (res) => {
            const data = await res.json();
            if(!res.ok) {
                throw new Error(data.message.message.substring(0, 100));
            }
            return data.txid
        })
}