// mobile/store/recallBadgeStore.ts
import { create } from 'zustand';

interface RecallBadgeState {
  count: number;
  setCount: (count: number) => void;
}

export const useRecallBadgeStore = create<RecallBadgeState>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
}));
