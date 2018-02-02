const deploy = require('./../bin/index').deploy;
const argv = require('minimist')(process.argv.slice(2));
deploy(argv);
