import { ContractFactory, Provider, utils, Wallet, Web3Provider } from "zksync-web3";
import * as ethers from "ethers";
import { AtlasEnvironment } from "atlas-ide";

import MyPaymasterArtifact from "../artifacts/MyPaymaster";
import MockUSDCArtifact from "../artifacts/mockUSDC";
import GreeterArtifact from "../artifacts/Greeter";

function getToken(wallet: Wallet, token_address: string) {
  return new ethers.Contract(token_address, MockUSDCArtifact.MyERC20.abi, wallet);
}

function getGreeter(wallet: Wallet, greeter_contract_address: string) {
  return new ethers.Contract(greeter_contract_address, GreeterArtifact.Greeter.abi, wallet);
}

export async function main (
    atlas: AtlasEnvironment, 
    token_address: string,
    greeter_address: string,
    paymaster_address: string,
    empty_wallet_pk: string
) {
  const provider = new Web3Provider(atlas.provider);
  const connectedChainID = (await provider.getNetwork()).chainId;
  if(connectedChainID !== 280 && connectedChainID !== 324) {
      throw new Error("Must be connected to zkSync within Atlas");
  }
  const emptyWallet = new Wallet(empty_wallet_pk, provider);

  // Obviously this step is not required, but it is here purely to demonstrate that indeed the wallet has no ether.
  const ethBalance = await emptyWallet.getBalance();
    if (!ethBalance.eq(0)) {
      throw new Error("The wallet is not empty");
    }

  const erc20Balance = await emptyWallet.getBalance(token_address);
  console.log(`ERC20 balance of the user before tx: ${erc20Balance}`);

  const greeter = getGreeter(emptyWallet, greeter_address);
  const erc20 = getToken(emptyWallet, token_address);

  const gasPrice = await provider.getGasPrice();

  // Loading the Paymaster Contract

  const PaymasterFactory = new ContractFactory(
    MyPaymasterArtifact.MyPaymaster.abi,
    MyPaymasterArtifact.MyPaymaster.evm.bytecode.object,
    emptyWallet
  );
  const PaymasterContract = PaymasterFactory.attach(paymaster_address);

  // Estimate gas fee for the transaction
  const gasLimit = await greeter.estimateGas.setGreeting(
    "new updated greeting",
    {
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        paymasterParams: utils.getPaymasterParams(paymaster_address, {
          type: "ApprovalBased",
          token: token_address,
          // Set a large allowance just for estimation
          minimalAllowance: ethers.BigNumber.from(`100000000000000000000`),
          // Empty bytes as testnet paymaster does not use innerInput
          innerInput: new Uint8Array(0),
        }),
      },
    }
  );

  // Gas estimation:
  const fee = gasPrice.mul(gasLimit.toString());
  console.log(`Estimated ETH FEE (gasPrice * gasLimit): ${fee}`);

  // Calling the dAPI to get the ETH price:
  const ETHUSD = await PaymasterContract.readDapi(
    "0x28ce555ee7a3daCdC305951974FcbA59F5BdF09b"
  );
  const USDCUSD = await PaymasterContract.readDapi(
    "0x946E3232Cc18E812895A8e83CaE3d0caA241C2AB"
  );

  // Checks old allowance (for testing purposes):
  const checkSetAllowance = await erc20.allowance(
    emptyWallet.address,
    paymaster_address
  );
  console.log(`ERC20 allowance for paymaster : ${checkSetAllowance}`);

  console.log(`ETH/USD dAPI Value: ${ETHUSD}`);
  console.log(`USDC/USD dAPI Value: ${USDCUSD}`);

  // Calculating the USD fee:
  const usdFee = fee.mul(ETHUSD).div(USDCUSD);
  console.log(`Estimated USD FEE: ${usdFee}`);

  console.log(`Current message is: ${await greeter.greet()}`);

  // Encoding the "ApprovalBased" paymaster flow's input
  const paymasterParams = utils.getPaymasterParams(paymaster_address, {
    type: "ApprovalBased",
    token: token_address,
    // set minimalAllowance to the estimated fee in erc20
    minimalAllowance: ethers.BigNumber.from(usdFee),
    // empty bytes as testnet paymaster does not use innerInput
    innerInput: new Uint8Array(0),
  });

  await (
    await greeter
      .connect(emptyWallet)
      .setGreeting(`new greeting updated at ${new Date().toUTCString()}`, {
        // specify gas values
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: 0,
        gasLimit: gasLimit,
        // paymaster info
        customData: {
          paymasterParams: paymasterParams,
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        },
      })
  ).wait();

  const newErc20Balance = await emptyWallet.getBalance(token_address);

  console.log(`ERC20 Balance of the user after tx: ${newErc20Balance}`);
  console.log(
    `Transaction fee paid in ERC20 was ${erc20Balance.sub(newErc20Balance)}`
  );
  console.log(`Message in contract now is: ${await greeter.greet()}`);
}
