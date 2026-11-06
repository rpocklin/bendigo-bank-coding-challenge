const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function correlationId(inbound: string | undefined): string {
  if (inbound && UUID.test(inbound)) {
    return inbound;
  }
  return crypto.randomUUID();
}

export type LogLine = {
  time: string;
  level: "info" | "error";
  service: string;
  msg: string;
  correlationId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

export function writeLog(line: LogLine): void {
  console.log(JSON.stringify(line));
}
