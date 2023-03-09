const {greet} = require("../../rust/pkg/rust")

async function aggr() {
  greet()
}

aggr()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});

