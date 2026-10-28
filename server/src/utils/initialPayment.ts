// Initial payment entered on the admission form: required, whole rupees, at least MIN_INITIAL_PAYMENT.
export const MIN_INITIAL_PAYMENT = 500;

export const parseInitialPayment = (value: unknown): { amount: number } | { error: string } => {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!text) return { error: 'Initial payment is required' };
  if (!/^\d+$/.test(text)) return { error: 'Initial payment must be a number' };
  const amount = Number(text);
  if (amount < MIN_INITIAL_PAYMENT) return { error: `Initial payment must be at least ₹${MIN_INITIAL_PAYMENT}` };
  return { amount };
};
