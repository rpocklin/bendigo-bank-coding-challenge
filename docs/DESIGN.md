---
version: "alpha"
name: Bendigo Bank
description: Staff commission-quote screen using the public Bendigo Bank site as the visual reference. Sampled 3 Nov 2026 from bendigobank.com.au.
colors:
  primary: "#DE313B"
  on-primary: "#FFFFFF"
  primary-hover: "#C82C35"
  secondary: "#870E40"
  on-secondary: "#FFFFFF"
  secondary-button: "#58003A"
  heading: "#330019"
  body: "#323D42"
  ink: "#2B2D32"
  surface: "#FFFFFF"
  surface-muted: "#F6F2F5"
  surface-warm: "#F6F5F3"
  surface-disabled: "#EFEFEF"
  border: "#808184"
  error: "#DE313B"
  error-surface: "#FDE5DA"
  focus: "#DE313B"
typography:
  headline-lg:
    fontFamily: Mulish
    fontSize: 36px
    fontWeight: "700"
    lineHeight: 42px
  headline-md:
    fontFamily: Mulish
    fontSize: 30px
    fontWeight: "700"
    lineHeight: 36px
  headline-sm:
    fontFamily: Mulish
    fontSize: 24px
    fontWeight: "700"
    lineHeight: 30px
  body-md:
    fontFamily: Mulish
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  label-md:
    fontFamily: Mulish
    fontSize: 14px
    fontWeight: "700"
    lineHeight: 18px
  button:
    fontFamily: Mulish
    fontSize: 16px
    fontWeight: "700"
    lineHeight: 22px
rounded:
  sm: 6px
  md: 6px
  lg: 24px
spacing:
  unit: 8px
  field: 24px
  page: 24px
  stack: 16px
components:
  page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    padding: "{spacing.page}"
  headline:
    textColor: "{colors.heading}"
    typography: "{typography.headline-lg}"
  section-title:
    textColor: "{colors.heading}"
    typography: "{typography.headline-md}"
  link:
    textColor: "{colors.secondary}"
    typography: "{typography.body-md}"
  label:
    textColor: "{colors.heading}"
    typography: "{typography.label-md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 11px
    height: 48px
  input-invalid:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 12px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-primary-focus:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.on-primary}"
  button-disabled:
    backgroundColor: "{colors.surface-disabled}"
    textColor: "{colors.body}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    height: 48px
  input-outline:
    backgroundColor: "{colors.border}"
    rounded: "{rounded.sm}"
    height: 1px
  button-secondary:
    backgroundColor: "{colors.secondary-button}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    height: 48px
  choice-selected:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
  result-panel:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.heading}"
    typography: "{typography.headline-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.field}"
  alert-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.heading}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.stack}"
  disclaimer:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.body}"
    typography: "{typography.label-md}"
    padding: "{spacing.stack}"
---

## Overview

This is the staff commission-quote screen, not a marketing site. It borrows the public Bendigo Bank look sampled on 3 November 2026 from the homepage, the home loans index, the tools and calculators index, the home loan repayment calculator, and the contact page.

The public site is a white page, Mulish (served there under the older name Muli), burgundy headings, wine-coloured underlined links, and a single red pill button for the action. Interior pages put a short introduction under the title, then a task, then a "Things you should know" note. Photography is full-bleed and about people. This screen does not use those photographs.

The quote page is one column. Staff enter currency, amount, term, and risk band, then generate a quote. The result sits in a blush panel. Errors use the same plain sentences as the message catalog, next to the field that failed.

Do not copy the Bendigo Bank logo, wordmark artwork, icon font, or photography into the repo. Set the name "Bendigo Bank" in Mulish bold if a mark is needed. Load Mulish (the renamed Muli) at weights 400 and 700, with Arial as the fallback. Those are the only weights on the public site.

## Colors

The palette is small. Red is the action. Wine is the link and the selected choice. Burgundy is for headings and labels. Body copy is a blue-black, not pure black.

- **Primary (#DE313B):** "Generate quote", and the invalid field border. White text on this red is about 4.6:1. It passes WCAG AA for 16px bold and should not be used smaller.
- **Primary hover (#C82C35):** Darken the button. The public site lightens to #E1464F on hover, and white text on that lighter red is about 4.1:1, which fails AA. This screen darkens instead.
- **Secondary (#870E40):** Links and the selected risk band. About 9.7:1 on white.
- **Secondary button (#58003A):** The public secondary button. This screen has no second action. Keep the token so a later action matches the site.
- **Heading (#330019):** Titles and field labels. The public h1 is white only because it sits on a photograph. On this white page the title uses the heading colour, which is what their h2 uses.
- **Body (#323D42):** Paragraphs, hints, and the disclaimer.
- **Surface muted (#F6F2F5):** The quote result panel and the selected choice. A blush, not a grey card.
- **Surface warm (#F6F5F3):** The disclaimer band.
- **Error surface (#FDE5DA):** The error panel fill. Message text stays #330019. #C53B00 appears on the public site but fails AA on this peach, so it is not a text colour here. The red border carries the error.
- **Border (#808184):** Resting input border only. It is about 3.9:1 on white, so it is not a text colour and not a placeholder that replaces a label.

## Typography

One family. Mulish, then Arial, then sans-serif. Weights are 400 for reading and 700 for titles, labels, and buttons. Do not introduce 500 or 600.

- **Title:** 36px / 42px, bold, heading colour. One per page.
- **Section:** 30px / 36px, bold. Used for "Quote" above the result.
- **Result figure:** 24px / 30px, bold, for the commission amount.
- **Body:** 16px / 24px. This is the public body size. Do not go below it for instructions.
- **Label and hint:** 14px / 18px. Labels are bold and burgundy. Hints and field errors are the same size. Errors are bold enough to see, in the heading colour, under the field.
- **Money:** `font-variant-numeric: tabular-nums` on amount, rate, and commission so digits do not jump when a quote arrives.

The public site offers increase and decrease font-size buttons. This screen does not. Type is in rem from a 16px root so the browser zoom and the staff member's own settings do the job.

## Layout

One column, max width 40rem, padding 24px, centered. The public article pages are a single reading column with a breadcrumb. This screen has no breadcrumb because there is nowhere else to go. A skip link, "Skip to quote form", is the first focusable control.

Stack fields by 24px. Label, then control, then hint or error, with 8px between label and control. The disclaimer sits above the button. The result panel and any alert sit 24px under the button.

On a narrow viewport the risk-band choices stack. From 40rem up they sit in a row of three equal columns with 16px gaps. The button is full width below 40rem and hugs its label above that, with at least 48px of height.

The reading order is title, one-sentence introduction, fields, the disclaimer, the button, then the result or error. Do not put the result beside the form. Staff on a branch screen should not have to hunt across a dashboard.

## Elevation & Depth

The public site is flat. Panels are a change of fill, not a shadow. Do not add drop shadows, glass, or hero gradients.

The page is white. The result is blush. The disclaimer is warm grey. The button is the only solid red mass. An invalid field is a 1px #DE313B border on the same 6px radius as a valid field.

Keyboard focus matches the public button treatment: a 3px white gap and then a 3px #DE313B ring (`box-shadow: 0 0 0 3px #FFFFFF, 0 0 0 6px #DE313B`). Show it on `:focus-visible`. The public site hides that ring while the mouse is in use. Keeping it on keyboard focus is the part worth copying. Inputs use the same ring plus their border moving from #808184 to #323D42.

## Shapes

Buttons are pills: 24px radius, which is what `.btn-primary` uses. Inputs, the result panel, the error panel, and the risk-band choices are 6px, which is what `.FormTextbox__Input` uses. Do not round the inputs into pills. The pill is reserved for the action so the submit control stays obvious.

Choice controls are real radio buttons inside the 6px tile, not a select and not a segmented control that hides the radio. The selected tile is blush with wine text and a 1px #870E40 border.

## Components

### Quote screen

The title is "Commission quote". The introduction is one sentence: staff enter the loan and the screen asks the quote service. Currency is visible as AUD. It is not a dropdown and it is not hidden, because the contract has a currency and version 1 has one row. The amount field is labelled "Loan amount", with `inputmode="decimal"` and the letters AUD beside it. The term field is "Loan term in months". Risk band is a fieldset whose legend is "Risk band", with radios Low, Medium, and High.

"Generate quote" is the primary button. While the request is in flight the label becomes "Generating quote", a spinner sits beside that label, the button is disabled, and the form sets `aria-busy`. The spinner and the generating label leave when the request succeeds or fails. The result region is a live region. On success it shows the quote id, the rate with the word "percent" so `1.50000` is not read as a fraction, and the commission at its full scale. `Intl.NumberFormat` may group digits. It must not drop fractional digits. On failure the catalog sentence goes in the error panel and `role="alert"`, and the matching field is marked invalid. The form stays filled in.

The disclaimer uses the public heading "Things you should know" and one sentence: the figure is a staff quote, not an offer to a customer.

### Fields

Labels sit above controls, in burgundy, 14px bold. The hint, when there is one, is body colour and 14px. An error replaces the hint and uses `aria-describedby`. The invalid border is #DE313B, as on the public forms. Do not rely on colour alone: the error text is there too.

### Actions and links

One primary button. A text link, wine and underlined, is the only other action, and only if we add something like "Clear". Do not make a second red button. The plum secondary button is reserved and unused on this screen.

### Result and error

The result panel is blush, 24px padding, heading "Quote", then the commission as the 24px figure and the rate and id as body text. The error panel is peach, heading-coloured text, a 1px #DE313B border, and `role="alert"`. It does not use an icon as the only signal.

## Do's and Don'ts

- Do keep 16px body text, underlined wine links, and a single red pill button.
- Do show AUD, the percent unit, and the full commission scale.
- Do put the error in text on the field and in the alert.
- Do use a skip link and a visible `:focus-visible` ring.
- Don't place white text on #E1464F, #808184, or the peach panel.
- Don't copy the logo, the icon font, or the homepage photography.
- Don't build the public mega-menu, font-size widget, carousel, or footer. This is one tool.
- Don't invent a second accent. Red, wine, and burgundy are the whole brand on this screen.
