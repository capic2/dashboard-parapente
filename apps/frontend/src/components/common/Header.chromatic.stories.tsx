import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Default } from './Header.stories.tsx';
import { useEffect, useRef } from 'react';
import Header from './Header';

function ThemeMenuOpenHarness({
  selector,
}: {
  selector: 'desktop' | 'mobile';
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const button = wrapperRef.current?.querySelector<HTMLElement>(
      `[data-theme-selector="${selector}"] button`
    );
    button?.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );
  }, [selector]);

  return (
    <div ref={wrapperRef} className="w-full">
      <Header />
    </div>
  );
}

const meta = preview.meta({
  title: 'Components/Header/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const HeaderChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
    </div>
  ),
});

export const HeaderDesktopThemeMenuOpen = meta.story({
  name: 'Theme menu open (desktop)',
  render: () => (
    <FigureWrapper title="Theme menu open (desktop)">
      <ThemeMenuOpenHarness selector="desktop" />
    </FigureWrapper>
  ),
  parameters: {
    chromatic: {
      disableSnapshot: false,
      modes: {
        'light-desktop': {
          theme: 'light',
          viewport: { width: 1280, height: 900 },
        },
        'dark-desktop': {
          theme: 'dark',
          viewport: { width: 1280, height: 900 },
        },
      },
    },
  },
});

export const HeaderMobileThemeMenuOpen = meta.story({
  name: 'Theme menu open (mobile)',
  render: () => (
    <FigureWrapper title="Theme menu open (mobile)">
      <ThemeMenuOpenHarness selector="mobile" />
    </FigureWrapper>
  ),
  parameters: {
    chromatic: {
      disableSnapshot: false,
      modes: {
        'light-mobile': {
          theme: 'light',
          viewport: { width: 375, height: 812 },
        },
        'dark-mobile': {
          theme: 'dark',
          viewport: { width: 375, height: 812 },
        },
      },
    },
  },
});
