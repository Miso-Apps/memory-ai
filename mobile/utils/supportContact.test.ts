import { buildSupportEmailUrl, openSupportContact } from './supportContact';

describe('supportContact', () => {
  it('builds a mailto url with encoded subject and body', () => {
    const url = buildSupportEmailUrl({
      email: 'support@memory-ai.app',
      subject: 'Memory AI Support',
      body: 'Need help with account',
    });

    expect(url).toBe(
      'mailto:support@memory-ai.app?subject=Memory%20AI%20Support&body=Need%20help%20with%20account',
    );
  });

  it('opens mail app when mailto is supported', async () => {
    const canOpenURL = jest.fn().mockResolvedValue(true);
    const openURL = jest.fn().mockResolvedValue(undefined);
    const alert = jest.fn();
    const copyText = jest.fn().mockResolvedValue(undefined);

    const result = await openSupportContact(
      {
        canOpenURL,
        openURL,
        alert,
        copyText,
      },
      {
        email: 'support@memory-ai.app',
        subject: 'Memory AI Support',
        body: 'Need help',
        text: {
          fallbackTitle: 'Contact support',
          fallbackMessage: 'No mail app found. Contact us at {{email}}.',
          copyEmail: 'Copy email',
          copiedTitle: 'Copied',
          copiedMessage: 'Support email copied.',
          cancel: 'Cancel',
        },
      },
    );

    expect(result).toBe('opened');
    expect(canOpenURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(copyText).not.toHaveBeenCalled();
  });

  it('shows fallback alert and supports copy when mail app is unavailable', async () => {
    const canOpenURL = jest.fn().mockResolvedValue(false);
    const openURL = jest.fn();
    const alert = jest.fn();
    const copyText = jest.fn().mockResolvedValue(undefined);

    const result = await openSupportContact(
      {
        canOpenURL,
        openURL,
        alert,
        copyText,
      },
      {
        email: 'support@memory-ai.app',
        subject: 'Memory AI Support',
        body: 'Need help',
        text: {
          fallbackTitle: 'Contact support',
          fallbackMessage: 'No mail app found. Contact us at {{email}}.',
          copyEmail: 'Copy email',
          copiedTitle: 'Copied',
          copiedMessage: 'Support email copied.',
          cancel: 'Cancel',
        },
      },
    );

    expect(result).toBe('fallback');
    expect(canOpenURL).toHaveBeenCalledTimes(1);
    expect(openURL).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);

    const [, , buttons] = alert.mock.calls[0];
    const copyButton = buttons.find((b: { text: string }) => b.text === 'Copy email');
    await copyButton.onPress();

    expect(copyText).toHaveBeenCalledWith('support@memory-ai.app');
    expect(alert).toHaveBeenCalledWith('Copied', 'Support email copied.');
  });
});
