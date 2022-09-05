import {
  CallExpression,
  ClassMember,
  Expression,
  ExpressionStatement,
  Module,
  ModuleDeclaration,
  parseSync,
  printSync,
  Statement,
  transformSync,
  VariableDeclarator,
} from "@swc/core";
import { addHook } from "pirates";
import * as path from "path";

import * as index from "./ast-index";
import "./reflection";
import "./instrument";

type AnyNode =
  | Module
  | ModuleDeclaration
  | Statement
  | ClassMember
  | Expression
  | VariableDeclarator;

interface VisitorCtx {
  parent: AnyNode | undefined;
}

type VisitorFn<T> = (node: T, ctx: VisitorCtx) => void;

type Vistor = {
  [k in AnyNode["type"]]?: VisitorFn<AnyNode & { type: k }>;
};

function matcher(filename: string) {
  return true;
}

function isNode(x: unknown): x is AnyNode {
  return !!x && typeof x === "object" && "type" in x;
}

function walk(rootNode: AnyNode, sourceVisitor?: Vistor) {
  const stack: AnyNode[] = [];

  function getParent() {
    return stack[stack.length - 1];
  }

  function doWalk(node: AnyNode, visitor?: Vistor) {
    const foundVisitor: any = visitor?.[node.type];
    if (foundVisitor) {
      foundVisitor(node, {
        parent: getParent(),
      });
    }

    stack.push(node);
    Object.entries(node).forEach(([k, v]: [string, unknown]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => {
          if (isNode(item)) {
            doWalk(item, visitor);
          }
        });
      }
      if (isNode(v)) {
        doWalk(v, visitor);
      }
    });
    stack.pop();
  }

  doWalk(rootNode, sourceVisitor);
}

function printExpr(module: Module, expr: Expression) {
  return printSync({
    ...module,
    body: [
      {
        type: "ExpressionStatement",
        expression: expr,
        span: {
          ctxt: 0,
          end: 0,
          start: 0,
        },
      },
    ],
    span: {
      ctxt: 0,
      end: 0,
      start: 0,
    },
  })
    .code.trim()
    .replace(";", "");
}

function parseExpr(code: string) {
  const parsed = parseSync(code);
  return (parsed.body[0] as ExpressionStatement).expression;
}

function evaluateModule(module: Module) {
  walk(module, {
    CallExpression: (callExpr, { parent }) => {
      if (!parent) return;
      if (
        callExpr.callee.type !== "MemberExpression" &&
        callExpr.callee.type !== "Identifier"
      ) {
        return;
      }
      const id = index.addNode(callExpr);
      const callee = printExpr(module, callExpr.callee);
      const toReplace = parseExpr(
        `require("${path.join(
          __dirname,
          "instrument"
        )}").instrument(${callee}, "${id}")()`
      ) as CallExpression;
      toReplace.arguments = callExpr.arguments;
      Object.entries(parent).forEach(([k, v]: [string, unknown]) => {
        if (Array.isArray(v)) {
          (parent as any)[k] = v.map((item) => {
            if (callExpr === item) {
              return toReplace;
            }
            return item;
          });
        }
        if (v === callExpr) {
          (parent as any)[k] = toReplace;
        }
      });
    },
  });
  const { code } = transformSync(module, {
    jsc: {
      parser: {
        syntax: "typescript",
      },
    },
    module: {
      type: "commonjs",
    },
  });
  return code;
}

addHook(
  (code, filename) => {
    const astForFile = parseSync(code, {
      syntax: "typescript",
    });

    return evaluateModule(astForFile);
  },
  { exts: [".ts"], matcher }
);
