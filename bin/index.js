const AWS = require('aws-sdk');
const fs = require('fs');
const cfTemplate = fs.readFileSync(__dirname + '/../lib/cloudformation.yaml');

const createWait = (cf, stackName, status) => () => cf.waitFor(status, {
  StackName: stackName
}).promise();

const deployS3EmptyBucketCfnCustomResource = cf => {
  // Deploy S3EmptyBucket CloudFormation Custom Resource to make sure
  // that an S3 bucket is emptied before deletion. Otherwise the S3
  // bucket cannot be deleted by CloudFormation.
  return require('aws-cfn-custom-resource-s3-empty-bucket').deploy()
    // Then wait for the CloudFormation Custom Resource to be
    // available.
    .then(_ => _
      .wait()
      .catch(e => {
        throw e.originalError
          ? new Error(JSON.stringify(e.originalError))
          : new Error(JSON.stringify(e));
      })
    )
}

const checkStackExists = (cf, stackName) => {
  return cf.listStacks()
    .promise()
    .then(_ => (
      _.StackSummaries.some(_ => (
        _.StackName === stackName &&
        // The status 'DELETE_COMPLETE' should be considered as not existing
        _.StackStatus !== 'DELETE_COMPLETE'
      ))
    ));
}

const getStackStatus = (cf, stackName) => {
  return cf.describeStacks({ StackName: stackName })
  .promise()
  .then(result => result.Stacks[0].StackStatus)
};

exports.deploy = args => {
  const region = args.region ? args.region : process.env.AWS_DEFAULT_REGION;

  if (!region) {
    throw new Error('No region provided');
  }

  if (!args.domain) {
    throw new Error('No domain argument provided');
  }

  const domainSplit = args.domain.split(/(?<=^[^.]+)\./).filter(_ => !!_);

  if (domainSplit.length < 2) {
    throw new Error('Invalid domain argument provided');
  }

  const lambdaEdgeArn = args.lambdaEdgeArn;
  const hasOAI = !!args.hasOAI;
  const subdomain = domainSplit[0];
  const primaryDomain = domainSplit[1];
  const stackName = args.domain.replace(/[^a-z0-9-]/gi, '-');
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

  const cf = new AWS.CloudFormation({ region });

  return deployS3EmptyBucketCfnCustomResource(cf)
    .then(() => checkStackExists(cf, stackParams.StackName))
    .then(alreadyExists => {
      if(alreadyExists){
        return getStackStatus(cf, stackParams.StackName)
          .then(status => {
            switch(status){
              case 'CREATE_COMPLETE':
              case 'UPDATE_COMPLETE':
              case 'ROLLBACK_COMPLETE':
              case 'UPDATE_ROLLBACK_COMPLETE':
                // Start the update of the stack
                cf.updateStack(stackParams)
                  .promise()
                  .then(_ => ({
                    wait: createWait(cf, stackName, 'stackUpdateComplete')
                  }))
                  .catch(_ => {
                    if (_.message.toLowerCase().indexOf('no update') > -1) {
                      return {
                        wait: createWait(cf, stackName, 'stackExists')
                      }
                    } else {
                      throw _;
                    }
                  });
                break;
              case 'CREATE_IN_PROGRESS':
              case 'UPDATE_IN_PROGRESS':
                console.log(`AWS CloudFront Hosting is in progress to be created or updated`);
                break;
              default:
                throw new Error(`Stack '${stackParams.StackName}' is in blocking state: ${status}`)
            }
          })
      } else {
        // Start the creation of the stack
        return cf.createStack(stackParams)
          .promise()
          .then(_ => ({
            wait: createWait(cf, stackName, 'stackCreateComplete')
          }));
      }
    });
};
