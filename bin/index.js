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
	AWS.config.update({ region: region });

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
				],
			};

			if (lambdaEdgeArn) {
				stackParams.Parameters.push({
					ParameterKey: 'LambdaEdgeArn',
					ParameterValue: lambdaEdgeArn,
				});
			}

			if (hasOAI) {
				stackParams.Parameters.push({
					ParameterKey: 'HasOAI',
					ParameterValue: hasOAI ? '1' : '0',
				});
			}

			return cf
				.createStack(stackParams)
				.promise()
				.catch(_ => {
					if (_.code === 'AlreadyExistsException') {
						cf
							.updateStack(stackParams)
							.promise()
							.catch(_ => console.error(_));
					} else {
						console.error(_);
					}
				});
		});
};
