const test = require('ava')

const {
  getVanillaFingerPrint,
  getStealthFingerPrint,
  dummyHTMLPath,
  vanillaPuppeteer,
  addExtra
} = require('../../test/util')
const Plugin = require('.')

// Fix CI issues with old versions
const isOldPuppeteerVersion = () => {
  const version = process.env.PUPPETEER_VERSION
  if (!version) {
    return false
  }
  if (version === '1.9.0' || version === '1.6.2') {
    return true
  }
  return false
}

test('vanilla: will be undefined', async t => {
  const { iframeChrome } = await getVanillaFingerPrint()
  t.is(iframeChrome, 'undefined')
})

test('stealth: will be object', async t => {
  const { iframeChrome } = await getStealthFingerPrint(Plugin)
  t.is(iframeChrome, 'object')
})

test('stealth: will not break iframes', async t => {
  const browser = await addExtra(vanillaPuppeteer)
    .use(Plugin())
    .launch({ headless: true })
  const page = await browser.newPage()

  const testFuncReturnValue = 'TESTSTRING'
  await page.evaluate(returnValue => {
    const { document } = window // eslint-disable-line
    const body = document.querySelector('body')
    const iframe = document.createElement('iframe')
    iframe.srcdoc = 'foobar'
    iframe.contentWindow.mySuperFunction = () => returnValue
    body.appendChild(iframe)
  }, testFuncReturnValue)
  const realReturn = await page.evaluate(
    () => document.querySelector('iframe').contentWindow.mySuperFunction() // eslint-disable-line
  )
  await browser.close()

  t.is(realReturn, 'TESTSTRING')
})

test('vanilla: will not have chrome runtine in any frame', async t => {
  const browser = await vanillaPuppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('file://' + dummyHTMLPath)

  const basiciframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  const sandboxSOiframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    el.setAttribute('sandbox', 'allow-same-origin')
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  const sandboxSOASiframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    el.setAttribute('sandbox', 'allow-same-origin allow-scripts')
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  const srcdociframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    el.srcdoc = 'blank page, boys.'
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  // console.log('basic iframe', basiciframe)
  // console.log('sandbox same-origin iframe', sandboxSOiframe)
  // console.log('sandbox same-origin&scripts iframe', sandboxSOASiframe)
  // console.log('srcdoc iframe', srcdociframe)

  await browser.close()

  t.is(typeof basiciframe, 'undefined')
  t.is(typeof sandboxSOiframe, 'undefined')
  t.is(typeof sandboxSOASiframe, 'undefined')
  t.is(typeof srcdociframe, 'undefined')
})

test('stealth: it will cover all frames including srcdoc', async t => {
  // const browser = await vanillaPuppeteer.launch({ headless: false })
  const browser = await addExtra(vanillaPuppeteer)
    .use(Plugin())
    .launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('file://' + dummyHTMLPath)

  const basiciframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  const sandboxSOiframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    el.setAttribute('sandbox', 'allow-same-origin')
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  const sandboxSOASiframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    el.setAttribute('sandbox', 'allow-same-origin allow-scripts')
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  const srcdociframe = await page.evaluate(() => {
    const el = document.createElement('iframe')
    el.srcdoc = 'blank page, boys.'
    document.body.appendChild(el)
    return el.contentWindow.chrome
  })

  // console.log('basic iframe', basiciframe)
  // console.log('sandbox same-origin iframe', sandboxSOiframe)
  // console.log('sandbox same-origin&scripts iframe', sandboxSOASiframe)
  // console.log('srcdoc iframe', srcdociframe)

  await browser.close()

  if (isOldPuppeteerVersion()) {
    t.is(typeof basiciframe, 'object')
  } else {
    t.is(typeof basiciframe, 'object')
    t.is(typeof sandboxSOiframe, 'object')
    t.is(typeof sandboxSOASiframe, 'object')
    t.is(typeof srcdociframe, 'object')
  }
})

test('regression: new method will not break recaptcha popup', async t => {
  // const browser = await vanillaPuppeteer.launch({ headless: false })
  const browser = await addExtra(vanillaPuppeteer)
    .use(Plugin())
    .launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('https://www.fbdemo.com/invisible-captcha/index.html')

  await page.type('#tswname', 'foo')
  await page.type('#tswemail', 'foo@foo.foo')
  await page.type(
    '#tswcomments',
    'In the depth of winter, I finally learned that within me there lay an invincible summer.'
  )
  await page.click('#tswsubmit')
  await page.waitFor(1000)

  const { hasRecaptchaPopup } = await page.evaluate(() => {
    const hasRecaptchaPopup = !!document.querySelectorAll(
      `iframe[title="recaptcha challenge"]`
    ).length
    return { hasRecaptchaPopup }
  })

  await browser.close()

  t.true(hasRecaptchaPopup)
})

test('regression: old method indeed did break recaptcha popup', async t => {
  const browser = await vanillaPuppeteer.launch({ headless: true })
  const page = await browser.newPage()

  // Old method
  await page.evaluateOnNewDocument(() => {
    // eslint-disable-next-line
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function() {
        return window
      }
    })
  })

  await page.goto('https://www.fbdemo.com/invisible-captcha/index.html')

  await page.type('#tswname', 'foo')
  await page.type('#tswemail', 'foo@foo.foo')
  await page.type(
    '#tswcomments',
    'In the depth of winter, I finally learned that within me there lay an invincible summer.'
  )
  await page.click('#tswsubmit')
  await page.waitFor(1000)

  const { hasRecaptchaPopup } = await page.evaluate(() => {
    const hasRecaptchaPopup = !!document.querySelectorAll(
      `iframe[title="recaptcha challenge"]`
    ).length
    return { hasRecaptchaPopup }
  })

  await browser.close()

  t.false(hasRecaptchaPopup)
})
