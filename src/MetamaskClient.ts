import {BaseProvider} from '@ethersproject/providers';
import "@nomicfoundation/hardhat-ethers";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
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

export type ClientConfig = {
    hardhatConfig?: any,
    networkName?: any,
    network?: any,
    ethers: any,
}

export class MetamaskClient {
    private filledTemplate: string = '';
    private readonly port: number;
    private id = 1;
    private txHashMap = new Map<number, string>();
    network: any;
    server: any;
    ethers: any;

    constructor(config: ClientConfig, private estimateGas: boolean = false, defaultServerPort: number = 8989) {
        this.ethers = config.ethers;

        if (config.hardhatConfig == null && config.network == null)
            throw new Error("Invalid configuration");

        if (config.network == null) {
            if (config.hardhatConfig.networks == null || config.hardhatConfig.networks![config.networkName] == null)
                throw new Error("Requested network is not configured: " + config.networkName);
            this.network = config.hardhatConfig.networks![config.networkName];
            this.network.name = config.networkName;
        } else {
            this.network = config.network.config;
            this.network.name = config.network.name;
        }

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

    public async getSigner(): Promise<HardhatEthersSigner> {
        return new Promise<HardhatEthersSigner>((resolve, reject) => {
            this.ethers.getSigners().then((signers: any[]) => {
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
                            let result = (signer.provider! as BaseProvider)._wrapTransaction(tx, hash);
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
                network: this.network.name,
                chainId: "0x" + (this.network.chainId).toString(16),
                serverPort: this.port
            })! as string;
        open(`http://localhost:${this.port}/send-transactions`);
    }
}
