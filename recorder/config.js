module.exports = {
    BLOCKFOUND: '16eXjTXuwq4K7PtpdfNGhVoQHuuUpYUfF4',
    BLOCKHEAD: '1AWEpKHWcdhXCfdPGH4zKEP1EMzSZAWsgB',
    BLOCKSEQ: '192gcfWz3sGB1mfWR98dkhDix1fYHNzYh4',
    TXN: '1NwmdmRduR59pYdGaafHVMvbjDvUAjsja5',
    CHAINS: {
        BTC: {
            id: 1,
            satoshis: 200000,
            blockApi: (blockHash) => {
                return `https://blockchain.info/rawblock/${blockhash}?format=hex`;
            },
            txnApi: (txnHash) => {
                return `https://blockchain.info/rawtx/${blockhash}?format=hex`;
            }
        }
    }
}