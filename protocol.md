# Fossil Blockchain Protocol

## "Block Funding" Transaction
### Outputs
#### vout 0-n
- Payments to be used to fund Transaction List transactions

#### OP_RETURN
1 BLOCK HEAD Protocol ID - 1AWEpKHWcdhXCfdPGH4zKEP1EMzSZAWsgB
2 ChainID - BTC, BCH
3 Block Header hex


## "Transaction List" Transaction
### Inputs
- One of outputs 0-n from Block Funding Transaction
- Any addition inputs needed to fund transaction fees

### Output
#### OP_RETURN Output
1 BLOCK TXNS Protocol ID - 1NwmdmRduR59pYdGaafHVMvbjDvUAjsja5
2 1st transaction hex
3 2nd transaction hex
4 ...
n nth transaction hex

