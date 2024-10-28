import { test, expect, Page } from '@playwright/test';

class CheckoutPage {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  shippingAddress = {
    email: "for.test.perifit@gmail.com",
    countryCode: "AU",
    first_name: "Auto",
    last_name: "Test",
    address1: "Costco Wholesale Ipswich",
    phone: "61212345678",
  }

  defaultCardNumber = {
    number: "4083060013005315",
    expDate: "08/2027",
    cvv: "032"
  }

  xpathSelectCountry = `//select[@id='Select0']`;
  xpathSelectProvinceOrState = `//select[@id='Select1']`;
  xpathBtnCountinueToShipping = `//span[normalize-space()='Continue to shipping']`;
  xpathBtnCountinueToPayment = `//span[normalize-space()='Continue to payment']`;
  xpathInputCardNumber = `//input[@placeholder='Card number']`;
  xpathInputCardExpDate = `//input[@placeholder='Expiration date (MM / YY)']`;
  xpathInputCardCVV = `//input[@placeholder='Security code']`;
  xpathBtnReviewOrder = `//span[normalize-space()='Review order']`;
  xpathPayNowBtnFull = `/html/body/div[1]/div[1]/div/div[1]/div[2]/div[1]/div/main/div/div/div/div/div[2]/div/div/div/div/div[2]/div[1]/form/div[1]/div/button`;
  xpathPayNowBtnAlternate = `//*[@id="Form4"]/div[1]/div/button`;

  async inputEmail(email: string) {
    await this.page.locator(`//input[@id='email']`).fill(email);
  }

  async selectCountry(countryCode: string) {
    await this.page.locator(this.xpathSelectCountry).click();
    await this.page.locator(this.xpathSelectCountry).selectOption({ value: countryCode });
  }

  async inputFirstName(firstName: string) {
    await this.page.locator("//input[@placeholder='First name']").fill(firstName);
  }

  async inputLastName(lastName: string) {
    await this.page.locator("//input[@placeholder='Last name']").fill(lastName);
  }

  async inputAddress1(address1: string) {
    await this.page.locator("//input[@placeholder='Address']").fill(address1);
    await this.page.waitForSelector("//h3[text()='Suggestions']");
    await this.selectOptionAddress1();
  }

  async selectOptionAddress1() {
    await this.page.locator("//li[@id='shipping-address1-option-0']").click();
  }

  async inputPhoneNumber(phone: string) {
    await this.page.locator("//input[@placeholder='Phone']").fill(phone);
  }

  async checkoutWithCreditCard(defaultCardNumber = this.defaultCardNumber) {
    const iframeCardNumber = this.page.frameLocator("//iframe[contains(@id, 'card-fields-number')]");
    const iframeExpDate = this.page.frameLocator("//iframe[contains(@id, 'card-fields-expiry')]");
    const iframeCvv = this.page.frameLocator("//iframe[contains(@id, 'card-fields-verification')]");

    await iframeCardNumber.locator(this.xpathInputCardNumber).fill(defaultCardNumber.number);
    await iframeExpDate.locator(this.xpathInputCardExpDate).fill(defaultCardNumber.expDate);
    await iframeCvv.locator(this.xpathInputCardCVV).fill(defaultCardNumber.cvv);
  }
}

test('Checkout flow with Pay now button click and delay', async ({ page }) => {
  // Set the timeout to 60 seconds for this test to prevent timeout errors
  test.setTimeout(60000); // 60 seconds

  await page.goto("https://au.perifit.co/");
  await page.locator("//div[contains(@class, 'announcement-bar__wrapper')]").click();
  const firstProduct = page.locator("//span[contains(@class, 'product-card__title')]//a").first();
  await firstProduct.click();

  // Click add to cart
  await page.locator("//div[normalize-space() = 'Add to cart']").first().click();

  // Click checkout
  await page.locator("//form[@class='cart-form rounded']//button[@name='checkout']").click();
  await page.waitForTimeout(5000);

  // Fill checkout info
  const checkoutPage = new CheckoutPage(page);
  const shippingAddress = checkoutPage.shippingAddress;

  await checkoutPage.page.locator(checkoutPage.xpathBtnCountinueToShipping).scrollIntoViewIfNeeded();
  await checkoutPage.inputEmail(shippingAddress.email);
  await checkoutPage.inputFirstName(shippingAddress.first_name);
  await checkoutPage.inputLastName(shippingAddress.last_name);
  await checkoutPage.inputAddress1(shippingAddress.address1);
  await checkoutPage.inputPhoneNumber(shippingAddress.phone);

  await page.waitForTimeout(2000);
  await checkoutPage.page.locator(checkoutPage.xpathBtnCountinueToShipping).click();
  await checkoutPage.page.locator(checkoutPage.xpathBtnCountinueToPayment).click();

  // Complete order with Credit card
  await checkoutPage.page.waitForSelector("//h2[text()='Payment']");
  await checkoutPage.checkoutWithCreditCard();
  await checkoutPage.page.locator(checkoutPage.xpathBtnReviewOrder).click();

  // Wait for "Pay now" button to be enabled and click it
  try {
    console.log("Waiting for Pay now button to be enabled...");
    await page.waitForSelector(checkoutPage.xpathPayNowBtnFull, { timeout: 10000 });
    await page.locator(checkoutPage.xpathPayNowBtnFull).click();
    console.log("Pay now button clicked.");
  } catch (error) {
    console.error("Pay now button using full XPath did not become enabled, trying alternate XPath...");
    await page.waitForSelector(checkoutPage.xpathPayNowBtnAlternate);
    await page.locator(checkoutPage.xpathPayNowBtnAlternate).click();
    console.log("Pay now button clicked with alternate XPath.");
  }

  // Wait for a few seconds (3 seconds) instead of 100 seconds
  await page.waitForTimeout(3000);

  // Get the final URL and assert that it contains the expected part
  let finalUrl = page.url();
  console.log(`Final URL after payment: ${finalUrl}`);

  // If the final URL contains "/processing", wait until the URL changes or reaches a timeout
  if (finalUrl.includes('/processing')) {
    console.log(`Final URL : ${finalUrl}`);
    const processingTimeout = 60000; // Maximum wait time for processing to complete (60 seconds)
    const startTime = Date.now();

    while (finalUrl.includes('/processing')) {
    //   // Wait for 3 seconds before checking again
      await page.waitForTimeout(3000);

      // Update the final URL
      finalUrl = page.url();
      console.log(`Current URL during processing: ${finalUrl}`);

      // Check if we've exceeded the processing timeout
      if (Date.now() - startTime > processingTimeout) {
        const dateTime = new Date().toISOString().replace(/:/g, '-');
 		await page.screenshot({ path: `./screenshots/${dateTime}.png` });
		 await page.waitForTimeout(3000);
      }
    }
  }

  console.log(`Final URL after processing: ${finalUrl}`);
  expect(finalUrl).toMatch(/\/(payment|review)$/); // Adjust this regex based on your expected URLs
});
