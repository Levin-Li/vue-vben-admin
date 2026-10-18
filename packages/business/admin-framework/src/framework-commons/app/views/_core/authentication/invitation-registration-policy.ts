import type { InvitationPreview } from '../../../api/invitation-register-service';

export type ContactChannel = 'Email' | 'Phone';

export function accountChannel(account: string): '' | ContactChannel {
  const clean = account.trim();
  if (/^1\d{10}$/.test(clean)) return 'Phone';
  if (/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(clean)) return 'Email';
  return '';
}

export function channelAllowed(
  preview: InvitationPreview,
  channel: '' | ContactChannel,
): boolean {
  if (!channel) return false;
  const policy = preview.registrationChannel;
  return (
    policy === 'Unrestricted' ||
    policy === 'Either' ||
    (policy === 'Phone' && channel === 'Phone') ||
    (policy === 'Email' && channel === 'Email')
  );
}
