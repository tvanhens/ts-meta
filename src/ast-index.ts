import { CallExpression } from "@swc/core";

const index = new Map<string, CallExpression>();

export function addNode(callExpr: CallExpression): string {
  const id = index.size.toString();
  index.set(id, callExpr);
  return id;
}

export function getNode(id: string): CallExpression | undefined {
  return index.get(id);
}
