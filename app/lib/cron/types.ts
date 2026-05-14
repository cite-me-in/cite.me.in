export interface CronTaskConfig {
  name: string;
  schedule: string;
  timeout: number;
  skip?: boolean;
}
