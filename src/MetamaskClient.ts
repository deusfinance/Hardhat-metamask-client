import { BaseProvider, TransactionRequest } from '@ethersproject/providers';
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import "@typechain/hardhat";
import bodyParser from "body-parser";
import * as Eta from "eta";
import { Deferrable, poll } from 'ethers/lib/utils';
import express, { Express, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { ethers } from "hardhat";
import open from 'open';
import { join } from 'path';

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
    network: any;
    server: any;

    constructor(private config: any, network: string, private estimateGas: boolean = false, defaultServerPort: number = 8989) {
        if (config.networks == null || config.networks![network] == null)
            throw new Error("Requested network is not configured: " + network);
        this.network = config.networks![network];
        this.network.name = network;

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
            ethers.getSigners().then((signers: any[]) => {
                let signer = signers[0];
//                let f = signer.sendTransaction;
                let x = async (transaction: Deferrable<TransactionRequest>) => {
//                    let out = await f.call(signer, transaction);
//                    console.log(out);
//                    return Promise.resolve(out);
                    let txId = this.id++;
                    console.log("Going to run transaction: " + txId);
                    if (this.estimateGas)
                        transaction.gasLimit = await signer.provider?.estimateGas(transaction);
                    await this._sendTransactions([new TransactionWrapper(txId, transaction)]);
                    return await poll(async () => {
                        console.log("Checking for transaction: " + txId);
                        if (!this.txHashMap.has(txId)) return undefined;
                        let hash = this.txHashMap.get(txId)!;
                        const tx = await signer.provider!.getTransaction(hash);
                        if (tx === null) return undefined;
                        console.log('Transaction');
                        let result = (signer.provider! as BaseProvider)._wrapTransaction(tx, hash);
                        console.log(result);
                        return result;
                    }, {
                        interval: 5000,
                        ceiling: 5000
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
                network: this.network.name,
                chainId: "0x" + (this.network.chainId).toString(16),
                serverPort: this.port
            })! as string;
        open(`http://localhost:${this.port}/send-transactions`);
    }
}
