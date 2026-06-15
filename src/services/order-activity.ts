import { db } from "../lib/db";

type OrderActivityInput = {
  orderId: string;
  type:
    | "CREATED"
    | "PAYMENT_INITIALIZED"
    | "PAYMENT_VERIFIED"
    | "STOCK_RESERVED"
    | "DISPATCH_QUOTED"
    | "DISPATCH_CREATED"
    | "DISPATCH_STATUS_UPDATED"
    | "ORDER_STATUS_UPDATED"
    | "CANCELLED"
    | "FAILED";
  message: string;
  metadata?: Record<string, unknown>;
};

export async function recordOrderActivity(input: OrderActivityInput) {
  return db.orderActivity.create({
    data: {
      orderId: input.orderId,
      type: input.type,
      message: input.message,
      metadata: input.metadata as any,
    },
  });
}
