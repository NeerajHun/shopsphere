
import { EventEnvelope } from './event-envelope.interface';

export interface OrderCreatedItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  totalAmount: number;
  currency: string;
  items: OrderCreatedItem[];
}

export type OrderCreatedEvent =
  EventEnvelope<OrderCreatedPayload>;
