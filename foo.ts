import * as protobuf from "protobufjs";
import { readFileSync, writeFileSync } from "fs";

const root = protobuf.loadSync("bank.proto");
const BankMessage = root.lookupType("Bank");

const jsonData = JSON.parse(readFileSync('public/assets/sounds/unicorn/bank.json', { encoding: 'utf8' }));
// Assuming jsonData is your data in JSON format:
const errMsg = BankMessage.verify(jsonData);
if (errMsg) throw Error(errMsg);

const buffer = BankMessage.encode(BankMessage.create(jsonData)).finish();
writeFileSync('foo.bin', buffer)
