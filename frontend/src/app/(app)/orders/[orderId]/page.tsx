import { OrderDetailClient } from "./order-detail-client";

export function generateStaticParams() {
  // Must return non-empty array due to Next.js bug (github.com/vercel/next.js/issues/61213)
  return [{ orderId: "placeholder" }];
}

export default async function OrderDetailPage(props: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await props.params;
  return <OrderDetailClient orderId={orderId} />;
}
