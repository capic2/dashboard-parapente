#!/usr/bin/env node

import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const output = options.output
  ? resolve(options.output)
  : resolve('/tmp/opencode/storybook-visual-preview/storybook.png');

const width = parsePositiveInt(options.width, 1440, 'width');
const height = parsePositiveInt(options.height, 1000, 'height');
const timeout = parsePositiveInt(options.timeout, 30_000, 'timeout');
const targetUrl = buildTargetUrl(options);

await mkdir(dirname(output), { recursive: true });

const { chromium } = await importPlaywright();
const browser = await launchBrowser(chromium);

try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
  await page
    .locator('#storybook-root, #storybook-docs, .sb-errordisplay')
    .first()
    .waitFor({ state: 'attached', timeout });
  await page.screenshot({ path: output, fullPage: Boolean(options.fullPage) });

  console.log(JSON.stringify({ output, url: targetUrl, width, height }, null, 2));
} finally {
  await browser.close();
}

function buildTargetUrl(parsedOptions) {
  if (parsedOptions.url) {
    return parsedOptions.url;
  }

  if (!parsedOptions.baseUrl || !parsedOptions.storyId) {
    throw new Error('Provide either --url or both --base-url and --story-id.');
  }

  const baseUrl = parsedOptions.baseUrl.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/iframe.html`);
  url.searchParams.set('id', parsedOptions.storyId);
  url.searchParams.set('viewMode', 'story');
  return url.toString();
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--full-page') {
      parsed.fullPage = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = toCamelCase(arg.slice(2));
    const value = args[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function parsePositiveInt(value, fallback, label) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${label} must be a positive integer.`);
  }

  return parsed;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }

    try {
      const requireFromCwd = createRequire(`${process.cwd()}/package.json`);
      return requireFromCwd('playwright');
    } catch {
      // Fall through to a clearer setup error below.
    }

    throw new Error(
      'Cannot load Playwright. Run `CI=true /home/capic/.local/share/pnpm/pnpm install` from this workspace, then retry.',
    );
  }
}

async function launchBrowser(chromium) {
  const systemChromium = await getSystemChromiumPath();

  try {
    return await chromium.launch({
      headless: true,
      ...(systemChromium ? { executablePath: systemChromium } : {}),
    });
  } catch (error) {
    if (systemChromium || !isMissingPlaywrightBrowserError(error)) {
      throw error;
    }

    throw new Error(
      'Cannot launch Chromium. Run `pnpm exec playwright install chromium` or install system Chromium, then retry.',
    );
  }
}

async function getSystemChromiumPath() {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, '/usr/bin/chromium'].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

function isMissingPlaywrightBrowserError(error) {
  return String(error?.message ?? '').includes("Executable doesn't exist");
}

function printHelp() {
  console.log(`Capture a Storybook story screenshot with Playwright.

Usage:
  node capture-storybook.mjs --base-url http://localhost:6006 --story-id components-button--primary --output /tmp/story.png
  node capture-storybook.mjs --url http://localhost:6006/iframe.html?id=components-button--primary --output /tmp/story.png

Options:
  --base-url   Storybook root URL.
  --story-id   Storybook story id. Used with --base-url.
  --url        Full URL to capture.
  --output     PNG output path.
  --width      Viewport width. Default: 1440.
  --height     Viewport height. Default: 1000.
  --timeout    Timeout in milliseconds. Default: 30000.
  --full-page  Capture the full page instead of the viewport.
`);
}
