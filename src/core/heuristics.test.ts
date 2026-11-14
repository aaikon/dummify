import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findAiWidgets,
  hasAiWord,
  isAiControl,
  isAiRegion,
  isHeuristicsExcludedHost,
  isSafeToHide,
  isVendorWidget,
} from './heuristics';
import { words } from './text';

/** Build one element from HTML (the first element child of a fresh container). */
function el(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  document.body.replaceChildren(host);
  const first = host.firstElementChild;
  if (!first) throw new Error('no element');
  return first;
}

describe('words', () => {
  it.each([
    ['aiSummaryBox', ['ai', 'summary', 'box']],
    ['AISummary', ['ai', 'summary']],
    ['kapa-widget_root', ['kapa', 'widget', 'root']],
    ['DocSearch-AskAiScreen', ['doc', 'search', 'ask', 'ai', 'screen']],
    ['container', ['container']],
  ])('%s', (input, expected) => {
    expect(words(input)).toEqual(expected);
  });
});

describe('hasAiWord (weak signal)', () => {
  it.each([
    '<div class="ai-summary"></div>',
    '<div class="reviewAiSummary"></div>',
    '<div id="askAi"></div>',
    '<button class="btn-ai"></button>',
    '<div class="chatbot-frame"></div>',
    '<div data-testid="ai-assistant-panel"></div>',
  ])('true for %s', (html) => {
    expect(hasAiWord(el(html))).toBe(true);
  });

  it.each([
    '<div class="container main detail"></div>',
    '<div class="ai"></div>',
    '<div class="hero ai-gradient"></div>',
    '<div class="email-domain"></div>',
    '<div class="ai-sdk-docs"></div>',
  ])('false for %s', (html) => {
    expect(hasAiWord(el(html))).toBe(false);
  });
});

describe('isVendorWidget (decisive)', () => {
  it.each([
    '<div id="kapa-widget-container"></div>',
    '<div id="inkeep-chat-button"></div>',
    '<div class="mendable-search"></div>',
    '<div class="DocSearch-AskAiScreen"></div>',
  ])('true for %s', (html) => {
    expect(isVendorWidget(el(html))).toBe(true);
  });

  it.each([
    '<div class="kapacity-meter"></div>',
    '<div id="intercom-container"></div>',
    '<div class="DocSearch-SearchBar"></div>',
  ])('false for %s', (html) => {
    expect(isVendorWidget(el(html))).toBe(false);
  });
});

describe('isAiControl', () => {
  it.each([
    ['exact label', '<button>Ask AI</button>'],
    ['aria-label', '<button aria-label="Ask AI"><svg></svg></button>'],
    ['decoration stripped', '<button>✨ Summarize with AI</button>'],
    ['help me write', '<button>Help me write</button>'],
    ['finnish', '<button>Kysy tekoälyltä</button>'],
    ['role=button', '<div role="button">Chat with AI</div>'],
    ['button-like link', '<a href="#">Ask AI</a>'],
    ['verb + sparkle', '<button><svg class="icon-sparkle"></svg>Summarize</button>'],
    ['verb + AI class', '<button class="ai-summarize">Summarize</button>'],
    ['sparkle + AI class', '<button class="btn-ai">✨</button>'],
  ])('true: %s', (_why, html) => {
    expect(isAiControl(el(html))).toBe(true);
  });

  it.each([
    ['one weak signal: sparkle', '<button>Subscribe ✨</button>'],
    ['one weak signal: verb', '<button>Summarize</button>'],
    ['one weak signal: AI class', '<button class="ai-assistant-btn">Open</button>'],
    ['verb in a longer label', '<button>Ask a question about shipping</button>'],
    ['label embedded in prose', '<button>Learn why we never Ask AI for advice</button>'],
    ['plain text', '<button>Share</button>'],
  ])('false: %s', (_why, html) => {
    expect(isAiControl(el(html))).toBe(false);
  });
});

describe('isAiRegion', () => {
  it('true: AI class + standalone disclaimer', () => {
    expect(
      isAiRegion(
        el(
          '<section class="ai-summary"><p>Text.</p><p>AI-generated from the text of customer reviews</p></section>',
        ),
      ),
    ).toBe(true);
  });

  it('true: AI aria-label + mistakes warning', () => {
    expect(
      isAiRegion(
        el(
          '<aside aria-label="AI summary"><small>Responses from AI may contain mistakes.</small></aside>',
        ),
      ),
    ).toBe(true);
  });

  it.each([
    [
      'disclaimer without AI marking',
      '<section class="reviews"><p>AI-generated summary</p></section>',
    ],
    [
      'AI marking without disclaimer',
      '<section class="ai-summary"><p>Customers like it.</p></section>',
    ],
    [
      'marketing copy is not a disclaimer',
      '<div class="ai-summary-card"><p>Summaries of long threads, powered by AI.</p></div>',
    ],
    [
      'disclaimer phrase inside a long paragraph',
      `<div class="ai-summary"><p>${'Long article text. '.repeat(10)}AI-generated content may contain mistakes.</p></div>`,
    ],
  ])('false: %s', (_why, html) => {
    expect(isAiRegion(el(html))).toBe(false);
  });
});

describe('isSafeToHide (size guard)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['<main></main>', '<article></article>', '<div role="main"></div>'])(
    'never %s',
    (html) => {
      expect(isSafeToHide(el(html))).toBe(false);
    },
  );

  it('never an element containing main, an article, or the page heading', () => {
    expect(isSafeToHide(el('<div><article></article></div>'))).toBe(false);
    expect(isSafeToHide(el('<div><h1>Title</h1></div>'))).toBe(false);
  });

  it('never an element covering more than half the viewport', () => {
    const big = el('<div class="ai-summary"></div>');
    vi.spyOn(big, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: window.innerWidth, height: window.innerHeight * 0.6 }),
    );
    expect(isSafeToHide(big)).toBe(false);
  });

  it('allows a small widget', () => {
    const small = el('<button>Ask AI</button>');
    vi.spyOn(small, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 80, height: 30 }),
    );
    expect(isSafeToHide(small)).toBe(true);
  });

  it('findAiWidgets drops hits that fail the guard', () => {
    const root = el('<div><button id="b">Ask AI</button></div>');
    const button = root.querySelector('#b');
    if (!button) throw new Error('no button');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: window.innerWidth, height: window.innerHeight }),
    );
    expect(findAiWidgets(root)).toEqual([]);
  });
});

describe('isHeuristicsExcludedHost', () => {
  it.each([
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'www.perplexity.ai'.replace('www.', ''),
  ])('excludes AI product %s', (host) => {
    expect(isHeuristicsExcludedHost(host)).toBe(true);
  });

  it.each(['google.com', 'news.example.org', 'mail.google.com', 'notclaude.ai'])(
    'runs on %s',
    (host) => {
      expect(isHeuristicsExcludedHost(host)).toBe(false);
    },
  );
});
