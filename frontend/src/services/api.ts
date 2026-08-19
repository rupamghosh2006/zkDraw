import type { Lottery, DrawVerificationResult, TicketVerificationResult } from '../types/index.js';

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function fetchLotteries(): Promise<Lottery[]> {
  const res = await fetch(`${API_BASE}/lotteries`);
  if (!res.ok) throw new Error('Failed to fetch lotteries');
  return res.json();
}

export async function fetchLotteryById(id: string): Promise<Lottery> {
  const res = await fetch(`${API_BASE}/lotteries/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch lottery ${id}`);
  return res.json();
}

export async function submitTicketCommitment(
  id: string,
  ticketCommitment: string,
): Promise<{ message: string; lottery: Lottery }> {
  const res = await fetch(`${API_BASE}/lotteries/${id}/buy-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketCommitment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to purchase ticket');
  return data;
}

export async function closeLottery(
  id: string,
): Promise<{ message: string; lottery: Lottery }> {
  const res = await fetch(`${API_BASE}/lotteries/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to close lottery');
  return data;
}

export async function drawLottery(
  id: string,
): Promise<{ message: string; lottery: Lottery }> {
  const res = await fetch(`${API_BASE}/lotteries/${id}/draw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to execute draw');
  return data;
}

export async function fetchDrawVerification(
  id: string,
): Promise<DrawVerificationResult> {
  const res = await fetch(`${API_BASE}/lotteries/${id}/verify`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to verify draw');
  return data;
}

export async function verifyTicketWinning(
  id: string,
  ticketNumber: number,
  ticketSaltHex: string,
  playerSecretHex?: string,
): Promise<TicketVerificationResult> {
  const res = await fetch(`${API_BASE}/lotteries/${id}/verify-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticketNumber,
      ticketSaltHex,
      playerSecretHex,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to verify ticket');
  return data;
}
