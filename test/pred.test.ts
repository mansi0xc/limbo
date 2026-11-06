import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { buildQuoteTx, buildTakeTx } from "../src/frameTx/pred.js";
import { FRAME_MODE } from "../src/frameTx/types.js";

const QUOTE_BOOK = "0x1111111111111111111111111111111111111111" as Address;
const MAKER = "0x2222222222222222222222222222222222222222" as Address;
const TRADER = "0x3333333333333333333333333333333333333333" as Address;

describe("PRED frame builders", () => {
  it("builds a quote transaction with a self_verify and a postQuote SENDER frame", () => {
    const tx = buildQuoteTx({
      maker: MAKER,
      quoteBook: QUOTE_BOOK,
      seq: 7n,
      price: 2n,
      maxSize: 10n,
    });

    expect(tx.frames).toHaveLength(2);
    expect(tx.frames[0].mode).toBe(FRAME_MODE.VERIFY);
    expect(tx.frames[0].target).toBeNull();
    expect(tx.frames[1].mode).toBe(FRAME_MODE.SENDER);
    expect(tx.frames[1].target?.toLowerCase()).toBe(QUOTE_BOOK);
    expect(tx.nonceKeys).toEqual([7n]);
    expect(tx.signatures).toHaveLength(1);
  });

  it("builds a trade with only_verify, pay, and take frames", () => {
    const tx = buildTakeTx({
      trader: TRADER,
      quoteBook: QUOTE_BOOK,
      seq: 7n,
      amountIn: 1n,
      minOut: 2n,
    });

    expect(tx.frames).toHaveLength(3);
    expect(tx.frames[0].mode).toBe(FRAME_MODE.VERIFY);
    expect(tx.frames[0].target).toBeNull();
    expect(tx.frames[1].mode).toBe(FRAME_MODE.VERIFY);
    expect(tx.frames[1].target?.toLowerCase()).toBe(QUOTE_BOOK);
    expect(tx.frames[2].mode).toBe(FRAME_MODE.SENDER);
    expect(tx.frames[2].target?.toLowerCase()).toBe(QUOTE_BOOK);
    expect(tx.frames[2].value).toBe(1n);
    expect(tx.nonceKeys).toEqual([2n]);
    expect(tx.signatures).toHaveLength(1);
  });

  it("adds the optional assertFilled VERIFY frame", () => {
    const tx = buildTakeTx({
      trader: TRADER,
      quoteBook: QUOTE_BOOK,
      seq: 7n,
      amountIn: 1n,
      minOut: 2n,
      assertFilled: true,
    });

    expect(tx.frames).toHaveLength(4);
    expect(tx.frames[3].mode).toBe(FRAME_MODE.VERIFY);
    expect(tx.frames[3].target?.toLowerCase()).toBe(QUOTE_BOOK);
  });
});
