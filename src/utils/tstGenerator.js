export function generateTST() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';

  const pick = (set, len) =>
    Array(len).fill().map(() => set[Math.floor(Math.random() * set.length)]).join('');

  return `${pick(chars, 4)}-${pick(nums, 4)}-${pick(chars, 4)}`;
}
