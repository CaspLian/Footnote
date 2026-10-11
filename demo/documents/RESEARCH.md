# Research notes: hospital itemized statements and EOBs

Research done on 2026-10-11 before designing the Footnote demo documents. Every reference below was opened and
read (PDFs were rasterized and inspected page by page). The two demo documents borrow only conventions that appear
across several of these references; no single organization's layout, logo, colors or wording was copied.

## 1. Hospital patient statements and itemized bills

| # | Source | What it shows |
|---|---|---|
| H1 | UCHealth, *Understanding your UC Health statement* (annotated sample, 2020): https://www.uchealth.com/wp-content/uploads/2020/03/UCHealth_Statement_UnderstandingYourStatement_3-20.pdf | Letter portrait. Page 1: logo + QR code, statement summary box (guarantor name/number, total amount due, due date, total charges, payments/discounts, patient amount due), payment options column, payment plan and financial assistance boxes; dotted perforation; coupon with return PO box, "HOSPITAL STATEMENT ENCLOSED", "ELECTRONIC SERVICE REQUESTED", guarantor address bottom-left, card fields and "PLEASE MAKE CHECK PAYABLE TO" remit address on the right. Page 2 "STATEMENT DETAILS": per date of service, gray bands, columns Charges / Payments-Discounts / Patient Balance; totals; "PAGE 2" top right. |
| H2 | Monument Health, *How to Read Your Statement* flyer (2024): https://monument.health/wp-content/uploads/2024/11/162470-How-to-Read-Your-Statement-Flyer_FINAL.pdf | Summary box top right (Total Charges, Insurance & Adjustments, Previously Paid, AMOUNT DUE + due date), financial assistance box with phone and web, dashed line "Detach this coupon and return with your payment" + "Check if address/insurance changes are on back", coupon with card type, card number, exp date, signature, statement date, guarantor ID, due date, amount due, "show amount paid here", remit address, guarantor address in the window position, and an OCR scan line at the bottom. Page 2: Date / Description / Charge / Payments-Adjustments / Total; insurance-change form; "2 of 2" bottom right. |
| H3 | Cleveland Clinic, *Understanding Your New Cleveland Clinic Billing Statement* (2026): https://my.clevelandclinic.org/-/scassets/files/org/patients-visitors/billing/financial-assistance/general-statement-information.pdf and https://my.clevelandclinic.org/patients/billing-finance/understanding-your-bill | "Page 1 of 4" top right; account summary (Guarantor #, Statement Date, Total Charges, Insurance Pay/Adjust, Patient Pay/Adjust, Insurance Pending, Amount Due, payment due by); payment methods (online, phone, QR); "Please detach and return bottom portion with your payment"; page 2 financial assistance summary; page 3 description of charges with gray visit bars (patient account, service date, location, insurance billed) and columns Charges / Insurance Pmt/Adj / Patient Pmt/Adj / Patient Balance; written-dispute box; contact lines in Spanish and Arabic. |
| H4 | Mercy, *How to Read Your Bill*: https://www.mercy.net/content/dam/mercy/en/pdf/mercy-how-to-read-your-bill.pdf | Remittance stub version: "FOR POST OFFICE USE ONLY", card fields, statement date / due date / amount due / invoice / account boxes, "MAIL PAYMENT TO", guarantor address, long numeric scan line, dashed tear line; italic nondiscrimination sentence; "Page 1" bottom center; service details table (Date, Description, Charges, Insurance Pmts/Adjs, Patient Pmts/Adjs, Insurance Balance, Patient Balance) with "Balance Due". |
| H5 | Experian Health, *Patient Statements* product sheet with a fictional sample statement: https://www.experian.com/content/dam/marketing/na/healthcare/brochures/patient-statements.pdf | Presort endorsement line and Intelligent Mail barcode above an uppercase, unpunctuated address block; account insurance, account summary (Total Charges, Insurance Payments/Adj., Insurance Pending, Patient Payments, Current Account Balance, Amount You Owe); "Please Note: Your physician will bill separately for their professional services"; coupon with "Amount Now Due", "Amount I Am Paying", card checkboxes; remit address with barcode; OCR scan line in an OCR font at the very bottom. |
| H6 | UT Southwestern, *Reading Your Bill*: https://utswmed.org/locations/clements/william-p-clements-jr-university-hospital/patients/reading-your-bill/ | Terms: Patient's Name/Guarantor, Guarantor Account Number, Charges, Adjustments and Payments (insurer contractual adjustments included), Patient Outstanding Balance, Payment Due Now, Service Details, Statement Totals. |
| H7 | California Medical Billing Advocates, summary vs itemized bill: https://www.calmba.org/accepted-patient-instructions | A real-looking itemized ER bill: Date of svc / Rev. # / Svc Code / Diagnosis / Service / Charges; terse uppercase chargemaster descriptions ("INF THERAPY, ADDNL", "SPECIAL SUPPLIES PHYS/QHP"); light zebra shading; bold TOTAL. |
| H8 | HFMA/MGMA, *Patient Friendly Billing*: https://www.hfma.org/wp-content/uploads/2022/10/5556.pdf | A good statement is clear, correct, concise; shows billing-question hours and phone, how to request an itemized bill, clear "please pay this amount" instruction, and definitions on the back. |
| H9 | KFF Health News, *A Hospital Charged $722.50 to Push Medicine Through an IV. Twice.*: https://kffhealthnews.org/health-care-costs/surprise-bill-iv-push-hospital-unbundling/ | Real ER abdominal-pain bill: $18,735.93 total, $9,885.73 CT scan, two $722.50 IV push fees, $6,999 negotiated, $150 ER copay. Used to sanity-check chargemaster amounts (ours are deliberately mid-range). |
| H10 | Amerigroup (Wellpoint), *Itemized bill review program*: https://www.provider.wellpoint.com/docs/gpp/AGP_CARE_IBRProgram.pdf | "The emergency room level reimbursement includes all monitoring, equipment, supplies, and time and staff charges." Basis for the bundled-supply denial (CO-97). |
| H11 | 26 CFR 1.501(r)-4(b)(5): https://www.law.cornell.edu/cfr/text/26/1.501(r)-4 | Nonprofit hospitals must put "a conspicuous written notice on billing statements" about financial assistance, with the phone number of the office that helps and the direct URL for the policy, application and plain language summary. |
| H12 | 45 CFR 92.11 (Section 1557, 2024 rule): https://www.law.cornell.edu/cfr/text/45/92.11 | Notice of availability of language assistance in English and at least 15 languages, required in "communications related to the cost and payment of care ... including medical billing and collections materials" and in "Explanations of Benefits". |
| H13 | USPS Quick Service Guide 507 (ancillary service endorsements): https://pe.usps.com/cpim/ftp/manuals/qsg300/q507.pdf and #10 window position (7/8 in from left, 1/2 in from bottom, 1-1/8 x 4-1/2 in window): https://www.businessenvelopes.com/window-envelopes-the-complete-guide-for-businesses | Endorsement ("ELECTRONIC SERVICE REQUESTED" etc.) goes directly below the return address; address block must sit inside the envelope window. |

Tagline wording (HHS sample taglines, as reproduced verbatim by many covered entities): checked against
https://www.dmas.virginia.gov/media/xvrb21qo/language-taglines-for-dmas-website-5-2024_revised.pdf,
https://www.tn.gov/content/dam/tn/tenncare/documents/foreignlanguageassistance.pdf and two HTML copies
(https://www.hopehealthco.org/language-assistance/, https://schuylkillendoscopy.com/notice-of-nondiscrimination/).
The HHS Arabic sample literally contains the placeholder "اذكر اللغة" ("name the language"); our Arabic line names
Arabic instead.

### Statement conventions we follow

- **Page and grid.** US Letter portrait, 0.5 in side margins, 0.45-0.5 in top/bottom, nothing printed closer than
  0.3 in to an edge (desktop-printer safe). Two-column top section; 4 pt spacing rhythm.
- **Section order, page 1.** Logo + return address top left; document title, statement date and "Page 1 of 3" top
  right; account information (guarantor, guarantor account no., patient, hospital account no., service date, visit
  type, insurance); amount-due box and account summary on the right (Total charges - Insurance payments -
  Insurance adjustments - Patient payments = Balance due); ways to pay (online, phone, mail, in person); questions
  and hours; conspicuous financial assistance notice with phone and URL (H11); physicians bill separately (H5).
- **Coupon.** Bottom third of page 1 below a dashed perforation at 7.33 in (tri-fold), headed "Please detach and
  return the lower portion with your payment". Left: return PO box + "ELECTRONIC SERVICE REQUESTED" (upper envelope
  window), presort line, IMb, guarantor address in uppercase without punctuation (lower window). Right: statement
  date / guarantor account / due date, amount due, "amount enclosed" box, card checkboxes, card number, exp. date,
  signature, address-change checkbox, "Make checks payable to" remit address (return-envelope window). OCR-A scan
  line (account no. + amount in cents + mod-10 check digit) along the bottom edge (H2, H4, H5).
- **Itemized detail (page 2).** Running header repeats logo, guarantor account, statement date, page x of y. Gray
  visit band (patient, hospital account, service date, patient type, insurance). Columns in this order: Service
  date, Rev code, CPT/HCPCS, Description, Units, Charges (H7, mediloop/Ohio Medicaid field definitions). Terse
  uppercase chargemaster descriptions with the "HC" (hospital charge) prefix. Lines sorted by revenue code, as on a
  UB-04 claim. Total charges row, then a payments-and-adjustments table and the balance due.
- **Back matter (page 3).** Financial assistance plain language summary (eligibility, AGB limit, how to apply,
  240-day application window), billing questions, written disputes, payment plans, itemized statements,
  address/insurance change form, nondiscrimination notice and the multi-language notice of availability (H12).
- **Typography.** Arial/Helvetica (the default of statement print vendors, H2-H5), 8.5 pt body, 8.5 pt table text,
  7-7.5 pt legal text, bold uppercase letter-spaced section labels, 18-20 pt bold amount due. Address block and
  presort line in uppercase. OCR scan line in OCR-A. Digits are tabular; money right-aligned with two decimals;
  credits shown with a leading minus.
- **Color and rules.** One brand color (navy) plus black; light gray fills for header rows and boxes, 0.5-0.75 pt
  rules, square corners, no gradients. Everything stays legible in grayscale.

## 2. Explanations of Benefits (EOBs)

| # | Source | What it shows |
|---|---|---|
| E1 | CMS Coverage to Care, *Reading your Explanation of Benefits (EOB)* (Pub. 11819, 2022): https://www.cms.gov/files/document/11819-sample-explanation-benefits-508.pdf | Header: "EXPLANATION OF BENEFITS", customer service number, statement date, document number, "THIS IS NOT A BILL", subscriber number, ID, group, group number, member name and address. Claim box: patient name, date received, provider, payee, claim number, date paid. Table: Line No., Date of Service, Service Description, Claim Status, Provider Charges, Allowed Charges, Co Pay, Deductible, Coinsurance, Paid by Insurer, What You Owe, Remark Code, with group headers "What your Provider Can Charge You", "Your Responsibility", "Total Claim Cost"; totals row; remark code text under the table. |
| E2 | Aetna sample EOB (CS01125, 2016): https://member.aetna.com/memberSecure/assets/pdfs/CS01125_final.pdf | Return address + barcode, member address in window, statement date / member / member ID / group, "Explanation of Benefits (EOB) - This is not a bill", summary boxes (you owe, you saved, deductible remaining with bar), key-terms table with totals, payment summary, "Your claims up close" with lettered columns (Amount billed, Member rate, Pending or not payable (Remarks), Applied to deductible, Copay, Amount remaining, Plan pays, Coinsurance, You may owe), benefit balances table (annual limit, used, remaining). |
| E3 | UMR (UnitedHealthcare), *Understanding your EOB, as easy as 1-2-3* (2024): https://www.umr.com/print/UM0088N.pdf | Cost summary table (Amount billed, Your discount, Your plan paid, You saved, TOTAL YOU MAY OWE with explanations); deductible/out-of-pocket bars ("$X out of $Y", "$Z to go"); claim table with "PLAN PAYS" and "YOU PAY" group headers: Service(s), Reason code, Service date(s), Amount billed, Your discount, Not allowed, Amount due to provider, %, Plan paid, Co-pay, Applied to deductible, Co-insurance, Not covered, Total you may owe; "Reason code explanations" box ("Provider negotiated discount. You are not responsible for this amount"). |
| E4 | Meritain Health (Aetna company) sample EOB: https://www.woodcountyohio.gov/DocumentCenter/View/1729/Meritain-How-to-Read-Your-Explanation-of-Benefits-PDF | "RETAIN FOR TAX PURPOSES / THIS IS NOT A BILL", forwarding endorsement, IMb, customer service box, procedure/revenue code column, provider discount, ineligible amount, reason code, deductible, copay, paid at %, accumulators, payment details (paid to, check #, amount), reason code descriptions, appeal procedures, "You Should Know" box with Spanish, Tagalog, Chinese and Navajo taglines. |
| E5 | Highmark sample (Lehigh County HR guide): https://www.lehighcounty.org/Portals/0/Intranet/PDF/HR/How%20to%20read%20an%20EOB.pdf | "Explanation at a glance" box (dates of service, check sent to, claim payment amount, provider may bill you); member responsibility table (Provider charges, Our allowance, Your deductible, Amount remaining, Health plan pays at, Health plan pays, Your share, Amount you owe provider); remarks. |
| E6 | Operating Engineers Local 49 / Health49, *How To Read Your EOB*: https://health49.org/wp-content/uploads/2021/09/How_to_Read_Your_EOB.pdf | Customer service box top right; claim number; Service Dates, Description, Total Charge, Provider Resp, Ineligible Amount, Remark Code, Allowed Amount, Deductible, Co-Pay, Co-Ins; claim summary; deductible calculation; comments; appeal information on the back. |
| E7 | CMS sample Part A Medicare Summary Notice: https://www.cms.gov/medicare/medicare-general-information/msn/downloads/sample-part-a-medicare-summary-notice.pdf | Running header on every page: patient name left, "THIS IS NOT A BILL \| Page 3 of 4" right; dashboard page; notes lettered A, B under each claim; last page "How to Handle Denied Claims or File an Appeal" with a fill-in appeal form and the appeal deadline. |
| E8 | UnitedHealthcare, *Understanding your medical EOB* (Medicare Advantage): https://uhg7-prod.adobecqms.net/content/dam/UCP/Individual/How_to_read_Medical_EOB.pdf | Totals chart (amount billed, total cost approved, plan's share, your share) and per-provider monthly details. |
| E9 | New Hampshire Insurance Department, *How do I read an Explanation of Benefits (EOB)?*: https://nhhealthcost.nh.gov/guide/question/how-do-i-read-explanation-benefits-eob | State regulator's definitions (provider charges, allowed charges, paid by insurer, payee, what you owe, remark code); "wait to receive a bill from your provider"; payments made to the provider may not be subtracted. |
| E10 | CMS *Model Notice of Adverse Benefit Determination* (rev. 11/21/2025): https://www.cms.gov/cciio/resources/files/downloads/abd_model_notice_2.pdf | Case details columns (Amt. Charged, Allowed Amt., Other Insurance, Deductible, Co-pay, Coinsurance, Other Amts. Not Covered, Amt. Paid), YTD credit toward deductible and out-of-pocket, denial codes; appeal-rights Q&A (help understanding, how to file, urgent situations, who may file, additional information, copies free of charge including billing and diagnosis codes, what happens next, other resources); language lines for Spanish, Tagalog, Chinese, Navajo. |
| E11 | 29 CFR 2590.715-2719(b)(2)(ii)(E) and (e): https://www.law.cornell.edu/cfr/text/29/2590.715-2719 | A denial notice must identify the claim (date of service, provider, claim amount), state that diagnosis and treatment codes are available on request, give the denial code and its meaning, describe internal appeal and external review, and give consumer-assistance contacts; non-English statements on how to get help. |
| E12 | X12 Claim Adjustment Reason Codes: https://x12.org/codes/claim-adjustment-reason-codes | CARC 1 "Deductible Amount", 2 "Coinsurance Amount", 3 "Co-payment Amount", 18 "Exact duplicate claim/service (Use only with Group Code OA except where state workers' compensation regulations requires CO)", 45 "Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement", 97 "The benefit for this service is included in the payment/allowance for another service/procedure that has already been adjudicated"; group codes CO, OA, PR. |
| E13 | HealthCare.gov, *External review*: https://www.healthcare.gov/appeal-insurance-company-decision/external-review/ | External review must be requested within 4 months; standard decision within 45 days, expedited within 72 hours. |

### EOB conventions we follow

- **Header.** Insurer logo and return address top left, endorsement line, IMb, member address in the window
  position; document title, statement date and page number top right; "THIS IS NOT A BILL" in bold capitals
  next to the title (E1, E2, E4, E6, E7).
- **Member box.** Member name, member ID, group number, plan name, member services phone with TTY and hours,
  website (E1, E2, E4).
- **Page 1 summary.** A plain table of the claim totals with one-line explanations (E3), plan-year deductible and
  out-of-pocket progress as "applied / annual / remaining" with a thin bar (E2, E3, E10).
- **Claim detail (page 2).** Claim header band: patient, claim number, provider and network status, provider's
  patient account number, dates of service, date received, date processed. Per-line table in this order:
  Service (description, date, code), Amount billed, Plan discount, Not covered, Allowed amount, Deductible,
  Copay, Coinsurance, Plan paid, You owe, Codes; group headers over the money columns (E1, E3, E10); totals row.
  A code table under it with each code's meaning and who pays (E3, E4, E12). Payment details (paid to, method,
  date, trace number) (E4).
- **Codes.** Standard X12 group + reason codes printed as GROUP-REASON (CO-45, PR-1, PR-2, PR-3, CO-97). The
  duplicate line is printed as **OA-18**, not CO-18: X12 restricts CARC 18 to group OA (E12). The teaching point is
  unchanged: the duplicate is not the patient's responsibility.
- **Rights page (page 3).** Appeal rights in the CMS model Q&A order (E10), 180-day internal appeal window, urgent
  appeals, external review timing (E13), free copies of claim documents and codes (E11), fraud line,
  nondiscrimination notice, and the multi-language notice of availability including Navajo (E4, E10, H12).
- **Running header on pages 2-3:** member name, member ID, "THIS IS NOT A BILL", page x of y (E7).
- **Typography.** A humanist sans (Source Sans 3, bundled, SIL OFL) to distinguish the insurer from the
  hospital; 9 pt body, 8 pt table text, 7-7.5 pt legal text; tabular figures, right-aligned money, column group
  headers; one brand color (dark green) plus black; gray header rows; square corners.

## 3. Fictional names and how they were checked (web searches on 2026-10-11)

| Name used | Searches | Result |
|---|---|---|
| Linnet Valley Medical Center (hospital) | `"Linnet Valley" hospital OR medical OR health`; `"Linnet" health system OR hospital OR "medical center" OR clinic` | No hospital, health system, clinic or plan uses "Linnet". Nearest real names (Linton Regional Medical Center ND, Linn Health & Rehabilitation RI, Lincoln Medical Center NY) are not close. |
| Pellridge Health Plan (insurer) and Pellridge Preferred PPO 1500 (plan) | `"Pellridge" health OR insurance OR plan`; `"Pellridge Health" OR "Pellridge Health Plan" OR "Pellridge Insurance"` | No insurer, plan or health company. Only a fantasy-town generator and a game building use the word. |
| Brayford, OH (hospital town) | `"Brayford, Ohio" OR "Brayford, OH"` | No such town (a Brayford Dr exists in Westerville; Brayford is a village in Devon, England). |
| Merrowfield, OH (insurer town) | `"Merrowfield" OR "Tamsin Falls" Ohio town` | No such town. |
| Rejected candidates | Wrenfield (near Warrenfield Medical Center, Dearborn MI), Corvane (near CorVel), Larkspire (near Lark Health), Wexmoor (a real Columbus neighborhood), Halverton (real companies) | Not used. |

Other identifiers: phone numbers use (614) 555-0100 to 555-0199 only; TTY is the national relay number 711; web
addresses use the reserved `.example` top-level domain; no NPI, tax ID, SSN or date of birth is printed; member,
group, account, claim and trace numbers are invented. The patient name is a made-up common name.

## 4. Decisions that differ from the brief

1. **OA-18 instead of CO-18** for the duplicate line, because X12 says CARC 18 is used only with group code OA
   (E12). Nothing else about the story changes.
2. **No imaging line has a doctor's-part-only reference.** In `backend/data/cpt_benchmarks.csv` every common
   emergency imaging code is a `non-facility` (global) row: 74177 $300.27, 74176 $183.04, 70450 $106.55, 71046
   $33.07, 76705 $86.17. The only `facility` imaging rows are 70010 and 77469, which do not fit an ER visit. The
   doctor's-part case is therefore carried by the ER facility level line, 99284, whose CSV row is `facility`
   ($118.24), which is exactly when the app says "clarify the doctor's fee". The CT line (74177) is one of the
   far-above-reference lines instead.

## 5. Independent review references (2026-10-11)

A second reviewer compared the finished documents with these public references, chosen to differ from sections 1
and 2 (R11 re-checks E12). Every PDF was downloaded and rasterized; the web pages were read.

| # | Source | What it adds |
|---|---|---|
| R1 | Children's Hospital Colorado, sample billing statement (June 2024): https://www.childrenscolorado.org/globalassets/your-visit/billing-statement.pdf | Guarantor number, responsible party, statement date and "Page x of 5" repeated on every page; bottom coupon ("Detach the bottom portion to return with your payment"), amount enclosed box, address-change checkbox, long numeric scan line; pages 3 to 5 are a surprise-billing disclosure and the patient's discounted-care rights. |
| R2 | Regions Hospital (HealthPartners), *Keys to Understanding Your Regions Hospital Statement*: https://www.healthpartners.com/ucm/groups/public/@hp/@public/documents/documents/dev_005204.pdf | Header band (guarantor name and number, statement date, payment due date, payment due), pay / payment plan / financial assistance blocks, card checkboxes, coupon (due date, pay this amount, guarantor #), remit address, OCR line; account aging (0-30, 31-60, 61-90, over 90 days); statement details by date of service. |
| R3 | Salem Health, statement insert (06/12/24): https://www.salemhealth.org/docs/default-source/patient-financial-services/statement-insert_sh.pdf | Epic-style statement: summary (total charges, total payments and adjustments, total patient balance), amount due, "Keep this portion for your records / Detach this portion and return with your payment", detail lines by revenue-code description with payment and adjustment lines. |
| R4 | UMass Memorial Health, *Easier to Read Statement* (2021): https://www.ummhealth.org/sites/default/files/Documents/Patients_Visitors/howToReadYourStatement.pdf | Guarantor summary and insurance block (primary insurance, subscriber, subscriber ID); sections per service type with Date(s) of service, Description, Charges, Patient payments/adj, Insurance payments/adj, Insurance pending, Your responsibility; tear-off stub with QR code and "show amount paid"; OCR line. |
| R5 | UCHealth, sample hospital statement and explanation (09/2021): https://uchealth-wp-uploads.s3.amazonaws.com/wp-content/uploads/2021/09/29124237/UCHealth-Sample-Hospital-Statement-and-Explanation-092921.pdf | Account aging table; "payments are posted to the oldest open balance"; past-due and collections paragraph; address and insurance update form; a note not to write the card number on the coupon. |
| R6 | Cigna, *Guide to your Explanation of Benefits* (832701 d 09/15): https://www.cigna.com/static/www-cigna-com/docs/846894-eob-v1.pdf | Summary (amount billed, discount, amount not covered, what the plan paid, what I owe, you saved %); claim detail columns (service dates, type of service, amount billed, discount, amount not covered, covered amount, copay/deductible, what the plan paid, % paid, coinsurance, see notes); deductible and out-of-pocket "for my next claim"; state insurance department paragraph; lettered notes. |
| R7 | Anthem Blue Cross, *Explanation of Benefits (EOB) Reference Guide* (rev. 1/11), as posted by CVT: https://www.cvtrust.org/sites/default/files/media/downloads/EOB_Explanation.pdf | Issue date and page box; subscriber name, identification number, group number and **group name**; patient, claim number, claim processed, provider of services, place of service (Emergency Room), patient account number; "It is / is not your responsibility to pay"; columns service dates, type of service, total billed, amount not allowed, patient savings, applied to deductible, coinsurance/copayment, claims payment; numbered detail messages; "We suggest that you retain this copy for your income tax records"; THIS IS NOT A BILL. |
| R8 | Anthem Blue Cross, *How to read your EOB* (10/15), as posted by CVT: https://www.cvtrust.org/sites/default/files/media/downloads/EOB%20Flyer%20updated.pdf | The same fields, plus member and family deductible to date and the customer-service block. |
| R9 | Blue Shield of California, *How to read an EOB*: https://www.blueshieldca.com/en/home/help-and-support/how-to-read-eob | Claims at a glance (patient responsibility, plan responsibility, network savings, amount billed, deductible status); detail (provider, preferred provider yes/no, service date, type of service and code, amount billed, amount allowed, amount we paid, not covered, deductible, copayment/coinsurance, notes). |
| R10 | CMS, *Model Disclosure Notice Regarding Patient Protections Against Surprise Billing* (OMB 0938-1401, exp. 12/31/2028): https://www.cms.gov/files/document/model-disclosure-notice-patient-protections-against-surprise-billing-providers-facilities-health.pdf | Plans and issuers must "include on each explanation of benefits" for items or services subject to PHS Act 2799A-1 (emergency services, among others) plain-language information on balance-billing protections; providers and facilities must give their notice no later than when they request payment. Model wording: "When you get emergency care or are treated by an out-of-network provider at an in-network hospital or ambulatory surgical center, you are protected from balance billing." |
| R11 | X12 Claim Adjustment Reason Codes, re-checked: https://x12.org/codes/claim-adjustment-reason-codes | CARC 18 "Exact duplicate claim/service (Use only with Group Code OA except where state workers' compensation regulations requires CO)"; CARC 45 "Use only with Group Codes PR or CO depending upon liability"; CARC 97 as quoted in E12. |

Names added in the review and their checks: "Quillmere" (the EOB's employer group name, Quillmere Fabrication
Co.): no company, plan or brand found; "Wellridge" and "Bellridge" (one letter from Pellridge): no health plan,
insurer or healthcare company found; "Cottonwood Run" in ZIP 43066: no such street.
