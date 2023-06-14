import { command, run, string, positional, option, } from 'cmd-ts';
import * as fs from 'fs';

const wallet = require("ethereumjs-wallet").default

const app = command({
  name: 'encrypt_private_key',
  args: {
    private_key_text_file: positional({
      type: string,
      displayName: 'private_key_text_file',
      description: "Text file with ethereum private key.",
    }),
    password: option({
      type: string,
      description: "Password used to decrypt encrypted private key.",
      defaultValue: () => '',
      short: 'p',
      long: 'password',
    }),
    keyfile_name: option({
      type: string,
      description: "Name of encrypted JSON file",
      defaultValue: () => null,
      short: 'k',
      long: 'keyfile_name',
    }),
  },
  handler: async ({ private_key_text_file, password, keyfile_name }) => {
    const data = fs.readFileSync(private_key_text_file, 'utf8');
    const private_key = data.split(/\r?\n/)[0].trim();

    const privateKeyAsUint8Array = Buffer.from(private_key, 'hex');
    const account = wallet.fromPrivateKey(privateKeyAsUint8Array);

    account.toV3(password)
      .then(value => {
        const address = account.getAddress().toString('hex');
        let file;
        if (keyfile_name) {
          file = keyfile_name;
        } else {
          file = `UTC--${new Date().toISOString().replace(/[:]/g, '-')}--${address}.json`;
        }
        fs.writeFileSync(file, JSON.stringify(value));
      });
  }
});


run(app, process.argv.slice(2));
