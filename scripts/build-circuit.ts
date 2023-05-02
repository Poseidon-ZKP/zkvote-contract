import { build_circuit } from "./helper";

const args = process.argv;
// console.log(args);

let circuits = args.slice(2);
if (circuits.length == 0) {
  circuits = [ "round2", "vote" ];
}
console.log("Building circuits: " + circuits);

Promise.all(circuits.map(build_circuit))
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});
