const bsv = require('bsv');
const fs = require('fs-extra');
const path = require('path');

const hdPriv = bsv.HDPrivateKey.fromRandom();
const fundingPriv = hdPriv.privateKey;
const fundingAddress = fundingPriv.toAddress(process.env.NETWORK).toString();
console.log(`Funding Address: ${fundingAddress}`);

fs.writeFileSync(path.join(__dirname, '../.env'),
`HDPRIV=${hdPriv.toString()}
NETWORK=mainnet
APINET=main`)
