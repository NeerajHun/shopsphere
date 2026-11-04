
export interface EventEnvelope<TPayload> {
  eventId: string;

  eventType: string;

  eventVersion: number;

  occurredAt: string;

  producer: string;

  correlationId: string;

  causationId: string | null;

  payload: TPayload;
}
