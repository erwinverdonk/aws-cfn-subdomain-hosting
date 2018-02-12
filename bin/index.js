exports.deploy = args => {
	if (!args.region && !process.env.AWS_DEFAULT_REGION) {
		throw new Error('No region provided');
	}

	if (!args.domain) {
		throw new Error('No domain argument provided');
	}

	const domainSplit = args.domain.split(/\.(?=[^.]+\.[^.]+$)/).filter(_ => !!_);

	if (domainSplit.length < 2) {
		throw new Error('Invalid domain argument provided');
	}

	const region = args.region ? args.region : process.env.AWS_DEFAULT_REGION;
	const lambdaEdgeArn = args.lambdaEdgeArn;
	const hasOAI = !!args.hasOAI;
	const subdomain = domainSplit[0];
	const primaryDomain = domainSplit[1];
	const stackName = args.domain.replace(/[^a-z0-9-]/gi, '-');

	const AWS = require('aws-sdk');
	AWS.config = new AWS.Config({ region });

	return require('aws-cfn-custom-resource-s3-empty-bucket')
		.deploy()
		.then(_ => {
			const fs = require('fs');
			const cf = new AWS.CloudFormation();
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

			console.log(`Creation of CloudFormation stack '${stackName}' started`);

			return cf
				.createStack(stackParams)
				.promise()
				.then(_ => console.log(`Creation of CloudFormation stack '${stackName}' in progress in the background`))
				.catch(_ => {
					if (_.code === 'AlreadyExistsException') {
						console.log(`CloudFormation stack '${stackName}' already exists`);
						console.log(`Update of CloudFormation stack '${stackName}' started`);

						return cf.updateStack(stackParams)
							.promise()
							.then(_ => console.log(`Update of CloudFormation stack '${stackName}' in progress in the background`));
					} else {
						throw _;
					}
				});
		});
};
