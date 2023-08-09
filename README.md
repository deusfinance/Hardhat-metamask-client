# Hardhat Metamask Client

The Hardhat Metamask Client is a secure solution that addresses the issues associated with hardcoded account private keys in Hardhat during contract deployment or transaction execution. It incorporates an ethers signer that redirects you to your default browser, leveraging the metamask extension to execute your transaction.

## Installation
To install the Hardhat Metamask Client, use the following command:
```bash
npm install hardhat_metamask_client
```

## Usage
To utilize the Metamask Client, create a new instance by providing a configuration object. Here's an example:

```ts
let client = new MetamaskClient(config);
```

The configuration object should follow this format:

```ts
export type ClientConfig = {
    hardhatConfig?: any,
    networkName?: any,
    network?: any,
    ethers: any,
}
```

Note that the `ethers` field is mandatory. For other parameters, you have two possible approaches:

### 1. Providing `hardhatConfig` and `networkName`

The `hardhatConfig` parameter is the HardhatUserConfig object, usually defined in the `hardhat.config.ts` file.

The `networkName` should represent the network in which you want to execute your transaction. This network must be configured in the config object. For instance, if you wish to execute a transaction in the `xyz` network, your configuration should look as follows:

```ts
// hardhat.configuration.ts
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

// sampleScript.ts
import config from '../hardhat.config';
import { ethers } from "hardhat";

let client = new MetamaskClient({
    hardhatConfig: config,
    networkName: "xyz",
    ethers: ethers
});
```

### 2. Providing the `network`

You can also directly provide the `network` object during task creation.

```ts
task("x", "")
    .setAction(async ({logData, reportGas}, {ethers, network}) => {
        let client: any = new MetamaskClient({ethers: ethers, network: network});
    });
```

Please note that the network configuration must include a URL, chainId, and at least one account. However, since this account won't be used to sign transactions, it can be any random private key if it's used only for signing transactions.

Here's an example illustrating how to deploy a contract using the Metamask signer:

```ts
let client = new MetamaskClient(config);
const Box = await ethers.getContractFactory("Box", {
    signer: await client.getSigner()
});
await Box.deploy();
client.close();  // Must be closed for the program to cease execution
```

## Concluding Remarks
When you've completed your tasks, ensure to call `client.close()`. This stops the program from running continuously. The Hardhat Metamask Client offers a safer and more streamlined solution to contract deployment and transaction execution. Enjoy your secure and efficient development!