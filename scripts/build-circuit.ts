import { build_circuit } from "./helper";

const args = process.argv;
console.log(args);

build_circuit(args[2])
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});


