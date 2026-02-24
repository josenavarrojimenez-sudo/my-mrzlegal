(function () {
  const MAX_ATTEMPTS = 20
  const INTERVAL_MS = 300

  const normalize = (value) => (value || '').trim().toLowerCase()

  const replaceRuLink = (link) => {
    if (!link) return false
    const text = normalize(link.textContent)
    if (text !== 'ru' && text !== 'rus' && text !== 'рус') return false

    const className = link.className || ''
    let href = (link.getAttribute('href') || '/es/').replace(/\/ru\//g, '/es/')
    if (!href.includes('/es')) {
      href = '/es/'
    }

    const esLink = document.createElement('a')
    esLink.className = className
    esLink.textContent = 'ES'
    esLink.setAttribute('href', href)
    esLink.setAttribute('title', 'Español')
    esLink.setAttribute('aria-label', 'Español')

    link.insertAdjacentElement('afterend', esLink)
    link.remove()
    return true
  }

  const run = () => {
    let replaced = false

    const headerLinks = document.querySelectorAll('header a, header .header a, header .nav a, header .nav-mobile a')
    headerLinks.forEach((link) => {
      if (replaceRuLink(link)) {
        replaced = true
      }
    })

    if (!replaced) {
      const allLinks = document.querySelectorAll('a')
      allLinks.forEach((link) => {
        if (replaceRuLink(link)) {
          replaced = true
        }
      })
    }

    return replaced
  }

  const observer = new MutationObserver(() => run())
  const start = () => {
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    run()

    let attempts = 0
    const timer = setInterval(() => {
      run()
      attempts += 1
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(timer)
      }
    }, INTERVAL_MS)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
