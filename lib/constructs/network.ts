import { Construct } from 'constructs';
import {
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointAwsService,
  IpAddresses,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';

export interface AuthnNetworkProps {
  readonly cidr?: string;
  readonly maxAzs?: number;
  readonly natGateways?: number;
}

export class AuthnNetwork extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: AuthnNetworkProps = {}) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      ipAddresses: IpAddresses.cidr(props.cidr ?? '10.0.0.0/16'),
      maxAzs: props.maxAzs ?? 3,
      natGateways: props.natGateways ?? (props.maxAzs ?? 3),
      subnetConfiguration: [
        { name: 'public',   subnetType: SubnetType.PUBLIC,               cidrMask: 24 },
        { name: 'private',  subnetType: SubnetType.PRIVATE_WITH_EGRESS,  cidrMask: 22 },
        { name: 'isolated', subnetType: SubnetType.PRIVATE_ISOLATED,     cidrMask: 24 },
      ],
    });

    this.vpc.addGatewayEndpoint('S3Endpoint',  { service: GatewayVpcEndpointAwsService.S3 });
    this.vpc.addGatewayEndpoint('DdbEndpoint', { service: GatewayVpcEndpointAwsService.DYNAMODB });

    const interfaceServices: { id: string; svc: InterfaceVpcEndpointAwsService }[] = [
      { id: 'EcrApiEndpoint',     svc: InterfaceVpcEndpointAwsService.ECR },
      { id: 'EcrDkrEndpoint',     svc: InterfaceVpcEndpointAwsService.ECR_DOCKER },
      { id: 'LogsEndpoint',       svc: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS },
      { id: 'SecretsMgrEndpoint', svc: InterfaceVpcEndpointAwsService.SECRETS_MANAGER },
      { id: 'KmsEndpoint',        svc: InterfaceVpcEndpointAwsService.KMS },
      { id: 'StsEndpoint',        svc: InterfaceVpcEndpointAwsService.STS },
      { id: 'SsmEndpoint',        svc: InterfaceVpcEndpointAwsService.SSM },
    ];

    for (const e of interfaceServices) {
      this.vpc.addInterfaceEndpoint(e.id, {
        service: e.svc,
        subnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        privateDnsEnabled: true,
      });
    }
  }
}
