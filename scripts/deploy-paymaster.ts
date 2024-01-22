import * as ethers from "ethers";
import { Web3Provider, Wallet, utils, ContractFactory } from 'zksync-web3';
import { AtlasEnvironment } from "atlas-ide";

import MyPaymasterArtifact from "../artifacts/MyPaymaster";
import MockUSDCArtifact from "../artifacts/mockUSDC";
import GreeterArtifact from "../artifacts/Greeter";

export async function main(atlas: AtlasEnvironment) {
  const provider = new Web3Provider(atlas.provider);
  const connectedChainID = (await provider.getNetwork()).chainId;
  if(connectedChainID !== 300 && connectedChainID !== 324) {
      throw new Error("Must be connected to zkSync within Atlas");
  }
  const wallet = provider.getSigner();
  // The wallet that will receive ERC20 tokens
  const emptyWallet = Wallet.createRandom();
  console.log(`Empty wallet's address: ${emptyWallet.address}`);
  console.log(`Empty wallet's private key: ${emptyWallet.privateKey}`);


  // Deploying the ERC20 token
  const erc20Factory = new ContractFactory(
      MockUSDCArtifact.MyERC20.abi,
      MockUSDCArtifact.MyERC20.evm.bytecode.object,
      wallet,
      "create"
  );

  const erc20 = await erc20Factory.deploy("USDC", "USDC", 18
  );
  console.log("ERC20 deploying...");
  await erc20.deployed();
  console.log(`ERC20 address: ${erc20.address}`);

  // Deploying the paymaster
  const paymasterFactory = new ContractFactory(
      MyPaymasterArtifact.MyPaymaster.abi,
      MyPaymasterArtifact.MyPaymaster.evm.bytecode.object,
      wallet,
      "create"
  );

  const paymaster = await paymasterFactory.deploy(erc20.address);
  console.log("Paymaster deploying...");
  await paymaster.deployed();
  console.log(`Paymaster address: ${paymaster.address}`);

  // Supplying paymaster with ETH.
  await (
    await wallet.sendTransaction({
      to: paymaster.address,
      value: ethers.utils.parseEther("0.05"),
    })
  ).wait();

  // Setting the dAPIs in Paymaster. Head over to the API3 Market (https://market.api3.org) to verify dAPI proxy contract addresses and whether they're funded or not.
  const ETHUSDdAPI = "0x28ce555ee7a3daCdC305951974FcbA59F5BdF09b";
  const USDCUSDdAPI = "0x946E3232Cc18E812895A8e83CaE3d0caA241C2AB";
  const setProxy = paymaster.setDapiProxy(USDCUSDdAPI, ETHUSDdAPI)
  await (await setProxy).wait()
  console.log("dAPI Proxies Set!")

  // Deploying the Greeter contract
  const oldGreeting = "old greeting"
  const greeterFactory = new ContractFactory(
      GreeterArtifact.Greeter.abi,
      GreeterArtifact.Greeter.evm.bytecode.object,
      wallet,
      "create"
  );

  const greeter = await greeterFactory.deploy(oldGreeting);
  console.log("Greeter deploying...");
  await greeter.deployed();
  console.log(`Greeter address: ${greeter.address}`);


  // Supplying the ERC20 tokens to the empty wallet:
  await // We will give the empty wallet 5k mUSDC:
  (await erc20.mint(emptyWallet.address, "5000000000000000000000")).wait();

  console.log("Minted 5k mUSDC for the empty wallet");

  return {
    erc20Address: erc20.address,
    greeterAddress: greeter.address,
    paymasterAddress: paymaster.address,
    emptyWalletPk: emptyWallet.privateKey
  }
}
