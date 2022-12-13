# Hardhat Metamask Client

To deploy a contract or run a transaction, Hardhat requires you to hardcode your account private key which may lead to some security issues.
This plugin provides an ethers signer that will redirect you to your default browser and use the metamask extention on that to run your desired trasnaction.

## Usage

```ts
import config from '../hardhat.config';

let client = new MetamaskClient(config, "fantom");

```
The first parameter is the HardhatUserConfig object which is typically defined in ```hardhat.config.ts``` file.
As the second parameter, you should specify the network name in which you would like to run your transaction. This network should be configured in
the config object for example if you want to run a transaction in ```xyz``` network your config should look like this:

```ts
export const config: HardhatUserConfig = {
    solidity: "...",
    networks: {
        xyz: {
            url: <RPC Url>,
            accounts: [
                <Private Key>
            ],
            chainId: <Chain Id>,
        },
        fantom: {
            ...
        },
    }
};
```
The configuration must include a URL, chainId, and at least one account, even though the account won't be used to sign transactions.
Thus it can be any random private key if it is only going to be used for signing transactions

The example below shows how you can deploy a contract using this metamask signer

```ts
let client = new MetamaskClient(config, "fantom");
const Box = await ethers.getContractFactory("Box", {
    signer: await client.getSigner()
});
await Box.deploy();
client.close();  // Should be closed in order for the program to stop running
```
