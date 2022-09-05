import { reflect } from "../lib/reflection";

const hello = (input: () => void) => {
  const call = reflect(hello);
};

hello(() => {});
