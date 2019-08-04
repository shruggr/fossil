const { planaria, planarium } = require("neonplanaria");
const fs = require('fs-extra');

const bsv = require('datapay').bsv;
const bitindex = require('bitindex-sdk').instance();
const config = require('./config');
const fetch = require('node-fetch');

const BLOCKFOUND = '16eXjTXuwq4K7PtpdfNGhVoQHuuUpYUfF4';
const BLOCKHEAD = '1AWEpKHWcdhXCfdPGH4zKEP1EMzSZAWsgB';
const BLOCKSEQ = '192gcfWz3sGB1mfWR98dkhDix1fYHNzYh4';
const TXN = '1NwmdmRduR59pYdGaafHVMvbjDvUAjsja5';

require('dotenv').config();

const hdPriv = bsv.HDPrivateKey.fromString(process.env.HDPRIV);

function getUtxos(address) {
    return fetch(`https://api.bitindex.network/api/v3/test/addr/${address}/utxo`)
        .then((res) => res.json());
}

function send(txHex) {
    return fetch(`https://api.bitindex.network/api/v3/test/tx/send`, {
        method: 'post',
        body: {rawtx: txHex},
        headers: { 'Content-Type': 'application/json' }
    })
        .then((res) => res.json())
        .then(({txid}) => txid);
}

module.exports = async function writeBlock(chainId, header, txnIds) {
    let chainPrivateKey = hdPriv.deriveChild(`m/${config.CHAINS[chainId].id}`).privateKey;
    let chainAddress = chainPrivateKey.toAddress()

    const blockSeqs = [];
    let blockSeq;
    for(let i = 0; i < txnIds.length; i++) {
        if(i % 2900 == 0) {
            blockSeq = [];
            blockSeqs.push(blockSeq);
        }
        blockSeq.push(txnIds[i]);
    }

    const privateKeys = blockSeqs.map((blockSeq, i) => {
        return hdPriv.deriveChild(`m/${config.CHAINS[chainId].id}/${i}`).privateKey;
    })

    let allUtxos = await bitindex.address.getUtxos(chainAddress);
    let total = 0;
    let utxos = [];
    for(let utxo of allUtxos) {
        utxos.push(utxo);
        total += utxo.satoshis;
        if(total > config.CHAINS[chainId].satoshis) {
            break;
        }
    }
    const blockTxn = new bsv.Transaction()
        .from(utxos)
        .addOutput(bsv.Script.buildSafeDataOut([
            config.BLOCK, 
            chainId, 
            header
        ]))

    privateKeys.map((privateKey) => {
        blockTxn.to(privateKey.toAddress(), 100000);
    })
    blockTxn
        .change(chainAddress)
        .sign(chainPrivateKey);
    
    // const { txid } = await bitindex.tx.send(blockTxn.toString())
    const txid = blockTxn.hash;
    console.log(blockTxn);
    
    const blockSeqTxns = await Promise.all(privateKeys.map(async (privateKey, i) => {
        const address = privateKey.toAddress().toString();
        const utxos = await bitindex.address.getUtxos(address)
        const blockSeqTxn = new bsv.Transaction()
            .from(utxos.filter((utxo) => utxo.txid == txid))
            .addOutput(bsv.Script.buildSafeDataOut([
                config.BLOCKSEQ,
                ...blockSeqs[i]
            ]))
            .change(chainAddress)
            .sign(privateKey);
        // return send({data: blockSeqTxn.toString()})
        console.log(blockSeqTxn);
    }));

    return [
        blockTxn,
        ...blockSeqTxns
    ];
}
