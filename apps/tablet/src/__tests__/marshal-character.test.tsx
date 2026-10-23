import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { MarshalCallout, MarshalCharacter } from '../features/character/MarshalCharacter';

afterEach(() => {
  cleanup();
});

describe('MarshalCharacter', () => {
  it('renders the full-body welcome eagerly with reserved dimensions and empty alt text', () => {
    render(<MarshalCharacter kind="welcome" />);

    const image = screen.getByTestId('marshal-character-image');
    expect(image.tagName).toBe('IMG');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('width', '640');
    expect(image).toHaveAttribute('height', '640');
    expect(image.getAttribute('src')).toContain('welcome-full.webp');
    expect(screen.getByTestId('marshal-character')).toHaveAttribute('data-kind', 'welcome');
  });

  it('loads compact state illustrations lazily at their display resolution', () => {
    render(<MarshalCharacter kind="error" />);

    const image = screen.getByTestId('marshal-character-image');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('width', '480');
    expect(image).toHaveAttribute('height', '480');
    expect(image.getAttribute('src')).toContain('error.webp');
    expect(screen.getByTestId('marshal-character')).toHaveAttribute('data-kind', 'error');
  });

  it('crossfades between states and removes the outgoing image after the transition', async () => {
    const { rerender } = render(<MarshalCharacter kind="welcome" />);
    rerender(<MarshalCharacter kind="processing" />);

    expect(screen.getByTestId('marshal-character')).toHaveAttribute('data-kind', 'processing');
    expect(screen.getByTestId('marshal-character-image').getAttribute('src')).toContain(
      'processing.webp',
    );
    expect(screen.getByTestId('marshal-character-previous').getAttribute('src')).toContain(
      'welcome-full.webp',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('marshal-character-previous')).toBeNull();
    });
  });
});

describe('MarshalCallout', () => {
  it('keeps the message and action usable when the illustration fails to load', () => {
    render(
      <MarshalCallout
        character="connection"
        title="The tablet can't reach the server"
        action={<button type="button">Try again</button>}
        role="alert"
      >
        Check the network connection, then try again.
      </MarshalCallout>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      "The tablet can't reach the serverCheck the network connection, then try again.",
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();

    fireEvent.error(screen.getByTestId('marshal-character-image'));

    expect(screen.getByTestId('marshal-connection')).toHaveAttribute('data-failed', 'true');
    expect(screen.getByTestId('marshal-character-image')).not.toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Check the network connection');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('uses a compact row without adding an illustration role or accessible name', () => {
    render(
      <MarshalCallout character="check-details" title="Check these details with the driver">
        Read the details aloud.
      </MarshalCallout>,
    );

    expect(screen.getByTestId('marshal-check-details')).toHaveTextContent(
      'Check these details with the driver',
    );
    expect(screen.getByTestId('marshal-character-image')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
