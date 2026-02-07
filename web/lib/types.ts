export type Transaction = {
  id: string;
  user_id: string;
  date: string;        // YYYY-MM-DD
  merchant: string;
  amount: number;
  category: string | null;
  source: "receipt" | "chat";
  receipt_url: string | null;
  created_at: string;
};
