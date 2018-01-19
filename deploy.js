const AWS = require('aws-sdk');
AWS.config.update({ region: 'eu-west-1' });

const fs = require('fs');
const cf = new AWS.CloudFormation();
const cfTemplate = fs.readFileSync('cloudformation.yaml');

cf.createStack({
  StackName: '',
  TemplateBody: cfTemplate.toString(),
  Capabilities: ['CAPABILITY_IAM'],
  Parameters: [
    {
      ParameterKey: 'Subdomain',
      ParameterValue: '',
    },
    {
      ParameterKey: 'PrimaryDomain',
      ParameterValue: '',
    },
  ],
})
.promise()
.catch(_ => {
  if (_.code === 'AlreadyExistsException') {
    cf.updateStack({
      StackName: '',
      TemplateBody: cfTemplate.toString(),
      Capabilities: ['CAPABILITY_IAM'],
      Parameters: [
        {
          ParameterKey: 'Subdomain',
          ParameterValue: '',
        },
        {
          ParameterKey: 'PrimaryDomain',
          ParameterValue: '',
        },
      ],
    })
    .promise()
    .catch(_ => console.error(_));
  } else {
    console.error(_);
  }
});
