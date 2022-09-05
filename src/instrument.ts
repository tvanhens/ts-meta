import { CallExpression } from "@swc/core";
import { getNode } from "./ast-index";

const allStacks = new Map<Function, CallExpression[]>();

export function instrument(fn: Function, id: string) {
  const node = getNode(id);
  if (!node) {
    return fn;
  }
  const stack = allStacks.get(fn) ?? [];
  allStacks.set(fn, stack);
  stack.push(node);
  return (...args: unknown[]) => {
    const returnValue = fn.apply(fn, args);
    stack.pop();
    return returnValue;
  };
}

export function getCallExpr(fn: Function): CallExpression | undefined {
  const stack = allStacks.get(fn) ?? [];
  return stack[stack.length - 1];
}
