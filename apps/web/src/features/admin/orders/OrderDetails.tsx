import { useState } from 'react';
import { type Order, type OrderStatus } from '@velora/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { money } from '@/lib/utils/currency';
import { date } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';
import { useUpdateOrderMutation } from '../api/admin.api';
import { StatusBadge } from '../components/StatusBadge';

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cancelled'],
  paid: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  expired: [],
};
export default function OrderDetails({ order, onClose }: { order: Order; onClose: () => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  const [update, { isLoading }] = useUpdateOrderMutation();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Order #${order.number}`}
      description={`Placed ${date(order.createdAt)} · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items`}
    >
      <div className="admin-detail-grid">
        <div className="admin-detail-card">
          <h3>Customer & delivery</h3>
          <strong>{order.address.name}</strong>
          <p>
            {order.email}
            <br />
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ''}
            <br />
            {order.address.city}, {order.address.region} {order.address.postalCode}
            <br />
            {order.address.country}
          </p>
        </div>
        <div className="admin-detail-card">
          <h3>Payment & fulfillment</h3>
          <StatusBadge status={order.paymentStatus} /> <StatusBadge status={order.status} />
          <p>
            Payment: {order.paymentMethod === 'stripe' ? 'Stripe Checkout' : 'Mock checkout'}
            <br />
            Shipping: {order.shippingMethod}
            <br />
            Tracking: {order.trackingNumber || 'Not yet assigned'}
          </p>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        {order.items.map((item) => (
          <div className="admin-order-item" key={`${item.productId}-${item.variantId}`}>
            <img src={item.image} alt="" />
            <div>
              <strong>{item.name}</strong>
              <small>
                {item.color} / {item.size} · Qty {item.quantity}
              </small>
            </div>
            <span className="price">{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="admin-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(order.totals.subtotal)}</span>
        </div>
        <div>
          <span>Discount {order.totals.couponCode ? `(${order.totals.couponCode})` : ''}</span>
          <span>−{money(order.totals.discount)}</span>
        </div>
        <div>
          <span>Shipping</span>
          <span>{money(order.totals.shipping)}</span>
        </div>
        <div>
          <span>Tax</span>
          <span>{money(order.totals.tax)}</span>
        </div>
        <div className="total">
          <span>Order total</span>
          <span>{money(order.totals.total)}</span>
        </div>
      </div>
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await update({ id: order.id, status, trackingNumber }).unwrap();
            toast.success('Order updated');
            onClose();
          } catch (cause) {
            toast.error(errorMessage(cause));
          }
        }}
      >
        <div className="admin-form-grid">
          <Field label="Fulfillment status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus)}
            >
              {[order.status, ...nextStatuses[order.status]].map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tracking number">
            <Input
              maxLength={100}
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="Carrier tracking number"
            />
          </Field>
        </div>
        <p>
          Only valid fulfillment transitions are available. Payment is confirmed through the
          checkout payment flow.
        </p>
        <div className="admin-form-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Update order'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
