import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { ApplicationLoadBalancer, HttpCodeTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ResolvedAuthnAwsConfig } from '../config/types';

export interface AuthnObservabilityProps {
  readonly config: ResolvedAuthnAwsConfig;
  readonly alb?: ApplicationLoadBalancer;
}

export class AuthnObservability extends Construct {
  public readonly alarmTopic?: Topic;

  constructor(scope: Construct, id: string, props: AuthnObservabilityProps) {
    super(scope, id);

    const { config, alb } = props;

    if (config.observability.alarmEmail) {
      this.alarmTopic = new Topic(this, 'Alarms', {
        displayName: 'authn-alarms',
      });
      this.alarmTopic.addSubscription(new EmailSubscription(config.observability.alarmEmail));
    }

    if (alb) {
      const fivexx = new Alarm(this, 'Alb5xx', {
        metric: alb.metrics.httpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT, {
          period: Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        alarmDescription: 'authn ALB target 5xx >10/5min',
      });
      if (this.alarmTopic) {
        fivexx.addAlarmAction(new SnsAction(this.alarmTopic));
      }
    }
  }
}
