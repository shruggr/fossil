const bitcore = require('bitcore-lib');
const fs = require('fs-extra');
const fetch = require('node-fetch');

async function getTxn(txid) {
    return fetch(`https://api.blockcypher.com/v1/btc/main/txs/${txid}?includeHex=true`)
        .then((res) => res.json())
        .then(({hex}) => hex);
}

async function doStuff() {
    let blockData = await fetch(`https://api.blockcypher.com/v1/btc/main/blocks/0000000000000000000a75f132ae24b4fe31a0c86c7e2c97e51922728937b6e4`)
        .then((res) => res.json());
    
    let header = new bitcore.BlockHeader({
        prevHash: blockData.prev_block,
        merkleRoot: blockData.mrkl_root,
        hash: blockData.hash,
        version: blockData.ver,
        time: new Date(blockData.time).getTime() / 1000,
        bits: blockData.bits,
        nonce: blockData.nonce
    });

    for(let txid of blockData.txids) {
        await fs.writeFile(
            `${__dirname}/../data/btc/txns/${txid}`,
            await getTxn(txid)
        );
    }

    await fs.writeFile(`${__dirname}/../data/btc/blocks/${header.hash}`, JSON.stringify({
        header: header.toString(),
        txids: blockData.txids
    }, null, 2));


}

doStuff()
    .catch(console.error)
    .then(() => process.exit(0));