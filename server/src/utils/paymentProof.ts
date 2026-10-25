export const getPaymentProofDataUrl = (file: { mimetype: string; buffer: Buffer }) =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
