import { CallExpression } from "@swc/core";
import { getCallExpr } from "./instrument";

export function reflect(fn: Function): CallExpression {
  const node = getCallExpr(fn);
  if (!node) {
    throw new Error("Reflection failed!");
  }
  return node;
}
