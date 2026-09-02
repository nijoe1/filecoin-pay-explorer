import { ExternalTextLink } from "@filecoin-foundation/ui-filecoin/TextLink/ExternalTextLink";
import type { Hash } from "viem";

export function TransactionLink({ explorerUrl, hash }: { explorerUrl?: string; hash: Hash }) {
  if (!explorerUrl) return <code className='block break-all text-xs'>{hash}</code>;
  return (
    <ExternalTextLink className='block break-all text-xs' href={`${explorerUrl}/tx/${hash}`}>
      {hash}
    </ExternalTextLink>
  );
}
