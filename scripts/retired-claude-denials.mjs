export const retiredClaudeToolDenials = Object.freeze([
  'Artifact',
  'CronCreate',
  'CronDelete',
  'CronList',
  'EnterWorktree',
  'ExitWorktree',
  'Monitor',
  'NotebookEdit',
  'PushNotification',
  'RemoteTrigger',
  'ScheduleWakeup',
  'SendUserFile',
  'ShareOnboardingGuide',
  'TaskOutput',
  'Workflow',
]);

export const retiredHarnessClaudeDenials = Object.freeze([
  ...retiredClaudeToolDenials,
  'Bash(git push:*)',
]);
