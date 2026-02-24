import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  RESEND_API_KEY: string
  RESEND_FROM: string
  RESEND_TO: string
  DEEPL_API_KEY: string
}

type ContactPayload = {
  name: string
  email: string
  phone?: string
  company?: string
  message: string
}

type NewsletterPayload = {
  email: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => c.redirect('/es/', 302))
app.get('/es', (c) => c.redirect('/es/', 302))

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/api/static-map', async (c) => {
  const mapUrl =
    'https://staticmap.openstreetmap.fr/osmfr/staticmap.php?center=9.845519943232729,-83.96499953547801&zoom=17&size=1200x800&maptype=mapnik&markers=9.845519943232729,-83.96499953547801,lightblue1'
  const response = await fetch(mapUrl, {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  })
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'public, max-age=86400')
  return new Response(response.body, {
    status: response.status,
    headers,
  })
})

app.get('/en/contact/', (c) => {
  return c.html(renderContactPage())
})

app.get('/es/contact/', (c) => {
  return c.html(renderContactPageEs())
})

app.get('/en/newsletter/', (c) => {
  return c.html(renderNewsletterPage())
})

app.get('/es/newsletter/', (c) => {
  return c.html(renderNewsletterPageEs())
})

app.post('/api/translate', async (c) => {
  if (!c.env.DEEPL_API_KEY) {
    return c.json({ error: 'Translation unavailable.' }, 503)
  }
  const payload = (await c.req.json()) as { strings?: unknown }
  const strings = Array.isArray(payload.strings) ? payload.strings : []
  const sanitized = strings
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => (value as string).trim())
    .slice(0, 60)

  if (!sanitized.length) {
    return c.json({ translations: [] })
  }

  const totalChars = sanitized.reduce((sum, value) => sum + value.length, 0)
  if (totalChars > 8000) {
    return c.json({ error: 'Payload too large.' }, 413)
  }

  const translations = await translateStringsWithDeepL(sanitized, c.env.DEEPL_API_KEY)
  return c.json({ translations })
})

app.get('/es/*', async (c) => {
  const url = new URL(c.req.url)
  const pathname = url.pathname
  const acceptHeader = c.req.header('accept') || ''
  const isHtmlRequest = acceptHeader.includes('text/html') || acceptHeader.includes('*/*') || acceptHeader === ''

  if (!isHtmlRequest) {
    return c.notFound()
  }

  const headers = new Headers(c.req.raw.headers)
  headers.set('host', 'krivitskiy.com')
  headers.delete('content-length')

  const fetchHtml = async (targetPath: string) => {
    const upstreamUrl = new URL(c.req.url)
    upstreamUrl.protocol = 'https:'
    upstreamUrl.hostname = 'krivitskiy.com'
    upstreamUrl.pathname = targetPath

    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers,
      redirect: 'manual',
    })

    // If upstream returns a custom 404 page for the Spanish path,
    // fall back to the upstream home to avoid showing a 404 screen.
    if (response.status === 404 || response.status === 410) {
      const fallbackUrl = new URL(c.req.url)
      fallbackUrl.protocol = 'https:'
      fallbackUrl.hostname = 'krivitskiy.com'
      fallbackUrl.pathname = '/en/'
      return fetch(fallbackUrl.toString(), {
        method: 'GET',
        headers,
        redirect: 'manual',
      })
    }

    return response
  }

  const upstreamPath = pathname.replace(/^\/es\b/, '/en')
  const response = await fetchHtml(upstreamPath)

  const responseHeaders = new Headers(response.headers)
  const contentType = responseHeaders.get('content-type') || ''
  if (!contentType.includes('text/html')) {
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  }

  responseHeaders.delete('content-length')
  const cleaned = applyPreviewEdits(response, {
    stripScripts: false,
    skipTextRewrite: true,
    // IMPORTANT: inject translators BEFORE Nuxt boots, otherwise Nuxt will render its own 404 route
    // for /es/* (because the Nuxt app doesn't know /es/* routes).
    extraHeadHtml:
      '<script src="/static/es-translate.js"></script><script src="/static/brand-override.js"></script>',
  })
  responseHeaders.set('content-language', 'es')
  responseHeaders.set('x-translation', 'client')
  return new Response(cleaned.body, {
    status: 200,
    headers: responseHeaders,
  })
})

app.post('/api/contact', async (c) => {
  const payload = (await c.req.json()) as Partial<ContactPayload>
  const name = (payload.name || '').trim()
  const email = (payload.email || '').trim()
  const message = (payload.message || '').trim()
  const phone = (payload.phone || '').trim()
  const company = (payload.company || '').trim()

  if (!name || !email || !message) {
    return c.json({ error: 'Name, email, and message are required.' }, 400)
  }

  if (!isValidEmail(email)) {
    return c.json({ error: 'Invalid email format.' }, 400)
  }

  const submittedAt = new Date().toISOString()
  const userAgent = c.req.header('user-agent') || ''
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''

  await sendResendEmail({
    apiKey: c.env.RESEND_API_KEY,
    from: c.env.RESEND_FROM,
    to: c.env.RESEND_TO,
    subject: `New contact submission from ${name}`,
    html: renderContactEmail({ name, email, phone, company, message, submittedAt, ip, userAgent }),
    replyTo: email,
  })

  return c.json({ success: true })
})

app.post('/api/newsletter', async (c) => {
  const payload = (await c.req.json()) as Partial<NewsletterPayload>
  const email = (payload.email || '').trim()

  if (!email) {
    return c.json({ error: 'Email is required.' }, 400)
  }

  if (!isValidEmail(email)) {
    return c.json({ error: 'Invalid email format.' }, 400)
  }

  const subscribedAt = new Date().toISOString()
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''

  await sendResendEmail({
    apiKey: c.env.RESEND_API_KEY,
    from: c.env.RESEND_FROM,
    to: c.env.RESEND_TO,
    subject: `New newsletter signup: ${email}`,
    html: renderNewsletterEmail({ email, subscribedAt, ip }),
  })

  return c.json({ success: true })
})

app.all('/i/*', async (c) => {
  const url = new URL(c.req.url)
  url.protocol = 'https:'
  url.hostname = 'krivitskiy.com'

  const headers = new Headers(c.req.raw.headers)
  headers.set('host', 'krivitskiy.com')
  headers.delete('content-length')

  const response = await fetch(url.toString(), {
    method: c.req.method,
    headers,
    redirect: 'manual',
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('cache-control', 'public, max-age=86400')

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
})

app.all('*', async (c) => {
  const url = new URL(c.req.url)
  url.protocol = 'https:'
  url.hostname = 'krivitskiy.com'

  const method = c.req.method
  const headers = new Headers(c.req.raw.headers)
  const acceptHeader = headers.get('accept') || ''
  const isHtmlRequest =
    (method === 'GET' || method === 'HEAD') &&
    (acceptHeader.includes('text/html') || acceptHeader.includes('*/*') || acceptHeader === '')
  const cache = caches.default
  const cacheKey = new Request(c.req.url, { method: 'GET' })
  const isSpanishPath = url.pathname === '/es/' || url.pathname === '/es' || url.pathname.startsWith('/es/')
  const isHomePath = url.pathname === '/en/' || url.pathname === '/en' || url.pathname === '/es/' || url.pathname === '/es'
  const isContactsPath = /\/contacts\/?$/.test(url.pathname)
  const isHtmlBypassCache = true

  if (isSpanishPath) {
    url.pathname = url.pathname.replace(/^\/es\b/, '/en')
  }

  headers.set('host', 'krivitskiy.com')
  headers.delete('content-length')

  const init: RequestInit = {
    method,
    headers,
    redirect: 'manual',
  }

  const controller = new AbortController()
  const timeoutMs = method === 'GET' || method === 'HEAD' ? 20000 : 20000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  init.signal = controller.signal

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await c.req.arrayBuffer()
  }

  try {
    let response = await fetch(url.toString(), init)
    if (isSpanishPath && (method === 'GET' || method === 'HEAD') && response.status === 404) {
      const fallbackUrl = new URL(c.req.url)
      fallbackUrl.protocol = 'https:'
      fallbackUrl.hostname = 'krivitskiy.com'
      fallbackUrl.pathname = '/en/'
      response = await fetch(fallbackUrl.toString(), init)
    }
    const responseHeaders = new Headers(response.headers)
    const contentType = responseHeaders.get('content-type') || ''
    const isHtmlResponse = contentType.includes('text/html')

    if (response.ok) {
      let outgoingResponse = response
      let didTranslate = false

      if (isHtmlResponse) {
        responseHeaders.delete('content-length')
        if (!isSpanishPath) {
          const previewOptions = {
            stripScripts: false,
            skipTextRewrite: true,
            extraBodyHtml: '<script src="/static/brand-override.js" defer></script>',
          }
          outgoingResponse = applyPreviewEdits(response, previewOptions)
        } else {
          const previewOptions = {
            stripScripts: false,
            skipTextRewrite: true,
            extraHeadHtml: '<script src="/static/es-path-bridge.js" defer></script>',
            extraBodyHtml: '<script src="/static/es-translate.js" defer></script><script src="/static/brand-override.js" defer></script>',
          }
          outgoingResponse = applyPreviewEdits(response, previewOptions)
          didTranslate = true
          responseHeaders.set('content-language', 'es')
          responseHeaders.set('x-translation', 'client')
        }
        const rewrittenHtml = await outgoingResponse.text()
        const replacedHtml = applyServerReplacements(rewrittenHtml, url.pathname)
        outgoingResponse = new Response(replacedHtml, {
          status: response.status,
          headers: responseHeaders,
        })
        responseHeaders.set('x-mrz-rewrite', '1')
      }

      if (isHtmlRequest && isHtmlResponse) {
        if ((!isSpanishPath || didTranslate) && !isHtmlBypassCache) {
          await cache.put(cacheKey, outgoingResponse.clone())
        }
      }

      if (isHtmlBypassCache) {
        responseHeaders.set('cache-control', 'no-store')
      }
      return new Response(outgoingResponse.body, {
        status: response.status,
        headers: responseHeaders,
      })
    }

    if (response.status >= 500) {
      if (isHtmlRequest && !isHtmlBypassCache) {
        const cached = await cache.match(cacheKey)
        if (cached) {
          return cached
        }

        if (isHomePath) {
          if (isSpanishPath) {
            const translated = await translateHtmlStringToSpanish(renderHomeSnapshotPage(), c.env.DEEPL_API_KEY)
            if (translated) {
              return c.html(translated)
            }
          }
          return c.html(renderHomeSnapshotPage())
        }

        if (isSpanishPath) {
          const translated = await translateHtmlStringToSpanish(renderFallbackPage(url.pathname), c.env.DEEPL_API_KEY)
          if (translated) {
            return c.html(translated)
          }
        }
        return c.html(renderFallbackPage(url.pathname))
      }

      return new Response('Upstream unavailable.', { status: 502 })
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    if (isHtmlRequest && !isHtmlBypassCache) {
      const cached = await cache.match(cacheKey)
      if (cached) {
        return cached
      }

      if (isHomePath) {
        if (isSpanishPath) {
          const translated = await translateHtmlStringToSpanish(renderHomeSnapshotPage(), c.env.DEEPL_API_KEY)
          if (translated) {
            return c.html(translated)
          }
        }
        return c.html(renderHomeSnapshotPage())
      }

      if (isSpanishPath) {
        const translated = await translateHtmlStringToSpanish(renderFallbackPage(url.pathname), c.env.DEEPL_API_KEY)
        if (translated) {
          return c.html(translated)
        }
      }
      return c.html(renderFallbackPage(url.pathname))
    }

    return new Response('Upstream unavailable.', { status: 502 })
  } finally {
    clearTimeout(timeoutId)
  }
})

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendResendEmail({
  apiKey,
  from,
  to,
  subject,
  html,
  replyTo,
}: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  replyTo?: string
}) {
  if (!apiKey || !from || !to) {
    throw new Error('Missing Resend configuration. Set RESEND_API_KEY, RESEND_FROM, and RESEND_TO.')
  }

  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    html,
  }

  if (replyTo) {
    payload.reply_to = replyTo
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Resend API error: ${response.status} ${errorText}`)
  }
}

function renderContactEmail({
  name,
  email,
  phone,
  company,
  message,
  submittedAt,
  ip,
  userAgent,
}: {
  name: string
  email: string
  phone: string
  company: string
  message: string
  submittedAt: string
  ip: string
  userAgent: string
}) {
  return `
    <h2>New Contact Submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || '—')}</p>
    <p><strong>Company:</strong> ${escapeHtml(company || '—')}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    <hr />
    <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
    <p><strong>IP:</strong> ${escapeHtml(ip || '—')}</p>
    <p><strong>User Agent:</strong> ${escapeHtml(userAgent || '—')}</p>
  `
}

function renderNewsletterEmail({
  email,
  subscribedAt,
  ip,
}: {
  email: string
  subscribedAt: string
  ip: string
}) {
  return `
    <h2>New Newsletter Signup</h2>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Subscribed at:</strong> ${escapeHtml(subscribedAt)}</p>
    <p><strong>IP:</strong> ${escapeHtml(ip || '—')}</p>
  `
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getDeepLEndpoint(apiKey: string) {
  if (apiKey.trim().endsWith(':fx')) {
    return 'https://api-free.deepl.com/v2/translate'
  }
  return 'https://api.deepl.com/v2/translate'
}

function updateSpanishLinks(html: string) {
  return html
    .replace(/href="\/?en\//gi, 'href="/es/')
    .replace(/href='\/?en\//gi, "href='/es/")
    .replace(/\b\/en\b/gi, '/es')
    .replace(/lang="en"/gi, 'lang="es"')
    .replace(/lang='en'/gi, "lang='es'")
}

const MAX_TRANSLATION_CHARS = 12000
const MAX_HTML_CHARS = 1000000

function splitHtmlIntoChunks(html: string, maxChars: number) {
  const tokens = html.match(/<\/?[^>]+>|[^<]+/g) || [html]
  const chunks: string[] = []
  let current = ''
  tokens.forEach((token) => {
    if (current.length + token.length > maxChars && current.length > 0) {
      chunks.push(current)
      current = ''
    }
    current += token
  })
  if (current) {
    chunks.push(current)
  }
  return chunks
}

async function requestDeepLTranslation(html: string, apiKey: string) {
  const endpoint = getDeepLEndpoint(apiKey)
  const body = new URLSearchParams()
  body.set('text', html)
  body.set('target_lang', 'ES')
  body.set('tag_handling', 'html')
  body.set('split_sentences', 'nonewlines')
  body.set('preserve_formatting', '1')
  body.set('ignore_tags', 'script,style')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepL API error: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as { translations?: { text: string }[] }
  const translated = data.translations?.[0]?.text
  return translated || ''
}

async function translateStringsWithDeepL(strings: string[], apiKey: string) {
  const endpoint = getDeepLEndpoint(apiKey)
  const body = new URLSearchParams()
  strings.forEach((value) => body.append('text', value))
  body.set('target_lang', 'ES')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepL API error: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as { translations?: { text: string }[] }
  return (data.translations || []).map((item) => item.text)
}

async function translateHtmlWithDeepL(html: string, apiKey: string) {
  const chunks = splitHtmlIntoChunks(html, MAX_TRANSLATION_CHARS)
  if (chunks.length <= 1) {
    return requestDeepLTranslation(html, apiKey)
  }
  const translatedChunks: string[] = []
  for (const chunk of chunks) {
    translatedChunks.push(await requestDeepLTranslation(chunk, apiKey))
  }
  return translatedChunks.join('')
}

async function translateResponseToSpanish(response: Response, apiKey?: string) {
  if (!apiKey) {
    return { response: null, error: 'missing_api_key' }
  }
  let html = ''
  try {
    const cloned = response.clone()
    html = await cloned.text()
  } catch (error) {
    return { response: null, error: 'read_failed' }
  }
  if (!html) {
    return { response: null, error: 'too_large', detail: 'empty' }
  }
  if (html.length > MAX_HTML_CHARS) {
    return { response: null, error: 'too_large', detail: `len:${html.length}` }
  }

  try {
    const translatedHtml = await translateHtmlWithDeepL(html, apiKey)
    if (!translatedHtml) {
      return { response: null, error: 'empty_translation' }
    }

    const updatedHtml = updateSpanishLinks(translatedHtml).replace(/MRZ LEGAL/gi, 'MRZ LEGAL')
    const headers = new Headers(response.headers)
    headers.set('content-type', 'text/html; charset=UTF-8')
    return {
      response: new Response(updatedHtml, {
        status: response.status,
        headers,
      }),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    return { response: null, error: 'deepl_error', detail }
  }
}

async function translateHtmlStringToSpanish(html: string, apiKey?: string) {
  if (!apiKey || !html || html.length > MAX_HTML_CHARS) {
    return null
  }
  try {
    const translatedHtml = await translateHtmlWithDeepL(html, apiKey)
    if (!translatedHtml) {
      return null
    }
    return updateSpanishLinks(translatedHtml).replace(/MRZ LEGAL/gi, 'MRZ LEGAL')
  } catch (error) {
    return null
  }
}

function renderBasePage({
  title,
  subtitle,
  body,
  script,
  lang = 'en',
}: {
  title: string
  subtitle: string
  body: string
  script: string
  lang?: string
}) {
  return `
    <!doctype html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title} — MRZ LEGAL</title>
        <link rel="icon" type="image/x-icon" href="https://krivitskiy.com/favicon.ico" />
        <link rel="preload" href="https://krivitskiy.com/font/als_span_regular.woff2" as="font" type="font/woff2" crossorigin />
        <link rel="preload" href="https://krivitskiy.com/font/als_wagon_bold_condensed.woff2" as="font" type="font/woff2" crossorigin />
        <link rel="preload" href="https://krivitskiy.com/font/als_wagon_regular_condensed.woff2" as="font" type="font/woff2" crossorigin />
        <link rel="stylesheet" href="/static/style.css" />
        <script src="/static/lang-override.js" defer></script>
      </head>
      <body class="custom-page">
        <header class="custom-header">
          <a class="logo" href="/en/">MRZ LEGAL</a>
          <nav class="custom-nav">
            <a href="/en/">Home</a>
            <a href="/en/contact/">Contact</a>
            <a href="/en/newsletter/">Newsletter</a>
          </nav>
        </header>
        <main class="custom-main">
          <section class="custom-hero">
            <p class="hero-kicker">${subtitle}</p>
            <h1>${title}</h1>
          </section>
          ${body}
        </main>
        <footer class="custom-footer">
          <div>© MRZ LEGAL. All rights reserved.</div>
          <div class="footer-links">
            <a href="/en/">English</a>
            <a href="https://krivitskiy.com/" target="_blank" rel="noreferrer">Original site</a>
          </div>
        </footer>
        <script>${script}</script>
      </body>
    </html>
  `
}

function renderContactPage() {
  return renderBasePage({
    title: 'Contact',
    subtitle: 'Legal support for entrepreneurs',
    body: `
      <section class="custom-card">
        <h2>Tell us about your case</h2>
        <p>Leave your details and we will respond as soon as possible.</p>
        <div class="custom-card contact-details">
          <p>+506 2278 0392 - info@mrzlegal.com - Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos</p>
        </div>
        <form id="contactForm" class="custom-form">
          <div class="grid">
            <label>
              <span>Name</span>
              <input type="text" name="name" placeholder="Your name" required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" name="email" placeholder="you@email.com" required />
            </label>
            <label>
              <span>Phone</span>
              <input type="tel" name="phone" placeholder="+1 234 567 89" />
            </label>
            <label>
              <span>Company</span>
              <input type="text" name="company" placeholder="Company" />
            </label>
          </div>
          <label>
            <span>Message</span>
            <textarea name="message" placeholder="Describe your request" required></textarea>
          </label>
          <button type="submit" class="primary">Send request</button>
          <p class="form-status" id="contactStatus"></p>
        </form>
      </section>
    `,
    script: `
      const form = document.getElementById('contactForm');
      const status = document.getElementById('contactStatus');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Sending...';
        status.className = 'form-status';
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Submission failed');
          }
          form.reset();
          status.textContent = 'Thank you. We will reply soon.';
          status.classList.add('success');
        } catch (err) {
          status.textContent = err.message || 'Something went wrong.';
          status.classList.add('error');
        }
      });
    `,
  })
}

function renderContactPageEs() {
  return renderBasePage({
    title: 'Contacto',
    subtitle: 'Apoyo legal para emprendedores',
    lang: 'es',
    body: `
      <section class="custom-card">
        <h2>Cuéntenos su caso</h2>
        <p>Deje sus datos y responderemos lo antes posible.</p>
        <div class="custom-card contact-details">
          <p>+506 2278 0392 - info@mrzlegal.com - Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos</p>
        </div>
        <form id="contactForm" class="custom-form">
          <div class="grid">
            <label>
              <span>Nombre</span>
              <input type="text" name="name" placeholder="Su nombre" required />
            </label>
            <label>
              <span>Correo electrónico</span>
              <input type="email" name="email" placeholder="usted@email.com" required />
            </label>
            <label>
              <span>Teléfono</span>
              <input type="tel" name="phone" placeholder="+1 234 567 89" />
            </label>
            <label>
              <span>Empresa</span>
              <input type="text" name="company" placeholder="Empresa" />
            </label>
          </div>
          <label>
            <span>Mensaje</span>
            <textarea name="message" placeholder="Describa su solicitud" required></textarea>
          </label>
          <button type="submit" class="primary">Enviar solicitud</button>
          <p class="form-status" id="contactStatus"></p>
        </form>
      </section>
    `,
    script: `
      const form = document.getElementById('contactForm');
      const status = document.getElementById('contactStatus');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Enviando...';
        status.className = 'form-status';
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'No se pudo enviar');
          }
          form.reset();
          status.textContent = 'Gracias. Le responderemos pronto.';
          status.classList.add('success');
        } catch (err) {
          status.textContent = err.message || 'Algo salió mal.';
          status.classList.add('error');
        }
      });
    `,
  })
}

function renderNewsletterPage() {
  return renderBasePage({
    title: 'Newsletter',
    subtitle: 'Updates and legal insights',
    body: `
      <section class="custom-card">
        <h2>Stay informed</h2>
        <p>Get the latest legal practice updates in your inbox.</p>
        <form id="newsletterForm" class="custom-form inline">
          <label>
            <span>Email</span>
            <input type="email" name="email" placeholder="you@email.com" required />
          </label>
          <button type="submit" class="primary">Subscribe</button>
          <p class="form-status" id="newsletterStatus"></p>
        </form>
      </section>
    `,
    script: `
      const form = document.getElementById('newsletterForm');
      const status = document.getElementById('newsletterStatus');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Submitting...';
        status.className = 'form-status';
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          const response = await fetch('/api/newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Submission failed');
          }
          form.reset();
          status.textContent = 'You are subscribed. Thank you!';
          status.classList.add('success');
        } catch (err) {
          status.textContent = err.message || 'Something went wrong.';
          status.classList.add('error');
        }
      });
    `,
  })
}

function renderNewsletterPageEs() {
  return renderBasePage({
    title: 'Boletín',
    subtitle: 'Actualizaciones y análisis legales',
    lang: 'es',
    body: `
      <section class="custom-card">
        <h2>Manténgase informado</h2>
        <p>Reciba las últimas novedades legales en su correo.</p>
        <form id="newsletterForm" class="custom-form inline">
          <label>
            <span>Correo electrónico</span>
            <input type="email" name="email" placeholder="usted@email.com" required />
          </label>
          <button type="submit" class="primary">Suscribirse</button>
          <p class="form-status" id="newsletterStatus"></p>
        </form>
      </section>
    `,
    script: `
      const form = document.getElementById('newsletterForm');
      const status = document.getElementById('newsletterStatus');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Enviando...';
        status.className = 'form-status';
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          const response = await fetch('/api/newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'No se pudo enviar');
          }
          form.reset();
          status.textContent = 'Gracias. Su suscripción fue confirmada.';
          status.classList.add('success');
        } catch (err) {
          status.textContent = err.message || 'Algo salió mal.';
          status.classList.add('error');
        }
      });
    `,
  })
}

function renderBrandReplacementScript() {
  return `(function(){
  const from=/krivitskiy/gi;
  const to='MRZ LEGAL';
  const replaceValue=(value)=>value
    .replace(from,to)
    .replace(/\+7\s*977\s*820-00-01/gi,'+506 2278 0392')
    .replace(/pravo@\s*mrz\s*legal\.com/gi,'info@mrzlegal.com')
    .replace(/ul\.?\s*sushchevskaya,?\s*d\.?\s*27\s*str\.?\s*2/gi,'Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos')
    .replace(/127030,?\s*moscow/gi,'Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos');
  const contactLine='+506 2278 0392 - info@mrzlegal.com - Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos';
  const contactTokens=['+7 977 820-00-01','PRAVO@MRZ LEGAL.COM','pravo@mrz legal.com','Sushchevskaya','127030','Moscow'];
  const replaceContactElements=()=>{
    document.querySelectorAll('div,p,span,li').forEach((el)=>{
      const text=(el.textContent || '');
      if(contactTokens.some((token)=>text.includes(token))){
        el.textContent=contactLine;
      }
    });
  };
  const replaceText=(node)=>{
    if(node.nodeType===Node.TEXT_NODE){
      const updated=replaceValue(node.nodeValue);
      if(updated!==node.nodeValue){
        node.nodeValue=updated;
      }
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE){
      return;
    }
    const el=node;
    ['alt','title','aria-label','placeholder'].forEach((attr)=>{
      const value=el.getAttribute(attr);
      if(value){
        const updated=replaceValue(value);
        if(updated!==value){
          el.setAttribute(attr, updated);
        }
      }
    });
    el.childNodes.forEach(replaceText);
  };
  const run=()=>{
    replaceText(document.body);
    replaceContactElements();
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  const observer=new MutationObserver((mutations)=>{
    mutations.forEach((mutation)=>{
      if(mutation.type==='characterData'){
        replaceText(mutation.target);
      }
      mutation.addedNodes.forEach(replaceText);
    });
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  if(document.title){
    document.title=document.title.replace(from,to);
  }
})();`
}

function renderLanguageReplacementScript() {
  return `(function(){
  const replaceValue=(value)=>value
    .replace(/\bRU\b/g,'ES')
    .replace(/\bRUS\b/g,'ES')
    .replace(/RU\./g,'ES')
    .replace(/Russian/gi,'Spanish')
    .replace(/Русский/gi,'Español')
    .replace(/Рус\.?/gi,'Español');

  const ensureOverrideStyle=()=>{
    if(document.getElementById('lang-override-style')){
      return;
    }
    const style=document.createElement('style');
    style.id='lang-override-style';
    style.textContent=\`
      .lang-override::before,
      .lang-override::after {
        content: attr(data-lang-display) !important;
      }
      a.nuxt-link-active.lang-force-hidden {
        display: none !important;
      }
      .lang-force-proxy {
        display: inline-flex !important;
        align-items: center;
        font-size: inherit;
        letter-spacing: inherit;
        color: inherit;
      }
    \`;
    document.head.appendChild(style);
  };

  const forcePseudoLang=(el)=>{
    const before=getComputedStyle(el,'::before').content || '';
    const after=getComputedStyle(el,'::after').content || '';
    const normalize=(value)=>value.replace(/["']/g,'').trim();
    const beforeText=normalize(before);
    const afterText=normalize(after);
    const isRu=(text)=>text === 'RU' || text === 'RUS' || text === 'Рус' || text === 'Русский';
    if(isRu(beforeText) || isRu(afterText)){
      el.classList.add('lang-override');
      el.setAttribute('data-lang-display','ES');
    }
  };

  const forceTopNavLang=()=>{
    ensureOverrideStyle();
    const candidates=[...document.querySelectorAll('a,button,span,div')];
    candidates.forEach((el)=>{
      const text=(el.textContent || '').trim();
      if(text === 'RU' || text === 'RUS' || text === 'Рус' || text === 'Русский'){
        el.textContent='ES';
        el.setAttribute('title','Español');
        el.setAttribute('aria-label','Español');
      }
      if(el.getAttribute('data-lang') === 'ru' || el.getAttribute('data-lang') === 'ru-RU'){
        el.setAttribute('data-lang','es');
      }
      if(el.getAttribute('lang') === 'ru' || el.getAttribute('lang') === 'ru-RU'){
        el.setAttribute('lang','es');
      }
      const href=el.getAttribute('href');
      if(href){
        let updatedHref=href;
        if(updatedHref.indexOf('/ru/') !== -1){
          updatedHref=updatedHref.split('/ru/').join('/es/');
        }
        updatedHref=updatedHref.replace(/\\/ru($|\\?)/g,'/es$1');
        updatedHref=updatedHref.replace(/lang=ru/gi,'lang=es');
        if(updatedHref!==href){
          el.setAttribute('href', updatedHref);
        }
      }
      forcePseudoLang(el);
    });

    const activeRuLink=[...document.querySelectorAll('a.nuxt-link-active')].find((el)=>{
      const text=(el.textContent || '').trim().toLowerCase();
      return text === 'ru' || text === 'rus' || text === 'рус';
    });
    const exactNavLink=document.querySelector('#__layout > div:nth-child(1) > div.wrapper.dark.fullheight:nth-child(1) > header.header:nth-child(1) > div.nav-mobile.nav-mobile--opened:nth-child(2) > div.ps.ps--active-y:nth-child(1) > div.nav-mobile__wrap:nth-child(2) > div.nav-mobile__body:nth-child(1) > div.nav-mobile__bottom:nth-child(2) > div:nth-child(1) > a.nuxt-link-active:nth-child(1)');
    const navContainer=document.querySelector('#__layout > div:nth-child(1) > div.wrapper.dark.fullheight:nth-child(1) > header.header:nth-child(1) > div.nav-mobile.nav-mobile--opened:nth-child(2) > div.ps.ps--active-y:nth-child(1) > div.nav-mobile__wrap:nth-child(2) > div.nav-mobile__body:nth-child(1) > div.nav-mobile__bottom:nth-child(2) > div:nth-child(1)');
    const targetLink=exactNavLink || activeRuLink;
    if(targetLink){
      const className=targetLink.className || 'nuxt-link-active';
      const href=(targetLink.getAttribute('href') || '/es/').replace('/ru/', '/es/');
      targetLink.classList.add('lang-force-hidden');
      const proxy=document.createElement('a');
      proxy.className='lang-force-proxy ' + className;
      proxy.textContent='ES';
      proxy.setAttribute('title','Español');
      proxy.setAttribute('aria-label','Español');
      proxy.setAttribute('href', href);
      if(targetLink.nextElementSibling){
        targetLink.nextElementSibling.insertAdjacentElement('beforebegin', proxy);
      } else {
        targetLink.insertAdjacentElement('afterend', proxy);
      }
      targetLink.remove();
    }
    if(navContainer){
      const ruLinks=[...navContainer.querySelectorAll('a')].filter((el)=>{
        const text=(el.textContent || '').trim().toLowerCase();
        return text === 'ru' || text === 'rus' || text === 'рус';
      });
      ruLinks.forEach((ruLinst text=(el.textContent || '').trim().toLowerCase();
        return text === 'ru' || text === 'rus' || text === 'рус';
      });
      ruLinks.forEach((ruLink)=>{
        const className=ruLink.className || 'nuxt-link-active';
        const href=(ruLink.getAttribute('href') || '/es/').replace('/ru/', '/es/');
        const esLink=document.createElement('a');
        esLink.className='lang-force-proxy ' + className;
        esLink.textContent='ES';
        esLink.setAttribute('title','Español');
        esLink.setAttribute('aria-label','Español');
        esLink.setAttribute('href', href);
        ruLink.insertAdjacentElement('afterend', esLink);
        ruLink.remove();
      });
    }
  };

  const replaceNode=(node)=>{
    if(node.nodeType===Node.TEXT_NODE){
      const updated=replaceValue(node.nodeValue);
      if(updated!==node.nodeValue){
        node.nodeValue=updated;
      }
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE){
      return;
    }
    const el=node;
    ['alt','title','aria-label','placeholder'].forEach((attr)=>{
      const value=el.getAttribute(attr);
      if(value){
        const updated=replaceValue(value);
        if(updated!==value){
          el.setAttribute(attr, updated);
        }
      }
    });
    if(el.hasAttribute('href')){
      const href=el.getAttribute('href');
      if(href){
        let updatedHref=href;
        updatedHref=updatedHref.replace(/\/ru\//g,'/es/');
        updatedHref=updatedHref.replace(/\/ru(\b|\?)/g,'/es$1');
        updatedHref=updatedHref.replace(/lang=ru/gi,'lang=es');
        if(updatedHref!==href){
          el.setAttribute('href', updatedHref);
        }
      }
    }
    if(el.hasAttribute('hreflang')){
      const lang=el.getAttribute('hreflang');
      if(lang === 'ru' || lang === 'ru-RU'){
        el.setAttribute('hreflang','es');
      }
    }
    if(el.hasAttribute('lang')){
      const lang=el.getAttribute('lang');
      if(lang === 'ru' || lang === 'ru-RU'){
        el.setAttribute('lang','es');
      }
    }
    if(el.hasAttribute('data-lang')){
      const lang=el.getAttribute('data-lang');
      if(lang === 'ru' || lang === 'ru-RU'){
        el.setAttribute('data-lang','es');
      }
    }
    el.childNodes.forEach(replaceNode);
  };
  const run=()=>{
    replaceNode(document.body);
    forceTopNavLang();
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  const observer=new MutationObserver((mutations)=>{
    mutations.forEach((mutation)=>{
      if(mutation.type==='characterData'){
        replaceNode(mutation.target);
      }
      mutation.addedNodes.forEach(replaceNode);
    });
    forceTopNavLang();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  let attempts=0;
  const interval=setInterval(()=>{
    forceTopNavLang();
    attempts+=1;
    if(attempts>10){
      clearInterval(interval);
    }
  }, 500);
})();`
}

function applyPreviewEdits(
  response: Response,
  options?: {
    stripScripts?: boolean
    extraBodyHtml?: string
    extraHeadHtml?: string
    skipTextRewrite?: boolean
  }
) {
  const stripScripts = options?.stripScripts ?? false
  const extraBodyHtml = options?.extraBodyHtml ?? ''
  const extraHeadHtml = options?.extraHeadHtml ?? ''
  const skipTextRewrite = options?.skipTextRewrite ?? false
  const mapCoords = '9.845519943232729,-83.96499953547801'
  const rewriter = new HTMLRewriter()
    .on('title', {
      text(text) {
        const updated = text.text.replace(/krivitskiy/gi, 'MRZ LEGAL')
        if (updated !== text.text) {
          text.replace(updated)
        }
      },
    })
    .on('meta', {
      element(element) {
        const content = element.getAttribute('content')
        if (content && /krivitskiy/gi.test(content)) {
          element.setAttribute('content', content.replace(/krivitskiy/gi, 'MRZ LEGAL'))
        }
      },
    })
    .on('head', {
      element(element) {
        if (extraHeadHtml) {
          element.append(extraHeadHtml, { html: true })
        }
      },
    })
        .on('#__nuxt > script', {
      element(element) {
        if (stripScripts) {
          element.remove()
        }
      },
    })
    .on('script', {
      element(element) {
        if (stripScripts) {
          element.remove()
        }
      },
    })
    .on('link', {
      element(element) {
        const href = element.getAttribute('href')
        if (stripScripts && href && href.includes('/_nuxt/') && /\.js(\?|$)/.test(href)) {
          element.remove()
          return
        }
        if (href) {
          let updatedHref = href
          updatedHref = updatedHref.replace(/\/ru\//g, '/es/')
          updatedHref = updatedHref.replace(/\/ru(\b|\?)/g, '/es$1')
          updatedHref = updatedHref.replace(/lang=ru/gi, 'lang=es')
          if (updatedHref !== href) {
            element.setAttribute('href', updatedHref)
          }
        }
        const lang = element.getAttribute('hreflang')
        if (lang === 'ru' || lang === 'ru-RU') {
          element.setAttribute('hreflang', 'es')
        }
        const dataLang = element.getAttribute('data-lang')
        if (dataLang === 'ru' || dataLang === 'ru-RU') {
          element.setAttribute('data-lang', 'es')
        }
      },
    })
    .on('iframe', {
      element(element) {
        const src = element.getAttribute('src')
        if (!src) return
        let updatedSrc = src
          .replace(/maps\?q=[0-9\.-]+,[0-9\.-]+/gi, `maps?q=${mapCoords}`)
          .replace(/q=[0-9\.-]+,[0-9\.-]+/gi, `q=${mapCoords}`)
          .replace(/center=[0-9\.-]+,[0-9\.-]+/gi, `center=${mapCoords}`)
          .replace(/markers=[0-9\.-]+,[0-9\.-]+/gi, `markers=${mapCoords}`)
        if (updatedSrc !== src) {
          element.setAttribute('src', updatedSrc)
        }
      },
    })
    .on('[style]', {
      element(element) {
        const style = element.getAttribute('style')
        if (!style) return
        let updatedStyle = style
          .replace(/maps\?q=[0-9\.-]+,[0-9\.-]+/gi, `maps?q=${mapCoords}`)
          .replace(/q=[0-9\.-]+,[0-9\.-]+/gi, `q=${mapCoords}`)
          .replace(/center=[0-9\.-]+,[0-9\.-]+/gi, `center=${mapCoords}`)
          .replace(/markers=[0-9\.-]+,[0-9\.-]+/gi, `markers=${mapCoords}`)
        if (updatedStyle !== style) {
          element.setAttribute('style', updatedStyle)
        }
      },
    })
    .on('p span:nth-child(7)', {
      element(element) {
        element.after('<span></span><span></span>', { html: true })
      },
    })
    .on('p span:nth-child(9)', {
      element(element) {
        element.after('<span></span><span></span>', { html: true })
      },
    })
    .on('#__layout > div.wrapper.dark.fullheight:nth-child(1)', {
      element(element) {
        element.append('<div class="preview-banner" data-preview="true" data-origin="manual">MRZ LEGAL</div>', { html: true })
      },
    })
    .on('a', {
      element(element) {
        const href = element.getAttribute('href')
        if (href) {
          let updatedHref = href
          updatedHref = updatedHref.replace(/\/ru\//g, '/es/')
          updatedHref = updatedHref.replace(/\/ru(\b|\?)/g, '/es$1')
          updatedHref = updatedHref.replace(/lang=ru/gi, 'lang=es')
          if (updatedHref !== href) {
            element.setAttribute('href', updatedHref)
          }
        }
        const lang = element.getAttribute('hreflang')
        if (lang === 'ru' || lang === 'ru-RU') {
          element.setAttribute('hreflang', 'es')
        }
        const dataLang = element.getAttribute('data-lang')
        if (dataLang === 'ru' || dataLang === 'ru-RU') {
          element.setAttribute('data-lang', 'es')
        }
      },
      text(text) {
        if (skipTextRewrite) {
          return
        }
        const updated = text.text
          .replace(/\bru\b/gi, 'ES')
          .replace(/\bRUS\b/gi, 'ES')
          .replace(/RU\./gi, 'ES')
          .replace(/Russian/gi, 'Spanish')
          .replace(/Русский/gi, 'Español')
          .replace(/Рус\.?/gi, 'Español')
        if (updated !== text.text) {
          text.replace(updated)
        }
      },
    })
    .on('a.nuxt-link-active', {
      text(text) {
        if (skipTextRewrite) {
          return
        }
        const trimmed = text.text.trim().toLowerCase()
        if (trimmed === 'ru') {
          text.replace('ES')
        }
      },
    })
    .on('link', {
      element(element) {
        const href = element.getAttribute('href')
        if (href) {
          let updatedHref = href
          updatedHref = updatedHref.replace(/\/ru\//g, '/es/')
          updatedHref = updatedHref.replace(/\/ru(\b|\?)/g, '/es$1')
          updatedHref = updatedHref.replace(/lang=ru/gi, 'lang=es')
          if (updatedHref !== href) {
            element.setAttribute('href', updatedHref)
          }
        }
        const lang = element.getAttribute('hreflang')
        if (lang === 'ru' || lang === 'ru-RU') {
          element.setAttribute('hreflang', 'es')
        }
        const dataLang = element.getAttribute('data-lang')
        if (dataLang === 'ru' || dataLang === 'ru-RU') {
          element.setAttribute('data-lang', 'es')
        }
      },
    })
    .on('body', {
      element(element) {
        if (extraBodyHtml) {
          element.append(extraBodyHtml, { html: true })
        }
        element.append('<div id="pseudo-scroll"></div>', { html: true })
      },
    })

  return rewriter.transform(response)
}

function getClientOverrideScript() {
  return `
<script>
(function(){
  var PHONE = '+506 2278 0392 - info@mrzlegal.com';
  var ADDRESS = 'Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos';
  var HOME_TEXT = 'Regional projects hold significant importance for us. We are committed to boarding the first available flight, regardless of weather, to reach your desired location. Tasks may be spread across various cities in Costa Rica at the same time.';
  var MAP_URL = 'https://tile.openstreetmap.org/17/34965/61933.png';
  var rx = function(pattern, flags){ return new RegExp(pattern, flags); };
  var rePhone = rx('\\+7\\s*977\\s*820-00-01','gi');
  var reEmail = rx('pravo@\\s*mrz\\s*legal\\.com','gi');
  var reAddr1 = rx('ul\\.\\s*sushchevskaya,?\\s*d\\.\\s*27\\s*str\\.\\s*2','gi');
  var reAddr2 = rx('127030,?\\s*moscow','gi');
  var reDesigned = rx('Designed by\\s*Art\\.?\\s*Lebedev\\s*Studio','gi');
  var reArt = rx('Art\\.?\\s*Lebedev\\s*Studio','gi');
  var reLogo = rx('ART\\.\\s*LEBEDEV','gi');

  function replaceText(node){
    if (!node || node.nodeType !== 3) return;
    var t = node.nodeValue || '';
    var u = t
      .replace(reDesigned, 'Designed by Jose Navarro')
      .replace(reArt, 'Jose Navarro')
      .replace(reLogo, 'MRZ LEGAL')
      .replace(rePhone, '+506 2278 0392')
      .replace(reEmail, 'info@mrzlegal.com')
      .replace(reAddr1, ADDRESS)
      .replace(reAddr2, ADDRESS);
    if (u.indexOf('Regional projects hold significant importance') !== -1) {
      u = HOME_TEXT;
    }
    if (u !== t) node.nodeValue = u;
  }
  function walk(node){
    if (!node) return;
    if (node.nodeType === 3) { replaceText(node); return; }
    for (var i=0;i<node.childNodes.length;i++) walk(node.childNodes[i]);
  }
  function updateLogo(){
    var nodes = document.querySelectorAll('a, div, span, p');
    for (var i=0;i<nodes.length;i++){
      var el = nodes[i];
      if (!el || !el.textContent) continue;
      if (reLogo.test(el.textContent)) {
        el.textContent = el.textContent.replace(reLogo,'MRZ LEGAL');
        var link = el.closest('a');
        if (link) link.href = '/en/';
      }
      if (reDesigned.test(el.textContent)) {
        el.textContent = el.textContent.replace(reDesigned,'Designed by Jose Navarro');
        var link2 = el.closest('a');
        if (link2) link2.href = '/en/';
      }
    }
  }
  function updateContacts(){
    if (!/\\/contacts\\/?$/.test(location.pathname)) return;
    var phoneEl = document.querySelector('#text > p:nth-child(1)');
    if (phoneEl) phoneEl.textContent = PHONE;
    var addr1El = document.querySelector('#text > p:nth-child(3)');
    if (addr1El) addr1El.textContent = ADDRESS;
    var addr2El = document.querySelector('#text > p:nth-child(5)');
    if (addr2El) addr2El.textContent = '';
  }
  function updateMap(){
    if (!/\\/contacts\\/?$/.test(location.pathname)) return;
    var map = document.querySelector('#map');
    if (!map) return;
    map.style.backgroundImage = 'url(' + MAP_URL + ')';
    map.style.backgroundSize = '512px 512px';
    map.style.backgroundRepeat = 'repeat';
    map.style.backgroundPosition = 'center';
    map.style.minHeight = '100vh';
    map.style.width = '100%';
    map.style.height = '100%';
    var iframe = map.querySelector('iframe');
    if (iframe) iframe.remove();
    map.style.filter = 'grayscale(100%) contrast(140%) brightness(110%)';
  }
  function apply(){
    try {
      walk(document.body);
      updateLogo();
      updateContacts();
      updateMap();
    } catch(e) {}
  }
  apply();
  var obs = new MutationObserver(function(){ apply(); });
  obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  setTimeout(function(){ obs.disconnect(); }, 120000);
  window.addEventListener('load', apply);
})();
</script>
`;
}

function applyServerReplacements(html: string, pathname: string) {
  let updated = html
    .replace(/Designed by\s*Art\.\s*Lebedev\s*Studio/gi, 'Designed by Jose Navarro')
    .replace(/ART\.\s*LEBEDEV/gi, 'MRZ LEGAL')
    .replace(/\+7\s*977\s*820-00-01/gi, '+506 2278 0392')
    .replace(/pravo@\s*mrz\s*legal\.com/gi, 'info@mrzlegal.com')
    .replace(/ul\.\s*sushchevskaya,?\s*d\.\s*27\s*str\.\s*2/gi, 'Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos')
    .replace(/127030,?\s*moscow/gi, 'Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos')
    .replace(
      /Regional projects hold significant importance[\s\S]*?our\s+solutions\./gi,
      'Regional projects hold significant importance for us. We are committed to boarding the first available flight, regardless of weather, to reach your desired location. Tasks may be spread across various cities in Costa Rica at the same time.'
    )

  const isContacts = /\/contacts\/?$/.test(pathname)
  const isHome = pathname === '/en/' || pathname === '/en'
  const mapUrl = 'https://tile.openstreetmap.org/17/34965/61933.png'

  if (isContacts) {
    updated = updated.replace(/<body([^>]*)>/i, (match, attrs) => {
      if (/class=/.test(attrs)) {
        return match.replace(/class=("|')([^"']*)("|')/i, (m, q1, cls, q2) => `class=${q1}${cls} mrz-contacts${q2}`)
      }
      return `<body${attrs} class="mrz-contacts">`
    })
  }

  if (isHome) {
    updated = updated.replace(/<body([^>]*)>/i, (match, attrs) => {
      if (/class=/.test(attrs)) {
        return match.replace(/class=("|')([^"']*)("|')/i, (m, q1, cls, q2) => `class=${q1}${cls} mrz-home${q2}`)
      }
      return `<body${attrs} class="mrz-home">`
    })
  }

  const style = `\n<style id="mrz-overrides">\n` +
    `body.mrz-contacts #map{position:relative;min-height:100vh;width:100%;height:100%;background-image:url('${mapUrl}');background-repeat:repeat;background-size:512px 512px;background-position:center;filter:grayscale(100%) contrast(140%) brightness(110%);}\n` +
    `body.mrz-contacts #map iframe{display:none !important;}\n` +
    `body.mrz-contacts #mrz-contact-overlay{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);text-align:center;font-size:16px;line-height:1.4;color:#000;text-transform:uppercase;letter-spacing:1px;z-index:5;}\n` +
    `body.mrz-contacts #mrz-contact-overlay .line{display:block;background:#111;color:#fff;padding:3px 10px;margin:4px 0;}\n` +
    `body.mrz-contacts .nav-mobile__top{display:none !important;}\n` +
    `#mrz-swipe-hint{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111;color:#fff;padding:6px 12px;border-radius:999px;font-size:12px;letter-spacing:1px;z-index:9999;}\n` +
    `@media (min-width: 901px){#mrz-swipe-hint{display:none;}}\n` +
    `</style>\n`

  if (!updated.includes('id="mrz-overrides"')) {
    updated = updated.replace('</head>', `${style}</head>`)
  }

  if (isContacts && !updated.includes('id="mrz-contact-overlay"')) {
    const overlay = `\n<div id="mrz-contact-overlay"><span class="line">+506 2278 0392 - info@mrzlegal.com</span><span class="line">Cartago, Tejar del Guarco, Valle Illios, uno – ciento dos</span></div>\n`
    updated = updated.replace('</body>', `${overlay}</body>`)
  }

  if (isHome && !updated.includes('id="mrz-swipe-hint"')) {
    const hint = `\n<div id="mrz-swipe-hint">Swipe left →</div>\n`
    updated = updated.replace('</body>', `${hint}</body>`)
  }

  return updated
}

function renderHomeSnapshotPage() {
  return renderBasePage({
    title: 'MRZ LEGAL',
    subtitle: 'Bankruptcy and trials',
    body: `
      <section class="custom-card snapshot-card">
        <h2>Practice</h2>
        <p>Defending the rights of entrepreneurs and companies in economic disputes.</p>
        <ul class="snapshot-list">
          <li><a href="/en/pages/bankruptcy/">Bankruptcy</a></li>
          <li><a href="/en/pages/economy/">Dispute resolution</a></li>
          <li><a href="/en/pages/corporate/">Corporate disputes</a></li>
          <li><a href="/en/pages/tax/">Tax disputes</a></li>
          <li><a href="/en/pages/economic/">Subsidiary liability</a></li>
          <li><a href="/en/pages/blog/">Blog “Bankromat”</a></li>
        </ul>
      </section>
      <section class="custom-card">
        <h2>About the practice</h2>
        <p>We&nbsp;support the business in&nbsp;achieving its goals. Modern, smart, and very “uncomfortable for rivals” legal company, that focuses on&nbsp;safeguarding interests related to&nbsp;economic activities.</p>
        <p>For 18&nbsp;years, we’ve been winning bankruptcy cases, resolving economic disputes, defending against subsidiary liability, and completing various legal projects with remarkable success.</p>
        <p>The services provided by&nbsp;our solicitors are personalized legal solutions that eliminate any hindrances to&nbsp;profitability. By&nbsp;taking in&nbsp;the entire image, we&nbsp;refrain from following traditional actions and overcome any doubt, ultimately reaching our goal.</p>
      </section>
      <section class="custom-card">
        <h2>Approach</h2>
        <p>We&nbsp;provide a&nbsp;concise answer without unnecessary elements and words, often unique to&nbsp;our company’s practices and the entire legal market. In&nbsp;addition to&nbsp;competence, extensive experience, and a&nbsp;fresh perspective, our work involves comprehending people, economics, and individual businesses.</p>
        <p>Any case we&nbsp;have is&nbsp;exceptional. It&nbsp;remains a&nbsp;secret, disclosed only to&nbsp;the trustee and concealed from others. <span>We</span>&nbsp;<span>navigate both past and future to</span>&nbsp;<span>safeguard business in</span>&nbsp;<span>the present, all without inconveniencing you. The primary focus is</span>&nbsp;<span>time; do</span>&nbsp;<span>not divert your attention from financial matters.</span></p>
      </section>
      <section class="custom-card">
        <h2>Experience and reach</h2>
        <p>We&nbsp;turn litigation investments into results for ordinary business people in&nbsp;complex legal disputes within the realms of&nbsp;banking and investment, real estate and trade, construction, manufacturing and energy, communications and IT. We’ll tell you directly what happens next. Millions of&nbsp;protected assets confirm the capabilities.</p>
        <p>Regional projects hold significant importance for&nbsp;us. We&nbsp;are committed to&nbsp;boarding the first available flight, regardless of&nbsp;weather, to&nbsp;reach your desired location. Tasks may be&nbsp;spread across various cities in&nbsp;Costa Rica at&nbsp;the same time.</p>
        <p>Your case is&nbsp;a&nbsp;privilege to&nbsp;us. We&nbsp;approach it&nbsp;not only with focus on&nbsp;the case itself, but also considering the individuals involved. We&nbsp;truly understand and prioritise the people behind every business, and as&nbsp;legal professionals, we&nbsp;always strive to&nbsp;protect both the person and the company.</p>
      </section>
    `,
    script: '',
  })
}

function renderFallbackPage(pathname: string) {
  return renderBasePage({
    title: 'Temporarily unavailable',
    subtitle: 'Please try again shortly',
    body: `
      <section class="custom-card">
        <h2>We are having trouble loading this page</h2>
        <p>The upstream site is currently overloaded, so this page cannot be displayed right now.</p>
        <div class="fallback-actions">
          <a class="primary" href="/en/">Back to home</a>
          <a href="/en/contact/">Contact us</a>
          <a href="/en/newsletter/">Newsletter</a>
        </div>
        <p class="small">Requested path: ${escapeHtml(pathname)}</p>
      </section>
    `,
    script: '',
  })
}

export default app
