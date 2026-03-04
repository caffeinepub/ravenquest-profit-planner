import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_HISTORY = 10;

export interface ChatHistoryEntry {
  id: string;
  input: string; // raw user input (truncated to 200 chars for display)
  matchedCount: number;
  matchedNames: string[];
  unrecognizedNames: string[];
  timestamp: number;
}

interface ChatHistoryState {
  entries: ChatHistoryEntry[];
  addEntry: (entry: Omit<ChatHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
}

export const useChatHistoryStore = create<ChatHistoryState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry) => {
        const newEntry: ChatHistoryEntry = {
          ...entry,
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : Date.now().toString(),
          input: entry.input.slice(0, 200),
          timestamp: Date.now(),
        };

        set((state) => {
          const updated = [newEntry, ...state.entries];
          if (updated.length > MAX_HISTORY) {
            updated.splice(MAX_HISTORY);
          }
          return { entries: updated };
        });
      },

      clearHistory: () => {
        set({ entries: [] });
      },
    }),
    {
      name: "rq-chat-history:v1",
    },
  ),
);
