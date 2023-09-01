import {BaseProvider} from '@ethersproject/providers';
import hre, { ethers } from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import "@typechain/hardhat";
import bodyParser from "body-parser";
import * as Eta from "eta";
import express, {Express, Request, Response} from 'express';
import {readFileSync} from 'fs';
import open from 'open';
import {join} from 'path';

function syncReadFile(filename: string) {
    return readFileSync(join(__dirname, filename), 'utf-8');
}

export class TransactionWrapper {
    warning: string | null = null;
    error: string | null = null;

    constructor(public id: number, public transaction: any) {

    }
}

export class MetamaskClient {
    private filledTemplate: string = '';
    private readonly port: number;
    private id = 1;
    private txHashMap = new Map<number, string>();
    server: any;

    constructor(private estimateGas: boolean = false, defaultServerPort: number = 8989) {
        const app: Express = express();
        this.port = process.env.PORT ? Number(process.env.PORT) : defaultServerPort;
        app.use(bodyParser.urlencoded({extended: false}));
        app.use(bodyParser.json());

        app.get('/send-transactions', (req: Request, res: Response) => {
            res.send(this.filledTemplate);
        });

        app.post('/transaction-result', (req: Request, res: Response) => {
            this.txHashMap.set(req.body.id, req.body.hash);
            res.sendStatus(200);
        });

        this.server = app.listen(this.port, () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${this.port}`);
        });
    }

    public close() {
        this.server.close();
    }

    public async getSigner(): Promise<SignerWithAddress> {
        return new Promise<SignerWithAddress>((resolve, reject) => {
            // hook hardhat's `ethers` object
            ethers.getSigners().then((signers: any[]) => {
                let signer = signers[0];
//                let f = signer.sendTransaction;
                let x = async (transaction: any) => {
//                    let out = await f.call(signer, transaction);
//                    console.log(out);
//                    return Promise.resolve(out);
                    let txId = this.id++;
                    console.log("Going to run transaction: " + txId);
                    if (this.estimateGas)
                        transaction.gasLimit = await signer.provider?.estimateGas(transaction);
                    await this._sendTransactions([new TransactionWrapper(txId, transaction)]);
                    return new Promise(async (resolve, reject) => {
                        let checkInterval = setInterval(async () => {
                            console.log("Checking for transaction: " + txId);
                            if (!this.txHashMap.has(txId)) return;
                            let hash = this.txHashMap.get(txId)!;
                            const tx = await signer.provider!.getTransaction(hash);
                            if (tx === null) return;
                            console.log('Transaction');
                            let result = (signer.provider! as any)._wrapTransactionResponse(tx);
                            console.log(result);
                            clearInterval(checkInterval); // Important to clear interval after the operation is done
                            resolve(result);
                        }, 5000); // Repeat every 5 seconds
                    });
                }
                signer.sendTransaction = x as any;
                resolve(signer);
            });
        });
    }


    public async sendTransaction(transaction: any) {
        return this._sendTransactions([new TransactionWrapper(this.id++, transaction)]);
    }

    private async _sendTransactions(transactions: TransactionWrapper[]) {
        this.filledTemplate = Eta.render(
            syncReadFile('template.html'), {
                transactions: transactions,
                network: hre.network.name,
                // `31337` is the chainId of default `localhost` network. Reference: https://hardhat.org/hardhat-network/docs/reference#chainid
                // `localhost` network's chainId is not explicitly configured in `hardhat.config.ts`
                // so we use `31337` as default value
                chainId: "0x" + (hre.network.config.chainId ?? 31337).toString(16),
                serverPort: this.port
            })! as string;
        open(`http://localhost:${this.port}/send-transactions`);
    }
}
