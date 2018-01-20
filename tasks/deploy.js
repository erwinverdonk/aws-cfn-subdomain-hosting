exports.default = (() => {
  return require('aws-cfn-custom-resource-s3-empty-bucket').default.then(_ => {
    if(process.argv.length < 3){
      throw new Error('No domain argument provided')
    }

    const domainSplit = process.argv[2].split(/\.(?=[^.]+\.[^.]+$)/).filter(_ => !!_);

    if(domainSplit.length < 2){
      throw new Error('Invalid domain argument provided')
    }

    const domain = domainSplit.join('.');
    const subdomain = domainSplit[0];
    const primaryDomain = domainSplit[1];
    const stackName = domain.replace(/[^a-z0-9-]/ig, '-');

    const AWS = require('aws-sdk');
    AWS.config.update({ region: 'eu-west-1' });

    const fs = require('fs');
    const cf = new AWS.CloudFormation();
    const cfTemplate = fs.readFileSync(__dirname + '/../src/cloudformation.yaml');

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
  });
})();
