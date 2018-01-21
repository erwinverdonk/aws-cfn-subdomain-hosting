exports.deploy = (domain) => {
  if(!domain){
    throw new Error('No domain argument provided')
  }

  const domainSplit = domain.split(/\.(?=[^.]+\.[^.]+$)/).filter(_ => !!_);

  if(domainSplit.length < 2){
    throw new Error('Invalid domain argument provided')
  }

  const subdomain = domainSplit[0];
  const primaryDomain = domainSplit[1];
  const stackName = domain.replace(/[^a-z0-9-]/ig, '-');

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'eu-west-1' });


  return require('aws-cfn-custom-resource-s3-empty-bucket')
    .deploy()
    .then(_ => {
      const fs = require('fs');
      const cf = new AWS.CloudFormation();
      const cfTemplate = fs.readFileSync(__dirname + '/../lib/cloudformation.yaml');

      return cf.createStack({
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
        ],
      })
      .promise()
      .catch(_ => {
        if (_.code === 'AlreadyExistsException') {
          cf.updateStack({
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
            ],
          })
          .promise()
          .catch(_ => console.error(_));
        } else {
          console.error(_);
        }
      });
    }
  );
}
