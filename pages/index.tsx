import {
  useActiveClaimConditionForWallet,
  useAddress,
  useClaimConditions,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  useContract,
  useContractMetadata,
  useTokenSupply,
  Web3Button,
} from "@thirdweb-dev/react";
import { BigNumber, utils } from "ethers";
import Image from "next/image";
import { useMemo, useState } from "react";
import styles from "../styles/Home.module.css";
import { parseIneligibility } from "../utils/parseIneligibility";

const Home = () => {
  const tokenAddress = "0x453f351966B81EDe5B8f44e133093b24ED32ac26";
  const { contract } = useContract(tokenAddress, "token-drop");
  const address = useAddress();
  const [quantity, setQuantity] = useState(1);
  const { data: contractMetadata } = useContractMetadata(contract);
  const [amountToClaim, setAmountToClaim] = useState("");

  const claimConditions = useClaimConditions(contract);
  const activeClaimCondition = useActiveClaimConditionForWallet(
    contract,
    address
  );
  const claimerProofs = useClaimerProofs(contract, address || "");
  const claimIneligibilityReasons = useClaimIneligibilityReasons(contract, {
    quantity,
    walletAddress: address || "",
  });

  const claimedSupply = useTokenSupply(contract);

  const totalAvailableSupply = useMemo(() => {
    try {
      return BigNumber.from(activeClaimCondition.data?.availableSupply || 0);
    } catch {
      return BigNumber.from(1_000_000_000);
    }
  }, [activeClaimCondition.data?.availableSupply]);

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data?.value || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    const n = totalAvailableSupply.add(
      BigNumber.from(claimedSupply.data?.value || 0)
    );
    if (n.gte(1_000_000_000)) {
      return "";
    }
    return n.toString();
  }, [totalAvailableSupply, claimedSupply]);

  const priceToMint = useMemo(() => {
    const bnPrice = BigNumber.from(
      activeClaimCondition.data?.currencyMetadata.value || 0
    );
    return `${utils.formatUnits(
      bnPrice.mul(quantity).toString(),
      activeClaimCondition.data?.currencyMetadata.decimals || 18
    )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);

  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;

    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    let max;
    if (totalAvailableSupply.lt(bnMaxClaimable)) {
      max = totalAvailableSupply;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000_000)) {
      return 1_000_000_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    totalAvailableSupply,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);

  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0
          )) ||
        numberClaimed === numberTotal
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
  ]);

  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);

  const isLoading = useMemo(() => {
    return activeClaimCondition.isLoading || !contract;
  }, [activeClaimCondition.isLoading, contract]);

  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading]
  );
  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return "Sold Out";
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0
      );
      if (pricePerToken.eq(0)) {
        return "Mint (Free)";
      }
      return `Mint (${priceToMint})`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return "Checking eligibility...";
    }

    return "Claiming not available";
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    buttonLoading,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);

  return (
    <div className={styles.container}>
      {(claimConditions.data &&
        claimConditions.data.length > 0 &&
        activeClaimCondition.isError) ||
        (activeClaimCondition.data &&
          activeClaimCondition.data.startTime > new Date() && (
            <p>Drop is starting soon. Please check back later.</p>
          ))}

      {claimConditions.data?.length === 0 ||
        (claimConditions.data?.every((cc) => cc.maxClaimableSupply === "0") && (
          <p>
            This drop is not ready to be minted yet. (No claim condition set)
          </p>
        ))}

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/*{contractMetadata?.image && (
            <Image
              src={contractMetadata?.image}
              alt={contractMetadata?.name!}
              width={200}
              height={200}
              style={{ objectFit: "contain" }}
            />
          )} */}

          <img src="/YoRHa_29.webp" className="rounded-2xl"/>
          <h2 className={styles.title}>YORHA Mint</h2>
          <p className={styles.explain}>
            Mint your unit YRH voting token!{" "}
            <span className={styles.pink}>{contractMetadata?.name}</span>
          </p>
        </>
      )}

      <hr className={styles.divider} />

      <div className={styles.claimGrid}>
        <input
          type="number"
          placeholder="Enter number of tokens"
          onChange={(e) => setAmountToClaim(e.target.value)}
          className={`${styles.textInput} ${styles.noGapBottom}`}
        />
        <Web3Button
          accentColor="#5204BF"
          colorMode="dark"
          contractAddress={"0x453f351966B81EDe5B8f44e133093b24ED32ac26"}
          action={(contract) => contract.call("mintTo", address, amountToClaim)}
          onSuccess={() => alert("Success!")}
          onError={(err) => alert(err)}
        >
          {buttonText}
          Mint Tokens
        </Web3Button>
      </div>
    </div>
  );
};

export default Home;
