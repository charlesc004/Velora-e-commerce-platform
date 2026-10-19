import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CartItem, CartLine } from '@velora/contracts';
function initialItems(): CartItem[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem('velora-cart') || '[]');
    return Array.isArray(items)
      ? items
          .filter(
            (i): i is CartItem =>
              !!i?.product?.id &&
              typeof i.variantId === 'string' &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 20,
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
function initialSettledOrders(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('velora-settled-orders') || '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string').slice(-100)
      : [];
  } catch {
    return [];
  }
}
const slice = createSlice({
  name: 'guestCart',
  initialState: { items: initialItems(), settledOrderIds: initialSettledOrders() },
  reducers: {
    add: (state, action: PayloadAction<CartItem>) => {
      const current = state.items.find(
        (i) => i.productId === action.payload.productId && i.variantId === action.payload.variantId,
      );
      if (current) current.quantity = Math.min(20, current.quantity + action.payload.quantity);
      else if (state.items.length < 50) state.items.push(action.payload);
    },
    update: (
      state,
      action: PayloadAction<{ productId: string; variantId: string; quantity: number }>,
    ) => {
      const item = state.items.find(
        (i) => i.productId === action.payload.productId && i.variantId === action.payload.variantId,
      );
      if (item) item.quantity = action.payload.quantity;
      state.items = state.items.filter((i) => i.quantity > 0);
    },
    clear: (state) => {
      state.items = [];
    },
    consumeOrder: (state, action: PayloadAction<{ orderId: string; items: CartLine[] }>) => {
      if (state.settledOrderIds.includes(action.payload.orderId)) return;
      for (const purchased of action.payload.items) {
        const item = state.items.find(
          (line) =>
            line.productId === purchased.productId && line.variantId === purchased.variantId,
        );
        if (item) item.quantity = Math.max(0, item.quantity - purchased.quantity);
      }
      state.items = state.items.filter((item) => item.quantity > 0);
      state.settledOrderIds = [...state.settledOrderIds.slice(-99), action.payload.orderId];
    },
  },
});
export const guestCartActions = slice.actions;
export default slice.reducer;
