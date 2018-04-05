const AWS = require('aws-sdk');

exports.deploy = args => {
  const region = args.region ? args.region : process.env.AWS_DEFAULT_REGION;

  if (!region) {
    throw new Error('No region provided');
  }

  if (!args.domain) {
    throw new Error('No domain argument provided');
  }

  const domainSplit = args.domain.split(/\.(?=[^.]+\.[^.]+$)/).filter(_ => !!_);

  if (domainSplit.length < 2) {
    throw new Error('Invalid domain argument provided');
  }

  const lambdaEdgeArn = args.lambdaEdgeArn;
  const hasOAI = !!args.hasOAI;
  const subdomain = domainSplit[0];
  const primaryDomain = domainSplit[1];
  const stackName = args.domain.replace(/[^a-z0-9-]/gi, '-');

  const cf = new AWS.CloudFormation({ region });

  return require('aws-cfn-custom-resource-s3-empty-bucket')
    .deploy()
    .then(_ => cf.waitFor(_.pendingResourceState, { StackName: _.stackName }).promise())
    .then(_ => {
      const fs = require('fs');
      const cfTemplate = fs.readFileSync(__dirname + '/../lib/cloudformation.yaml');

      const stackParams = {
        StackName: stackName,
        TemplateBody: cfTemplate.toString(),
        Capabilities: ['CAPABILITY_IAM'],
        Parameters: [
          {
            ParameterKey: 'Subdomain',
            ParameterValue: subdomain,
          },
          {
            ParameterKey: 'PrimaryDomain',
            ParameterValue: primaryDomain,
          },
          {
            ParameterKey: 'HasOAI',
            ParameterValue: hasOAI.toString(),
          },
          {
            ParameterKey: 'LambdaEdgeArn',
            ParameterValue: lambdaEdgeArn ? lambdaEdgeArn : '',
          },
        ],
      };

      console.log(`Create or update of CloudFormation stack '${stackName}' started`);

      return cf
        .createStack(stackParams)
        .promise()
        .then(_ => ({ stackName, pendingResourceState: 'stackCreateComplete' }))
        .catch(_ => {
          if (_.code === 'AlreadyExistsException') {
            return cf
              .updateStack(stackParams)
              .promise()
              .then(_ => ({ stackName, pendingResourceState: 'stackUpdateComplete' }))
              .catch(_ => {
                if (_.message.toLowerCase().indexOf('no update') > -1) {
                  return { stackName, pendingResourceState: 'stackExists' };
                } else {
                  throw _;
                }
              });
          } else {
            throw _;
          }
        });
    });
};
